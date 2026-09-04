/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client-v2';
import type { Application } from '@nocobase/client-v2';

const MENU_KEY = 'wecom-aibot';

export class PluginWecomAibotClientV2 extends Plugin<Record<string, never>, Application> {
  async load() {
    this.pluginSettingsManager.addMenuItem({
      key: MENU_KEY,
      title: this.t('WeCom AI Bot'),
      icon: 'RobotOutlined',
      aclSnippet: 'pm.wecom-aibot.view',
    });

    this.pluginSettingsManager.addPageTabItem({
      menuKey: MENU_KEY,
      key: 'index',
      title: this.t('Bot Management'),
      aclSnippet: 'pm.wecom-aibot.bots',
      sort: 1,
      componentLoader: () => import('./pages/BotListPage'),
    });

    this.pluginSettingsManager.addPageTabItem({
      menuKey: MENU_KEY,
      key: 'unbound-users',
      title: this.t('Unbound Users'),
      aclSnippet: 'pm.wecom-aibot.view',
      sort: 2,
      componentLoader: () => import('./pages/UnboundUsersPage'),
    });
  }
}

export default PluginWecomAibotClientV2;
