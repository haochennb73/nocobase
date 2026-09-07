/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { randomUUID } from 'node:crypto';
import type { BaseMessage, EventMessage, MixedMessage, TextMessage, WsFrame } from '@wecom/aibot-node-sdk';
import type { Model, Repository } from '@nocobase/database';
import {
  CHAT_TYPE,
  COLLECTIONS,
  DEFAULT_UNBOUND_REPLY,
  IGNORE_REASON,
  PROCESS_STATUS,
  SEND_KIND,
  SEND_STATUS,
  TASK_STATUS,
  TEXT_MSG_TYPES,
  UNBOUND_GUIDE_THROTTLE_MS,
} from '../../constants';
import type { AggregationWindow } from './aggregation';
import type { ServiceContext } from './context';

interface ReceivedValues {
  msgId: string;
  botId: number;
  conversationId: number | null;
  userId: number | null;
  chatType: string;
  chatId: string | null;
  fromUserId: string;
  msgType: string;
  content?: string;
  mediaInfo?: Record<string, unknown> | null;
  rawPayload?: object;
  receivedAt: Date;
  processStatus: string;
  ignoreReason?: string | null;
}

/**
 * Handles every message/event frame pushed over the long connection:
 * idempotent persistence, user binding resolution, strict/lenient unbound policy,
 * conversation merging, aggregation window feeding and orphan recovery.
 * See design doc 03 §3 / §6 and 05 §4.2.
 */
export class InboundService {
  /** Last guide-reply time per conversation (strict-mode unbound throttle, in memory). */
  private lastGuideReplyAt = new Map<number, number>();

  constructor(private ctx: ServiceContext) {}

  private get db() {
    return this.ctx.db;
  }

  private get logger() {
    return this.ctx.logger;
  }

  private repo(name: (typeof COLLECTIONS)[keyof typeof COLLECTIONS] | 'users'): Repository {
    return this.db.getRepository(name);
  }

