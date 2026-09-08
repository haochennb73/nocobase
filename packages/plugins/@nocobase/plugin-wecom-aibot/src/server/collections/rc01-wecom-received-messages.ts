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
// Every field carries `interface` + `uiSchema` so the collection manager, block pickers and
// workflows treat these fields as first-class no-code fields (display names come from locale).
export default defineCollection({
  name: 'RC01_wecom_received_messages',
  title: '{{t("WeCom Received Messages")}}',
  dumpRules: { group: 'third-party' },
  // Registered into the collection manager (meta row via db2cm migration) so the
  // table is visible to data source management, block pickers and workflows.
  uiManageable: true,
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
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: '{{t("WeCom message ID")}}',
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
      type: 'bigInt',
      name: 'taskId',
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: '{{t("Task ID")}}',
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
      name: 'chatId',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: '{{t("WeCom chat id")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'fromUserId',
      allowNull: false,
      index: true,
      interface: 'input',
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
      interface: 'input',
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
      interface: 'textarea',
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
      interface: 'json',
      uiSchema: {
        type: 'object',
        title: '{{t("Media info")}}',
        'x-component': 'Input.JSON',
      },
    },
    {
      type: 'json',
      name: 'rawPayload',
      hidden: true,
      interface: 'json',
      uiSchema: {
        type: 'object',
        title: '{{t("Raw payload")}}',
        'x-component': 'Input.JSON',
      },
    },
    {
      type: 'date',
      name: 'receivedAt',
      allowNull: false,
      index: true,
      interface: 'datetime',
      uiSchema: {
        type: 'string',
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
      interface: 'select',
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
      interface: 'textarea',
      uiSchema: {
        type: 'string',
        title: '{{t("Process error")}}',
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'string',
      name: 'ignoreReason',
      interface: 'select',
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
      name: 'task',
      target: 'RC01_wecom_process_tasks',
      foreignKey: 'taskId',
      interface: 'm2o',
      uiSchema: {
        type: 'string',
        title: '{{t("Task")}}',
        'x-component': 'AssociationField',
        'x-component-props': {
          multiple: false,
          fieldNames: { label: 'id', value: 'id' },
        },
      },
    },
  ],
});
