/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/server';
import { COLLECTIONS } from '../constants';
import { AggregationManager } from './services/aggregation';
import { ConnectionManager } from './services/connection-manager';
import type { PluginLogger, ServiceContext } from './services/context';
import { HistoryService } from './services/history';
import { InboundService } from './services/inbound';
import { OutboundService } from './services/outbound';

const SECRET_MASK = '********';

interface ActionParams {
  filterByTk?: number | string;
  values?: Record<string, unknown>;
}

export class PluginWecomAibotServer extends Plugin {
  private services!: ServiceContext;

  async beforeLoad() {}

  async load() {
    const ctx: ServiceContext = {
      db: this.app.db,
      logger: this.app.logger as PluginLogger,
    };
    ctx.inbound = new InboundService(ctx);
    ctx.history = new HistoryService(this.app.db);
    ctx.connectionManager = new ConnectionManager({
      ctx,
      getDecryptedSecret: (botDbId) => this.getDecryptedSecret(botDbId),
    });
    ctx.outbound = new OutboundService(ctx);
    ctx.aggregation = new AggregationManager((window) => {
      const inbound = this.services.inbound;
      if (!inbound) {
        return Promise.resolve();
      }
      return inbound.flushWindow(window);
    });
    this.services = ctx;

    this.registerSendHook();
    this.registerSecretMiddleware();
    this.registerResources();
    this.setPermissions();

    this.app.on('afterStart', async () => {
      try {
        // Persistence fallback for messages that were stored but never batched
        // before the previous shutdown (in-memory windows are lost on restart).
        await ctx.inbound?.recoverOrphanMessages();
        await ctx.connectionManager?.startAll();
      } catch (err) {
        this.app.logger.error(`[wecom-aibot] startup failed: ${err instanceof Error ? err.message : err}`);
      }
    });

    this.app.on('beforeStop', async () => {
      // Close open aggregation windows first so no burst is lost, then let the
      // outbound queue drain and finally drop the long connections.
      await ctx.aggregation?.flushAll();
      await ctx.outbound?.drain();
      await ctx.connectionManager?.stopAll();
    });
  }

  async install() {}

  async afterEnable() {
    // Runtime enable: collections already exist, connect the enabled bots now.
    await this.services?.connectionManager?.startAll();
  }

  async afterDisable() {
    await this.services?.aggregation?.flushAll();
    await this.services?.outbound?.drain();
    await this.services?.connectionManager?.stopAll();
  }

  async remove() {}

  /** Feed every fresh `pending` send record into the outbound queue after commit. */
  private registerSendHook(): void {
    const SendModel = this.app.db.getModel(COLLECTIONS.sendMessages);
    SendModel.afterSave((model, options) => {
      const outbound = this.services.outbound;
      if (!outbound) {
        return;
      }
      const run = () => {
        outbound.enqueue(model).catch((err) => {
          this.app.logger.error(`[wecom-aibot] enqueue failed: ${err instanceof Error ? err.message : err}`);
        });
      };
      const transaction = options?.transaction;
      if (transaction && typeof transaction.afterCommit === 'function') {
        transaction.afterCommit(run);
      } else {
        run();
      }
    });
  }

  /**
   * Secret handling for `RC01_wecom_bots` (design 03 §7):
   * - create: secret is required and stored AES-encrypted via the built-in app.aesEncryptor;
   * - update: empty/masked secret means "keep unchanged", otherwise re-encrypt;
   * - get/list responses: the secret value is always masked.
   */
  private registerSecretMiddleware(): void {
    this.app.resourcer.use(
      async (ctx, next) => {
        const { resourceName, actionName } = ctx.action;

        if (resourceName === COLLECTIONS.bots && (actionName === 'create' || actionName === 'update')) {
          const params = ctx.action.params as ActionParams;
          const values = params.values;
          if (values && 'secret' in values) {
            if (actionName === 'create') {
              if (!values.secret) {
                ctx.throw(400, 'secret is required');
              }
              values.secret = await this.app.aesEncryptor.encrypt(String(values.secret));
            } else if (!values.secret || values.secret === SECRET_MASK) {
              delete values.secret;
            } else {
              values.secret = await this.app.aesEncryptor.encrypt(String(values.secret));
            }
          } else if (actionName === 'create') {
            ctx.throw(400, 'secret is required');
          }
        }

        await next();

        if (resourceName === COLLECTIONS.bots && (actionName === 'get' || actionName === 'list')) {
          const body = ctx.body as { data?: unknown } | undefined;
          const data = body?.data;
          if (Array.isArray(data)) {
            data.forEach((record) => maskSecret(record));
          } else if (data && typeof data === 'object') {
            maskSecret(data);
          }
        }
      },
      { group: 'wecomAibotSecret', before: 'acl', after: 'auth' },
    );
  }

