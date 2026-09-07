/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

// Outbound messages (replies / active pushes). Workflows create `pending` rows;
// the plugin outbound service rate-limits, sends via the long connection and writes back status.
export default defineCollection({
  name: 'RC01_wecom_send_messages',
  title: '{{t("WeCom Send Messages")}}',
  dumpRules: { group: 'third-party' },
  // Registered into the collection manager (meta row via db2cm migration) so the
  // table is visible to data source management, block pickers and workflows
  // (WF-A creates `pending` rows here).
  uiManageable: true,
  indexes: [
    {
      fields: ['sendStatus', 'botId'],
    },
  ],
  fields: [
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
      name: 'taskId',
    },
    {
      type: 'bigInt',
      name: 'userId',
      index: true,
    },
    {
      type: 'string',
      name: 'kind',
      defaultValue: 'reply',
      uiSchema: {
        type: 'string',
        title: '{{t("Kind")}}',
        'x-component': 'Select',
        enum: [
          { value: 'reply', label: '{{t("Reply")}}' },
          { value: 'push', label: '{{t("Push")}}' },
        ],
      },
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
      name: 'toChatId',
      allowNull: false,
      uiSchema: {
        type: 'string',
        title: '{{t("Target chat id")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'msgType',
      defaultValue: 'text',
      uiSchema: {
        type: 'string',
        title: '{{t("Message type")}}',
        'x-component': 'Select',
        enum: [
          { value: 'text', label: '{{t("Text")}}' },
          { value: 'markdown', label: '{{t("Markdown")}}' },
        ],
      },
    },
    {
      type: 'text',
      name: 'content',
      allowNull: false,
      length: 'medium',
      uiSchema: {
        type: 'string',
        title: '{{t("Content")}}',
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'string',
      name: 'sendStatus',
      defaultValue: 'pending',
      index: true,
      uiSchema: {
        type: 'string',
        title: '{{t("Send status")}}',
        'x-component': 'Select',
        enum: [
          { value: 'pending', label: '{{t("Pending")}}' },
          { value: 'sending', label: '{{t("Sending")}}' },
          { value: 'sent', label: '{{t("Sent")}}' },
          { value: 'failed', label: '{{t("Failed")}}' },
        ],
      },
    },
    {
      type: 'text',
      name: 'sendError',
    },
    {
      type: 'integer',
      name: 'retryCount',
      defaultValue: 0,
    },
    {
      type: 'date',
      name: 'sentAt',
      uiSchema: {
        type: 'date',
        title: '{{t("Sent at")}}',
        'x-component': 'DatePicker',
        'x-component-props': { showTime: true },
      },
    },
    {
      type: 'json',
      name: 'rawResponse',
      hidden: true,
    },
    {
      type: 'bigInt',
      name: 'workflowExecId',
    },
    { type: 'belongsTo', name: 'bot', target: 'RC01_wecom_bots', foreignKey: 'botId' },
    { type: 'belongsTo', name: 'conversation', target: 'RC01_wecom_conversations', foreignKey: 'conversationId' },
    { type: 'belongsTo', name: 'task', target: 'RC01_wecom_process_tasks', foreignKey: 'taskId' },
    { type: 'belongsTo', name: 'user', target: 'users', foreignKey: 'userId' },
  ],
});
