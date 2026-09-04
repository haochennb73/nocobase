/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { extendCollection } from '@nocobase/database';

// WeCom user binding (Phase 1): extend the core users table with the WeCom userid field.
// Maintained manually by administrators; resolved from the `from.userid` of inbound bot frames.
export default extendCollection({
  name: 'users',
  fields: [
    {
      type: 'string',
      name: 'wecomUserId',
      unique: true,
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: '{{t("WeCom UserID")}}',
        'x-component': 'Input',
      },
    },
  ],
});
