/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { normalizeV2RedirectPath, useApp } from '@nocobase/client-v2';
import type { Authenticator } from '@nocobase/plugin-auth/client-v2';
import { Button } from 'antd';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthFeishuTranslation } from '../locale';

export default function FeishuSignInButton({ authenticator }: { authenticator: Authenticator }) {
  const { t } = useAuthFeishuTranslation();
  const app = useApp();
  const [searchParams] = useSearchParams();

  const handleClick = () => {
    const { name } = authenticator;
    app.apiClient.auth.setAuthenticator(name);
    const redirectPath = normalizeV2RedirectPath(app, searchParams.get('redirect'));
    // The server callback takes everything after `redirect=` in `state` verbatim as the landing path, so it must stay un-encoded here.
    const state = `${window.location.origin}${window.location.pathname}?redirect=${redirectPath}`;
    const authUrl = app.getApiUrl(
      `auth:redirect?authenticator=${encodeURIComponent(name)}&state=${encodeURIComponent(state)}`,
    );
    window.location.href = authUrl;
  };

  return (
    <Button type="primary" block onClick={handleClick}>
      {t('Sign in with Feishu')}
    </Button>
  );
}
