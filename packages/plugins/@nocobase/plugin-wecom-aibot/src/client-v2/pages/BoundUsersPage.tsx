/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useFlowContext } from '@nocobase/flow-engine';
import { useMemoizedFn, useRequest } from 'ahooks';
import { Alert, App, Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo } from 'react';
import { useT } from '../locale';

interface BoundUserRecord {
  id: number;
  username?: string;
  nickname?: string;
  wecomUserId?: string;
}

export default function BoundUsersPage() {
  const t = useT();
  const ctx = useFlowContext();
  const { modal, message } = App.useApp();
  const usersResource = useMemo(() => ctx.api.resource('users'), [ctx.api]);

  const { data, loading, refresh } = useRequest(async () => {
    const response = await usersResource.list({
      filter: { wecomUserId: { $notEmpty: true } },
      // NOTE: `fields`, not `attributes` — `attributes` silently drops the filter.
      fields: ['id', 'username', 'nickname', 'wecomUserId'],
      sort: ['id'],
      pageSize: 200,
    });
    const payload = response?.data?.data;
    const records: BoundUserRecord[] = Array.isArray(payload) ? payload : [];
    return { records, total: response?.data?.meta?.count || records.length };
  });

  const handleUnbind = useMemoizedFn((record: BoundUserRecord) => {
    modal.confirm({
      title: t('Unbind WeCom UserID'),
      content: t(
        'After unbinding, messages from this WeCom user are treated as unbound again (archived only in strict mode). Continue?',
      ),
      async onOk() {
        try {
          await usersResource.update({ filterByTk: record.id, values: { wecomUserId: null } });
          message.success(t('Unbound successfully'));
          refresh();
        } catch (err) {
          message.error(err instanceof Error ? err.message : String(err));
        }
      },
    });
  });

  const columns = useMemo<ColumnsType<BoundUserRecord>>(
    () => [
      { title: t('Username'), dataIndex: 'username', render: (value: string | null) => value || '-' },
      { title: t('Nickname'), dataIndex: 'nickname', render: (value: string | null) => value || '-' },
      { title: t('WeCom UserID'), dataIndex: 'wecomUserId', ellipsis: true },
      {
        title: t('Actions'),
        width: 120,
        render: (_, record) => <a onClick={() => handleUnbind(record)}>{t('Unbind')}</a>,
      },
    ],
    [handleUnbind, t],
  );

  return (
    <Card variant="borderless">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('Bound WeCom users')}
        description={t(
          'NocoBase users with a WeCom UserID binding (users.wecomUserId). Their messages are processed with the bound user identity. The WeCom long-connection protocol only carries the userid — the bound nickname/username is the human-readable identity shown in conversation records.',
        )}
      />
      <Table<BoundUserRecord>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data?.records || []}
        pagination={false}
      />
    </Card>
  );
}