  /** Entry point for `message*` frames. */
  async handleMessage(botDbId: number, frame: WsFrame<BaseMessage>): Promise<void> {
    const msg = frame.body;
    if (!msg?.msgid) {
      return;
    }

    const bot = await this.repo(COLLECTIONS.bots).findOne({ filterByTk: botDbId });
    if (!bot) {
      this.logger.warn(`[wecom-aibot] message for unknown bot#${botDbId}, msgid=${msg.msgid}`);
      return;
    }

    // 1. Idempotency: the same msgid must never be processed twice.
    const duplicate = await this.repo(COLLECTIONS.receivedMessages).findOne({
      filter: { msgId: msg.msgid },
    });
    if (duplicate) {
      return;
    }

    const msgType = String(msg.msgtype || '');
    const chatType = msg.chattype === CHAT_TYPE.group ? CHAT_TYPE.group : CHAT_TYPE.single;
    const fromUserId = String(msg.from?.userid || '');
    const chatKey = chatType === CHAT_TYPE.group ? String(msg.chatid || '') : fromUserId;
    if (!chatKey || !fromUserId) {
      this.logger.warn(`[wecom-aibot] message without chat key, msgid=${msg.msgid}`);
      return;
    }

    // 2. Bot disabled after the connection was established: keep an audit record only.
    if (!bot.get('enabled')) {
      await this.createReceived({
        msgId: msg.msgid,
        botId: botDbId,
        conversationId: null,
        userId: null,
        chatType,
        chatId: msg.chatid || null,
        fromUserId,
        msgType,
        rawPayload: msg,
        receivedAt: this.receivedAtOf(msg),
        processStatus: PROCESS_STATUS.ignored,
        ignoreReason: IGNORE_REASON.botDisabled,
      });
      return;
    }

    // 3. Resolve the NocoBase user bound to this WeCom userid (supplement requirement D5).
    const binding = await this.resolveBinding(fromUserId);
    const userId = binding.userId;

    // 4. Merge into the (bot, chatType, chatKey) conversation record.
    const conversation = await this.ensureConversation(
      botDbId,
      chatType,
      chatKey,
      fromUserId,
      userId,
      binding.displayName,
    );
    const conversationId = Number(conversation.get('id'));

    const isTextLike = (TEXT_MSG_TYPES as readonly string[]).includes(msgType);
    const textContent = isTextLike ? this.extractText(msg) : '';

    // 5. Strict binding mode + unbound sender: audit record + throttled guide reply, no task.
    if (isTextLike && bot.get('requireBinding') && !userId) {
      await this.createReceived({
        msgId: msg.msgid,
        botId: botDbId,
        conversationId,
        userId: null,
        chatType,
        chatId: msg.chatid || null,
        fromUserId,
        msgType,
        content: textContent,
        rawPayload: msg,
        receivedAt: this.receivedAtOf(msg),
        processStatus: PROCESS_STATUS.ignored,
        ignoreReason: IGNORE_REASON.unboundUser,
      });
      await this.sendUnboundGuide(bot, conversation, chatType, chatKey);
      return;
    }

    // 6. Non-text message types: Phase 1 only keeps an audit record (design G11).
    if (!isTextLike) {
      await this.createReceived({
        msgId: msg.msgid,
        botId: botDbId,
        conversationId,
        userId,
        chatType,
        chatId: msg.chatid || null,
        fromUserId,
        msgType,
        mediaInfo: this.extractMediaInfo(msg),
        rawPayload: msg,
        receivedAt: this.receivedAtOf(msg),
        processStatus: PROCESS_STATUS.ignored,
        ignoreReason: IGNORE_REASON.unsupportedType,
      });
      return;
    }

    if (!textContent.trim()) {
      return;
    }

    // 7. Normal text path: persist, then feed the aggregation window.
    const received = await this.createReceived({
      msgId: msg.msgid,
      botId: botDbId,
      conversationId,
      userId,
      chatType,
      chatId: msg.chatid || null,
      fromUserId,
      msgType,
      content: textContent,
      rawPayload: msg,
      receivedAt: this.receivedAtOf(msg),
      processStatus: PROCESS_STATUS.received,
    });
    if (!received) {
      return; // Lost a msgid race to another delivery; the winner already handles it.
    }

    this.ctx.aggregation?.add({
      botDbId,
      conversationId,
      chatType,
      chatKey,
      messageId: Number(received.get('id')),
      content: textContent,
      fromUserId,
      debounceMs: Number(bot.get('debounceMs') || 0),
      maxWindowMs: Number(bot.get('maxWindowMs') || 0),
    });
  }

  /** Entry point for `event*` frames (enter_chat / feedback / template card / disconnected). */
  async handleEvent(botDbId: number, frame: WsFrame<EventMessage>): Promise<void> {
    const event = frame.body;
    if (!event?.event?.eventtype) {
      return;
    }
    const eventtype = String(event.event.eventtype);

    if (eventtype === 'enter_chat') {
      await this.sendWelcome(botDbId, frame);
      return;
    }

    if (eventtype === 'disconnected_event') {
      // Another process subscribed with the same botId and kicked this connection.
      this.logger.warn(`[wecom-aibot] bot#${botDbId} was kicked: a newer connection of the same botId appeared`);
      return;
    }

    if (eventtype === 'feedback_event' || eventtype === 'template_card_event') {
      const duplicate = await this.repo(COLLECTIONS.receivedMessages).findOne({
        filter: { msgId: event.msgid },
      });
      if (duplicate) {
        return;
      }
      const bot = await this.repo(COLLECTIONS.bots).findOne({ filterByTk: botDbId });
      if (!bot?.get('enabled')) {
        return;
      }
      const chatType = event.chattype === CHAT_TYPE.group ? CHAT_TYPE.group : CHAT_TYPE.single;
      const fromUserId = String(event.from?.userid || '');
      const binding = await this.resolveBinding(fromUserId);
      const conversation = await this.ensureConversation(
        botDbId,
        chatType,
        chatType === CHAT_TYPE.group ? String(event.chatid || '') : fromUserId,
        fromUserId,
        binding.userId,
        binding.displayName,
      );
      await this.createReceived({
        msgId: event.msgid,
        botId: botDbId,
        conversationId: Number(conversation.get('id')),
        userId: binding.userId,
        chatType,
        chatId: event.chatid || null,
        fromUserId,
        msgType: `event_${eventtype}`,
        content: JSON.stringify(event.event),
        rawPayload: event,
        receivedAt: this.receivedAtOf(event),
        processStatus: PROCESS_STATUS.ignored,
      });
    }
  }

