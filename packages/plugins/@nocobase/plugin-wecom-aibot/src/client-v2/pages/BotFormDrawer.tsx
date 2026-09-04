/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DrawerFormLayout } from '@nocobase/client-v2';
import { useFlowContext } from '@nocobase/flow-engine';
import { useMemoizedFn } from 'ahooks';
import { Form, Input, InputNumber, Switch } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { COLLECTIONS } from '../../constants';
import { useT } from '../locale';

export interface BotRecord {
  id?: number;
  name?: string;
  botId?: string;
  secret?: string;
  enabled?: boolean;
  connStatus?: string;
  lastConnectedAt?: string | null;
  lastError?: string | null;
  requireBinding?: boolean;
  unboundReplyText?: string;
  debounceMs?: number;
  maxWindowMs?: number;
  historyRounds?: number;
  sendRatePerMin?: number;
  welcomeMessage?: string;
  description?: string;
}

type BotFormValues = Omit<BotRecord, 'id' | 'enabled' | 'connStatus' | 'lastConnectedAt' | 'lastError'>;

export function BotFormView(props: { mode: 'create' | 'edit'; record?: BotRecord; onSubmitted: () => void }) {
  const t = useT();
  const ctx = useFlowContext();
  const resource = useMemo(() => ctx.api.resource(COLLECTIONS.bots), [ctx.api]);
  const [form] = Form.useForm<BotFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo<Partial<BotFormValues>>(() => {
    if (props.mode === 'edit' && props.record) {
      // The API returns the secret masked; never pre-fill it. Leaving it empty
      // on submit means "keep unchanged" (handled server-side).
      const { secret, ...rest } = props.record;
      return rest;
    }
    return {
      requireBinding: true,
      debounceMs: 10000,
      maxWindowMs: 60000,
      historyRounds: 5,
      sendRatePerMin: 25,
    };
  }, [props.mode, props.record]);

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  const handleSubmit = useMemoizedFn(async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (props.mode === 'create') {
        await resource.create({ values });
      } else if (props.record?.id != null) {
        await resource.update({ filterByTk: props.record.id, values });
      }
      props.onSubmitted();
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <DrawerFormLayout
      title={props.mode === 'create' ? t('Add Bot') : t('Edit Bot')}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitText={t('Submit')}
      cancelText={t('Cancel')}
    >
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <Form.Item
          name="name"
          label={t('Name')}
          rules={[{ required: true, message: t('The field value is required') }]}
        >
          <Input placeholder={t('e.g. Recruitment Assistant Bot')} maxLength={100} />
        </Form.Item>
        <Form.Item
          name="botId"
          label={t('Bot ID')}
          extra={t('From WeCom Admin Console: App Management → Intelligent Bot → long-connection settings.')}
          rules={[{ required: true, message: t('The field value is required') }]}
        >
          <Input disabled={props.mode === 'edit'} maxLength={64} />
        </Form.Item>
        <Form.Item
          name="secret"
          label={t('Secret')}
          rules={props.mode === 'create' ? [{ required: true, message: t('The field value is required') }] : []}
        >
          <Input.Password
            autoComplete="new-password"
            placeholder={props.mode === 'edit' ? t('Leave blank to keep unchanged') : undefined}
          />
        </Form.Item>
        <Form.Item
          name="requireBinding"
          label={t('Require user binding')}
          valuePropName="checked"
          extra={t(
            'Strict mode: messages from WeCom users not bound to a NocoBase user are archived but not processed, and a binding guide reply is sent (throttled to once per conversation per day).',
          )}
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="unboundReplyText"
          label={t('Unbound user guide reply')}
          extra={t('Leave blank to use the built-in guide text.')}
        >
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={500} />
        </Form.Item>
        <Form.Item
          name="debounceMs"
          label={t('Aggregation debounce (ms)')}
          extra={t('Consecutive messages within this window are merged into one task. 0 disables aggregation.')}
        >
          <InputNumber min={0} max={60000} step={1000} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="maxWindowMs"
          label={t('Aggregation hard cap (ms)')}
          extra={t('An aggregation window is force-flushed after this duration measured from its first message.')}
        >
          <InputNumber min={0} max={600000} step={1000} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="historyRounds"
          label={t('History rounds')}
          extra={t('How many recent completed Q&A rounds are injected into each task for multi-turn context.')}
        >
          <InputNumber min={0} max={20} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="sendRatePerMin"
          label={t('Send rate limit (msgs/min)')}
          extra={t('Keep it below the official cap of 30 messages per minute per bot.')}
        >
          <InputNumber min={1} max={30} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="welcomeMessage"
          label={t('Welcome message')}
          extra={t('Sent within 5 seconds when a user opens the chat for the day.')}
        >
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={500} />
        </Form.Item>
        <Form.Item name="description" label={t('Description')}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={500} />
        </Form.Item>
      </Form>
    </DrawerFormLayout>
  );
}

export default BotFormView;
