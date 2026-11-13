/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Checkbox, Form, Input } from 'antd';
import React from 'react';
import { useAuthFeishuTranslation } from '../locale';

/**
 * Field paths must match the server reads in `feishu-auth.ts`: `options.appId` / `options.appSecret` and `options.public.autoSignup`.
 */
export default function FeishuAdminSettings() {
  const { t } = useAuthFeishuTranslation();

  return (
    <>
      <Form.Item name={['options', 'appId']} label={t('App ID')} rules={[{ required: true }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name={['options', 'appSecret']} label={t('App Secret')} rules={[{ required: true }]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item name={['options', 'public', 'autoSignup']} valuePropName="checked" initialValue={true}>
        <Checkbox>{t('Sign up automatically when the user does not exist')}</Checkbox>
      </Form.Item>
    </>
  );
}
