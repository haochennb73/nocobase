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
import { wecomUserIdField } from '../collections/extend-users';

interface Db2cmCollectionsRepository {
  db2cmCollections?: (names: string[]) => Promise<void>;
}

/**
 * Register the plugin's runtime collections/fields into the collection manager so they
 * become visible in the admin UI (data source management, block pickers, workflow pickers):
 *
 * 1. `uiManageable: true` collections are copied into the `collections` meta table via
 *    CollectionRepository.db2cmCollections (idempotent — existing meta rows are skipped).
 *    RC01_wecom_bots intentionally stays code-only (encrypted secret, dedicated settings page).
 * 2. `users.wecomUserId` needs an explicit `fields` meta row: the `users` collection meta row
 *    already exists, so db2cm('users') would skip it entirely (same pattern as
 *    plugin-departments creating the users.departments field meta row in install()).
 */
export default class RegisterUiCollectionsMigration extends Migration {
  async up() {
    const collectionRepo = this.db.getRepository('collections') as Db2cmCollectionsRepository;
    if (typeof collectionRepo?.db2cmCollections === 'function') {
      await collectionRepo.db2cmCollections([
        COLLECTIONS.conversations,
        COLLECTIONS.receivedMessages,
        COLLECTIONS.sendMessages,
        COLLECTIONS.processTasks,
      ]);
    }

    const fieldRepo = this.db.getRepository('fields');
    if (fieldRepo) {
      const exists = await fieldRepo.count({
        filter: { name: 'wecomUserId', collectionName: 'users' },
      });
      if (!exists) {
        await fieldRepo.create({ values: { ...wecomUserIdField } });
      }
    }
  }

  async down() {
    // Intentionally a no-op: destroying `collections`/`fields` meta rows can cascade into
    // removing the runtime collections (and their tables/columns) on the next sync, which
    // must never happen for a reversible metadata registration.
  }
}
