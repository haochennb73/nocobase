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
import { primaryIdField } from './id-field';

// Processing tasks produced by the aggregation window. One row = one batch of received messages
// handed to the workflow (collection trigger) and finally to the AI employee instruction.
// Every field carries `interface` + `uiSchema` so the collection manager, block pickers and
// workflows treat these fields as first-class no-code fields (display names come from locale).
export default defineCollection({
  name: 'RC01_wecom_process_tasks',
  title: `{{t("WeCom Process Tasks", { ns: "${I18N_NAMESPACE}" })}}`,
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
    primaryIdField,
    {
      type: 'uuid',
      name: 'batchKey',
      allowNull: false,
      unique: true,
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: `{{t("Batch key", { ns: "${I18N_NAMESPACE}" })}}`,
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
      allowNull: false,
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
        title: `{{t("Reply target", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Last sender WeCom userid", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Message IDs", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Aggregated content", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Context history", { ns: "${I18N_NAMESPACE}" })}}`,
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
        title: `{{t("Task status", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Select',
        enum: [
          { value: 'pending', label: `{{t("Pending", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'processing', label: `{{t("Processing", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'done', label: `{{t("Done", { ns: "${I18N_NAMESPACE}" })}}` },
          { value: 'failed', label: `{{t("Failed", { ns: "${I18N_NAMESPACE}" })}}` },
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
        title: `{{t("Retry count", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'string',
      name: 'aiEmployeeUsername',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: `{{t("AI employee username", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input',
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
      type: 'bigInt',
      name: 'replyMessageId',
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: `{{t("Reply message ID", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'text',
      name: 'error',
      interface: 'textarea',
      uiSchema: {
        type: 'string',
        title: `{{t("Error", { ns: "${I18N_NAMESPACE}" })}}`,
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
      name: 'replyMessage',
      target: 'RC01_wecom_send_messages',
      foreignKey: 'replyMessageId',
      interface: 'm2o',
      uiSchema: {
        type: 'string',
        title: `{{t("Reply message", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'AssociationField',
        'x-component-props': {
          multiple: false,
          fieldNames: { label: 'id', value: 'id' },
        },
      },
    },
  ],
});
