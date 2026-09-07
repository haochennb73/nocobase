/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { WSClient } from '@wecom/aibot-node-sdk';
import type { BaseMessage, EventMessage, WsFrame } from '@wecom/aibot-node-sdk';
import type { Model } from '@nocobase/database';
import { COLLECTIONS, CONN_STATUS, KICK_DISCONNECT_MESSAGE } from '../../constants';
import type { ServiceContext } from './context';

export interface BotRuntime {
  client: WSClient;
  startedAt: number;
  /**
   * Set when the WeCom server pushes `disconnected_event` (another connection subscribed
   * with the same Bot ID). The SDK never reconnects after a kick, so the following
   * `disconnected` event is terminal and must be persisted as `error`, not `reconnecting`.
   */
  kicked?: boolean;
}

export interface ConnectionManagerDeps {
  ctx: ServiceContext;
  /** Resolve the decrypted long-connection secret for a bot record id. */
  getDecryptedSecret: (botDbId: number) => Promise<string | null>;
}

/**
 * Manages one WSClient per enabled bot.
 *
 * WeCom allows exactly ONE live long connection per bot (a newer subscribe kicks the
 * older connection), therefore one NocoBase instance owns the connection exclusively
 * for each configured bot. Lifecycle follows the app: started on `afterStart`,
 * stopped on `beforeStop` / plugin disable.
 */
export class ConnectionManager {
  private runtimes = new Map<number, BotRuntime>();

  /** In-flight start promises keyed by bot db id — prevents two concurrent start() calls
   * from creating two WSClient instances for the same bot (which would kick each other). */
  private inflightStarts = new Map<number, Promise<void>>();

  constructor(private deps: ConnectionManagerDeps) {}

  private get db() {
    return this.deps.ctx.db;
  }

  private get logger() {
    return this.deps.ctx.logger;
  }

  private get botRepo() {
    return this.db.getRepository(COLLECTIONS.bots);
  }

  /** Connect every enabled bot. Called on app start. */
  async startAll(): Promise<void> {
    const bots = await this.botRepo.find({ filter: { enabled: true } });
    for (const bot of bots) {
      await this.start(bot).catch((err) => {
        this.logger.error(`[wecom-aibot] failed to start bot ${bot.get('botId')}: ${err?.message}`);
      });
    }
  }

  async start(bot: Model): Promise<void> {
    const botDbId = Number(bot.get('id'));
    if (this.runtimes.has(botDbId)) {
      return;
    }
    // Serialize concurrent start() calls: the original implementation only registered the
    // runtime after several awaits, so overlapping calls (e.g. clicking Connect while the
    // app-start connection was still handshaking) could open two connections for one bot.
    const pending = this.inflightStarts.get(botDbId);
    if (pending) {
      return pending;
    }
    const task = this.doStart(botDbId, bot).finally(() => {
      this.inflightStarts.delete(botDbId);
    });
    this.inflightStarts.set(botDbId, task);
    return task;
  }

