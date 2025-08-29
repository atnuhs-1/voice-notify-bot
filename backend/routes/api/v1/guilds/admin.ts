// Phase 4: 管理者向けAPI実装
// サマリー生成テスト・手動実行用API

import { FastifyPluginAsync } from 'fastify';
import type { APIResponse } from '../../../../types/api';
import { PermissionLevel, API_ERROR_CODES } from '../../../../types/api';

const adminRoute: FastifyPluginAsync = async (fastify) => {
  
  // 手動サマリー生成API（テスト・管理用）
  fastify.post<{
    Params: { guildId: string };
    Body: {
      type: 'daily' | 'weekly' | 'monthly';
      force?: boolean; // 既存データを上書き
    };
  }>('/:guildId/admin/generate-summary', {
    preHandler: [
      fastify.authenticate,
      fastify.requirePermission(PermissionLevel.EXECUTE) // 実行権限必要
    ]
  }, async (request, reply) => {
    const { guildId } = request.params;
    const { type, force = false } = request.body;
    const requestId = fastify.generateRequestId();

    try {
      // サーバー権限チェック
      const hasAccess = await fastify.checkGuildAccess(request.user!.userId, guildId);
      if (!hasAccess) {
        return reply.code(403).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.GUILD_NOT_FOUND,
          message: '指定されたサーバーにアクセスする権限がありません',
          details: { guildId }
        }, requestId));
      }

      // 手動サマリー生成を実行
      let result: any;
      const generateSummary = (fastify as any).generateSummary;

      switch (type) {
        case 'daily':
          // 既存チェック
          if (!force) {
            const today = new Date().toISOString().split('T')[0];
            const existing = await fastify.dbHelpers.getDailySummary(guildId, today);
            if (existing) {
              return reply.code(400).send(fastify.createErrorResponse({
                code: API_ERROR_CODES.SUMMARY_ALREADY_EXISTS,
                message: '本日の日次サマリーは既に生成済みです',
                details: { 
                  guildId, 
                  date: today,
                  summary: existing,
                  hint: 'force=true で上書き可能です'
                }
              }, requestId));
            }
          }
          
          await generateSummary.daily(guildId);
          result = { type: 'daily', message: '日次サマリーを生成しました' };
          break;

        case 'weekly':
          const periods = await fastify.dbHelpers.getCurrentPeriodKeys();
          
          if (!force) {
            const existing = await fastify.dbHelpers.query({
              sql: 'SELECT * FROM weekly_activity_summaries WHERE guildId = ? AND weekKey = ?',
              args: [guildId, periods.currentWeek]
            });
            if (existing.rows.length > 0) {
              return reply.code(400).send(fastify.createErrorResponse({
                code: API_ERROR_CODES.SUMMARY_ALREADY_EXISTS,
                message: '今週の週次サマリーは既に生成済みです',
                details: { 
                  guildId, 
                  weekKey: periods.currentWeek,
                  summary: existing.rows[0],
                  hint: 'force=true で上書き可能です'
                }
              }, requestId));
            }
          }
          
          await generateSummary.weekly(guildId, force);
          result = { type: 'weekly', message: '週次サマリーを生成しました', weekKey: periods.currentWeek };
          break;

        case 'monthly':
          const monthPeriods = await fastify.dbHelpers.getCurrentPeriodKeys();
          
          if (!force) {
            const existing = await fastify.dbHelpers.query({
              sql: 'SELECT * FROM monthly_activity_summaries WHERE guildId = ? AND monthKey = ?',
              args: [guildId, monthPeriods.currentMonth]
            });
            if (existing.rows.length > 0) {
              return reply.code(400).send(fastify.createErrorResponse({
                code: API_ERROR_CODES.SUMMARY_ALREADY_EXISTS,
                message: '今月の月次サマリーは既に生成済みです',
                details: { 
                  guildId, 
                  monthKey: monthPeriods.currentMonth,
                  summary: existing.rows[0],
                  hint: 'force=true で上書き可能です'
                }
              }, requestId));
            }
          }
          
          await generateSummary.monthly(guildId);
          result = { type: 'monthly', message: '月次サマリーを生成しました', monthKey: monthPeriods.currentMonth };
          break;

        default:
          return reply.code(400).send(fastify.createErrorResponse({
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: '無効なサマリータイプです',
            details: { 
              field: 'type',
              value: type,
              allowed: ['daily', 'weekly', 'monthly']
            }
          }, requestId));
      }

      const response: APIResponse<any> = {
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          operation: 'manual-summary-generation',
          guildId,
          force
        }
      };

      fastify.log.info(`✅ 手動サマリー生成完了: ${guildId}/${type} (force: ${force})`);
      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`❌ 手動サマリー生成エラー (${guildId}/${type}):`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'サマリー生成中にエラーが発生しました',
        details: { guildId, type, error: error instanceof Error ? error.message : 'Unknown error' }
      }, requestId));
    }
  });

  // スケジューラー情報取得API（管理・デバッグ用）
  fastify.get<{
    Params: { guildId: string };
  }>('/:guildId/admin/scheduler-info', {
    preHandler: [
      fastify.authenticate,
      fastify.requirePermission(PermissionLevel.VIEW)
    ]
  }, async (request, reply) => {
    const { guildId } = request.params;
    const requestId = fastify.generateRequestId();

    try {
      // サーバー権限チェック
      const hasAccess = await fastify.checkGuildAccess(request.user!.userId, guildId);
      if (!hasAccess) {
        return reply.code(403).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.GUILD_NOT_FOUND,
          message: '指定されたサーバーにアクセスする権限がありません',
          details: { guildId }
        }, requestId));
      }

      // サマリー生成状況を確認
      const today = new Date().toISOString().split('T')[0];
      const periods = await fastify.dbHelpers.getCurrentPeriodKeys();

      const dailySummary = await fastify.dbHelpers.getDailySummary(guildId, today);
      
      const weeklySummary = await fastify.dbHelpers.query({
        sql: 'SELECT * FROM weekly_activity_summaries WHERE guildId = ? AND weekKey = ?',
        args: [guildId, periods.currentWeek]
      });

      const monthlySummary = await fastify.dbHelpers.query({
        sql: 'SELECT * FROM monthly_activity_summaries WHERE guildId = ? AND monthKey = ?',
        args: [guildId, periods.currentMonth]
      });

      // 通知スケジュール確認
      const schedules = await fastify.dbHelpers.query({
        sql: 'SELECT * FROM notification_schedules WHERE guildId = ?',
        args: [guildId]
      });

      // 最近の活動確認
      const recentActivity = await fastify.dbHelpers.query({
        sql: `
          SELECT COUNT(*) as count, MAX(joinTime) as lastActivity
          FROM user_voice_activities 
          WHERE guildId = ? AND joinTime >= ?
        `,
        args: [guildId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()]
      });

      const response: APIResponse<any> = {
        data: {
          guildId,
          periods,
          summaries: {
            daily: dailySummary,
            weekly: weeklySummary.rows[0] || null,
            monthly: monthlySummary.rows[0] || null
          },
          notifications: {
            schedules: schedules.rows,
            hasActiveSchedules: schedules.rows.some((s: any) => s.isEnabled)
          },
          activity: {
            recentCount: recentActivity.rows[0]?.count || 0,
            lastActivity: recentActivity.rows[0]?.lastActivity || null,
            isActive: (recentActivity.rows[0]?.count || 0) > 0
          },
          scheduler: {
            enabled: process.env.DISABLE_SCHEDULER !== 'true',
            timezone: 'Asia/Tokyo'
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId
        }
      };

      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`❌ スケジューラー情報取得エラー (${guildId}):`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'スケジューラー情報の取得中にエラーが発生しました',
        details: { guildId }
      }, requestId));
    }
  });

};

export default adminRoute;