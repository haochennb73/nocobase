/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

// Inbound messages received from WeCom bots. `msgId` unique index provides idempotency.
export default defineCollection({
  name: 'RC01_wecom_received_messages',
  title: '{{t("WeCom Received Messages")}}',
  dumpRules: { group: 'third-party' },
  indexes: [
    {
      fields: ['processStatus', 'botId'],
    },
    {
      fields: ['conversationId', 'receivedAt'],
    },
  ],
  fields: [
    {
      type: 'string',
      name: 'msgId',
      allowNull: false,
      unique: true,
    },
    {
      type: 'bigInt',
      name: 'botId',
      allowNull: false,
      index: true,
    },
    {
      type: 'bigInt',
      name: 'conversationId',
      index: true,
    },
    {
      type: 'bigInt',
      name: 'userId',
      index: true,
    },
    {
      type: 'bigInt',
      name: 'taskId',
    },
    {
      type: 'string',
      name: 'chatType',
      allowNull: false,
      uiSchema: {
        type: 'string',
        title: '{{t("Chat type")}}',
        'x-component': 'Select',
        enum: [
          { value: 'single', label: '{{t("Single chat")}}' },
          { value: 'group', label: '{{t("Group chat")}}' },
        ],
      },
    },
    {
      type: 'string',
      name: 'chatId',
    },
    {
      type: 'string',
      name: 'fromUserId',
      allowNull: false,
      index: true,
      uiSchema: {
        type: 'string',
        title: '{{t("Sender WeCom userid")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'msgType',
      allowNull: false,
      uiSchema: {
        type: 'string',
        title: '{{t("Message type")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'text',
      name: 'content',
      length: 'medium',
      uiSchema: {
        type: 'string',
        title: '{{t("Content")}}',
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'json',
      name: 'mediaInfo',
      hidden: true,
    },
    {
      type: 'json',
      name: 'rawPayload',
      hidden: true,
    },
    {
      type: 'date',
      name: 'receivedAt',
      allowNull: false,
      index: true,
      uiSchema: {
        type: 'date',
        title: '{{t("Received at")}}',
        'x-component': 'DatePicker',
        'x-component-props': { showTime: true },
      },
    },
    {
      type: 'string',
      name: 'processStatus',
      defaultValue: 'received',
      index: true,
      uiSchema: {
        type: 'string',
        title: '{{t("Process status")}}',
        'x-component': 'Select',
        enum: [
          { value: 'received', label: '{{t("Received")}}' },
          { value: 'batched', label: '{{t("Batched")}}' },
          { value: 'processing', label: '{{t("Processing")}}' },
          { value: 'done', label: '{{t("Done")}}' },
          { value: 'failed', label: '{{t("Failed")}}' },
          { value: 'ignored', label: '{{t("Ignored")}}' },
        ],
      },
    },
    {
      type: 'text',
      name: 'processError',
    },
    {
      type: 'string',
      name: 'ignoreReason',
      uiSchema: {
        type: 'string',
        title: '{{t("Ignore reason")}}',
        'x-component': 'Select',
        enum: [
          { value: 'duplicate', label: '{{t("Duplicate")}}' },
          { value: 'unsupported_type', label: '{{t("Unsupported type")}}' },
          { value: 'bot_disabled', label: '{{t("Bot disabled")}}' },
          { value: 'unbound_user', label: '{{t("Unbound user")}}' },
        ],
      },
    },
    { type: 'belongsTo', name: 'bot', target: 'RC01_wecom_bots', foreignKey: 'botId' },
    { type: 'belongsTo', name: 'conversation', target: 'RC01_wecom_conversations', foreignKey: 'conversationId' },
    { type: 'belongsTo', name: 'user', target: 'users', foreignKey: 'userId' },
    { type: 'belongsTo', name: 'task', target: 'RC01_wecom_process_tasks', foreignKey: 'taskId' },
  ],
});
