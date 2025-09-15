// Phase 4: 通知スケジュール管理API
// 日次・週次・月次通知設定の管理システム

import { FastifyPluginAsync } from 'fastify';
import type { APIResponse } from '../../../../types/api';
import { PermissionLevel, API_ERROR_CODES } from '../../../../types/api';

// 通知スケジュール型定義
interface NotificationSchedule {
  guildId: string;
  scheduleType: 'daily' | 'weekly' | 'monthly';
  isEnabled: boolean;
  targetChannelId: string | null;
  
  // 日次通知設定
  dailyNotificationTime?: string; // "18:00" 形式
  dailyActivityPeriodStart?: string; // "18:00" 形式
  dailyActivityPeriodEnd?: string; // "10:00" 形式（翌日）
  
  // 週次通知設定
  weeklyNotificationDay?: number; // 0=日曜, 1=月曜...
  weeklyNotificationTime?: string; // "09:00" 形式
  
  // 月次通知設定
  monthlyNotificationDay?: number; // 1-28 (月の日付)
  monthlyNotificationTime?: string; // "09:00" 形式
  
  createdAt?: string;
  updatedAt?: string;
}

// 通知設定のバリデーション
const validateSchedule = (schedule: Partial<NotificationSchedule>): string[] => {
  const errors: string[] = [];
  
  // 必須フィールドのチェック
  if (!schedule.scheduleType) {
    errors.push('scheduleType は必須です');
  } else if (!['daily', 'weekly', 'monthly'].includes(schedule.scheduleType)) {
    errors.push('scheduleType は daily, weekly, monthly のいずれかである必要があります');
  }
  
  if (schedule.isEnabled && !schedule.targetChannelId) {
    errors.push('通知を有効化する場合は targetChannelId が必要です');
  }
  
  // 時刻形式チェック（HH:MM）
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (schedule.scheduleType === 'daily') {
    if (schedule.isEnabled && !schedule.dailyNotificationTime) {
      errors.push('日次通知では dailyNotificationTime が必要です');
    }
    if (schedule.dailyNotificationTime && !timeRegex.test(schedule.dailyNotificationTime)) {
      errors.push('dailyNotificationTime は HH:MM 形式で入力してください');
    }
    if (schedule.dailyActivityPeriodStart && !timeRegex.test(schedule.dailyActivityPeriodStart)) {
      errors.push('dailyActivityPeriodStart は HH:MM 形式で入力してください');
    }
    if (schedule.dailyActivityPeriodEnd && !timeRegex.test(schedule.dailyActivityPeriodEnd)) {
      errors.push('dailyActivityPeriodEnd は HH:MM 形式で入力してください');
    }
  }
  
  if (schedule.scheduleType === 'weekly') {
    if (schedule.isEnabled && (schedule.weeklyNotificationDay === undefined || schedule.weeklyNotificationDay === null)) {
      errors.push('週次通知では weeklyNotificationDay が必要です');
    }
    if (schedule.weeklyNotificationDay !== undefined && (schedule.weeklyNotificationDay < 0 || schedule.weeklyNotificationDay > 6)) {
      errors.push('weeklyNotificationDay は 0-6 の範囲で指定してください (0=日曜, 1=月曜...)');
    }
    if (schedule.isEnabled && !schedule.weeklyNotificationTime) {
      errors.push('週次通知では weeklyNotificationTime が必要です');
    }
    if (schedule.weeklyNotificationTime && !timeRegex.test(schedule.weeklyNotificationTime)) {
      errors.push('weeklyNotificationTime は HH:MM 形式で入力してください');
    }
  }
  
  if (schedule.scheduleType === 'monthly') {
    if (schedule.isEnabled && (schedule.monthlyNotificationDay === undefined || schedule.monthlyNotificationDay === null)) {
      errors.push('月次通知では monthlyNotificationDay が必要です');
    }
    if (schedule.monthlyNotificationDay !== undefined && (schedule.monthlyNotificationDay < 1 || schedule.monthlyNotificationDay > 28)) {
      errors.push('monthlyNotificationDay は 1-28 の範囲で指定してください');
    }
    if (schedule.isEnabled && !schedule.monthlyNotificationTime) {
      errors.push('月次通知では monthlyNotificationTime が必要です');
    }
    if (schedule.monthlyNotificationTime && !timeRegex.test(schedule.monthlyNotificationTime)) {
      errors.push('monthlyNotificationTime は HH:MM 形式で入力してください');
    }
  }
  
  return errors;
};

