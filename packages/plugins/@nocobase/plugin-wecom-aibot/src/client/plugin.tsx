/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import { Alert, Button, Card } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import models from './models';

const PACKAGE_NAME = '@nocobase/plugin-wecom-aibot';

// The full management UI (bot table, bound/unbound user pages) lives in client-v2 at
// /v/admin/settings/wecom-aibot. The legacy /admin plugin settings menu only gets this
// minimal redirect page, so BOTH admin UIs offer an entry point (issue #3).
const SETTINGS_PATH_V2 = '/v/admin/settings/wecom-aibot';

function WeComBotSettingsRedirect() {
  const { t } = useTranslation(PACKAGE_NAME);
  return (
    <Card variant="borderless">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('WeCom Bot Connector')}
        description={t('The bot management page runs in the modern admin UI. Click the button below to open it.')}
      />
      <Button
        type="primary"
        onClick={() => {
          window.location.href = SETTINGS_PATH_V2;
        }}
      >
        {t('Open configuration page')}
      </Button>
    </Card>
  );
}

export class PluginWecomAibotClient extends Plugin {
  async load() {
    this.flowEngine.registerModels(models);

    this.app.pluginSettingsManager.add(PACKAGE_NAME, {
      title: `{{t("WeCom Bot Connector", { ns: "${PACKAGE_NAME}" })}}`,
      icon: 'RobotOutlined',
      Component: WeComBotSettingsRedirect,
      aclSnippet: 'pm.wecom-aibot.view',
    });
  }
}

export default PluginWecomAibotClient;
