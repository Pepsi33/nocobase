/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Button } from 'antd';
import React from 'react';
import { Authenticator } from '@nocobase/plugin-auth/client';
import { useT } from './locale';
import { useAPIClient } from '@nocobase/client';

export const SignInButton = ({ authenticator }: { authenticator: Authenticator }) => {
  const t = useT();
  const api = useAPIClient();

  const handleClick = async () => {
    const { name } = authenticator;
    api.auth.setAuthenticator(name);
    const redirect = window.location.href;
    const authUrl = `/api/auth:redirect?authenticator=${name}&state=${encodeURIComponent(redirect)}`;
    window.location.href = authUrl;
  };

  return (
    <Button type="primary" block onClick={handleClick}>
      {t('Sign in with Feishu')}
    </Button>
  );
};
