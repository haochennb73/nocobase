/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Model, Repository } from '@nocobase/database';
import {
  COLLECTIONS,
  MAX_OUTBOUND_QUEUE_SIZE,
  MAX_SEND_RETRIES,
  PROCESS_STATUS,
  SEND_KIND,
  SEND_STATUS,
  TASK_STATUS,
} from '../../constants';
import type { ServiceContext } from './context';
import { TokenBucket } from './rate-limiter';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Exponential backoff schedule for automatic send retries (design 03 §6.6). */
const RETRY_DELAYS_MS = [1000, 5000, 30000];

/**
 * Consumes `RC01_wecom_send_messages` records in `pending` status (created by workflows
 * or the inbound guide reply) and pushes them through the bot's long connection.
 *
 * One FIFO queue + worker loop + token bucket per bot keeps every bot under its
 * configured rate (below the official 30 msgs/min cap) without blocking other bots.
 */
export class OutboundService {
  private queues = new Map<number, number[]>();
  private workers = new Set<number>();
  private buckets = new Map<number, TokenBucket>();
  private activeCount = 0;
  private stopping = false;

  constructor(private ctx: ServiceContext) {}

  private get db() {
    return this.ctx.db;
  }

  private get logger() {
    return this.ctx.logger;
  }

  /**
   * Called from the `RC01_wecom_send_messages.afterSaveWithAssociations` db hook.
   * Only fresh `pending` records enter the queue.
   */
  async enqueue(record: Model): Promise<void> {
    if (this.stopping) {
      return;
    }
    if (record.get('sendStatus') !== SEND_STATUS.pending) {
      return;
    }
    const botDbId = Number(record.get('botId'));
    const recordId = Number(record.get('id'));
    const queue = this.queues.get(botDbId) || [];
    if (!this.queues.has(botDbId)) {
      this.queues.set(botDbId, queue);
    }
    if (queue.includes(recordId)) {
      return;
    }

    if (queue.length >= MAX_OUTBOUND_QUEUE_SIZE) {
      // Reject immediately instead of letting memory grow without bound.
      await this.db.getRepository(COLLECTIONS.sendMessages).update({
        filterByTk: recordId,
        values: { sendStatus: SEND_STATUS.failed, sendError: 'send queue is full' },
      });
      this.logger.warn(`[wecom-aibot] outbound queue of bot#${botDbId} is full, record#${recordId} rejected`);
      return;
    }

    queue.push(recordId);
    this.ensureWorker(botDbId);
  }

  /** Action entry (resource `RC01_wecom_send_messages:resend`): failed → pending re-queue. */
  async resend(recordId: number): Promise<void> {
    const repo = this.db.getRepository(COLLECTIONS.sendMessages);
    const record = await repo.findOne({ filterByTk: recordId });
    if (!record) {
      throw new Error('send message record not found');
    }
    if (record.get('sendStatus') !== SEND_STATUS.failed) {
      throw new Error('only failed messages can be resent');
    }
    await repo.update({
      filterByTk: recordId,
      values: { sendStatus: SEND_STATUS.pending, sendError: null },
    });
  }

  /** beforeStop: stop accepting new records and wait (bounded) for in-flight sends. */
  async drain(timeoutMs = 5000): Promise<void> {
    this.stopping = true;
    const startedAt = Date.now();
    while (this.activeCount > 0 && Date.now() - startedAt < timeoutMs) {
      await sleep(100);
    }
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
    this.workers.clear();
  }

