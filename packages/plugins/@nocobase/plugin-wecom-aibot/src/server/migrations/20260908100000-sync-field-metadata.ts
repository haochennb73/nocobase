/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { COLLECTIONS } from '../../constants';

const UI_COLLECTIONS = [
  COLLECTIONS.conversations,
  COLLECTIONS.receivedMessages,
  COLLECTIONS.sendMessages,
  COLLECTIONS.processTasks,
];

/**
 * The db2cm registration (20260907100000) copied the runtime fields verbatim, but the
 * definitions at that time carried no `interface` and only partial `uiSchema`, and no
 * explicit createdAt/updatedAt fields. Without `interface` the no-code layer (collection
 * manager "configure fields", block field pickers, workflow field pickers) cannot treat
 * a meta row as a usable field.
 *
 * This migration re-syncs the meta rows from the current runtime definitions:
 * - existing rows are updated in place with `interface` + full `uiSchema` (metadata only:
 *   the field lifecycle hooks that issue DDL run only in a request context, which a
 *   migration does not have, and no type/unique/default value changes are involved);
 * - missing rows (createdAt/updatedAt, appended to the definitions afterwards) are created.
 *
 * Idempotent: re-running converges to the same meta state.
 */
export default class SyncFieldMetadataMigration extends Migration {
  async up() {
    const fieldRepo = this.db.getRepository('fields');

    for (const collectionName of UI_COLLECTIONS) {
      const collection = this.db.getCollection(collectionName);
      if (!collection) {
        continue;
      }

      let nextSort = 0;
      for (const [name, field] of collection.fields) {
        const values = { name, ...field.options };
        const existing = await fieldRepo.findOne({ filter: { collectionName, name } });
        if (existing) {
          await fieldRepo.update({ filter: { collectionName, name }, values });
          continue;
        }

        if (!nextSort) {
          const top = await fieldRepo.find({ filter: { collectionName }, sort: ['-sort'], limit: 1 });
          nextSort = Number(top[0]?.get('sort') || 0) + 1;
        }
        await fieldRepo.create({ values: { ...values, collectionName, sort: nextSort } });
        nextSort += 1;
      }
    }
  }

  async down() {
    // Intentionally a no-op: the meta rows describe runtime columns that keep existing;
    // removing interface/uiSchema metadata again would only break the no-code UI.
  }
}
