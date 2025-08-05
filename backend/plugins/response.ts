/**
 * 統一APIレスポンス形式プラグイン
 * 新API設計での統一レスポンス形式とエラーハンドリングを提供
 */

import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { APIResponse, APIResponseMeta, APIError, APIErrorCode, API_ERROR_CODES } from '../types/api';

// リクエストIDを生成するユーティリティ
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// 統一レスポンス形式のヘルパー関数
declare module 'fastify' {
  interface FastifyReply {
    success<T>(data: T, meta?: Partial<APIResponseMeta>): FastifyReply;
    error(
      code: APIErrorCode,
      message: string,
      statusCode?: number,
      details?: any
    ): FastifyReply;
    validationError(
      message: string,
      field?: string,
      value?: any,
      validation?: string
    ): FastifyReply;
    notFound(resource: string, id?: string): FastifyReply;
    forbidden(message?: string, details?: any): FastifyReply;
    unauthorized(message?: string): FastifyReply;
  }
}

const responsePlugin: FastifyPluginAsync = async (fastify) => {
  // リクエスト開始時にリクエストIDを設定
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    (request as any).requestId = generateRequestId();
  });

  // 成功レスポンスのヘルパー
  fastify.decorateReply('success', function <T>(
    this: FastifyReply,
    data: T,
    meta: Partial<APIResponseMeta> = {}
  ) {
    const request = this.request as any;
    const response: APIResponse<T> = {
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.requestId || generateRequestId(),
        ...meta
      }
    };

    return this.code(200).send(response);
  });

  // エラーレスポンスのヘルパー
  fastify.decorateReply('error', function (
    this: FastifyReply,
    code: APIErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any
  ) {
    const request = this.request as any;
    const error: APIError = {
      code,
      message,
      ...(details && { details })
    };

    const response: APIResponse<null> = {
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.requestId || generateRequestId()
      },
      error
    };

    return this.code(statusCode).send(response);
  });

  // バリデーションエラーのヘルパー
  fastify.decorateReply('validationError', function (
    this: FastifyReply,
    message: string,
    field?: string,
    value?: any,
    validation?: string
  ) {
    const details: any = {};
    if (field) details.field = field;
    if (value !== undefined) details.value = value;
    if (validation) details.validation = validation;

    return this.error(
      API_ERROR_CODES.VALIDATION_ERROR,
      message,
      400,
      Object.keys(details).length > 0 ? details : undefined
    );
  });

  // 404エラーのヘルパー
  fastify.decorateReply('notFound', function (
    this: FastifyReply,
    resource: string,
    id?: string
  ) {
    const message = id 
      ? `指定された${resource}が見つかりません`
      : `${resource}が見つかりません`;
    
    const details = id ? { [`${resource}Id`]: id } : undefined;

    return this.error(
      getResourceNotFoundCode(resource),
      message,
      404,
      details
    );
  });

  // 403エラーのヘルパー
  fastify.decorateReply('forbidden', function (
    this: FastifyReply,
    message: string = 'この操作を実行する権限がありません',
    details?: any
  ) {
    return this.error(
      API_ERROR_CODES.INSUFFICIENT_PERMISSION,
      message,
      403,
      details
    );
  });

  // 401エラーのヘルパー
  fastify.decorateReply('unauthorized', function (
    this: FastifyReply,
    message: string = '認証が必要です'
  ) {
    return this.error(
      API_ERROR_CODES.AUTH_REQUIRED,
      message,
      401
    );
  });

  // グローバルエラーハンドラー
  fastify.setErrorHandler(async (error, request, reply) => {
    const requestId = (request as any).requestId || generateRequestId();

    // ログ出力
    fastify.log.error({
      requestId,
      error: {
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode
      },
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        query: request.query,
        params: request.params
      }
    }, 'API Error occurred');

    // 既にレスポンスが送信済みの場合はスキップ
    if (reply.sent) {
      return;
    }

    // Discord.js関連のエラー
    if (error.message.includes('Missing Permissions')) {
      return reply.error(
        API_ERROR_CODES.DISCORD_PERMISSION_ERROR,
        'Botがこの操作を実行する権限がありません',
        403,
        { discordError: error.message }
      );
    }

    // レート制限エラー
    if (error.message.includes('rate limit') || error.statusCode === 429) {
      return reply.error(
        API_ERROR_CODES.DISCORD_RATE_LIMIT,
        'レート制限に達しました。しばらく時間をおいてから再試行してください',
        429,
        { retryAfter: (error as any).headers?.['retry-after'] }
      );
    }

    // バリデーションエラー（Fastify標準）
    if (error.validation) {
      const validationDetails = error.validation.map((v: any) => ({
        field: v.instancePath || v.dataPath,
        message: v.message,
        value: v.data
      }));

      return reply.error(
        API_ERROR_CODES.VALIDATION_ERROR,
        'リクエストパラメータが無効です',
        400,
        { validation: validationDetails }
      );
    }

    // データベースエラー
    if (error.message.includes('database') || error.message.includes('SQL')) {
      return reply.error(
        API_ERROR_CODES.DATABASE_ERROR,
        'データベースエラーが発生しました',
        500,
        process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined
      );
    }

    // HTTPステータスコードがある場合
    if (error.statusCode) {
      const statusCode = error.statusCode;
      let apiErrorCode: APIErrorCode;
      let message: string;

      switch (statusCode) {
        case 400:
          apiErrorCode = API_ERROR_CODES.VALIDATION_ERROR;
          message = 'リクエストが無効です';
          break;
        case 401:
          apiErrorCode = API_ERROR_CODES.AUTH_REQUIRED;
          message = '認証が必要です';
          break;
        case 403:
          apiErrorCode = API_ERROR_CODES.INSUFFICIENT_PERMISSION;
          message = 'この操作を実行する権限がありません';
          break;
        case 404:
          apiErrorCode = API_ERROR_CODES.GUILD_NOT_FOUND;
          message = 'リソースが見つかりません';
          break;
        case 503:
          apiErrorCode = API_ERROR_CODES.SERVICE_UNAVAILABLE;
          message = 'サービスが一時的に利用できません';
          break;
        default:
          apiErrorCode = API_ERROR_CODES.INTERNAL_SERVER_ERROR;
          message = '内部サーバーエラーが発生しました';
      }

      return reply.error(apiErrorCode, message, statusCode);
    }

    // その他の予期しないエラー
    return reply.error(
      API_ERROR_CODES.INTERNAL_SERVER_ERROR,
      '内部サーバーエラーが発生しました',
      500,
      process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined
    );
  });

  // 404ハンドラー（ルートが見つからない場合）
  fastify.setNotFoundHandler(async (request, reply) => {
    return reply.error(
      API_ERROR_CODES.GUILD_NOT_FOUND,
      'リクエストされたエンドポイントが見つかりません',
      404,
      { path: request.url, method: request.method }
    );
  });
};

// リソース名から適切なエラーコードを取得
function getResourceNotFoundCode(resource: string): APIErrorCode {
  switch (resource.toLowerCase()) {
    case 'guild':
    case 'server':
      return API_ERROR_CODES.GUILD_NOT_FOUND;
    case 'user':
      return API_ERROR_CODES.USER_NOT_FOUND;
    case 'channel':
      return API_ERROR_CODES.CHANNEL_NOT_FOUND;
    case 'schedule':
      return API_ERROR_CODES.SCHEDULE_NOT_FOUND;
    default:
      return API_ERROR_CODES.GUILD_NOT_FOUND; // デフォルト
  }
}

export default fp(responsePlugin, {
  name: 'response',
  dependencies: ['support'] // supportプラグインに依存
});