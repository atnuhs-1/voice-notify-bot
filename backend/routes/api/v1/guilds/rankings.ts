// Phase 2.4.1: ランキングAPI実装
// GET /api/v1/guilds/{guildId}/statistics/rankings
// 柔軟な期間指定・メトリクス指定・比較機能

import { FastifyPluginAsync } from 'fastify';
import type { 
  RankingQuery, 
  RankingResponse, 
  RankingResponseMeta,
  APIResponse
} from '../../../../types/api';
import { PermissionLevel } from '../../../../types/api';
import { API_ERROR_CODES } from '../../../../types/api';
import { calculateRankingWithComparison } from '../../../../utils/statistics';
import { validateDateRange, validateMetric } from '../../../../utils/validation';

const rankingsRoute: FastifyPluginAsync = async (fastify) => {
  // ランキング取得エンドポイント
  fastify.get<{
    Params: { guildId: string };
    Querystring: RankingQuery;
  }>('/:guildId/statistics/rankings', {
    preHandler: [
      fastify.authenticate,
      fastify.requirePermission(PermissionLevel.VIEW)
    ]
  }, async (request, reply) => {
    const { guildId } = request.params;
    const { 
      metric, 
      from, 
      to, 
      limit = 10, 
      compare = true 
    } = request.query;

    const requestId = fastify.generateRequestId();
    
    try {
      // バリデーション
      if (!metric || !from || !to) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'metric, from, to パラメータは必須です',
          details: {
            required: ['metric', 'from', 'to'],
            provided: { metric, from, to }
          }
        }, requestId));
      }

      // メトリクス検証
      if (!validateMetric(metric)) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: '無効なメトリクスが指定されました',
          details: {
            field: 'metric',
            value: metric,
            validation: 'duration, sessions, started_sessions のいずれかを指定してください'
          }
        }, requestId));
      }

      // 日付範囲検証
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

      // リミット検証
      const limitNum = Math.min(Math.max(parseInt(String(limit)) || 10, 1), 100);

      // サーバー権限チェック
      const hasAccess = await fastify.checkGuildAccess(request.user!.userId, guildId);
      if (!hasAccess) {
        return reply.code(403).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.GUILD_NOT_FOUND,
          message: '指定されたサーバーにアクセスする権限がありません',
          details: { guildId }
        }, requestId));
      }

      // ランキング計算
      const result = await calculateRankingWithComparison(
        fastify.db,
        guildId,
        metric,
        from,
        to,
        limitNum,
        compare
      );

      // レスポンス構築
      const responseData: RankingResponse = {
        rankings: result.rankings,
        period: result.period
      };

      const meta: RankingResponseMeta = {
        timestamp: new Date().toISOString(),
        requestId,
        totalParticipants: Number(result.totalParticipants),
        serverTotalDuration: Number(result.serverTotalDuration),
        metric,
        hasComparison: compare && result.period.previous !== undefined
      };

      const response: APIResponse<RankingResponse> = {
        data: responseData,
        meta
      };

      fastify.log.info(`Rankings fetched for guild ${guildId}: ${result.rankings.length} users, metric: ${metric}`);
      
      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`Error fetching rankings for guild ${guildId}:`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'ランキングの取得中にエラーが発生しました',
        details: { guildId, metric }
      }, requestId));
    }
  });
};

export default rankingsRoute;