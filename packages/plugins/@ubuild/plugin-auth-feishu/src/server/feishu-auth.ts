/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { AuthConfig, BaseAuth } from '@nocobase/auth';
import { Model } from '@nocobase/database';
import { AuthModel } from '@nocobase/plugin-auth';
import axios from 'axios';
import { namespace } from '../constants';

const FEISHU_AUTH_URL = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';
const FEISHU_TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token';
const FEISHU_USER_INFO_URL = 'https://open.feishu.cn/open-apis/authen/v1/user_info';

export class FeishuAuth extends BaseAuth {
  constructor(config: AuthConfig) {
    const { ctx } = config;
    super({
      ...config,
      userCollection: ctx.db.getCollection('users'),
    });
  }

  /**
   * 获取飞书授权 URL
   * 根据飞书官方文档：https://open.feishu.cn/document/sso/web-application-sso/login-overview
   */
  getAuthUrl(redirectUri: string, state?: string): string {
    const { appId } = this.authenticator.options || {};
    if (!appId) {
      this.ctx.throw(400, 'Feishu App ID is not configured');
    }

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state || '',
    });

    // 使用 accounts.feishu.cn 作为授权域名
    return `${FEISHU_AUTH_URL}?${params.toString()}`;
  }

  /**
   * 通过授权码获取访问令牌
   * 根据飞书官方文档：https://open.feishu.cn/document/sso/web-application-sso/obtain-access-token
   */
  async getAccessToken(code: string, redirectUri: string): Promise<any> {
    const { appId, appSecret } = this.authenticator.options || {};
    if (!appId || !appSecret) {
      this.ctx.throw(400, 'Feishu App ID or Secret is not configured');
    }

    try {
      // 飞书 v2 OAuth API 使用 client_id 和 client_secret（与授权 URL 保持一致）
      const requestData = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: appId,
        client_secret: appSecret,
      };

      this.ctx.logger.debug('Requesting Feishu access token', {
        url: FEISHU_TOKEN_URL,
        redirect_uri: redirectUri,
        has_code: !!code,
      });

      const response = await axios.post(FEISHU_TOKEN_URL, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // v2 API 返回格式：{ code: 0, msg: 'success', data: { ... } }
      if (response.data.code !== 0) {
        this.ctx.logger.error('Feishu API error', {
          code: response.data.code,
          msg: response.data.msg,
          data: response.data,
        });
        throw new Error(response.data.msg || `Feishu API error: ${response.data.code}`);
      }

      return response.data;
    } catch (error: any) {
      this.ctx.logger.error('Failed to get Feishu access token', {
        error: error.message,
        response: error?.response?.data,
        status: error?.response?.status,
        redirect_uri: redirectUri,
      });

      const errorMessage =
        error?.response?.data?.msg ||
        error?.response?.data?.error_description ||
        error?.message ||
        'Failed to get access token from Feishu';

      this.ctx.throw(500, errorMessage);
    }
  }

  /**
   * 通过访问令牌获取用户信息
   * 根据飞书官方文档：https://open.feishu.cn/document/sso/web-application-sso/get-user-info
   */
  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await axios.get(FEISHU_USER_INFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // 飞书 API 返回格式：{ code: 0, msg: 'success', data: { ... } }
      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Failed to get user info');
      }

      return response.data.data;
    } catch (error: any) {
      this.ctx.logger.error('Failed to get Feishu user info', error);
      const errorMessage = error?.response?.data?.msg || error?.message || 'Failed to get user info from Feishu';
      this.ctx.throw(500, errorMessage);
    }
  }

  /**
   * 获取回调 URL
   * 注意：
   * 1. 此 URL 必须在飞书开放平台的应用配置中预先注册（不包含查询参数）
   * 2. 飞书会在回调时自动添加 code 和 state 参数
   * 3. authenticator 参数需要在回调处理时从请求中获取
   */
  getRedirectUri(): string {
    const { protocol, host } = this.ctx.request;
    // 使用 API_BASE_PATH 环境变量或默认 '/api'
    const apiBasePath = process.env.API_BASE_PATH || '/api';
    // 确保路径格式正确：/api/auth:callback
    const basePath = apiBasePath.endsWith('/') ? apiBasePath : `${apiBasePath}/`;
    const callbackUrl = `${protocol}://${host}${basePath}auth:callback?authenticator=${this.authenticator.name}`;

    this.ctx.logger.debug('Feishu redirect URI', { callbackUrl });

    return callbackUrl;
  }

  /**
   * 验证用户身份
   */
  async validate(): Promise<Model> {
    const ctx = this.ctx;
    const { code, state } = ctx.action.params.values || {};

    if (!code) {
      ctx.throw(400, 'Authorization code is required');
    }

    // 获取回调 URL
    const redirectUri = this.getRedirectUri();

    // 通过授权码获取访问令牌
    const tokenData = await this.getAccessToken(code, redirectUri);
    const { access_token, open_id } = tokenData;

    if (!access_token) {
      ctx.throw(500, 'Failed to get access token from Feishu');
    }

    // 获取用户信息
    const userInfo = await this.getUserInfo(access_token);

    // 使用 open_id 作为唯一标识
    const uuid = open_id || userInfo.open_id;
    if (!uuid) {
      ctx.throw(400, 'Failed to get user identifier from Feishu');
    }

    const authenticator = this.authenticator as AuthModel;
    const { autoSignup } = this.authenticator.options?.public || {};

    let user: Model;

    // 查找或创建用户
    if (autoSignup) {
      user = await authenticator.findOrCreateUser(uuid, {
        nickname: userInfo.name || userInfo.en_name || uuid,
        username: userInfo.name || userInfo.en_name || uuid,
        email: userInfo.email,
        avatar: userInfo.avatar_url,
      });
    } else {
      user = await authenticator.findUser(uuid);
      if (!user) {
        ctx.throw(401, ctx.t('User not found. Please contact administrator.', { ns: namespace }));
      }
    }

    // 如果用户已存在但未关联，则关联
    if (user) {
      const users = await authenticator.getUsers({
        through: {
          where: { uuid },
        },
      });
      if (users.length === 0) {
        await authenticator.addUser(user, {
          through: {
            uuid,
          },
        });
      }
    }

    return user;
  }
}
