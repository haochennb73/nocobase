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
// Every field carries `interface` + `uiSchema` so the collection manager, block pickers and
// workflows treat these fields as first-class no-code fields (display names come from locale).
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
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: '{{t("Batch key")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'bigInt',
      name: 'botId',
      allowNull: false,
      index: true,
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: '{{t("Bot ID")}}',
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'bigInt',
      name: 'conversationId',
      allowNull: false,
      index: true,
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: '{{t("Conversation ID")}}',
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'bigInt',
      name: 'userId',
      index: true,
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: '{{t("User ID")}}',
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'string',
      name: 'chatType',
      allowNull: false,
      interface: 'select',
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
      interface: 'input',
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
      interface: 'input',
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
      interface: 'json',
      uiSchema: {
        type: 'object',
        title: '{{t("Message IDs")}}',
        'x-component': 'Input.JSON',
      },
    },
    {
      type: 'text',
      name: 'aggregatedContent',
      allowNull: false,
      length: 'medium',
      interface: 'textarea',
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
      interface: 'textarea',
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
      interface: 'select',
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
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: '{{t("Retry count")}}',
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'string',
      name: 'aiEmployeeUsername',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: '{{t("AI employee username")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'bigInt',
      name: 'workflowExecId',
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: '{{t("Workflow execution ID")}}',
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'bigInt',
      name: 'replyMessageId',
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: '{{t("Reply message ID")}}',
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'text',
      name: 'error',
      interface: 'textarea',
      uiSchema: {
        type: 'string',
        title: '{{t("Error")}}',
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'date',
      name: 'createdAt',
      field: 'createdAt',
      interface: 'createdAt',
      uiSchema: {
        type: 'datetime',
        title: '{{t("Created at")}}',
        'x-component': 'DatePicker',
        'x-component-props': { dateFormat: 'YYYY-MM-DD', showTime: true },
        'x-read-pretty': true,
      },
    },
    {
      type: 'date',
      name: 'updatedAt',
      field: 'updatedAt',
      interface: 'updatedAt',
      uiSchema: {
        type: 'datetime',
        title: '{{t("Last updated at")}}',
        'x-component': 'DatePicker',
        'x-component-props': { dateFormat: 'YYYY-MM-DD', showTime: true },
        'x-read-pretty': true,
      },
    },
    {
      type: 'belongsTo',
      name: 'bot',
      target: 'RC01_wecom_bots',
      foreignKey: 'botId',
      interface: 'm2o',
      uiSchema: {
        type: 'string',
        title: '{{t("Bot")}}',
        'x-component': 'AssociationField',
        'x-component-props': {
          multiple: false,
          fieldNames: { label: 'name', value: 'id' },
        },
      },
    },
    {
      type: 'belongsTo',
      name: 'conversation',
      target: 'RC01_wecom_conversations',
      foreignKey: 'conversationId',
      interface: 'm2o',
      uiSchema: {
        type: 'string',
        title: '{{t("Conversation")}}',
        'x-component': 'AssociationField',
        'x-component-props': {
          multiple: false,
          fieldNames: { label: 'displayName', value: 'id' },
        },
      },
    },
    {
      type: 'belongsTo',
      name: 'user',
      target: 'users',
      foreignKey: 'userId',
      interface: 'm2o',
      uiSchema: {
        type: 'string',
        title: '{{t("User")}}',
        'x-component': 'AssociationField',
        'x-component-props': {
          multiple: false,
          fieldNames: { label: 'nickname', value: 'id' },
        },
      },
    },
    {
      type: 'belongsTo',
      name: 'replyMessage',
      target: 'RC01_wecom_send_messages',
      foreignKey: 'replyMessageId',
      interface: 'm2o',
      uiSchema: {
        type: 'string',
        title: '{{t("Reply message")}}',
        'x-component': 'AssociationField',
        'x-component-props': {
          multiple: false,
          fieldNames: { label: 'id', value: 'id' },
        },
      },
    },
  ],
});