const notificationsRoute: FastifyPluginAsync = async (fastify) => {
  
  // 通知スケジュール一覧取得
  fastify.get<{
    Params: { guildId: string };
  }>('/:guildId/notifications/schedules', {
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

      // 通知スケジュール取得
      const schedules = await fastify.dbHelpers.query({
        sql: `
          SELECT * FROM notification_schedules 
          WHERE guildId = ? 
          ORDER BY scheduleType, createdAt
        `,
        args: [guildId]
      });

      const response: APIResponse<NotificationSchedule[]> = {
        data: schedules.rows,
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          count: schedules.rows.length,
          guildId
        }
      };

      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`❌ 通知スケジュール取得エラー (${guildId}):`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: '通知スケジュールの取得中にエラーが発生しました',
        details: { guildId }
      }, requestId));
    }
  });

  // 特定タイプの通知スケジュール取得
  fastify.get<{
    Params: { 
      guildId: string; 
      type: 'daily' | 'weekly' | 'monthly' 
    };
  }>('/:guildId/notifications/schedules/:type', {
    preHandler: [
      fastify.authenticate,
      fastify.requirePermission(PermissionLevel.VIEW)
    ]
  }, async (request, reply) => {
    const { guildId, type } = request.params;
    const requestId = fastify.generateRequestId();

    try {
      // パラメータバリデーション
      if (!['daily', 'weekly', 'monthly'].includes(type)) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: '無効な通知タイプです',
          details: { 
            field: 'type',
            value: type,
            allowed: ['daily', 'weekly', 'monthly']
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

      // 該当タイプの通知スケジュール取得
      const schedule = await fastify.dbHelpers.query({
        sql: `
          SELECT * FROM notification_schedules 
          WHERE guildId = ? AND scheduleType = ?
        `,
        args: [guildId, type]
      });

      const response: APIResponse<NotificationSchedule | null> = {
        data: schedule.rows[0] || null,
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          guildId,
          type,
          exists: schedule.rows.length > 0
        }
      };

      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`❌ 通知スケジュール取得エラー (${guildId}/${type}):`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: '通知スケジュールの取得中にエラーが発生しました',
        details: { guildId, type }
      }, requestId));
    }
  });

  // 通知スケジュール更新・作成
  fastify.put<{
    Params: { 
      guildId: string; 
      type: 'daily' | 'weekly' | 'monthly'
    };
    Body: Partial<NotificationSchedule>;
  }>('/:guildId/notifications/schedules/:type', {
    preHandler: [
      fastify.authenticate,
      fastify.requirePermission(PermissionLevel.MANAGE)
    ]
  }, async (request, reply) => {
    const { guildId, type } = request.params;
    const scheduleData = request.body;
    const requestId = fastify.generateRequestId();

    try {
      // パラメータバリデーション
      if (!['daily', 'weekly', 'monthly'].includes(type)) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: '無効な通知タイプです',
          details: { 
            field: 'type',
            value: type,
            allowed: ['daily', 'weekly', 'monthly']
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

      // スケジュールデータの準備とバリデーション
      const schedule: Partial<NotificationSchedule> = {
        ...scheduleData,
        guildId,
        scheduleType: type
      };

      const validationErrors = validateSchedule(schedule);
      if (validationErrors.length > 0) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'バリデーションエラーが発生しました',
          details: {
            errors: validationErrors,
            schedule
          }
        }, requestId));
      }

      // チャンネル存在チェック（Discord API）
      if (schedule.isEnabled && schedule.targetChannelId) {
        try {
          const guild = fastify.discord.guilds.cache.get(guildId);
          if (!guild) {
            return reply.code(404).send(fastify.createErrorResponse({
              code: API_ERROR_CODES.GUILD_NOT_FOUND,
              message: 'Botがこのサーバーに参加していません',
              details: { guildId }
            }, requestId));
          }

          const channel = guild.channels.cache.get(schedule.targetChannelId);
          if (!channel || !channel.isTextBased()) {
            return reply.code(400).send(fastify.createErrorResponse({
              code: API_ERROR_CODES.VALIDATION_ERROR,
              message: '指定されたチャンネルが存在しないか、テキストチャンネルではありません',
              details: { 
                guildId, 
                channelId: schedule.targetChannelId 
              }
            }, requestId));
          }
        } catch (discordError) {
          fastify.log.warn(`Discord API チェックエラー: ${discordError}`);
          // Discordエラーの場合は警告のみで続行（ネットワークエラー等を考慮）
        }
      }

      // 既存スケジュール確認
      const existing = await fastify.dbHelpers.query({
        sql: 'SELECT * FROM notification_schedules WHERE guildId = ? AND scheduleType = ?',
        args: [guildId, type]
      });

      const now = new Date().toISOString();
      let result: any;

      if (existing.rows.length > 0) {
        // 更新
        await fastify.dbHelpers.query({
          sql: `
            UPDATE notification_schedules 
            SET isEnabled = ?, targetChannelId = ?,
                dailyNotificationTime = ?, dailyActivityPeriodStart = ?, dailyActivityPeriodEnd = ?,
                weeklyNotificationDay = ?, weeklyNotificationTime = ?,
                monthlyNotificationDay = ?, monthlyNotificationTime = ?,
                updatedAt = ?
            WHERE guildId = ? AND scheduleType = ?
          `,
          args: [
            schedule.isEnabled,
            schedule.targetChannelId,
            schedule.dailyNotificationTime || null,
            schedule.dailyActivityPeriodStart || null,
            schedule.dailyActivityPeriodEnd || null,
            schedule.weeklyNotificationDay || null,
            schedule.weeklyNotificationTime || null,
            schedule.monthlyNotificationDay || null,
            schedule.monthlyNotificationTime || null,
            now,
            guildId,
            type
          ]
        });

        result = { 
          action: 'updated', 
          message: `${type}通知スケジュールを更新しました`,
          schedule: { ...schedule, updatedAt: now }
        };

      } else {
        // 新規作成
        await fastify.dbHelpers.query({
          sql: `
            INSERT INTO notification_schedules (
              guildId, scheduleType, isEnabled, targetChannelId,
              dailyNotificationTime, dailyActivityPeriodStart, dailyActivityPeriodEnd,
              weeklyNotificationDay, weeklyNotificationTime,
              monthlyNotificationDay, monthlyNotificationTime,
              createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            guildId,
            type,
            schedule.isEnabled,
            schedule.targetChannelId,
            schedule.dailyNotificationTime || null,
            schedule.dailyActivityPeriodStart || null,
            schedule.dailyActivityPeriodEnd || null,
            schedule.weeklyNotificationDay || null,
            schedule.weeklyNotificationTime || null,
            schedule.monthlyNotificationDay || null,
            schedule.monthlyNotificationTime || null,
            now,
            now
          ]
        });

        result = { 
          action: 'created', 
          message: `${type}通知スケジュールを作成しました`,
          schedule: { ...schedule, createdAt: now, updatedAt: now }
        };
      }

      const response: APIResponse<any> = {
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          guildId,
          type,
          operation: 'upsert-schedule'
        }
      };

      fastify.log.info(`✅ 通知スケジュール${result.action}: ${guildId}/${type} (enabled: ${schedule.isEnabled})`);
      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`❌ 通知スケジュール更新エラー (${guildId}/${type}):`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: '通知スケジュールの更新中にエラーが発生しました',
        details: { guildId, type }
      }, requestId));
    }
  });

  // 通知スケジュール削除
  fastify.delete<{
    Params: { 
      guildId: string; 
      type: 'daily' | 'weekly' | 'monthly'
    };
  }>('/:guildId/notifications/schedules/:type', {
    preHandler: [
      fastify.authenticate,
      fastify.requirePermission(PermissionLevel.MANAGE)
    ]
  }, async (request, reply) => {
    const { guildId, type } = request.params;
    const requestId = fastify.generateRequestId();

    try {
      // パラメータバリデーション
      if (!['daily', 'weekly', 'monthly'].includes(type)) {
        return reply.code(400).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: '無効な通知タイプです',
          details: { 
            field: 'type',
            value: type,
            allowed: ['daily', 'weekly', 'monthly']
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

      // 削除実行
      const result = await fastify.dbHelpers.query({
        sql: 'DELETE FROM notification_schedules WHERE guildId = ? AND scheduleType = ?',
        args: [guildId, type]
      });

      if (result.rowsAffected === 0) {
        return reply.code(404).send(fastify.createErrorResponse({
          code: API_ERROR_CODES.SCHEDULE_NOT_FOUND,
          message: '指定された通知スケジュールが見つかりません',
          details: { guildId, type }
        }, requestId));
      }

      const response: APIResponse<any> = {
        data: {
          action: 'deleted',
          message: `${type}通知スケジュールを削除しました`,
          deletedCount: result.rowsAffected
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          guildId,
          type,
          operation: 'delete-schedule'
        }
      };

      fastify.log.info(`✅ 通知スケジュール削除: ${guildId}/${type}`);
      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`❌ 通知スケジュール削除エラー (${guildId}/${type}):`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: '通知スケジュールの削除中にエラーが発生しました',
        details: { guildId, type }
      }, requestId));
    }
  });

  // テスト通知送信
  fastify.post<{
    Params: { guildId: string };
    Body: {
      type: 'daily' | 'weekly' | 'monthly';
      channelId?: string; // 指定がない場合は設定済みチャンネルを使用
    };
  }>('/:guildId/notifications/test', {
    preHandler: [
      fastify.authenticate,
      fastify.requirePermission(PermissionLevel.EXECUTE)
    ]
  }, async (request, reply) => {
    const { guildId } = request.params;
    const { type, channelId } = request.body;
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

      // 使用するチャンネルIDを決定
      let targetChannelId = channelId;
      
      if (!targetChannelId) {
        // 指定がない場合は設定済みチャンネルを取得
        const schedule = await fastify.dbHelpers.query({
          sql: 'SELECT targetChannelId FROM notification_schedules WHERE guildId = ? AND scheduleType = ?',
          args: [guildId, type]
        });
        
        if (schedule.rows.length > 0 && schedule.rows[0].targetChannelId) {
          targetChannelId = schedule.rows[0].targetChannelId;
        } else {
          return reply.code(400).send(fastify.createErrorResponse({
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: 'チャンネルIDが指定されておらず、設定済みの通知チャンネルもありません',
            details: { guildId, type }
          }, requestId));
        }
      }

      // Discord通知送信
      const notificationResult = await fastify.discordNotifier.sendTestNotification(
        guildId,
        targetChannelId!, // この時点でtargetChannelIdは必ず存在する
        type
      );

      const response: APIResponse<any> = {
        data: {
          action: 'test-notification-sent',
          message: notificationResult.success 
            ? `${type}通知のテスト送信が完了しました`
            : `${type}通知のテスト送信が失敗しました`,
          type,
          targetChannelId,
          success: notificationResult.success,
          notificationResult
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          guildId,
          operation: 'test-notification'
        }
      };

      fastify.log.info(`✅ テスト通知要求: ${guildId}/${type} -> ${channelId || 'default'}`);
      return reply.code(200).send(response);

    } catch (error) {
      fastify.log.error(`❌ テスト通知エラー (${guildId}/${type}):`, error);
      
      return reply.code(500).send(fastify.createErrorResponse({
        code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'テスト通知の送信中にエラーが発生しました',
        details: { guildId, type }
      }, requestId));
    }
  });

};

export default notificationsRoute;