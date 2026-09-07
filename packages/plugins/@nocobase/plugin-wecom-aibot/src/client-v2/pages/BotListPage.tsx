/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useFlowContext } from '@nocobase/flow-engine';
import { useMemoizedFn, useRequest } from 'ahooks';
import { Alert, App, Badge, Button, Card, Flex, Space, Switch, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo } from 'react';
import { COLLECTIONS } from '../../constants';
import { useT } from '../locale';
import { BotFormView, type BotRecord } from './BotFormDrawer';

const STATUS_BADGE: Record<
  string,
  { status: 'success' | 'processing' | 'warning' | 'error' | 'default'; label: string }
> = {
  connected: { status: 'success', label: 'Connected' },
  connecting: { status: 'processing', label: 'Connecting' },
  reconnecting: { status: 'warning', label: 'Reconnecting' },
  error: { status: 'error', label: 'Error' },
  disconnected: { status: 'default', label: 'Disconnected' },
};

function normalizeListResponse(response: { data?: { data?: unknown; meta?: { count?: number } } }) {
  const payload = response?.data?.data;
  const records: BotRecord[] = Array.isArray(payload) ? payload : [];
  return {
    records,
    total: response?.data?.meta?.count || records.length,
  };
}

export default function BotListPage() {
  const t = useT();
  const ctx = useFlowContext();
  const { modal, message } = App.useApp();
  const resource = useMemo(() => ctx.api.resource(COLLECTIONS.bots), [ctx.api]);

  // Poll every 5s so connection status write-backs show up without manual refresh.
  const { data, loading, refresh } = useRequest(
    async () => {
      const response = await resource.list({ pageSize: 100, sort: ['id'] });
      return normalizeListResponse(response);
    },
    { pollingInterval: 5000, pollingWhenHidden: false },
  );

  const openForm = useMemoizedFn((mode: 'create' | 'edit', record?: BotRecord) => {
    ctx.viewer.drawer({
      width: '50%',
      closable: true,
      content: () => <BotFormView mode={mode} record={record} onSubmitted={() => refresh()} />,
    });
  });

  /**
   * Connect (and the enable switch's ON side) always asks for confirmation with the full
   * mutual-kick semantics up front — there is deliberately no separate "test connection"
   * action: a test connection is a real subscription and would kick the live one.
   */
  const confirmStart = useMemoizedFn((record: BotRecord) => {
    modal.confirm({
      title: t('Connect bot'),
      width: 600,
      content: (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>{t('About to open the long connection with Bot ID: {{botId}}.', { botId: record.botId })}</li>
          <li>
            {t(
              'WeCom allows only one live connection per Bot ID. Connecting here kicks any other connection of the same bot, and a kicked connection never auto-recovers — it must be reconnected manually.',
            )}
          </li>
          <li>{t('If the status turns to Error after connecting, check the Last error column for the reason.')}</li>
          <li>{t('The server must allow outbound WebSocket connections to wss://openws.work.weixin.qq.com.')}</li>
        </ul>
      ),
      async onOk() {
        const response = await resource.start({ filterByTk: record.id });
        const result = response?.data?.data as { ok?: boolean; error?: string } | undefined;
        if (result?.ok === false) {
          message.error(result.error || t('Failed to connect'));
        } else {
          message.success(t('Connecting'));
        }
        refresh();
      },
    });
  });

  const handleToggleEnabled = useMemoizedFn((record: BotRecord, checked: boolean) => {
    if (checked) {
      confirmStart(record);
      return;
    }
    modal.confirm({
      title: t('Disable bot'),
      content: t('Disabling disconnects the long connection. Pending replies of this bot will fail. Continue?'),
      async onOk() {
        await resource.stop({ filterByTk: record.id });
        message.success(t('Bot disabled'));
        refresh();
      },
    });
  });

  const handleStop = useMemoizedFn((record: BotRecord) => {
    modal.confirm({
      title: t('Disconnect'),
      content: t('Disconnect the long connection of this bot? The bot stays enabled and reconnects on next app start.'),
      async onOk() {
        await resource.stop({ filterByTk: record.id });
        refresh();
      },
    });
  });

  const handleDelete = useMemoizedFn((record: BotRecord) => {
    modal.confirm({
      title: t('Delete'),
      content: t('Are you sure you want to delete this bot? Message history tables are kept.'),
      async onOk() {
        await resource.destroy({ filterByTk: record.id });
        refresh();
      },
    });
  });

  const columns = useMemo<ColumnsType<BotRecord>>(
    () => [
      // Full display without ellipsis (issue 5a). The long Bot ID is intentionally not a
      // column (issue 5b) — it stays visible in the edit form only.
      { title: t('Name'), dataIndex: 'name' },
      {
        title: t('Enabled'),
        dataIndex: 'enabled',
        width: 90,
        render: (value: boolean, record) => (
          <Switch checked={!!value} onChange={(checked) => handleToggleEnabled(record, checked)} />
        ),
      },
      {
        title: t('Connection status'),
        dataIndex: 'connStatus',
        width: 150,
        render: (value: string) => {
          const badge = STATUS_BADGE[value] || STATUS_BADGE.disconnected;
          return <Badge status={badge.status} text={t(badge.label)} />;
        },
      },
      {
        title: t('Last connected at'),
        dataIndex: 'lastConnectedAt',
        width: 180,
        render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
      },
      {
        title: t('Last error'),
        dataIndex: 'lastError',
        ellipsis: { showTitle: false },
        render: (value: string | null) =>
          value ? (
            <Tooltip title={value} placement="topLeft">
              <span>{value}</span>
            </Tooltip>
          ) : (
            '-'
          ),
      },
      {
        title: t('Actions'),
        width: 220,
        render: (_, record) => (
          <Space wrap>
            <a onClick={() => openForm('edit', record)}>{t('Edit')}</a>
            <a onClick={() => confirmStart(record)}>{t('Connect')}</a>
            <a onClick={() => handleStop(record)}>{t('Disconnect')}</a>
            <a onClick={() => handleDelete(record)}>{t('Delete')}</a>
          </Space>
        ),
      },
    ],
    [confirmStart, handleDelete, handleStop, handleToggleEnabled, openForm, t],
  );

  return (
    <Card variant="borderless">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('Long-connection requirements')}
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>{t('The server must allow outbound WebSocket connections to wss://openws.work.weixin.qq.com.')}</li>
            <li>
              {t(
                'WeCom allows only one live connection per Bot ID. A connection kicked by a newer one never auto-recovers; reconnect it manually from this page (status shows Error with the reason).',
              )}
            </li>
            <li>
              {t(
                'Find Bot ID and Secret in WeCom Admin Console: App Management → Intelligent Bot → long-connection settings.',
              )}
            </li>
          </ul>
        }
      />
      <Flex justify="flex-end" style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refresh()}>
            {t('Refresh')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm('create')}>
            {t('Add Bot')}
          </Button>
        </Space>
      </Flex>
      <Table<BotRecord>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data?.records || []}
        pagination={false}
      />
    </Card>
  );
}
