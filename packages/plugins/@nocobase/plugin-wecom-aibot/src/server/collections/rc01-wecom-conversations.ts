/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

// One row = one single/group chat conversation under a bot. Used for multi-turn context and ownership tracing.
export default defineCollection({
  name: 'RC01_wecom_conversations',
  title: '{{t("WeCom Conversations")}}',
  dumpRules: { group: 'third-party' },
  indexes: [
    {
      unique: true,
      fields: ['botId', 'chatType', 'chatKey'],
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
      name: 'chatKey',
      allowNull: false,
      uiSchema: {
        type: 'string',
        title: '{{t("Chat key")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'fromUserId',
      uiSchema: {
        type: 'string',
        title: '{{t("WeCom userid")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'displayName',
      uiSchema: {
        type: 'string',
        title: '{{t("Display name")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'aiSessionId',
      uiSchema: {
        type: 'string',
        title: '{{t("AI session id")}}',
        'x-component': 'Input',
      },
    },
    {
      type: 'date',
      name: 'lastActiveAt',
      index: true,
      uiSchema: {
        type: 'date',
        title: '{{t("Last active at")}}',
        'x-component': 'DatePicker',
        'x-component-props': { showTime: true },
      },
    },
    {
      type: 'integer',
      name: 'messageCount',
      defaultValue: 0,
      uiSchema: {
        type: 'number',
        title: '{{t("Message count")}}',
        'x-component': 'InputNumber',
      },
    },
    { type: 'belongsTo', name: 'bot', target: 'RC01_wecom_bots', foreignKey: 'botId' },
    { type: 'belongsTo', name: 'user', target: 'users', foreignKey: 'userId' },
  ],
});
