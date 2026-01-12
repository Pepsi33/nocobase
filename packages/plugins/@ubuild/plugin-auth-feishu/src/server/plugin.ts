/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/server';
import { authType, namespace } from '../constants';
import { FeishuAuth } from './feishu-auth';
import { tval } from '@nocobase/utils';
import type { Context } from '@nocobase/actions';

export class PluginAuthFeishuServer extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    // 注册飞书认证类型
    this.app.authManager.registerTypes(authType, {
      auth: FeishuAuth,
      title: tval('Feishu', { ns: namespace }),
    });

    // 获取 auth 资源并添加 OAuth 授权跳转路由
    const authResource = this.app.resourceManager.getResource('auth');
    if (authResource) {
      // 注册 OAuth 授权跳转路由
      authResource.addAction('redirect', async (ctx, next) => {
        const authenticatorName = ctx.action.params?.authenticator || ctx.query?.authenticator;

        if (!authenticatorName) {
          ctx.throw(400, 'Authenticator name is required');
        }

        const authenticator = (await this.app.authManager.get(authenticatorName, ctx as any)) as FeishuAuth;
        const redirectUri = authenticator.getRedirectUri();
        const state = ctx.query?.state || '';

        const authUrl = authenticator.getAuthUrl(redirectUri, state);

        ctx.redirect(authUrl);
      });

      // 注册 OAuth 回调处理路由
      authResource.addAction('callback', async (ctx, next) => {
        const authenticatorName = ctx.query?.authenticator;
        const code = ctx.query?.code;
        const state = ctx.query?.state;

        if (!authenticatorName || !code) {
          ctx.throw(400, 'Authenticator name and code are required');
        }

        // 设置认证参数
        ctx.action.mergeParams({
          values: { code, state },
        });

        // 执行登录
        const authenticator = await this.app.authManager.get(authenticatorName, ctx as any);
        const result = await authenticator.signIn();

        // http://127.0.0.1:13000/signin?redirect=/admin
        // => http://127.0.0.1:13000/admin
        const redirectPath = state?.split('redirect=')[1] || '/admin';
        const redirectOrigin = new URL(state).origin;
        // 重定向到前端，携带 token
        // 使用 origin 获取基础 URL，或者从 request 中获取
        const origin = redirectOrigin || ctx.origin || `${ctx.request.protocol}://${ctx.request.host}`;
        const publicPath = process.env.APP_PUBLIC_PATH || '/';
        const redirectUrl = `${origin}${publicPath.replace(/\/$/, '')}${redirectPath}?token=${
          result.token
        }&authenticator=${authenticatorName}`;

        ctx.redirect(redirectUrl);
      });
    }

    // 允许公开访问授权和回调路由
    this.app.acl.allow('auth', ['redirect', 'callback'], 'public');
  }

  async install() {}

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default PluginAuthFeishuServer;
