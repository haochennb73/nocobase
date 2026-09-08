/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { COLLECTIONS, I18N_NAMESPACE } from '../../constants';

const UI_COLLECTIONS = [
  COLLECTIONS.conversations,
  COLLECTIONS.receivedMessages,
  COLLECTIONS.sendMessages,
  COLLECTIONS.processTasks,
];

// Exact match of a bare title template `{{t("Key")}}` (no options argument).
const BARE_TEMPLATE = /^\{\{t\("([^"]+)"\)\}\}$/;

const qualify = (value: string): string => {
  const match = BARE_TEMPLATE.exec(value);
  return match ? `{{t("${match[1]}", { ns: "${I18N_NAMESPACE}" })}}` : value;
};

const transform = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return qualify(value);
  }
  if (Array.isArray(value)) {
    return value.map(transform);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = transform(item);
    }
    return result;
  }
  return value;
};

/**
 * Stored collection-manager meta rows carry bare `{{t("Key")}}` title templates. A bare
 * template compiles against the core `client` i18n namespace, so plugin-only keys (e.g.
 * "WeCom message ID") fall back to raw English while keys that coincide with core ones
 * render translated — mixed-language field names in the data source UI.
 *
 * The code definitions now spell out the plugin namespace
 * (`{{t("Key", { ns: "@nocobase/plugin-wecom-aibot" })}}`, same convention as
 * plugin-workflow-manual). Meta rows win over code definitions at app boot, so this
 * migration rewrites the stored rows into the qualified form:
 * - `collections.title` (and any template inside `collections.options`) of the four
 *   UI-managed collections;
 * - every template string inside `fields.options` of those collections (uiSchema.title,
 *   enum labels);
 * - the `users.wecomUserId` field row created by 20260907100000.
 *
 * Idempotent: qualified templates no longer match the bare pattern. Metadata only —
 * no table/column shape is touched, and other collections are never selected.
 */
export default class QualifyTitleNamespaceMigration extends Migration {
  async up() {
    const collectionRepo = this.db.getRepository('collections');
    for (const name of UI_COLLECTIONS) {
      const row = await collectionRepo.findOne({ filter: { name } });
      if (!row) {
        continue;
      }
      const values: Record<string, unknown> = {};
      const title: unknown = row.get('title');
      if (typeof title === 'string') {
        const nextTitle = qualify(title);
        if (nextTitle !== title) {
          values.title = nextTitle;
        }
      }
      const options: unknown = row.get('options') || {};
      const nextOptions = transform(options);
      if (JSON.stringify(nextOptions) !== JSON.stringify(options)) {
        values.options = nextOptions;
      }
      if (Object.keys(values).length) {
        await collectionRepo.update({ filter: { name }, values });
      }
    }

    const fieldRepo = this.db.getRepository('fields');
    const fieldFilters: Array<Record<string, string>> = [
      ...UI_COLLECTIONS.map((collectionName) => ({ collectionName })),
      { collectionName: 'users', name: 'wecomUserId' },
    ];
    for (const filter of fieldFilters) {
      const rows = await fieldRepo.find({ filter });
      for (const row of rows) {
        const options = (row.get('options') || {}) as Record<string, unknown>;
        const nextOptions = transform(options) as Record<string, unknown>;
        if (JSON.stringify(nextOptions) === JSON.stringify(options)) {
          continue;
        }
        // Spread pattern (same as 20260908100000): MagicAttributeModel folds the
        // non-column keys back into the `options` json column, real columns stay put.
        await fieldRepo.update({
          filter: { collectionName: row.get('collectionName'), name: row.get('name') },
          values: { ...nextOptions },
        });
      }
    }
  }

  async down() {
    // Intentionally a no-op: reverting to bare templates would reintroduce the
    // mixed-language display names.
  }
}
