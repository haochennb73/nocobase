/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { extendCollection } from '@nocobase/database';
import { I18N_NAMESPACE } from '../../constants';

// WeCom user binding (Phase 1): extend the core users table with the WeCom userid field.
// Maintained manually by administrators; resolved from the `from.userid` of inbound bot frames.
//
// The same options object is reused by the db2cm migration to create the `fields`
// meta row (the `users` collection row already exists, so db2cm('users') skips it
// and code-defined fields stay invisible to the collection manager without this).
export const wecomUserIdField = {
  collectionName: 'users',
  type: 'string',
  name: 'wecomUserId',
  unique: true,
  interface: 'input',
  uiSchema: {
    type: 'string',
    title: `{{t("WeCom UserID", { ns: "${I18N_NAMESPACE}" })}}`,
    'x-component': 'Input',
  },
};

export default extendCollection({
  name: 'users',
  fields: [wecomUserIdField],
});