  private async doStart(botDbId: number, bot: Model): Promise<void> {
    if (this.runtimes.has(botDbId)) {
      return;
    }

    const secret = await this.deps.getDecryptedSecret(botDbId);
    if (!secret) {
      await this.updateStatus(botDbId, CONN_STATUS.error, 'secret is empty');
      return;
    }

    const botId = String(bot.get('botId'));
    await this.updateStatus(botDbId, CONN_STATUS.connecting);

    const client = new WSClient({
      botId,
      secret,
      // Keep reconnecting forever; transient network drops must not disable the bot.
      maxReconnectAttempts: -1,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
    });

    this.bindEvents(botDbId, client);
    this.runtimes.set(botDbId, { client, startedAt: Date.now() });

    try {
      client.connect();
    } catch (err) {
      this.runtimes.delete(botDbId);
      await this.updateStatus(botDbId, CONN_STATUS.error, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async stop(botDbId: number): Promise<void> {
    const runtime = this.runtimes.get(botDbId);
    if (!runtime) {
      await this.updateStatus(botDbId, CONN_STATUS.disconnected);
      return;
    }
    this.runtimes.delete(botDbId);
    try {
      runtime.client.disconnect();
    } catch (err) {
      this.logger.warn(
        `[wecom-aibot] error while disconnecting bot#${botDbId}: ${err instanceof Error ? err.message : err}`,
      );
    }
    await this.updateStatus(botDbId, CONN_STATUS.disconnected);
  }

  async stopAll(): Promise<void> {
    const ids = Array.from(this.runtimes.keys());
    for (const id of ids) {
      await this.stop(id);
    }
  }

  /** Used after the bot configuration (e.g. secret) changed. */
  async restart(botDbId: number): Promise<void> {
    await this.stop(botDbId);
    const bot = await this.botRepo.findOne({ filterByTk: botDbId });
    if (!bot || !bot.get('enabled')) {
      return;
    }
    await this.start(bot);
  }

  getClient(botDbId: number): WSClient | undefined {
    return this.runtimes.get(botDbId)?.client;
  }

  isRunning(botDbId: number): boolean {
    return this.runtimes.has(botDbId);
  }

  private bindEvents(botDbId: number, client: WSClient): void {
    client.on('authenticated', async () => {
      await this.updateStatus(botDbId, CONN_STATUS.connected, undefined, true);
    });

    client.on('disconnected', async (reason: string) => {
      const runtime = this.runtimes.get(botDbId);
      if (!runtime) {
        // Manual stop(): the runtime was already removed and stop() persisted `disconnected`.
        return;
      }
      if (runtime.kicked) {
        // Server kick (`disconnected_event`): the SDK sets isManualClose internally and never
        // reconnects — treat it as terminal, drop the dead client and surface a hard error
        // instead of a misleading, permanently frozen "reconnecting" status.
        this.runtimes.delete(botDbId);
        this.logger.warn(`[wecom-aibot] bot#${botDbId} was kicked by a newer connection of the same Bot ID`);
        await this.updateStatus(botDbId, CONN_STATUS.error, KICK_DISCONNECT_MESSAGE);
        return;
      }
      // Transient close (network drop, heartbeat timeout): the SDK schedules its own
      // reconnect right after this event; surface the reason for diagnostics.
      await this.updateStatus(botDbId, CONN_STATUS.reconnecting, reason);
    });

    client.on('reconnecting', async (attempt: number) => {
      await this.updateStatus(botDbId, CONN_STATUS.reconnecting, `reconnecting attempt ${attempt}`);
    });

    client.on('error', async (err: Error) => {
      this.logger.error(`[wecom-aibot] bot#${botDbId} connection error: ${err?.message}`);
      await this.updateStatus(botDbId, CONN_STATUS.error, err?.message);
    });

    client.on('message', async (frame: WsFrame<BaseMessage>) => {
      try {
        await this.deps.ctx.inbound?.handleMessage(botDbId, frame);
      } catch (err) {
        this.logger.error(
          `[wecom-aibot] inbound handling failed (bot#${botDbId}): ${err instanceof Error ? err.message : err}`,
        );
      }
    });

    client.on('event', async (frame: WsFrame<EventMessage>) => {
      // Intercept the kick notification before any async work: the SDK emits
      // `disconnected` synchronously right after dispatching this frame, so the flag
      // must be set in the same tick for the handler above to see it.
      if (frame.body?.event?.eventtype === 'disconnected_event') {
        const runtime = this.runtimes.get(botDbId);
        if (runtime) {
          runtime.kicked = true;
        }
        return;
      }
      try {
        await this.deps.ctx.inbound?.handleEvent(botDbId, frame);
      } catch (err) {
        this.logger.error(
          `[wecom-aibot] event handling failed (bot#${botDbId}): ${err instanceof Error ? err.message : err}`,
        );
      }
    });
  }

  private async updateStatus(
    botDbId: number,
    connStatus: string,
    lastError?: string,
    connectedNow = false,
  ): Promise<void> {
    try {
      const values: Record<string, unknown> = { connStatus };
      if (lastError !== undefined) {
        values.lastError = lastError;
      }
      if (connectedNow) {
        values.lastConnectedAt = new Date();
        values.lastError = null;
      }
      await this.botRepo.update({ filterByTk: botDbId, values });
    } catch (err) {
      this.logger.warn(
        `[wecom-aibot] failed to persist connStatus for bot#${botDbId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

export default ConnectionManager;
