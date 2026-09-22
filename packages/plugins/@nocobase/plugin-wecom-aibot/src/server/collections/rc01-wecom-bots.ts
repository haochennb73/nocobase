/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';
import { DEFAULT_MAX_SEND_RETRIES, I18N_NAMESPACE } from '../../constants';

// WeCom intelligent bot (aibot) configuration. One row = one bot with its long-connection credentials.
// `secret` is stored encrypted via app.aesEncryptor at the service layer (see connection-manager).
export default defineCollection({
  name: 'RC01_wecom_bots',
  title: `{{t("WeCom AI Bots", { ns: "${I18N_NAMESPACE}" })}}`,
  dumpRules: 'required',
  fields: [
    {
      type: 'string',
      name: 'name',
      allowNull: false,
      uiSchema: {
        type: 'string',
        title: `{{t("Bot name", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'botId',
      allowNull: false,
      unique: true,
      uiSchema: {
        type: 'string',
        title: `{{t("WeCom Bot ID", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input',
      },
    },
    {
      type: 'text',
      name: 'secret',
      allowNull: false,
      hidden: true,
      uiSchema: {
        type: 'string',
        title: `{{t("Secret", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Password',
      },
    },
    {
      type: 'boolean',
      name: 'enabled',
      defaultValue: true,
      uiSchema: {
        type: 'boolean',
        title: `{{t("Enabled", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Checkbox',
      },
    },
    {
      type: 'string',
      name: 'connStatus',
      defaultValue: 'disconnected',
      uiSchema: {
        type: 'string',
        title: `{{t("Connection status", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input',
      },
    },
    {
      type: 'date',
      name: 'lastConnectedAt',
      uiSchema: {
        type: 'date',
        title: `{{t("Last connected at", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'DatePicker',
        'x-component-props': { showTime: true },
      },
    },
    {
      type: 'text',
      name: 'lastError',
      uiSchema: {
        type: 'string',
        title: `{{t("Last error", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'boolean',
      name: 'requireBinding',
      defaultValue: true,
      uiSchema: {
        type: 'boolean',
        title: `{{t("Require user binding", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Checkbox',
      },
    },
    {
      type: 'text',
      name: 'unboundReplyText',
      uiSchema: {
        type: 'string',
        title: `{{t("Unbound user reply text", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'integer',
      name: 'debounceMs',
      defaultValue: 10000,
      uiSchema: {
        type: 'number',
        title: `{{t("Aggregation window (ms)", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'integer',
      name: 'maxWindowMs',
      defaultValue: 60000,
      uiSchema: {
        type: 'number',
        title: `{{t("Max aggregation window (ms)", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'integer',
      name: 'historyRounds',
      defaultValue: 5,
      uiSchema: {
        type: 'number',
        title: `{{t("History rounds", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'integer',
      name: 'sendRatePerMin',
      defaultValue: 25,
      uiSchema: {
        type: 'number',
        title: `{{t("Send rate limit (per minute)", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'integer',
      name: 'maxSendRetries',
      defaultValue: DEFAULT_MAX_SEND_RETRIES,
      uiSchema: {
        type: 'number',
        title: `{{t("Send retry limit", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'text',
      name: 'welcomeMessage',
      uiSchema: {
        type: 'string',
        title: `{{t("Welcome message", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input.TextArea',
      },
    },
    {
      type: 'text',
      name: 'description',
      uiSchema: {
        type: 'string',
        title: `{{t("Description", { ns: "${I18N_NAMESPACE}" })}}`,
        'x-component': 'Input.TextArea',
      },
    },
  ],
});
