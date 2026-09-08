/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';
import { I18N_NAMESPACE } from '../../constants';

// Inbound messages received from WeCom bots. `msgId` unique index provides idempotency.
// Every field carries `interface` + `uiSchema` so the collection manager, block pickers and
// workflows treat these fields as first-class no-code fields (display names come from locale).
export default defineCollection({
  name: 'RC01_wecom_received_messages',
  title: `{{t("WeCom Received Messages", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("WeCom message ID", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Bot ID", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Conversation ID", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("User ID", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'bigInt',
      name: 'taskId',
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: `{{t("Task ID", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Chat type", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Select',
        enum: [
          { value: 'single', label: `{{t("Single chat", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'group', label: `{{t("Group chat", { ns: "${I18N_NAMESPACE}" })}}` },
        ],
      },
    },
    {
      type: 'string',
      name: 'chatId',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: `{{t("WeCom chat id", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Sender WeCom userid", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Message type", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Content", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Media info", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Raw payload", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Received at", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Process status", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Select',
        enum: [
          { value: 'received', label: `{{t("Received", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'batched', label: `{{t("Batched", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'processing', label: `{{t("Processing", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'done', label: `{{t("Done", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'failed', label: `{{t("Failed", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'ignored', label: `{{t("Ignored", { ns: "${I18N_NAMESPACE}" })}}` },
        ],
      },
    },
    {
      type: 'text',
      name: 'processError',
      interface: 'textarea',
      uiSchema: {
        type: 'string',
        title: `{{t("Process error", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'string',
      name: 'ignoreReason',
      interface: 'select',
      uiSchema: {
        type: 'string',
        title: `{{t("Ignore reason", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Select',
        enum: [
          { value: 'duplicate', label: `{{t("Duplicate", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'unsupported_type', label: `{{t("Unsupported type", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'bot_disabled', label: `{{t("Bot disabled", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'unbound_user', label: `{{t("Unbound user", { ns: "${I18N_NAMESPACE}" })}}` },
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
        title: `{{t("Created at", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Last updated at", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Bot", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Conversation", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("User", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Task", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'AssociationField',
        'x-component-props': {
          multiple: false,
          fieldNames: { label: 'id', value: 'id' },
        },
      },
    },
  ],
});
