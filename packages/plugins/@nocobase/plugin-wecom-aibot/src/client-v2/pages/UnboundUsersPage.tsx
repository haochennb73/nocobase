/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useFlowContext } from '@nocobase/flow-engine';
import { useDebounceFn, useMemoizedFn, useRequest } from 'ahooks';
import { Alert, App, Card, Modal, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo, useState } from 'react';
import { COLLECTIONS } from '../../constants';
import { useT } from '../locale';

interface UnboundUserRecord {
  fromUserId: string;
  messageCount: number;
  lastMessageAt: string | null;
  botIds: number[];
}

interface UserOption {
  value: number;
  label: string;
}

export default function UnboundUsersPage() {
  const t = useT();
  const ctx = useFlowContext();
  const { message } = App.useApp();
  const wecomResource = useMemo(() => ctx.api.resource('wecomAibot'), [ctx.api]);
  const botsResource = useMemo(() => ctx.api.resource(COLLECTIONS.bots), [ctx.api]);
  const usersResource = useMemo(() => ctx.api.resource('users'), [ctx.api]);

  const {
    data: records,
    loading,
    refresh,
  } = useRequest(async () => {
    const response = await wecomResource.unboundUsers();
    const payload = response?.data?.data;
    return Array.isArray(payload) ? (payload as UnboundUserRecord[]) : [];
  });

  // Bot names for the "bots" column tags.
  const { data: botNames } = useRequest(async () => {
    const response = await botsResource.list({ pageSize: 100 });
    const payload = response?.data?.data;
    const names = new Map<number, string>();
    if (Array.isArray(payload)) {
      for (const bot of payload as Array<{ id: number; name?: string }>) {
        names.set(bot.id, bot.name || `#${bot.id}`);
      }
    }
    return names;
  });

  const [bindingRecord, setBindingRecord] = useState<UnboundUserRecord | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>();
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchUserOptions = useMemoizedFn(async (keyword: string) => {
    setSearching(true);
    try {
      const filter = keyword
        ? { $or: [{ nickname: { $includes: keyword } }, { username: { $includes: keyword } }] }
        : {};
      const response = await usersResource.list({ filter, pageSize: 20, sort: ['-createdAt'] });
      const payload = response?.data?.data;
      const options: UserOption[] = Array.isArray(payload)
        ? (payload as Array<{ id: number; nickname?: string; username?: string }>).map((user) => ({
            value: user.id,
            label: `${user.nickname || user.username} (@${user.username})`,
          }))
        : [];
      setUserOptions(options);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  });

  const { run: debouncedSearch } = useDebounceFn(fetchUserOptions, { wait: 300 });

  const openBindModal = useMemoizedFn((record: UnboundUserRecord) => {
    setBindingRecord(record);
    setSelectedUserId(undefined);
    fetchUserOptions('');
  });

  const closeBindModal = useMemoizedFn(() => {
    setBindingRecord(null);
    setSelectedUserId(undefined);
    setUserOptions([]);
  });

  const handleBind = useMemoizedFn(async () => {
    if (!bindingRecord || selectedUserId == null) {
      return;
    }
    setSubmitting(true);
    try {
      await usersResource.update({
        filterByTk: selectedUserId,
        values: { wecomUserId: bindingRecord.fromUserId },
      });
      message.success(t('Binding succeeded'));
      closeBindModal();
      refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      // Unique constraint on users.wecomUserId surfaces as a database error.
      if (/duplicate|unique/i.test(text)) {
        message.error(t('This WeCom UserID is already bound to another NocoBase user.'));
      } else {
        message.error(text);
      }
    } finally {
      setSubmitting(false);
    }
  });

  const columns = useMemo<ColumnsType<UnboundUserRecord>>(
    () => [
      { title: t('WeCom UserID'), dataIndex: 'fromUserId', ellipsis: true },
      { title: t('Message count'), dataIndex: 'messageCount', width: 140 },
      {
        title: t('Last message at'),
        dataIndex: 'lastMessageAt',
        width: 190,
        render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
      },
      {
        title: t('Bots'),
        dataIndex: 'botIds',
        width: 220,
        render: (ids: number[]) => (
          <>
            {(ids || []).map((id) => (
              <Tag key={id}>{botNames?.get(id) || `#${id}`}</Tag>
            ))}
          </>
        ),
      },
      {
        title: t('Actions'),
        width: 120,
        render: (_, record) => <a onClick={() => openBindModal(record)}>{t('Bind')}</a>,
      },
    ],
    [botNames, openBindModal, t],
  );

  return (
    <Card variant="borderless">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('Unbound WeCom users')}
        description={t(
          'These WeCom users sent messages but are not bound to any NocoBase user. In strict mode their messages are archived but not processed. Bind them by selecting the matching NocoBase user; the binding writes users.wecomUserId.',
        )}
      />
      <Table<UnboundUserRecord>
        rowKey="fromUserId"
        loading={loading}
        columns={columns}
        dataSource={records || []}
        pagination={false}
      />
      <Modal
        title={t('Bind to NocoBase user')}
        open={!!bindingRecord}
        okText={t('Bind')}
        cancelText={t('Cancel')}
        confirmLoading={submitting}
        okButtonProps={{ disabled: selectedUserId == null }}
        onOk={handleBind}
        onCancel={closeBindModal}
        destroyOnClose
      >
        <p>
          {t('WeCom UserID')}: <strong>{bindingRecord?.fromUserId}</strong>
        </p>
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder={t('Search NocoBase users by nickname or username')}
          filterOption={false}
          loading={searching}
          options={userOptions}
          value={selectedUserId}
          onChange={(value) => setSelectedUserId(value)}
          onSearch={(keyword) => debouncedSearch(keyword)}
          notFoundContent={t('No matching users')}
        />
      </Modal>
    </Card>
  );
}
