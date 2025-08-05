// Phase 2.4.3: サマリー履歴API実装
// GET /api/v1/guilds/{guildId}/statistics/summaries
// 日次・週次・月次サマリーの履歴取得

import { FastifyPluginAsync } from 'fastify';
import type { 
  SummariesQuery, 
  SummariesResponse, 
  SummariesResponseMeta,
  APIResponse
} from '../../../../types/api';
import { PermissionLevel } from '../../../../types/api';
import { API_ERROR_CODES } from '../../../../types/api';
import { validateSummaryType, validatePagination, validateGuildId, validateDateRange } from '../../../../utils/validation';
import { getPeriodStart, getPeriodEnd } from '../../../../utils/period';

const summariesRoute: FastifyPluginAsync = async (fastify) => {
  // サマリー履歴取得エンドポイント
  fastify.get<{
    Params: { guildId: string };
    Querystring: SummariesQuery;
  }>('/:guildId/statistics/summaries', {
    preHandler: [
      fastify.authenticate,
      fastify.requirePermission(PermissionLevel.VIEW)
    ]
  }, async (request, reply) => {
    const { guildId } = request.params;
    const { 
      type, 
      from, 
      to, 
      limit = 30, 
      offset = 0 
    } = request.query;

    const requestId = fastify.generateRequestId();
    
    try {
      // バリデーション
      if (!type) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'type パラメータは必須です',
          details: {
            required: ['type'],
            allowed: ['daily', 'weekly', 'monthly']
          }
        }, requestId));
      }

      // サーバーID検証
      if (!validateGuildId(guildId)) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.INVALID_GUILD_ID,
          message: '無効なサーバーIDです',
          details: { guildId }
        }, requestId));
      }

      // サマリータイプ検証
      if (!validateSummaryType(type)) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: '無効なサマリータイプです',
          details: {
            field: 'type',
            value: type,
            validation: 'daily, weekly, monthly のいずれかを指定してください'
          }
        }, requestId));
      }

      // 日付範囲検証（オプション）
      if (from && to) {
        const dateValidation = validateDateRange(from, to);
        if (!dateValidation.isValid) {
          return reply.code(400).send(fastify.createErrorResponse({
            code: API_ERROR_CODES.INVALID_DATE_RANGE,
            message: '無効な日付範囲です',
            details: {
              field: 'date_range',
              validation: dateValidation.error
            }
          }, requestId));
        }
      }

      // ページネーション検証
      const pagination = validatePagination(limit, offset);

      // サーバー権限チェック
      const hasAccess = await fastify.checkGuildAccess(request.user!.userId, guildId);
      if (!hasAccess) {
        return reply.code(403).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.GUILD_NOT_FOUND,
          message: '指定されたサーバーにアクセスする権限がありません',
          details: { guildId }
        }, requestId));
      }

      // サマリーデータ取得
      const summaries = await fetchSummaries(
        fastify.db,
        guildId,
        type,
        from,
        to,
        pagination.limit,
        pagination.offset
      );

      // 総件数取得
      const totalCount = await getSummariesCount(
        fastify.db,
        guildId,
        type,
        from,
        to
      );

      // レスポンス構築
      const responseData: SummariesResponse = {
        summaries: summaries.map((summary: any) => ({
          id: summary.id,
          period: {
            key: summary.periodKey,
            start: getPeriodStart(type as any, summary.periodKey),
            end: getPeriodEnd(type as any, summary.periodKey)
          },
          metrics: {
            totalDuration: summary.totalDuration,
            totalParticipants: summary.totalParticipants,
            totalSessions: summary.totalSessions,
            longestSession: summary.longestSession
          },
          topUser: summary.topUserId ? {
            userId: summary.topUserId,
            username: summary.topUsername,
            duration: summary.topUserDuration
          } : null,
          notifications: {
            isNotified: summary.isNotified,
            notifiedAt: summary.notifiedAt
          }
        }))
      };

      const meta: SummariesResponseMeta = {
        timestamp: new Date().toISOString(),
        requestId,
        total: totalCount,
        hasMore: (pagination.offset + pagination.limit) < totalCount,
        summaryType: type
      };

      const response: APIResponse<SummariesResponse> = {
        data: responseData,
        meta
      };

      fastify.log.info(`Summaries fetched for guild ${guildId}: ${summaries.length} items, type: ${type}`);
      
      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`Error fetching summaries for guild ${guildId}:`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'サマリーの取得中にエラーが発生しました',
        details: { guildId, type }
      }, requestId));
    }
  });
};

/**
 * サマリーデータの取得
 */
async function fetchSummaries(
  client: any,
  guildId: string,
  type: 'daily' | 'weekly' | 'monthly',
  from?: string,
  to?: string,
  limit: number = 30,
  offset: number = 0
) {
  const tableName = `${type}_activity_summaries`;
  const dateColumn = type === 'daily' ? 'activityDate' : 
                     type === 'weekly' ? 'weekStart' : 'monthStart';
  
  let sql = `
    SELECT 
      id,
      ${type === 'daily' ? 'activityDate' : type === 'weekly' ? 'weekKey' : 'monthKey'} as periodKey,
      totalDuration,
      totalParticipants,
      totalSessions,
      longestSession,
      topUserId,
      topUsername,
      topUserDuration,
      isNotified,
      notifiedAt,
      createdAt
    FROM ${tableName}
    WHERE guildId = ?
  `;
  
  const args: any[] = [guildId];
  
  // 日付範囲フィルタ
  if (from && to) {
    sql += ` AND ${dateColumn} >= ? AND ${dateColumn} <= ?`;
    args.push(from, to);
  }
  
  // 順序とページネーション
  sql += ` ORDER BY ${dateColumn} DESC LIMIT ? OFFSET ?`;
  args.push(limit, offset);
  
  const result = await client.execute({
    sql,
    args
  });
  
  return result.rows;
}

/**
 * サマリー総件数の取得
 */
async function getSummariesCount(
  client: any,
  guildId: string,
  type: 'daily' | 'weekly' | 'monthly',
  from?: string,
  to?: string
): Promise<number> {
  const tableName = `${type}_activity_summaries`;
  const dateColumn = type === 'daily' ? 'activityDate' : 
                     type === 'weekly' ? 'weekStart' : 'monthStart';
  
  let sql = `SELECT COUNT(*) as count FROM ${tableName} WHERE guildId = ?`;
  const args: any[] = [guildId];
  
  if (from && to) {
    sql += ` AND ${dateColumn} >= ? AND ${dateColumn} <= ?`;
    args.push(from, to);
  }
  
  const result = await client.execute({
    sql,
    args
  });
  
  return result.rows[0]?.count || 0;
}

export default summariesRoute;