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

// One row = one single/group chat conversation under a bot. Used for multi-turn context and ownership tracing.
// Every field carries `interface` + `uiSchema` so the collection manager, block pickers and
// workflows treat these fields as first-class no-code fields (display names come from locale).
export default defineCollection({
  name: 'RC01_wecom_conversations',
  title: `{{t("WeCom Conversations", { ns: "${I18N_NAMESPACE}" })}}`,
  dumpRules: { group: 'third-party' },
  // Registered into the collection manager (meta row via db2cm migration) so the
  // table is visible to data source management, block pickers and workflows.
  uiManageable: true,
  indexes: [
    {
      unique: true,
      fields: ['botId', 'chatType', 'chatKey'],
    },
  ],
  fields: [
    primaryIdField,
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
      name: 'chatKey',
      allowNull: false,
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: `{{t("Chat key", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'fromUserId',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: `{{t("WeCom userid", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'displayName',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: `{{t("Display name", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'aiSessionId',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: `{{t("AI session id", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input',
      },
    },
    {
      type: 'date',
      name: 'lastActiveAt',
      index: true,
      interface: 'datetime',
      uiSchema: {
        type: 'string',
        title: `{{t("Last active at", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'DatePicker',
        'x-component-props': { showTime: true },
      },
    },
    {
      type: 'integer',
      name: 'messageCount',
      defaultValue: 0,
      interface: 'integer',
      uiSchema: {
        type: 'number',
        title: `{{t("Message count", { ns: "${I18N_NAMESPACE}" })}}`,
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