  /**
   * Aggregation window callback: create one process task for the whole burst.
   * The new `pending` task is picked up by workflow WF-A through its collection event trigger.
   */
  async flushWindow(window: AggregationWindow): Promise<void> {
    const bot = await this.repo(COLLECTIONS.bots).findOne({ filterByTk: window.botDbId });
    const conversation = await this.repo(COLLECTIONS.conversations).findOne({
      filterByTk: window.conversationId,
    });
    if (!bot || !conversation) {
      this.logger.warn(
        `[wecom-aibot] flush window dropped: bot or conversation missing (${window.botDbId}/${window.conversationId})`,
      );
      return;
    }

    const aggregatedContent = window.contents
      .map((content) => content.trim())
      .filter(Boolean)
      .join('\n');
    if (!aggregatedContent) {
      await this.markReceived(window.messageIds, PROCESS_STATUS.ignored, IGNORE_REASON.unsupportedType);
      return;
    }

    const userId = (await this.resolveBinding(window.lastFromUserId)).userId;
    const contextHistory = await this.ctx.history?.render(window.conversationId, Number(bot.get('historyRounds') || 0));
    const task = await this.createTask({
      botDbId: window.botDbId,
      conversationId: window.conversationId,
      userId,
      chatType: window.chatType,
      toChatId: window.chatKey,
      fromUserId: window.lastFromUserId,
      messageIds: window.messageIds,
      aggregatedContent,
      contextHistory: contextHistory || null,
    });
    if (task) {
      await this.markReceived(window.messageIds, PROCESS_STATUS.batched, undefined, Number(task.get('id')));
    }
  }

  /**
   * Persistence fallback (design 03 §6.1): after an app restart in-memory windows are
   * lost, so rebuild tasks from received messages that never made it into a batch.
   */
  async recoverOrphanMessages(): Promise<void> {
    const bots = await this.repo(COLLECTIONS.bots).find();
    for (const bot of bots) {
      const botDbId = Number(bot.get('id'));
      const windowSpan = Number(bot.get('maxWindowMs') || 60000) + Number(bot.get('debounceMs') || 10000);
      const threshold = new Date(Date.now() - windowSpan - 60000);
      const orphans: Model[] = await this.repo(COLLECTIONS.receivedMessages).find({
        filter: {
          botId: botDbId,
          processStatus: PROCESS_STATUS.received,
          receivedAt: { $lt: threshold },
        },
        sort: ['receivedAt'],
      });
      if (!orphans.length) {
        continue;
      }

      const byConversation = new Map<number, Model[]>();
      for (const orphan of orphans) {
        const conversationId = Number(orphan.get('conversationId'));
        if (!byConversation.has(conversationId)) {
          byConversation.set(conversationId, []);
        }
        byConversation.get(conversationId)?.push(orphan);
      }

      for (const [conversationId, group] of byConversation) {
        const conversation = await this.repo(COLLECTIONS.conversations).findOne({ filterByTk: conversationId });
        if (!conversation) {
          continue;
        }
        const contents = group.map((m) => String(m.get('content') || '').trim()).filter(Boolean);
        if (!contents.length) {
          continue;
        }
        const task = await this.createTask({
          botDbId,
          conversationId,
          userId: Number(group[group.length - 1].get('userId')) || null,
          chatType: String(conversation.get('chatType')),
          toChatId: String(conversation.get('chatKey')),
          fromUserId: String(group[group.length - 1].get('fromUserId')),
          messageIds: group.map((m) => Number(m.get('id'))),
          aggregatedContent: contents.join('\n'),
          contextHistory:
            (await this.ctx.history?.render(conversationId, Number(bot.get('historyRounds') || 0))) || null,
        });
        if (task) {
          await this.markReceived(
            group.map((m) => Number(m.get('id'))),
            PROCESS_STATUS.batched,
            undefined,
            Number(task.get('id')),
          );
          this.logger.info(`[wecom-aibot] recovered ${group.length} orphan message(s) into task#${task.get('id')}`);
        }
      }
    }
  }

