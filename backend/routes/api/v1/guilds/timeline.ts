// Phase 2.4.2: タイムラインAPI実装
// GET /api/v1/guilds/{guildId}/statistics/timeline
// 指定時間範囲での詳細セッション履歴

import { FastifyPluginAsync } from 'fastify';
import type { 
  TimelineQuery, 
  TimelineResponse, 
  TimelineResponseMeta,
  APIResponse
} from '../../../../types/api';
import { PermissionLevel } from '../../../../types/api';
import { API_ERROR_CODES } from '../../../../types/api';
import { generateTimeline } from '../../../../utils/statistics';
import { validateDateRange, validateGuildId } from '../../../../utils/validation';

const timelineRoute: FastifyPluginAsync = async (fastify) => {
  // タイムライン取得エンドポイント
  fastify.get<{
    Params: { guildId: string };
    Querystring: TimelineQuery;
  }>('/:guildId/statistics/timeline', {
    preHandler: [
      fastify.authenticate,
      fastify.requirePermission(PermissionLevel.VIEW)
    ]
  }, async (request, reply) => {
    const { guildId } = request.params;
    const { from, to } = request.query;

    const requestId = fastify.generateRequestId();
    
    try {
      // バリデーション
      if (!from || !to) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'from, to パラメータは必須です',
          details: {
            required: ['from', 'to'],
            provided: { from, to }
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

      // 日付範囲検証（タイムラインは時分秒を含むISO datetimeで受け取る）
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

      // 期間制限チェック（最大7日間）
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.INVALID_DATE_RANGE,
          message: 'タイムライン取得は最大7日間までです',
          details: {
            maxDays: 7,
            requestedDays: daysDiff
          }
        }, requestId));
      }

      // サーバー権限チェック
      const hasAccess = await fastify.checkGuildAccess(request.user!.userId, guildId);
      if (!hasAccess) {
        return reply.code(403).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.GUILD_NOT_FOUND,
          message: '指定されたサーバーにアクセスする権限がありません',
          details: { guildId }
        }, requestId));
      }

      // タイムライン生成
      const result = await generateTimeline(
        fastify.db,
        guildId,
        from,
        to
      );

      // チャンネル名の取得（Discord APIから）
      await enrichWithChannelNames(result.activities, guildId, fastify);

      // レスポンス構築
      const responseData: TimelineResponse = {
        activities: result.activities,
        summary: result.summary
      };

      const meta: TimelineResponseMeta = {
        timestamp: new Date().toISOString(),
        requestId,
        period: { from, to }
      };

      const response: APIResponse<TimelineResponse> = {
        data: responseData,
        meta
      };

      fastify.log.info(`Timeline generated for guild ${guildId}: ${result.activities.length} users, ${result.summary.totalSessions} sessions`);
      
      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`Error generating timeline for guild ${guildId}:`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'タイムラインの生成中にエラーが発生しました',
        details: { guildId, from, to }
      }, requestId));
    }
  });
};

/**
 * チャンネル名の補完（Discord APIから取得）
 */
async function enrichWithChannelNames(activities: any[], guildId: string, fastify: any) {
  try {
    const guild = fastify.discord.guilds.cache.get(guildId);
    if (!guild) return;

    for (const activity of activities) {
      for (const session of activity.sessions) {
        const channel = guild.channels.cache.get(session.channelId);
        if (channel) {
          session.channelName = channel.name;
        } else {
          session.channelName = `Channel-${session.channelId.substring(0, 8)}`;
        }
      }
    }
  } catch (error) {
    fastify.log.warn(`Failed to enrich channel names for guild ${guildId}:`, error);
    // チャンネル名の取得に失敗してもエラーにはしない
  }
}

export default timelineRoute;