/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import Database from '@nocobase/database';
import { createMockServer, MockServer } from '@nocobase/test';
import type { BaseMessage, WsFrame } from '@wecom/aibot-node-sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CHAT_TYPE,
  COLLECTIONS,
  DEFAULT_UNBOUND_REPLY,
  IGNORE_REASON,
  PROCESS_STATUS,
  SEND_KIND,
  SEND_STATUS,
  TASK_STATUS,
} from '../../constants';
import type { ServiceContext } from '../services/context';
import type { InboundService } from '../services/inbound';

function textFrame(msgid: string, userid: string, content: string): WsFrame<BaseMessage> {
  return {
    body: {
      msgid,
      aibotid: 'aibot-test',
      chattype: CHAT_TYPE.single,
      msgtype: 'text',
      from: { userid },
      create_time: Math.floor(Date.now() / 1000),
      text: { content },
    },
  } as unknown as WsFrame<BaseMessage>;
}

describe('wecom-aibot inbound flow', () => {
  let app: MockServer | undefined;
  let db: Database;
  let services: ServiceContext | undefined;
  let botDbId: number;
  let boundUserId: number;

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // Narrow the optional service context once instead of using `!` assertions.
  const inboundService = (): InboundService => {
    const inbound = services?.inbound;
    if (!inbound) {
      throw new Error('inbound service is not initialized');
    }
    return inbound;
  };

  beforeAll(async () => {
    app = await createMockServer({ plugins: ['field-sort', 'users', 'wecom-aibot'] });
    db = app.db;
    services = (app.pm.get('wecom-aibot') as unknown as { services: ServiceContext }).services;
    expect(services.inbound).toBeDefined();

    const bound = await db.getRepository('users').create({
      values: { username: 'bound-user', nickname: 'Bound', wecomUserId: 'wx-bound-001' },
    });
    boundUserId = Number(bound.get('id'));

    const bot = await db.getRepository(COLLECTIONS.bots).create({
      values: {
        name: 'Test Bot',
        botId: 'aibot-test',
        secret: 'test-secret',
        enabled: true,
        requireBinding: true,
        debounceMs: 60,
        maxWindowMs: 5000,
        historyRounds: 3,
        sendRatePerMin: 30,
      },
    });
    botDbId = Number(bot.get('id'));
  }, 600000);

  afterAll(async () => {
    // Stop the outbound retry timers, then tear the app down.
    await services?.outbound?.drain();
    await app?.destroy();
  }, 120000);

  it('batches a bound text burst into one pending task', async () => {
    await inboundService().handleMessage(botDbId, textFrame('msg-a1', 'wx-bound-001', 'hello'));
    await sleep(20);
    await inboundService().handleMessage(botDbId, textFrame('msg-a2', 'wx-bound-001', 'world'));
    await sleep(400);

    const received = await db.getRepository(COLLECTIONS.receivedMessages).find({
      filter: { msgId: { $in: ['msg-a1', 'msg-a2'] } },
    });
    expect(received).toHaveLength(2);
    for (const record of received) {
      expect(record.get('processStatus')).toBe(PROCESS_STATUS.batched);
      expect(record.get('userId')).toBe(boundUserId);
    }

    const tasks = await db.getRepository(COLLECTIONS.processTasks).find({ filter: { botId: botDbId } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].get('aggregatedContent')).toBe('hello\nworld');
    expect(tasks[0].get('taskStatus')).toBe(TASK_STATUS.pending);
    expect(tasks[0].get('userId')).toBe(boundUserId);
    expect(tasks[0].get('toChatId')).toBe('wx-bound-001');

    const conversation = await db
      .getRepository(COLLECTIONS.conversations)
      .findOne({ filter: { botId: botDbId, chatKey: 'wx-bound-001' } });
    expect(conversation).not.toBeNull();
    expect(conversation?.get('chatType')).toBe(CHAT_TYPE.single);
    expect(conversation?.get('userId')).toBe(boundUserId);
  });

  it('is idempotent for a repeated msgid', async () => {
    await inboundService().handleMessage(botDbId, textFrame('msg-a1', 'wx-bound-001', 'hello again'));
    await sleep(300);
    const received = await db.getRepository(COLLECTIONS.receivedMessages).find({ filter: { msgId: 'msg-a1' } });
    expect(received).toHaveLength(1);
    expect(received[0].get('content')).toBe('hello');
  });

  it('archives unsupported message types with media info', async () => {
    const frame = {
      body: {
        msgid: 'msg-img-1',
        aibotid: 'aibot-test',
        chattype: CHAT_TYPE.single,
        msgtype: 'image',
        from: { userid: 'wx-bound-001' },
        create_time: Math.floor(Date.now() / 1000),
        image: { url: 'https://example.com/img.png', aeskey: 'aes-key' },
      },
    } as unknown as WsFrame<BaseMessage>;

    await inboundService().handleMessage(botDbId, frame);

    const record = await db.getRepository(COLLECTIONS.receivedMessages).findOne({ filter: { msgId: 'msg-img-1' } });
    expect(record).not.toBeNull();
    expect(record?.get('processStatus')).toBe(PROCESS_STATUS.ignored);
    expect(record?.get('ignoreReason')).toBe(IGNORE_REASON.unsupportedType);
    const mediaInfo = record?.get('mediaInfo') as { type?: string; url?: string };
    expect(mediaInfo?.type).toBe('image');
    expect(mediaInfo?.url).toBe('https://example.com/img.png');
  });

  it('audits messages of a disabled bot without processing them', async () => {
    await db.getRepository(COLLECTIONS.bots).update({ filterByTk: botDbId, values: { enabled: false } });
    await inboundService().handleMessage(botDbId, textFrame('msg-d1', 'wx-bound-001', 'are you there'));

    const record = await db.getRepository(COLLECTIONS.receivedMessages).findOne({ filter: { msgId: 'msg-d1' } });
    expect(record?.get('processStatus')).toBe(PROCESS_STATUS.ignored);
    expect(record?.get('ignoreReason')).toBe(IGNORE_REASON.botDisabled);
    expect(record?.get('conversationId')).toBeNull();

    await db.getRepository(COLLECTIONS.bots).update({ filterByTk: botDbId, values: { enabled: true } });
  });

  // Runs last: the guide reply enters the outbound queue and schedules retries
  // while no long connection exists in the test environment.
  it('ignores unbound senders in strict mode and sends one throttled guide reply', async () => {
    await inboundService().handleMessage(botDbId, textFrame('msg-u1', 'wx-stranger', 'help'));
    await sleep(20);
    await inboundService().handleMessage(botDbId, textFrame('msg-u2', 'wx-stranger', 'anyone there?'));
    await sleep(300);

    const received = await db.getRepository(COLLECTIONS.receivedMessages).find({
      filter: { msgId: { $in: ['msg-u1', 'msg-u2'] } },
    });
    expect(received).toHaveLength(2);
    for (const record of received) {
      expect(record.get('processStatus')).toBe(PROCESS_STATUS.ignored);
      expect(record.get('ignoreReason')).toBe(IGNORE_REASON.unboundUser);
      expect(record.get('userId')).toBeNull();
    }

    // Throttle: one guide reply per conversation per day, not one per message.
    const sends = await db
      .getRepository(COLLECTIONS.sendMessages)
      .find({ filter: { botId: botDbId, kind: SEND_KIND.reply } });
    expect(sends).toHaveLength(1);
    expect(sends[0].get('content')).toBe(DEFAULT_UNBOUND_REPLY);
    expect([SEND_STATUS.pending, SEND_STATUS.sending, SEND_STATUS.failed]).toContain(sends[0].get('sendStatus'));

    // No process task may be created from unbound messages.
    const tasks = await db.getRepository(COLLECTIONS.processTasks).find({ filter: { botId: botDbId } });
    expect(tasks).toHaveLength(1);
  });
});