  private ensureWorker(botDbId: number): void {
    if (this.workers.has(botDbId)) {
      return;
    }
    this.workers.add(botDbId);
    this.runWorker(botDbId).catch((err) => {
      this.logger.error(
        `[wecom-aibot] outbound worker of bot#${botDbId} crashed: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  private async runWorker(botDbId: number): Promise<void> {
    try {
      while (!this.stopping) {
        const queue = this.queues.get(botDbId);
        const recordId = queue?.shift();
        if (recordId === undefined) {
          return;
        }
        const bucket = this.bucketOf(botDbId);
        if (bucket && !bucket.tryTake()) {
          // No token: wait for the refill, then retry this record first.
          queue.unshift(recordId);
          await sleep(Math.max(bucket.msUntilNextToken(), 200));
          continue;
        }
        await this.processRecord(botDbId, recordId);
      }
    } finally {
      this.workers.delete(botDbId);
      if ((this.queues.get(botDbId)?.length || 0) > 0 && !this.stopping) {
        this.ensureWorker(botDbId);
      }
    }
  }

  private bucketOf(botDbId: number): TokenBucket | null {
    return this.buckets.get(botDbId) || null;
  }

  private async ensureBucket(botDbId: number, sendRatePerMin: number): Promise<TokenBucket> {
    let bucket = this.buckets.get(botDbId);
    if (!bucket) {
      bucket = new TokenBucket(sendRatePerMin);
      this.buckets.set(botDbId, bucket);
    } else {
      bucket.setRate(sendRatePerMin);
    }
    return bucket;
  }

  private async processRecord(botDbId: number, recordId: number): Promise<void> {
    const sendRepo = this.db.getRepository(COLLECTIONS.sendMessages);
    const record = await sendRepo.findOne({ filterByTk: recordId });
    if (!record || record.get('sendStatus') !== SEND_STATUS.pending) {
      return;
    }

    const bot = await this.db.getRepository(COLLECTIONS.bots).findOne({ filterByTk: botDbId });
    if (!bot || !bot.get('enabled')) {
      await sendRepo.update({
        filterByTk: recordId,
        values: { sendStatus: SEND_STATUS.failed, sendError: 'bot is disabled' },
      });
      return;
    }
    await this.ensureBucket(botDbId, Number(bot.get('sendRatePerMin') || 25));

    const client = this.ctx.connectionManager?.getClient(botDbId);
    if (!client) {
      await this.markFailed(sendRepo, record, 'bot connection is not available');
      this.scheduleRetry(botDbId, recordId, Number(record.get('retryCount') || 0) + 1);
      return;
    }

    this.activeCount += 1;
    try {
      await sendRepo.update({ filterByTk: recordId, values: { sendStatus: SEND_STATUS.sending } });
      // The SDK active-push API only supports markdown / template card / media,
      // so plain text replies are mapped to markdown (SDK types are authoritative).
      const frame = await client.sendMessage(String(record.get('toChatId')), {
        msgtype: 'markdown',
        markdown: { content: String(record.get('content') || '') },
      });

      if (frame.errcode) {
        throw new Error(`errcode=${frame.errcode} errmsg=${frame.errmsg || ''}`);
      }

      await this.onSendSuccess(record, {
        errcode: frame.errcode ?? 0,
        errmsg: frame.errmsg || 'ok',
        reqId: frame.headers?.req_id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.markFailed(sendRepo, record, message);
      this.scheduleRetry(botDbId, recordId, Number(record.get('retryCount') || 0) + 1);
    } finally {
      this.activeCount -= 1;
    }
  }

  /** Send succeeded: cascade send/task/received/conversation statuses in one transaction. */
  private async onSendSuccess(record: Model, rawResponse: Record<string, unknown>): Promise<void> {
    const recordId = Number(record.get('id'));
    const taskId = record.get('taskId') ? Number(record.get('taskId')) : null;
    const conversationId = record.get('conversationId') ? Number(record.get('conversationId')) : null;

    await this.db.sequelize.transaction(async (transaction) => {
      await this.db.getRepository(COLLECTIONS.sendMessages).update({
        filterByTk: recordId,
        values: { sendStatus: SEND_STATUS.sent, sentAt: new Date(), rawResponse },
        transaction,
      });

      if (taskId) {
        await this.db.getRepository(COLLECTIONS.processTasks).update({
          filterByTk: taskId,
          values: { taskStatus: TASK_STATUS.done, replyMessageId: recordId },
          transaction,
        });
        // Only reply records close the loop for the batch's received messages.
        if (record.get('kind') === SEND_KIND.reply) {
          await this.db.getRepository(COLLECTIONS.receivedMessages).update({
            filter: {
              taskId,
              processStatus: { $in: [PROCESS_STATUS.batched, PROCESS_STATUS.processing] },
            },
            values: { processStatus: PROCESS_STATUS.done },
            transaction,
          });
        }
      }

      if (conversationId) {
        const conversationRepo = this.db.getRepository(COLLECTIONS.conversations);
        const conversation = await conversationRepo.findOne({ filterByTk: conversationId, transaction });
        if (conversation) {
          await conversationRepo.update({
            filterByTk: conversationId,
            values: {
              lastActiveAt: new Date(),
              messageCount: Number(conversation.get('messageCount') || 0) + 1,
            },
            transaction,
          });
        }
      }
    });
  }

  private async markFailed(sendRepo: Repository, record: Model, sendError: string): Promise<void> {
    await sendRepo.update({
      filterByTk: record.get('id'),
      values: {
        sendStatus: SEND_STATUS.failed,
        sendError: sendError.slice(0, 2000),
        retryCount: Number(record.get('retryCount') || 0) + 1,
      },
    });
    this.logger.warn(`[wecom-aibot] send record#${record.get('id')} failed: ${sendError}`);
  }

  /** Automatic exponential backoff retry while retryCount < MAX_SEND_RETRIES. */
  private scheduleRetry(botDbId: number, recordId: number, retryCountAfterFailure: number): void {
    if (retryCountAfterFailure >= MAX_SEND_RETRIES) {
      return;
    }
    const delay = RETRY_DELAYS_MS[Math.min(retryCountAfterFailure, RETRY_DELAYS_MS.length) - 1] || 30000;
    setTimeout(() => {
      this.retryRecord(botDbId, recordId).catch((err) => {
        this.logger.warn(`[wecom-aibot] scheduled retry failed: ${err instanceof Error ? err.message : err}`);
      });
    }, delay);
  }

  private async retryRecord(botDbId: number, recordId: number): Promise<void> {
    if (this.stopping) {
      return;
    }
    const record = await this.db.getRepository(COLLECTIONS.sendMessages).findOne({ filterByTk: recordId });
    // Retry only when the record is still where the failure left it.
    if (!record || record.get('sendStatus') !== SEND_STATUS.failed) {
      return;
    }
    await this.db.getRepository(COLLECTIONS.sendMessages).update({
      filterByTk: recordId,
      values: { sendStatus: SEND_STATUS.pending, sendError: null },
    });
    const queue = this.queues.get(botDbId) || [];
    if (!this.queues.has(botDbId)) {
      this.queues.set(botDbId, queue);
    }
    queue.push(recordId);
    this.ensureWorker(botDbId);
  }
}

export default OutboundService;
