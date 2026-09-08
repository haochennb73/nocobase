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

// Outbound messages (replies / active pushes). Workflows create `pending` rows;
// the plugin outbound service rate-limits, sends via the long connection and writes back status.
// Every field carries `interface` + `uiSchema` so the collection manager, block pickers and
// workflows treat these fields as first-class no-code fields (display names come from locale).
export default defineCollection({
  name: 'RC01_wecom_send_messages',
  title: `{{t("WeCom Send Messages", { ns: "${I18N_NAMESPACE}" })}}`,
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
      name: 'taskId',
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: `{{t("Task ID", { ns: "${I18N_NAMESPACE}" })}}`,
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
      type: 'string',
      name: 'kind',
      defaultValue: 'reply',
      interface: 'select',
      uiSchema: {
        type: 'string',
        title: `{{t("Kind", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Select',
        enum: [
          { value: 'reply', label: `{{t("Reply", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'push', label: `{{t("Push", { ns: "${I18N_NAMESPACE}" })}}` },
        ],
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
      name: 'toChatId',
      allowNull: false,
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: `{{t("Target chat id", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'msgType',
      defaultValue: 'text',
      interface: 'select',
      uiSchema: {
        type: 'string',
        title: `{{t("Message type", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Select',
        enum: [
          { value: 'text', label: `{{t("Text", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'markdown', label: `{{t("Markdown", { ns: "${I18N_NAMESPACE}" })}}` },
        ],
      },
    },
    {
      type: 'text',
      name: 'content',
      allowNull: false,
      length: 'medium',
      interface: 'textarea',
      uiSchema: {
        type: 'string',
        title: `{{t("Content", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'string',
      name: 'sendStatus',
      defaultValue: 'pending',
      index: true,
      interface: 'select',
      uiSchema: {
        type: 'string',
        title: `{{t("Send status", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Select',
        enum: [
          { value: 'pending', label: `{{t("Pending", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'sending', label: `{{t("Sending", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'sent', label: `{{t("Sent", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'failed', label: `{{t("Failed", { ns: "${I18N_NAMESPACE}" })}}` },
        ],
      },
    },
    {
      type: 'text',
      name: 'sendError',
      interface: 'textarea',
      uiSchema: {
        type: 'string',
        title: `{{t("Send error", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'integer',
      name: 'retryCount',
      defaultValue: 0,
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: `{{t("Retry count", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'date',
      name: 'sentAt',
      interface: 'datetime',
      uiSchema: {
        type: 'string',
        title: `{{t("Sent at", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'DatePicker',
        'x-component-props': { showTime: true },
      },
    },
    {
      type: 'json',
      name: 'rawResponse',
      hidden: true,
      interface: 'json',
      uiSchema: {
        type: 'object',
        title: `{{t("Raw response", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input.JSON',
      },
    },
    {
      type: 'bigInt',
      name: 'workflowExecId',
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: `{{t("Workflow execution ID", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
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
  ],
});