  private async sendWelcome(botDbId: number, frame: WsFrame<EventMessage>): Promise<void> {
    const bot = await this.repo(COLLECTIONS.bots).findOne({ filterByTk: botDbId });
    const welcomeMessage = String(bot?.get('welcomeMessage') || '').trim();
    if (!bot?.get('enabled') || !welcomeMessage) {
      return;
    }
    const client = this.ctx.connectionManager?.getClient(botDbId);
    if (!client) {
      return;
    }
    try {
      // replyWelcome must arrive within 5 seconds of the enter_chat event.
      await client.replyWelcome(frame, { msgtype: 'text', text: { content: welcomeMessage } });
    } catch (err) {
      this.logger.warn(
        `[wecom-aibot] welcome reply failed (bot#${botDbId}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async sendUnboundGuide(bot: Model, conversation: Model, chatType: string, toChatId: string): Promise<void> {
    const conversationId = Number(conversation.get('id'));
    const now = Date.now();
    const lastAt = this.lastGuideReplyAt.get(conversationId);
    if (lastAt && now - lastAt < UNBOUND_GUIDE_THROTTLE_MS) {
      return;
    }
    this.lastGuideReplyAt.set(conversationId, now);

    const content = String(bot.get('unboundReplyText') || '').trim() || DEFAULT_UNBOUND_REPLY;
    // The send table's db hook (registered by the plugin) picks this pending record up.
    await this.repo(COLLECTIONS.sendMessages).create({
      values: {
        botId: Number(bot.get('id')),
        conversationId,
        kind: SEND_KIND.reply,
        chatType,
        toChatId,
        msgType: 'text',
        content,
        sendStatus: SEND_STATUS.pending,
      },
    });
  }

  /**
   * from.userid → users.wecomUserId lookup (supplement requirement D5). Also returns a
   * human-readable name: the WeCom long-connection protocol only carries `from.userid`
   * (no name/nickname), so the bound NocoBase user is the only identity source.
   */
  private async resolveBinding(fromUserId: string): Promise<{ userId: number | null; displayName: string | null }> {
    if (!fromUserId) {
      return { userId: null, displayName: null };
    }
    // NOTE: use `fields`, never `attributes` — OptionsParser drops the whole
    // where clause when `attributes` is present (options-parser.ts parseFields).
    const user = await this.repo('users').findOne({
      filter: { wecomUserId: fromUserId },
      fields: ['id', 'nickname', 'username'],
    });
    if (!user) {
      return { userId: null, displayName: null };
    }
    const displayName = String(user.get('nickname') || '') || String(user.get('username') || '');
    return { userId: Number(user.get('id')), displayName: displayName || null };
  }

  /**
   * Late-binding backfill (triggered by the users afterSave hook in plugin.ts): refresh
   * existing single-chat conversations of a freshly bound WeCom userid so they show the
   * NocoBase user's name instead of the raw userid.
   */
  async backfillConversationDisplayName(wecomUserId: string, displayName: string): Promise<void> {
    if (!wecomUserId || !displayName) {
      return;
    }
    await this.repo(COLLECTIONS.conversations).update({
      filter: { fromUserId: wecomUserId, chatType: CHAT_TYPE.single },
      values: { displayName },
    });
  }

  private async ensureConversation(
    botDbId: number,
    chatType: string,
    chatKey: string,
    fromUserId: string,
    userId: number | null,
    boundDisplayName?: string | null,
  ): Promise<Model> {
    // Single chats prefer the bound NocoBase user's name over the raw userid; group chats
    // keep the chatKey (the protocol carries no group title).
    const displayName = chatType === CHAT_TYPE.single && boundDisplayName ? boundDisplayName : chatKey;
    const repo = this.repo(COLLECTIONS.conversations);
    let conversation: Model | null = await repo.findOne({
      filter: { botId: botDbId, chatType, chatKey },
    });

    if (!conversation) {
      try {
        conversation = await repo.create({
          values: {
            botId: botDbId,
            userId,
            chatType,
            chatKey,
            fromUserId,
            displayName,
            lastActiveAt: new Date(),
            messageCount: 1,
          },
        });
        return conversation;
      } catch (err) {
        // Unique index race: another delivery created it concurrently.
        conversation = await repo.findOne({ filter: { botId: botDbId, chatType, chatKey } });
        if (!conversation) {
          throw err;
        }
      }
    }

    const values: Record<string, unknown> = {
      lastActiveAt: new Date(),
      messageCount: Number(conversation.get('messageCount') || 0) + 1,
    };
    if (userId && !conversation.get('userId')) {
      values.userId = userId; // Late binding: user got mapped after first contact.
    }
    if (displayName !== String(conversation.get('displayName') || '')) {
      values.displayName = displayName; // Bound nickname appeared/changed: refresh the display name.
    }
    await repo.update({ filterByTk: conversation.get('id'), values });
    return conversation;
  }

  /** Create the received record; returns null when the msgid unique index rejects a race. */
  private async createReceived(values: ReceivedValues): Promise<Model | null> {
    try {
      return await this.repo(COLLECTIONS.receivedMessages).create({ values });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('msgid') || message.includes('duplicate') || message.includes('unique')) {
        return null;
      }
      throw err;
    }
  }

  private async createTask(values: {
    botDbId: number;
    conversationId: number;
    userId: number | null;
    chatType: string;
    toChatId: string;
    fromUserId: string;
    messageIds: number[];
    aggregatedContent: string;
    contextHistory: string | null;
  }): Promise<Model | null> {
    try {
      return await this.repo(COLLECTIONS.processTasks).create({
        values: {
          batchKey: randomUUID(),
          botId: values.botDbId,
          conversationId: values.conversationId,
          userId: values.userId,
          chatType: values.chatType,
          toChatId: values.toChatId,
          fromUserId: values.fromUserId,
          messageIds: values.messageIds,
          aggregatedContent: values.aggregatedContent,
          contextHistory: values.contextHistory,
          taskStatus: TASK_STATUS.pending,
        },
      });
    } catch (err) {
      this.logger.error(`[wecom-aibot] failed to create process task: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private async markReceived(ids: number[], processStatus: string, ignoreReason?: string, taskId?: number) {
    if (!ids.length) {
      return;
    }
    const values: Record<string, unknown> = { processStatus };
    if (taskId) {
      values.taskId = taskId;
    }
    if (ignoreReason) {
      values.ignoreReason = ignoreReason;
    }
    await this.repo(COLLECTIONS.receivedMessages).update({
      filter: { id: { $in: ids } },
      values,
    });
  }

  private receivedAtOf(msg: { create_time?: number }): Date {
    return msg.create_time ? new Date(msg.create_time * 1000) : new Date();
  }

  private extractText(msg: BaseMessage): string {
    if (msg.msgtype === 'text') {
      return (msg as TextMessage).text?.content || '';
    }
    if (msg.msgtype === 'mixed') {
      const items = (msg as MixedMessage).mixed?.msg_item || [];
      return items
        .filter((item) => item.msgtype === 'text' && item.text?.content)
        .map((item) => item.text?.content || '')
        .join('\n');
    }
    return '';
  }

  private extractMediaInfo(msg: BaseMessage): Record<string, unknown> | null {
    const raw = msg as Record<string, unknown>;
    switch (msg.msgtype) {
      case 'image':
      case 'file':
      case 'video': {
        const media = raw[msg.msgtype] as { url?: string; aeskey?: string } | undefined;
        return media ? { type: msg.msgtype, url: media.url, aeskey: media.aeskey } : { type: msg.msgtype };
      }
      case 'voice': {
        const voice = raw.voice as { content?: string } | undefined;
        return { type: 'voice', content: voice?.content };
      }
      case 'mixed': {
        const items = (msg as MixedMessage).mixed?.msg_item || [];
        return {
          type: 'mixed',
          textCount: items.filter((item) => item.msgtype === 'text').length,
          imageCount: items.filter((item) => item.msgtype === 'image').length,
        };
      }
      default:
        return null;
    }
  }
}

export default InboundService;
