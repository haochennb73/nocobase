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
import { primaryIdField } from '../collections/id-field';

const UI_COLLECTIONS = [
  COLLECTIONS.conversations,
  COLLECTIONS.receivedMessages,
  COLLECTIONS.sendMessages,
  COLLECTIONS.processTasks,
];

/**
 * Create the `fields` meta row for the primary key of the plugin's UI-manageable collections.
 *
 * These collections now declare `id` explicitly (see `collections/id-field.ts` for why the implicit
 * `autoGenId` primary key was unusable in the no-code layer). The runtime declaration alone changes
 * nothing for an already-installed app: `collections:db2cmCollections` skips collections whose meta
 * row exists, and the field meta rows are written once at registration time — the same reason
 * `users.wecomUserId` needed an explicit row in 20260907100000. Fresh installs get the row from the
 * db2cm copy instead, so both branches converge here through the count guard.
 *
 * Metadata only: the physical column (bigint + sequence + primary key + not null) already matches the
 * declaration, and field lifecycle hooks that would issue DDL do not run in a migration context.
 * `sort: 0` keeps the primary key ahead of the other fields (their sorts start at 1).
 *
 * Idempotent: re-running converges to the same meta state.
 */
export default class RegisterIdFieldMigration extends Migration {
  async up() {
    const fieldRepo = this.db.getRepository('fields');

    for (const collectionName of UI_COLLECTIONS) {
      const exists = await fieldRepo.count({ filter: { collectionName, name: primaryIdField.name } });
      if (exists) {
        continue;
      }
      await fieldRepo.create({ values: { ...primaryIdField, collectionName, sort: 0 } });
    }
  }

  async down() {
    // Intentionally a no-op: the meta row describes the runtime primary key that keeps existing;
    // removing it again would only hide `ID` from the no-code layer, not drop anything.
  }
}
