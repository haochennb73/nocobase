/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

// Primary key declared explicitly instead of relying on the implicit `id` injected by `autoGenId`.
//
// The implicit primary key carries no `interface`, and the no-code layer drops fields without one:
// `getNormalizedFields` filters `field.interface && !field.hidden` (plugin-workflow
// client-v2/canvas/collectionFieldOptions.ts) and `fieldsToOptions` skips `!field.interface`
// (client-v2 flow/components/filter). As a result the row's primary key was invisible to workflow
// trigger/node variable trees, node filters and block field pickers, so WF-A could not express
// "filter ID = trigger data.ID". Core plugin collections declare their id the same way
// (plugin-users `users.id`), which is why `ID` is selectable there.
//
// The physical column already matches this declaration (bigint + sequence + primary key + not null),
// so syncing it is a no-op on existing tables; a `fields` meta row still has to be created for
// already-installed apps (see the register-id-field migration).
export const primaryIdField = {
  type: 'bigInt',
  name: 'id',
  autoIncrement: true,
  primaryKey: true,
  allowNull: false,
  interface: 'integer',
  uiSchema: {
    type: 'number',
    title: '{{t("ID")}}',
    'x-component': 'InputNumber',
    'x-read-pretty': true,
  },
};
