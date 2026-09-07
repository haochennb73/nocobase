/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

// Processing tasks produced by the aggregation window. One row = one batch of received messages
// handed to the workflow (collection trigger) and finally to the AI employee instruction.
export default defineCollection({
  name: 'RC01_wecom_process_tasks',
  title: '{{t("WeCom Process Tasks")}}',
  dumpRules: { group: 'third-party' },
  // Registered into the collection manager (meta row via db2cm migration) so the
  // table is visible to data source management, block pickers and workflows
  // (WF-A collection-event trigger watches this table).
  uiManageable: true,
  indexes: [
    {
      fields: ['taskStatus', 'createdAt'],
    },
    {
      fields: ['conversationId', 'createdAt'],
    },
  ],
  fields: [
    {
      type: 'uuid',
      name: 'batchKey',
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
      allowNull: false,
      index: true,
    },
    {
      type: 'bigInt',
      name: 'userId',
      index: true,
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
        title: '{{t("Reply target")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'fromUserId',
      allowNull: false,
      uiSchema: {
        type: 'string',
        title: '{{t("Last sender WeCom userid")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'json',
      name: 'messageIds',
      allowNull: false,
    },
    {
      type: 'text',
      name: 'aggregatedContent',
      allowNull: false,
      length: 'medium',
      uiSchema: {
        type: 'string',
        title: '{{t("Aggregated content")}}',
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'text',
      name: 'contextHistory',
      length: 'medium',
      uiSchema: {
        type: 'string',
        title: '{{t("Context history")}}',
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'string',
      name: 'taskStatus',
      defaultValue: 'pending',
      index: true,
      uiSchema: {
        type: 'string',
        title: '{{t("Task status")}}',
        'x-component': 'Select',
        enum: [
          { value: 'pending', label: '{{t("Pending")}}' },
          { value: 'processing', label: '{{t("Processing")}}' },
          { value: 'done', label: '{{t("Done")}}' },
          { value: 'failed', label: '{{t("Failed")}}' },
        ],
      },
    },
    {
      type: 'integer',
      name: 'retryCount',
      defaultValue: 0,
    },
    {
      type: 'string',
      name: 'aiEmployeeUsername',
    },
    {
      type: 'bigInt',
      name: 'workflowExecId',
    },
    {
      type: 'bigInt',
      name: 'replyMessageId',
    },
    {
      type: 'text',
      name: 'error',
    },
    { type: 'belongsTo', name: 'bot', target: 'RC01_wecom_bots', foreignKey: 'botId' },
    { type: 'belongsTo', name: 'conversation', target: 'RC01_wecom_conversations', foreignKey: 'conversationId' },
    { type: 'belongsTo', name: 'user', target: 'users', foreignKey: 'userId' },
    { type: 'belongsTo', name: 'replyMessage', target: 'RC01_wecom_send_messages', foreignKey: 'replyMessageId' },
  ],
});
