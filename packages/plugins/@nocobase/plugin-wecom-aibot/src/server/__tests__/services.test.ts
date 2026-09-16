/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { randomUUID } from 'node:crypto';
import Database from '@nocobase/database';
import { createMockServer, MockServer } from '@nocobase/test';
import type { WSClient } from '@wecom/aibot-node-sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COLLECTIONS, PROCESS_STATUS, SEND_STATUS, TASK_STATUS } from '../../constants';
import type { BotRuntime, ConnectionManager } from '../services/connection-manager';
import type { ServiceContext } from '../services/context';
import type { HistoryService } from '../services/history';
import type { InboundService } from '../services/inbound';
import type { OutboundService } from '../services/outbound';

/** Inject a fake long-connection client so outbound sends never touch the network. */
function seedFakeClient(connectionManager: ConnectionManager, botDbId: number, client: WSClient): void {
  const manager = connectionManager as unknown as { runtimes: Map<number, BotRuntime> };
  manager.runtimes.set(botDbId, { client, startedAt: Date.now() });
}

/** Configured on the fixture bot so the "retries exhausted" branch is reachable without waiting for the backoff. */
const BOT_MAX_SEND_RETRIES = 2;

describe('wecom-aibot services', () => {
  let app: MockServer | undefined;
  let db: Database;
  let services: ServiceContext | undefined;
  let botDbId: number;
  let boundUserId: number;

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // Narrow the optional service context once instead of using `!` assertions.
  const requireServices = (): {
    inbound: InboundService;
    outbound: OutboundService;
    history: HistoryService;
    connectionManager: ConnectionManager;
  } => {
    const inbound = services?.inbound;
    const outbound = services?.outbound;
    const history = services?.history;
    const connectionManager = services?.connectionManager;
    if (!inbound || !outbound || !history || !connectionManager) {
      throw new Error('wecom-aibot services are not initialized');
    }
    return { inbound, outbound, history, connectionManager };
  };

  beforeAll(async () => {
    app = await createMockServer({ plugins: ['field-sort', 'users', 'wecom-aibot'] });
    db = app.db;
    services = (app.pm.get('wecom-aibot') as unknown as { services: ServiceContext }).services;
    expect(services.outbound).toBeDefined();

    const bound = await db.getRepository('users').create({
      values: { username: 'bound-user', nickname: 'Bound', wecomUserId: 'wx-bound-001' },
    });
    boundUserId = Number(bound.get('id'));

    const bot = await db.getRepository(COLLECTIONS.bots).create({
      values: {
        name: 'Svc Bot',
        botId: 'aibot-svc',
        secret: 'test-secret',
        enabled: true,
        requireBinding: true,
        debounceMs: 60,
        maxWindowMs: 5000,
        historyRounds: 3,
        sendRatePerMin: 30,
        maxSendRetries: BOT_MAX_SEND_RETRIES,
      },
    });
    botDbId = Number(bot.get('id'));
  }, 600000);

  afterAll(async () => {
    await services?.outbound?.drain();
    await app?.destroy();
  }, 120000);

  it('sends a pending reply through the bot client and cascades all statuses', async () => {
    const conversation = await db.getRepository(COLLECTIONS.conversations).create({
      values: {
        botId: botDbId,
        userId: boundUserId,
        chatType: 'single',
        chatKey: 'wx-bound-001',
        fromUserId: 'wx-bound-001',
        displayName: 'wx-bound-001',
        lastActiveAt: new Date(),
        messageCount: 0,
      },
    });
    const conversationId = Number(conversation.get('id'));

    const task = await db.getRepository(COLLECTIONS.processTasks).create({
      values: {
        batchKey: randomUUID(),
        botId: botDbId,
        conversationId,
        userId: boundUserId,
        chatType: 'single',
        toChatId: 'wx-bound-001',
        fromUserId: 'wx-bound-001',
        messageIds: [],
        aggregatedContent: 'question one',
        taskStatus: TASK_STATUS.pending,
      },
    });
    const taskId = Number(task.get('id'));

    const received = await db.getRepository(COLLECTIONS.receivedMessages).create({
      values: {
        msgId: 'msg-svc-r1',
        botId: botDbId,
        conversationId,
        userId: boundUserId,
        chatType: 'single',
        fromUserId: 'wx-bound-001',
        msgType: 'text',
        content: 'question one',
        receivedAt: new Date(),
        processStatus: PROCESS_STATUS.batched,
        taskId,
      },
    });

    const calls: Array<{ chatId: string; body: unknown }> = [];
    seedFakeClient(requireServices().connectionManager, botDbId, {
      sendMessage: async (chatId: string, body: unknown) => {
        calls.push({ chatId, body });
        return { errcode: 0, errmsg: 'ok', headers: { req_id: 'req-ok-1' } };
      },
    } as unknown as WSClient);

    // Creating the pending record fires the afterSave enqueue hook.
    const send = await db.getRepository(COLLECTIONS.sendMessages).create({
      values: {
        botId: botDbId,
        conversationId,
        taskId,
        userId: boundUserId,
        kind: 'reply',
        chatType: 'single',
        toChatId: 'wx-bound-001',
        content: 'answer one',
        sendStatus: SEND_STATUS.pending,
      },
    });
    const sendId = Number(send.get('id'));

    await sleep(400);

    expect(calls).toHaveLength(1);
    expect(calls[0].chatId).toBe('wx-bound-001');
    expect(calls[0].body).toEqual({ msgtype: 'markdown', markdown: { content: 'answer one' } });

    const sent = await db.getRepository(COLLECTIONS.sendMessages).findOne({ filterByTk: sendId });
    expect(sent?.get('sendStatus')).toBe(SEND_STATUS.sent);
    expect(sent?.get('sentAt')).not.toBeNull();
    const rawResponse = sent?.get('rawResponse') as { reqId?: string };
    expect(rawResponse?.reqId).toBe('req-ok-1');

    const doneTask = await db.getRepository(COLLECTIONS.processTasks).findOne({ filterByTk: taskId });
    expect(doneTask?.get('taskStatus')).toBe(TASK_STATUS.done);
    expect(Number(doneTask?.get('replyMessageId'))).toBe(sendId);

    const doneReceived = await db
      .getRepository(COLLECTIONS.receivedMessages)
      .findOne({ filterByTk: Number(received.get('id')) });
    expect(doneReceived?.get('processStatus')).toBe(PROCESS_STATUS.done);

    const updatedConversation = await db
      .getRepository(COLLECTIONS.conversations)
      .findOne({ filterByTk: conversationId });
    expect(Number(updatedConversation?.get('messageCount'))).toBe(1);
  });

  it('marks the record failed and bumps retryCount when the client throws', async () => {
    seedFakeClient(requireServices().connectionManager, botDbId, {
      sendMessage: async () => {
        throw new Error('boom');
      },
    } as unknown as WSClient);

    const send = await db.getRepository(COLLECTIONS.sendMessages).create({
      values: {
        botId: botDbId,
        kind: 'push',
        chatType: 'single',
        toChatId: 'wx-bound-001',
        content: 'will fail',
        sendStatus: SEND_STATUS.pending,
      },
    });
    const sendId = Number(send.get('id'));

    await sleep(400);

    const failed = await db.getRepository(COLLECTIONS.sendMessages).findOne({ filterByTk: sendId });
    expect(failed?.get('sendStatus')).toBe(SEND_STATUS.failed);
    expect(Number(failed?.get('retryCount'))).toBe(1);
    expect(String(failed?.get('sendError'))).toContain('boom');
  });

  /** A conversation plus its task, i.e. the state WF-A leaves behind before the reply is sent. */
  const seedTaskScenario = async (chatKey: string, taskStatus: string, retryCount: number) => {
    const conversation = await db.getRepository(COLLECTIONS.conversations).create({
      values: {
        botId: botDbId,
        userId: boundUserId,
        chatType: 'single',
        chatKey,
        fromUserId: 'wx-bound-001',
        displayName: chatKey,
        lastActiveAt: new Date(),
        messageCount: 0,
      },
    });
    const conversationId = Number(conversation.get('id'));
    const task = await db.getRepository(COLLECTIONS.processTasks).create({
      values: {
        batchKey: randomUUID(),
        botId: botDbId,
        conversationId,
        userId: boundUserId,
        chatType: 'single',
        toChatId: chatKey,
        fromUserId: 'wx-bound-001',
        messageIds: [],
        aggregatedContent: 'question for a failing send',
        taskStatus,
      },
    });
    const taskId = Number(task.get('id'));
    await db.getRepository(COLLECTIONS.sendMessages).create({
      values: {
        botId: botDbId,
        conversationId,
        taskId,
        userId: boundUserId,
        kind: 'reply',
        chatType: 'single',
        toChatId: chatKey,
        content: 'will fail',
        sendStatus: SEND_STATUS.pending,
        retryCount,
      },
    });
    return { conversationId, taskId };
  };

  it('fails the owning task once the configured send retries are exhausted', async () => {
    seedFakeClient(requireServices().connectionManager, botDbId, {
      sendMessage: async () => {
        throw new Error('boom');
      },
    } as unknown as WSClient);

    // retryCount already at the bot's limit: this attempt is the last one.
    const { taskId } = await seedTaskScenario('wx-fail-terminal', TASK_STATUS.processing, BOT_MAX_SEND_RETRIES - 1);

    await sleep(400);

    const failedTask = await db.getRepository(COLLECTIONS.processTasks).findOne({ filterByTk: taskId });
    expect(failedTask?.get('taskStatus')).toBe(TASK_STATUS.failed);
    expect(String(failedTask?.get('error'))).toContain('boom');
  });

  it('leaves the task processing while send retries remain', async () => {
    seedFakeClient(requireServices().connectionManager, botDbId, {
      sendMessage: async () => {
        throw new Error('boom');
      },
    } as unknown as WSClient);

    const { taskId } = await seedTaskScenario('wx-fail-retrying', TASK_STATUS.processing, 0);

    await sleep(400);

    const task = await db.getRepository(COLLECTIONS.processTasks).findOne({ filterByTk: taskId });
    expect(task?.get('taskStatus')).toBe(TASK_STATUS.processing);
  });

  it('does not un-complete an already done task when a late send fails', async () => {
    seedFakeClient(requireServices().connectionManager, botDbId, {
      sendMessage: async () => {
        throw new Error('boom');
      },
    } as unknown as WSClient);

    const { taskId } = await seedTaskScenario('wx-fail-done', TASK_STATUS.done, BOT_MAX_SEND_RETRIES - 1);

    await sleep(400);

    const task = await db.getRepository(COLLECTIONS.processTasks).findOne({ filterByTk: taskId });
    expect(task?.get('taskStatus')).toBe(TASK_STATUS.done);
  });

  it('renders completed rounds as context history', async () => {
    const conversation = await db.getRepository(COLLECTIONS.conversations).create({
      values: {
        botId: botDbId,
        userId: boundUserId,
        chatType: 'single',
        chatKey: 'wx-hist',
        fromUserId: 'wx-bound-001',
        displayName: 'wx-hist',
        lastActiveAt: new Date(),
        messageCount: 0,
      },
    });
    const conversationId = Number(conversation.get('id'));

    const seedRound = async (question: string, answer: string, createdAt: Date) => {
      const task = await db.getRepository(COLLECTIONS.processTasks).create({
        values: {
          batchKey: randomUUID(),
          botId: botDbId,
          conversationId,
          userId: boundUserId,
          chatType: 'single',
          toChatId: 'wx-hist',
          fromUserId: 'wx-bound-001',
          messageIds: [],
          aggregatedContent: question,
          taskStatus: TASK_STATUS.pending,
          createdAt,
        },
      });
      const reply = await db.getRepository(COLLECTIONS.sendMessages).create({
        values: {
          botId: botDbId,
          conversationId,
          taskId: Number(task.get('id')),
          kind: 'reply',
          chatType: 'single',
          toChatId: 'wx-hist',
          content: answer,
          sendStatus: SEND_STATUS.sent,
          sentAt: createdAt,
        },
      });
      await db.getRepository(COLLECTIONS.processTasks).update({
        filterByTk: Number(task.get('id')),
        values: { taskStatus: TASK_STATUS.done, replyMessageId: Number(reply.get('id')) },
      });
    };

    await seedRound('Q1', 'A1', new Date(Date.now() - 2000));
    await seedRound('Q2', 'A2', new Date(Date.now() - 1000));

    // A done task without a reply must not be rendered.
    await db.getRepository(COLLECTIONS.processTasks).create({
      values: {
        batchKey: randomUUID(),
        botId: botDbId,
        conversationId,
        userId: boundUserId,
        chatType: 'single',
        toChatId: 'wx-hist',
        fromUserId: 'wx-bound-001',
        messageIds: [],
        aggregatedContent: 'Q-without-answer',
        taskStatus: TASK_STATUS.done,
        createdAt: new Date(),
      },
    });

    const full = await requireServices().history.render(conversationId, 5);
    expect(full).toContain('【历史对话（最近 2 轮）】');
    expect(full).toContain('用户: Q1');
    expect(full).toContain('助手: A1');
    expect(full).toContain('用户: Q2');
    expect(full).toContain('助手: A2');
    expect(full).not.toContain('Q-without-answer');
    // Oldest first.
    expect(full.indexOf('Q1')).toBeLessThan(full.indexOf('Q2'));

    const limited = await requireServices().history.render(conversationId, 1);
    expect(limited).toContain('【历史对话（最近 1 轮）】');
    expect(limited).toContain('Q2');
    expect(limited).not.toContain('Q1');

    expect(await requireServices().history.render(conversationId, 0)).toBe('');
  });

  it('recovers orphan received messages into a task after restart', async () => {
    const conversation = await db.getRepository(COLLECTIONS.conversations).create({
      values: {
        botId: botDbId,
        userId: boundUserId,
        chatType: 'single',
        chatKey: 'wx-orphan',
        fromUserId: 'wx-bound-001',
        displayName: 'wx-orphan',
        lastActiveAt: new Date(),
        messageCount: 0,
      },
    });
    const conversationId = Number(conversation.get('id'));

    const old = new Date(Date.now() - 180000);
    const orphanRepo = db.getRepository(COLLECTIONS.receivedMessages);
    const r1 = await orphanRepo.create({
      values: {
        msgId: 'msg-orphan-1',
        botId: botDbId,
        conversationId,
        userId: boundUserId,
        chatType: 'single',
        fromUserId: 'wx-bound-001',
        msgType: 'text',
        content: 'orphan one',
        receivedAt: old,
        processStatus: PROCESS_STATUS.received,
      },
    });
    const r2 = await orphanRepo.create({
      values: {
        msgId: 'msg-orphan-2',
        botId: botDbId,
        conversationId,
        userId: boundUserId,
        chatType: 'single',
        fromUserId: 'wx-bound-001',
        msgType: 'text',
        content: 'orphan two',
        receivedAt: new Date(old.getTime() + 1000),
        processStatus: PROCESS_STATUS.received,
      },
    });
    // A fresh message must NOT be recovered (its window may still be open).
    const fresh = await orphanRepo.create({
      values: {
        msgId: 'msg-orphan-fresh',
        botId: botDbId,
        conversationId,
        userId: boundUserId,
        chatType: 'single',
        fromUserId: 'wx-bound-001',
        msgType: 'text',
        content: 'still fresh',
        receivedAt: new Date(),
        processStatus: PROCESS_STATUS.received,
      },
    });

    await requireServices().inbound.recoverOrphanMessages();

    const tasks = await db
      .getRepository(COLLECTIONS.processTasks)
      .find({ filter: { conversationId, batchKey: { $notEmpty: true } } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].get('aggregatedContent')).toBe('orphan one\norphan two');
    expect(tasks[0].get('toChatId')).toBe('wx-orphan');
    expect(Number(tasks[0].get('userId'))).toBe(boundUserId);
    const taskId = Number(tasks[0].get('id'));

    for (const record of [r1, r2]) {
      const reloaded = await orphanRepo.findOne({ filterByTk: Number(record.get('id')) });
      expect(reloaded?.get('processStatus')).toBe(PROCESS_STATUS.batched);
      expect(Number(reloaded?.get('taskId'))).toBe(taskId);
    }
    const reloadedFresh = await orphanRepo.findOne({ filterByTk: Number(fresh.get('id')) });
    expect(reloadedFresh?.get('processStatus')).toBe(PROCESS_STATUS.received);
  });
});
