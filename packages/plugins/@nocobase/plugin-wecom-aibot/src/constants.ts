/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const COLLECTIONS = {
  bots: 'RC01_wecom_bots',
  conversations: 'RC01_wecom_conversations',
  receivedMessages: 'RC01_wecom_received_messages',
  sendMessages: 'RC01_wecom_send_messages',
  processTasks: 'RC01_wecom_process_tasks',
} as const;

// i18n namespace carrying every user-facing title shipped by this plugin (collection
// titles, field titles, enum labels). Templates in collection definitions MUST spell it
// out — a bare {{t("Key")}} compiles against the core 'client' namespace, where
// plugin-only keys are missing and fall back to raw English (same convention as
// plugin-workflow-manual's `{{t("Task title", { ns: "workflow-manual" })}}`).
export const I18N_NAMESPACE = '@nocobase/plugin-wecom-aibot';

export type CollectionKey = keyof typeof COLLECTIONS;

// Connection lifecycle status of a bot's long connection (written back by ConnectionManager).
export const CONN_STATUS = {
  disconnected: 'disconnected',
  connecting: 'connecting',
  connected: 'connected',
  reconnecting: 'reconnecting',
  error: 'error',
} as const;

export type ConnStatus = (typeof CONN_STATUS)[keyof typeof CONN_STATUS];

// RC01_wecom_received_messages.processStatus
export const PROCESS_STATUS = {
  received: 'received',
  batched: 'batched',
  processing: 'processing',
  done: 'done',
  failed: 'failed',
  ignored: 'ignored',
} as const;

export type ProcessStatus = (typeof PROCESS_STATUS)[keyof typeof PROCESS_STATUS];

export const IGNORE_REASON = {
  duplicate: 'duplicate',
  unsupportedType: 'unsupported_type',
  botDisabled: 'bot_disabled',
  unboundUser: 'unbound_user',
} as const;

export type IgnoreReason = (typeof IGNORE_REASON)[keyof typeof IGNORE_REASON];

// RC01_wecom_process_tasks.taskStatus
export const TASK_STATUS = {
  pending: 'pending',
  processing: 'processing',
  done: 'done',
  failed: 'failed',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

// RC01_wecom_send_messages.sendStatus
export const SEND_STATUS = {
  pending: 'pending',
  sending: 'sending',
  sent: 'sent',
  failed: 'failed',
} as const;

export type SendStatus = (typeof SEND_STATUS)[keyof typeof SEND_STATUS];

export const SEND_KIND = {
  reply: 'reply',
  push: 'push',
} as const;

export const CHAT_TYPE = {
  single: 'single',
  group: 'group',
} as const;

export type ChatType = (typeof CHAT_TYPE)[keyof typeof CHAT_TYPE];

// Inbound message types that carry processable text (Phase 1: text + mixed extracted text).
export const TEXT_MSG_TYPES = ['text', 'mixed'] as const;

// Default of the per-bot `maxSendRetries` setting: how many times a failed send is retried before
// the record is finally marked failed and its task is marked failed with it.
export const DEFAULT_MAX_SEND_RETRIES = 3;

// Upper bound of the per-bot outbound queue. Records beyond it are rejected immediately.
export const MAX_OUTBOUND_QUEUE_SIZE = 200;

// Throttle for the "please bind your account" guide reply in strict mode:
// at most one guide reply per conversation per day.
export const UNBOUND_GUIDE_THROTTLE_MS = 24 * 60 * 60 * 1000;

// Default guide reply when the bot-level unboundReplyText is left empty.
export const DEFAULT_UNBOUND_REPLY =
  '您尚未绑定 NocoBase 账号，暂无法为您处理消息。请联系管理员在「用户管理」中为您维护企微 UserID 后再试。';

// Persisted as `lastError` when WeCom kicks the live connection (another subscription with
// the same WeCom Bot ID appeared). The SDK treats a kick as terminal — it never auto-reconnects
// after `disconnected_event` — so the status must be surfaced as a hard error, not
// "reconnecting". Recovered by clicking Connect again once the other connection is gone.
export const KICK_DISCONNECT_MESSAGE =
  'Connection closed by WeCom server: a newer connection subscribed with the same WeCom Bot ID (mutual kick). Auto-reconnect is disabled after a kick; click "Connect" again once the other connection is gone.';
