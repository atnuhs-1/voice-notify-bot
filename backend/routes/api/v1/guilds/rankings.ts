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
import { PermissionLevel, API_ERROR_CODES } from '../../../../types/api';
import { calculateRankingWithComparison } from '../../../../utils/statistics';
import { validateDateRange, validateMetric } from '../../../../utils/validation';
import { calculatePresetPeriod, isValidPreset, getPresetDescription, type PeriodPreset } from '../../../../utils/presets';

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
      period,
      from, 
      to, 
      limit = 10, 
      compare = true 
    } = request.query;

    const requestId = fastify.generateRequestId();
    
    try {
      // 1. 基本バリデーション（metricは必須）
      if (!metric) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'metric パラメータは必須です',
          details: {
            required: ['metric'],
            provided: { metric, period, from, to }
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

      // 2. ハイブリッド期間パラメータの処理
      let finalFrom: string;
      let finalTo: string;
      let searchType: 'preset' | 'custom';
      let presetName: string | undefined;
      let isOptimized: boolean;

      if (period) {
        // プリセット期間優先
        if (!isValidPreset(period)) {
          return reply.code(400).send(fastify.createErrorResponse({
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: '無効なプリセット期間が指定されました',
            details: {
              field: 'period',
              value: period,
              validation: 'this_week, last_week, this_month, last_month, last_7_days, last_30_days, this_year, last_year のいずれかを指定してください'
            }
          }, requestId));
        }

        const periodResult = calculatePresetPeriod(period as PeriodPreset);
        finalFrom = periodResult.from;
        finalTo = periodResult.to;
        searchType = 'preset';
        presetName = period;
        isOptimized = periodResult.isISOBoundary;

        console.log(`📅 Preset period: ${period} (${getPresetDescription(period as PeriodPreset)}) → ${finalFrom} to ${finalTo} (optimized: ${isOptimized})`);

      } else if (from && to) {
        // カスタム期間
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

        finalFrom = from;
        finalTo = to;
        searchType = 'custom';
        presetName = undefined;
        isOptimized = false; // カスタム期間は最適化判定をランキング計算内で実行

        console.log(`📅 Custom period: ${finalFrom} to ${finalTo}`);

      } else {
        // デフォルト（今週）
        const defaultPeriod = calculatePresetPeriod('this_week');
        finalFrom = defaultPeriod.from;
        finalTo = defaultPeriod.to;
        searchType = 'preset';
        presetName = 'this_week';
        isOptimized = true;

        console.log(`📅 Default period: this_week → ${finalFrom} to ${finalTo}`);
      }

      // 3. リミット検証
      const limitNum = Math.min(Math.max(parseInt(String(limit)) || 10, 1), 100);

      // 4. サーバー権限チェック
      const hasAccess = await fastify.checkGuildAccess(request.user!.userId, guildId);
      if (!hasAccess) {
        return reply.code(403).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.GUILD_NOT_FOUND,
          message: '指定されたサーバーにアクセスする権限がありません',
          details: { guildId }
        }, requestId));
      }

      // 5. 統一されたランキング計算
      const result = await calculateRankingWithComparison(
        fastify.db,
        guildId,
        metric,
        finalFrom,
        finalTo,
        limitNum,
        compare
      );

      // 6. レスポンス構築（ハイブリッド情報付き）
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
        hasComparison: compare && result.period.previous !== undefined,
        searchType,
        preset: presetName,
        isOptimized: isOptimized || (result as any).isCustomPeriod === false // 統計計算結果からも判定
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