  private registerResources(): void {
    // Connection test: subscribes a throw-away long connection and closes it.
    // NOTE: WeCom kicks any other live connection of the same botId (design G6).
    this.app.resourceManager.registerActionHandler(`${COLLECTIONS.bots}:test`, async (ctx, next) => {
      const params = ctx.action.params as ActionParams;
      const values = params.values || {};
      let botId = values.botId ? String(values.botId) : '';
      let secret = values.secret ? String(values.secret) : '';

      if (params.filterByTk) {
        const bot = await this.app.db.getRepository(COLLECTIONS.bots).findOne({ filterByTk: params.filterByTk });
        if (!bot) {
          ctx.throw(404, 'bot not found');
        }
        botId = botId || String(bot.get('botId') || '');
        secret = secret || ((await this.getDecryptedSecret(Number(bot.get('id')))) ?? '');
      }

      if (!botId || !secret) {
        ctx.throw(400, 'botId and secret are required');
      }
      ctx.body = await this.services.connectionManager?.testConnection(botId, secret);
      await next();
    });

    this.app.resourceManager.registerActionHandler(`${COLLECTIONS.bots}:start`, async (ctx, next) => {
      const params = ctx.action.params as ActionParams;
      const repo = this.app.db.getRepository(COLLECTIONS.bots);
      const bot = await repo.findOne({ filterByTk: params.filterByTk });
      if (!bot) {
        ctx.throw(404, 'bot not found');
      }
      const botDbId = Number(bot.get('id'));
      await repo.update({ filterByTk: botDbId, values: { enabled: true } });
      try {
        await this.services.connectionManager?.start(bot);
        ctx.body = { ok: true };
      } catch (err) {
        ctx.body = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      await next();
    });

    this.app.resourceManager.registerActionHandler(`${COLLECTIONS.bots}:stop`, async (ctx, next) => {
      const params = ctx.action.params as ActionParams;
      const repo = this.app.db.getRepository(COLLECTIONS.bots);
      const bot = await repo.findOne({ filterByTk: params.filterByTk });
      if (!bot) {
        ctx.throw(404, 'bot not found');
      }
      const botDbId = Number(bot.get('id'));
      await this.services.connectionManager?.stop(botDbId);
      await repo.update({ filterByTk: botDbId, values: { enabled: false } });
      ctx.body = { ok: true };
      await next();
    });

    this.app.resourceManager.registerActionHandler(`${COLLECTIONS.sendMessages}:resend`, async (ctx, next) => {
      const params = ctx.action.params as ActionParams;
      if (!params.filterByTk) {
        ctx.throw(400, 'filterByTk is required');
      }
      await this.services.outbound?.resend(Number(params.filterByTk));
      ctx.body = { ok: true };
      await next();
    });

    // Aggregated list of WeCom userids that never matched a NocoBase user,
    // feeding the settings page "Unbound users" tab.
    this.app.resourceManager.define({
      name: 'wecomAibot',
      actions: {
        unboundUsers: async (ctx, next) => {
          ctx.body = await this.listUnboundUsers();
          await next();
        },
      },
    });
  }

  private setPermissions(): void {
    this.app.acl.registerSnippet({
      name: `pm.${this.name}.bots`,
      actions: [
        `${COLLECTIONS.bots}:create`,
        `${COLLECTIONS.bots}:update`,
        `${COLLECTIONS.bots}:destroy`,
        `${COLLECTIONS.bots}:test`,
        `${COLLECTIONS.bots}:start`,
        `${COLLECTIONS.bots}:stop`,
      ],
    });
    this.app.acl.registerSnippet({
      name: `pm.${this.name}.view`,
      actions: [
        `${COLLECTIONS.conversations}:list`,
        `${COLLECTIONS.conversations}:get`,
        `${COLLECTIONS.receivedMessages}:list`,
        `${COLLECTIONS.receivedMessages}:get`,
        `${COLLECTIONS.processTasks}:list`,
        `${COLLECTIONS.processTasks}:get`,
        `${COLLECTIONS.sendMessages}:list`,
        `${COLLECTIONS.sendMessages}:get`,
        `${COLLECTIONS.sendMessages}:resend`,
        'wecomAibot:unboundUsers',
      ],
    });

    this.app.acl.allow(COLLECTIONS.bots, ['list', 'get'], 'loggedIn');
    this.app.acl.allow(COLLECTIONS.conversations, ['list', 'get'], 'loggedIn');
    this.app.acl.allow(COLLECTIONS.receivedMessages, ['list', 'get'], 'loggedIn');
    this.app.acl.allow(COLLECTIONS.processTasks, ['list', 'get'], 'loggedIn');
    this.app.acl.allow(COLLECTIONS.sendMessages, ['list', 'get'], 'loggedIn');
  }

  private async listUnboundUsers(): Promise<
    Array<{ fromUserId: string; messageCount: number; lastMessageAt: string | null; botIds: number[] }>
  > {
    const db = this.app.db;
    const receivedRepo = db.getRepository(COLLECTIONS.receivedMessages);
    const records = await receivedRepo.find({
      filter: { userId: null, fromUserId: { $notEmpty: true } },
      // NOTE: `fields`, not `attributes` — `attributes` silently drops the filter.
      fields: ['fromUserId', 'receivedAt', 'botId'],
      sort: ['-receivedAt'],
      limit: 5000,
    });
    if (!records.length) {
      return [];
    }

    const boundUsers = await db.getRepository('users').find({
      filter: { wecomUserId: { $notEmpty: true } },
      fields: ['wecomUserId'],
    });
    const bound = new Set(boundUsers.map((user) => String(user.get('wecomUserId'))));

    const grouped = new Map<string, { messageCount: number; lastMessageAt: string | null; botIds: Set<number> }>();
    for (const record of records) {
      const fromUserId = String(record.get('fromUserId'));
      if (bound.has(fromUserId)) {
        continue;
      }
      let entry = grouped.get(fromUserId);
      if (!entry) {
        entry = { messageCount: 0, lastMessageAt: null, botIds: new Set() };
        grouped.set(fromUserId, entry);
      }
      entry.messageCount += 1;
      if (!entry.lastMessageAt) {
        const receivedAt = record.get('receivedAt');
        entry.lastMessageAt = receivedAt instanceof Date ? receivedAt.toISOString() : String(receivedAt || '');
      }
      entry.botIds.add(Number(record.get('botId')));
    }

    return Array.from(grouped.entries()).map(([fromUserId, entry]) => ({
      fromUserId,
      messageCount: entry.messageCount,
      lastMessageAt: entry.lastMessageAt,
      botIds: Array.from(entry.botIds),
    }));
  }

  private async getDecryptedSecret(botDbId: number): Promise<string | null> {
    const bot = await this.app.db.getRepository(COLLECTIONS.bots).findOne({ filterByTk: botDbId });
    const stored = bot?.get('secret');
    if (typeof stored !== 'string' || !stored) {
      return null;
    }
    try {
      return await this.app.aesEncryptor.decrypt(stored);
    } catch (err) {
      this.app.logger.error(
        `[wecom-aibot] failed to decrypt secret of bot#${botDbId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }
}

function maskSecret(record: unknown): void {
  if (record && typeof record === 'object' && 'secret' in record) {
    const target = record as Record<string, unknown>;
    target.secret = target.secret ? SECRET_MASK : '';
  }
}

export default PluginWecomAibotServer;
