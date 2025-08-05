import fp from 'fastify-plugin';
import { createClient, Client } from '@libsql/client';
import type { FastifyPluginAsync } from 'fastify';
import type {
  Notification,
  VoiceSession,
  UserVoiceActivity,
  PeriodUserStats,
  NotificationSchedule,
  DailyActivitySummary,
  CreateUserActivityParams,
  PeriodType
} from '../types/database';

// データベースクライアントの型定義
declare module 'fastify' {
  interface FastifyInstance {
    db: Client;
    dbHelpers: DatabaseHelpers;
  }
}

// データベースヘルパー関数の型定義
interface DatabaseHelpers {
  // Notifications テーブル操作
  getNotifications(guildId: string, textChannelId?: string): Promise<Notification[]>;
  setNotifications(guildId: string, textChannelId: string, voiceChannelIds: string[]): Promise<void>;
  deleteNotifications(guildId: string, textChannelId: string): Promise<void>;
  
  // VoiceSessions テーブル操作
  startVoiceSession(guildId: string, channelId: string): Promise<number>;
  endVoiceSession(guildId: string, channelId: string): Promise<VoiceSession | null>;
  getActiveSession(guildId: string, channelId: string): Promise<VoiceSession | null>;

  // UserVoiceActivities テーブル操作
  createUserActivity(params: CreateUserActivityParams): Promise<number>;
  endUserActivity(guildId: string, userId: string, channelId: string): Promise<UserVoiceActivity | null>;
  getActiveUserActivity(guildId: string, userId: string, channelId: string): Promise<UserVoiceActivity | null>;

  // PeriodUserStats テーブル操作
  updatePeriodStats(guildId: string, userId: string, username: string, periodType: PeriodType, periodKey: string, activity: UserVoiceActivity): Promise<void>;
  getPeriodRanking(guildId: string, periodType: PeriodType, periodKey: string, limit?: number): Promise<PeriodUserStats[]>;

  // NotificationSchedules テーブル操作
  getNotificationSchedule(guildId: string, scheduleType: 'daily' | 'weekly' | 'monthly'): Promise<NotificationSchedule | null>;
  setNotificationSchedule(guildId: string, schedule: Partial<NotificationSchedule>): Promise<void>;

  // ActivitySummaries テーブル操作
  createDailySummary(guildId: string, activityDate: string, summary: Partial<DailyActivitySummary>): Promise<void>;
  getDailySummary(guildId: string, activityDate: string): Promise<DailyActivitySummary | null>;
  
  // 週次・月次サマリー操作
  createWeeklySummary(guildId: string, weekKey: string, summary: Partial<any>): Promise<void>;
  createMonthlySummary(guildId: string, monthKey: string, summary: Partial<any>): Promise<void>;
  
  // 期間キー生成・ユーティリティ関数
  getCurrentPeriodKeys(baseTime?: Date): Promise<{
    currentWeek: string;
    currentMonth: string;
    currentYear: string;
    statisticsDate: string;
  }>;
  getWeekKey(date: Date): string;
  getMonthKey(date: Date): string;
  getYearKey(date: Date): string;
  getStatisticsDate(date: Date): string;
  getISOWeek(date: Date): number;
  getPreviousPeriodKey(periodType: PeriodType, currentKey: string): string;
  
  // タイムライン取得関数
  getTimelineActivities(guildId: string, from: string, to: string): Promise<UserVoiceActivity[]>;
  
  // 統計計算関数
  calculateActivitySummary(guildId: string, periodStart: Date, periodEnd: Date): Promise<{
    totalParticipants: number;
    totalSessions: number;
    totalDuration: number;
    longestSession: number;
    topUser: { userId: string; username: string; duration: number } | null;
  }>;
  
  // 通知チェック関数
  getActiveNotificationSchedules(scheduleType: 'daily' | 'weekly' | 'monthly', currentTime: string): Promise<NotificationSchedule[]>;
  
  // 期間の開始・終了日を取得するヘルパー関数
  getWeekStartEnd(weekKey: string): [string, string];
  getMonthStartEnd(monthKey: string): [string, string];
}

// 型定義は ../types/database.ts からインポート
const databasePlugin: FastifyPluginAsync = async (fastify) => {
  // 環境変数のチェック
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL environment variable is required');
  }

  // Tursoクライアントの作成
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN, // オプション：プライベートDBの場合
  });

  fastify.log.info('Connecting to Turso database...');

  try {
    // 接続テスト
    await client.execute('SELECT 1');
    fastify.log.info('✅ Turso database connected successfully');

    // テーブル作成
    await initializeTables(client, fastify.log);
    fastify.log.info('✅ Database tables initialized');

  } catch (error) {
    fastify.log.error('❌ Failed to connect to Turso database:', error);
    throw error;
  }

  // データベースヘルパー関数
  const dbHelpers: DatabaseHelpers = {
    // Notifications テーブル操作
    async getNotifications(guildId: string, textChannelId?: string) {
      let query = 'SELECT * FROM notifications WHERE guildId = ?';
      let params: any[] = [guildId];

      if (textChannelId) {
        query += ' AND textChannelId = ?';
        params.push(textChannelId);
      }

      const result = await client.execute({
        sql: query,
        args: params,
      });

      return result.rows.map(row => ({
        id: row.id as number,
        guildId: row.guildId as string,
        voiceChannelId: row.voiceChannelId as string,
        textChannelId: row.textChannelId as string,
        createdAt: row.createdAt as string,
      }));
    },

    async setNotifications(guildId: string, textChannelId: string, voiceChannelIds: string[]) {
      const now = new Date().toISOString(); // ISO形式で統一
      
      // トランザクション：既存設定を削除して新規作成
      await client.batch([
        // 既存設定を削除
        {
          sql: 'DELETE FROM notifications WHERE guildId = ? AND textChannelId = ?',
          args: [guildId, textChannelId],
        },
        // 新規設定を作成（createdAtも明示的に設定）
        ...voiceChannelIds.map(voiceChannelId => ({
          sql: 'INSERT INTO notifications (guildId, voiceChannelId, textChannelId, createdAt) VALUES (?, ?, ?, ?)',
          args: [guildId, voiceChannelId, textChannelId, now],
        })),
      ]);
    },

    async deleteNotifications(guildId: string, textChannelId: string) {
      await client.execute({
        sql: 'DELETE FROM notifications WHERE guildId = ? AND textChannelId = ?',
        args: [guildId, textChannelId],
      });
    },

    // 修正: JavaScript でISO形式の時刻を生成
    async startVoiceSession(guildId: string, channelId: string) {
      const now = new Date().toISOString(); // "2025-07-23T13:35:01.000Z"
      
      const result = await client.execute({
        sql: 'INSERT INTO voice_sessions (guildId, channelId, startTime, isActive) VALUES (?, ?, ?, true)',
        args: [guildId, channelId, now], // ISO形式で保存
      });

      return Number(result.lastInsertRowid);
    },

    // 修正: endTime もISO形式で保存
    async endVoiceSession(guildId: string, channelId: string) {
      // アクティブなセッションを取得
      const activeSession = await this.getActiveSession(guildId, channelId);
      if (!activeSession) return null;

      const now = new Date().toISOString(); // "2025-07-23T13:35:01.000Z"

      // セッションを終了
      await client.execute({
        sql: 'UPDATE voice_sessions SET endTime = ?, isActive = false WHERE id = ?',
        args: [now, activeSession.id], // ISO形式で保存
      });

      // 更新されたセッションを返す
      const result = await client.execute({
        sql: 'SELECT * FROM voice_sessions WHERE id = ?',
        args: [activeSession.id],
      });

      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id as number,
        guildId: row.guildId as string,
        channelId: row.channelId as string,
        startTime: row.startTime as string,
        endTime: row.endTime as string,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt as string,
      };
    },

    async getActiveSession(guildId: string, channelId: string) {
      const result = await client.execute({
        sql: 'SELECT * FROM voice_sessions WHERE guildId = ? AND channelId = ? AND isActive = true ORDER BY startTime DESC LIMIT 1',
        args: [guildId, channelId],
      });

      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id as number,
        guildId: row.guildId as string,
        channelId: row.channelId as string,
        startTime: row.startTime as string,
        endTime: row.endTime as string | null,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt as string,
      };
    },

    // UserVoiceActivities テーブル操作
    async createUserActivity(params) {
      const now = new Date().toISOString();
      
      const result = await client.execute({
        sql: `INSERT INTO user_voice_activities 
              (guildId, userId, username, channelId, sessionId, joinTime, isSessionStarter, isActive, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, true, ?)`,
        args: [
          params.guildId,
          params.userId,
          params.username,
          params.channelId,
          params.sessionId,
          params.joinTime,
          params.isSessionStarter,
          now
        ]
      });

      return Number(result.lastInsertRowid);
    },

    async endUserActivity(guildId: string, userId: string, channelId: string) {
      // アクティブな記録を取得
      const activity = await this.getActiveUserActivity(guildId, userId, channelId);
      if (!activity) return null;

      const now = new Date().toISOString();
      const duration = Math.floor((new Date(now).getTime() - new Date(activity.joinTime).getTime()) / 1000);

      // 記録を終了
      await client.execute({
        sql: 'UPDATE user_voice_activities SET leaveTime = ?, duration = ?, isActive = false WHERE id = ?',
        args: [now, duration, activity.id]
      });

      return {
        ...activity,
        leaveTime: now,
        duration,
        isActive: false
      };
    },

    async getActiveUserActivity(guildId: string, userId: string, channelId: string) {
      const result = await client.execute({
        sql: `SELECT * FROM user_voice_activities 
              WHERE guildId = ? AND userId = ? AND channelId = ? AND isActive = true 
              ORDER BY joinTime DESC LIMIT 1`,
        args: [guildId, userId, channelId]
      });

      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id as number,
        guildId: row.guildId as string,
        userId: row.userId as string,
        username: row.username as string,
        channelId: row.channelId as string,
        sessionId: row.sessionId as number,
        joinTime: row.joinTime as string,
        leaveTime: row.leaveTime as string | null,
        duration: row.duration as number | null,
        isSessionStarter: Boolean(row.isSessionStarter),
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt as string,
      };
    },

    // PeriodUserStats テーブル操作
    async updatePeriodStats(guildId: string, userId: string, username: string, periodType: 'week' | 'month' | 'year', periodKey: string, activity: UserVoiceActivity) {
      const duration = activity.duration || 0;
      const sessionIncrement = 1;
      const startedIncrement = activity.isSessionStarter ? 1 : 0;

      // UPSERT操作
      await client.execute({
        sql: `INSERT INTO period_user_stats 
              (guildId, userId, username, periodType, periodKey, totalDuration, sessionCount, startedSessionCount, longestSession, averageSession, lastActivityId, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(guildId, userId, periodType, periodKey) DO UPDATE SET
                username = ?,
                totalDuration = totalDuration + ?,
                sessionCount = sessionCount + ?,
                startedSessionCount = startedSessionCount + ?,
                longestSession = MAX(longestSession, ?),
                averageSession = CASE WHEN sessionCount > 0 THEN totalDuration / sessionCount ELSE 0 END,
                lastActivityId = ?,
                updatedAt = CURRENT_TIMESTAMP`,
        args: [
          guildId, userId, username, periodType, periodKey, duration, sessionIncrement, startedIncrement, duration, duration, activity.id,
          username, duration, sessionIncrement, startedIncrement, duration, activity.id
        ]
      });
    },

    async getPeriodRanking(guildId: string, periodType: 'week' | 'month' | 'year', periodKey: string, limit = 10) {
      const result = await client.execute({
        sql: `SELECT * FROM period_user_stats 
              WHERE guildId = ? AND periodType = ? AND periodKey = ?
              ORDER BY totalDuration DESC
              LIMIT ?`,
        args: [guildId, periodType, periodKey, limit]
      });

      return result.rows.map(row => ({
        id: row.id as number,
        guildId: row.guildId as string,
        userId: row.userId as string,
        username: row.username as string,
        periodType: row.periodType as 'week' | 'month' | 'year',
        periodKey: row.periodKey as string,
        totalDuration: row.totalDuration as number,
        sessionCount: row.sessionCount as number,
        startedSessionCount: row.startedSessionCount as number,
        longestSession: row.longestSession as number,
        averageSession: row.averageSession as number,
        lastActivityId: row.lastActivityId as number | null,
        updatedAt: row.updatedAt as string,
      }));
    },

    // 期間キー生成・日付ユーティリティ関数
    async getCurrentPeriodKeys(baseTime?: Date) {
      const jstTime = baseTime ? new Date(baseTime.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })) : new Date();
      
      return {
        currentWeek: this.getWeekKey(jstTime),
        currentMonth: this.getMonthKey(jstTime),
        currentYear: this.getYearKey(jstTime),
        statisticsDate: this.getStatisticsDate(jstTime)
      };
    },

    getWeekKey(date: Date): string {
      const year = date.getFullYear();
      const weekNumber = this.getISOWeek(date);
      return `${year}-W${String(weekNumber).padStart(2, '0')}`;
    },

    getMonthKey(date: Date): string {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return `${year}-${String(month).padStart(2, '0')}`;
    },

    getYearKey(date: Date): string {
      return String(date.getFullYear());
    },

    getStatisticsDate(date: Date): string {
      return date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
    },

    getISOWeek(date: Date): number {
      const target = new Date(date.valueOf());
      const dayNumber = (date.getDay() + 6) % 7; // 月曜日を0とする
      target.setDate(target.getDate() - dayNumber + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000); // 604800000 = 7 * 24 * 3600 * 1000
    },

    getPreviousPeriodKey(periodType: PeriodType, currentKey: string): string {
      switch (periodType) {
        case 'week': {
          const [year, week] = currentKey.split('-W').map(Number);
          if (week === 1) {
            return `${year - 1}-W52`; // 前年の最終週（概算）
          }
          return `${year}-W${String(week - 1).padStart(2, '0')}`;
        }
        case 'month': {
          const [year, month] = currentKey.split('-').map(Number);
          if (month === 1) {
            return `${year - 1}-12`;
          }
          return `${year}-${String(month - 1).padStart(2, '0')}`;
        }
        case 'year': {
          const year = parseInt(currentKey);
          return String(year - 1);
        }
        default:
          return currentKey;
      }
    },

    // NotificationSchedules テーブル操作
    async getNotificationSchedule(guildId: string, scheduleType: 'daily' | 'weekly' | 'monthly') {
      const result = await client.execute({
        sql: 'SELECT * FROM notification_schedules WHERE guildId = ? AND scheduleType = ?',
        args: [guildId, scheduleType]
      });

      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id as number,
        guildId: row.guildId as string,
        scheduleType: row.scheduleType as 'daily' | 'weekly' | 'monthly',
        isEnabled: Boolean(row.isEnabled),
        dailyNotificationTime: row.dailyNotificationTime as string | null,
        dailyActivityPeriodStart: row.dailyActivityPeriodStart as string | null,
        dailyActivityPeriodEnd: row.dailyActivityPeriodEnd as string | null,
        weeklyNotificationDay: row.weeklyNotificationDay as number | null,
        weeklyNotificationTime: row.weeklyNotificationTime as string | null,
        monthlyNotificationDay: row.monthlyNotificationDay as number | null,
        monthlyNotificationTime: row.monthlyNotificationTime as string | null,
        targetChannelId: row.targetChannelId as string,
        timezone: row.timezone as string,
        createdAt: row.createdAt as string,
        updatedAt: row.updatedAt as string,
      };
    },

    async setNotificationSchedule(guildId: string, schedule: Partial<NotificationSchedule>) {
      const now = new Date().toISOString();

      await client.execute({
        sql: `INSERT OR REPLACE INTO notification_schedules 
              (guildId, scheduleType, isEnabled, dailyNotificationTime, dailyActivityPeriodStart, dailyActivityPeriodEnd,
               weeklyNotificationDay, weeklyNotificationTime, monthlyNotificationDay, monthlyNotificationTime,
               targetChannelId, timezone, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          guildId,
          schedule.scheduleType || 'daily',
          schedule.isEnabled ?? true,
          schedule.dailyNotificationTime || null,
          schedule.dailyActivityPeriodStart || null,
          schedule.dailyActivityPeriodEnd || null,
          schedule.weeklyNotificationDay || null,
          schedule.weeklyNotificationTime || null,
          schedule.monthlyNotificationDay || null,
          schedule.monthlyNotificationTime || null,
          schedule.targetChannelId || '',
          schedule.timezone || 'Asia/Tokyo',
          now
        ]
      });
    },

    // ActivitySummaries テーブル操作
    async createDailySummary(guildId: string, activityDate: string, summary: Partial<DailyActivitySummary>) {
      const now = new Date().toISOString();

      await client.execute({
        sql: `INSERT OR REPLACE INTO daily_activity_summaries 
              (guildId, activityDate, periodStart, periodEnd, totalDuration, totalParticipants, totalSessions,
               longestSession, topUserId, topUsername, topUserDuration, isNotified, notifiedAt, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          guildId,
          activityDate,
          summary.periodStart || now,
          summary.periodEnd || now,
          summary.totalDuration || 0,
          summary.totalParticipants || 0,
          summary.totalSessions || 0,
          summary.longestSession || 0,
          summary.topUserId || null,
          summary.topUsername || null,
          summary.topUserDuration || 0,
          summary.isNotified ?? false,
          summary.notifiedAt || null,
          now
        ]
      });
    },

    async getDailySummary(guildId: string, activityDate: string) {
      const result = await client.execute({
        sql: 'SELECT * FROM daily_activity_summaries WHERE guildId = ? AND activityDate = ?',
        args: [guildId, activityDate]
      });

      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id as number,
        guildId: row.guildId as string,
        activityDate: row.activityDate as string,
        periodStart: row.periodStart as string,
        periodEnd: row.periodEnd as string,
        totalDuration: row.totalDuration as number,
        totalParticipants: row.totalParticipants as number,
        totalSessions: row.totalSessions as number,
        longestSession: row.longestSession as number,
        topUserId: row.topUserId as string | null,
        topUsername: row.topUsername as string | null,
        topUserDuration: row.topUserDuration as number,
        isNotified: Boolean(row.isNotified),
        notifiedAt: row.notifiedAt as string | null,
        createdAt: row.createdAt as string,
      };
    },

    // 週次・月次サマリー操作
    async createWeeklySummary(guildId: string, weekKey: string, summary: Partial<any>) {
      const now = new Date().toISOString();
      const [weekStart, weekEnd] = this.getWeekStartEnd(weekKey);

      await client.execute({
        sql: `INSERT OR REPLACE INTO weekly_activity_summaries 
              (guildId, weekKey, weekStart, weekEnd, totalDuration, totalParticipants, totalSessions,
               averageDailyDuration, topUserId, topUsername, topUserDuration, isNotified, notifiedAt, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          guildId,
          weekKey,
          weekStart,
          weekEnd,
          summary.totalDuration || 0,
          summary.totalParticipants || 0,
          summary.totalSessions || 0,
          summary.averageDailyDuration || 0,
          summary.topUserId || null,
          summary.topUsername || null,
          summary.topUserDuration || 0,
          summary.isNotified ?? false,
          summary.notifiedAt || null,
          now
        ]
      });
    },

    async createMonthlySummary(guildId: string, monthKey: string, summary: Partial<any>) {
      const now = new Date().toISOString();
      const [monthStart, monthEnd] = this.getMonthStartEnd(monthKey);

      await client.execute({
        sql: `INSERT OR REPLACE INTO monthly_activity_summaries 
              (guildId, monthKey, monthStart, monthEnd, totalDuration, totalParticipants, totalSessions,
               averageDailyDuration, mostActiveDayDate, mostActiveDayDuration, topUserId, topUsername, 
               topUserDuration, isNotified, notifiedAt, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          guildId,
          monthKey,
          monthStart,
          monthEnd,
          summary.totalDuration || 0,
          summary.totalParticipants || 0,
          summary.totalSessions || 0,
          summary.averageDailyDuration || 0,
          summary.mostActiveDayDate || null,
          summary.mostActiveDayDuration || 0,
          summary.topUserId || null,
          summary.topUsername || null,
          summary.topUserDuration || 0,
          summary.isNotified ?? false,
          summary.notifiedAt || null,
          now
        ]
      });
    },

    // タイムライン取得関数
    async getTimelineActivities(guildId: string, from: string, to: string) {
      const result = await client.execute({
        sql: `SELECT * FROM user_voice_activities 
              WHERE guildId = ? 
                AND joinTime >= ? 
                AND (leaveTime <= ? OR (leaveTime IS NULL AND joinTime <= ?))
              ORDER BY userId, joinTime`,
        args: [guildId, from, to, to]
      });

      return result.rows.map(row => ({
        id: row.id as number,
        guildId: row.guildId as string,
        userId: row.userId as string,
        username: row.username as string,
        channelId: row.channelId as string,
        sessionId: row.sessionId as number,
        joinTime: row.joinTime as string,
        leaveTime: row.leaveTime as string | null,
        duration: row.duration as number | null,
        isSessionStarter: Boolean(row.isSessionStarter),
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt as string,
      }));
    },

    // 統計計算関数
    async calculateActivitySummary(guildId: string, periodStart: Date, periodEnd: Date) {
      const startISO = periodStart.toISOString();
      const endISO = periodEnd.toISOString();

      // ユーザー別統計
      const userStats = await client.execute({
        sql: `
          SELECT 
            userId,
            username,
            COUNT(*) as sessionCount,
            SUM(duration) as totalDuration,
            MAX(duration) as longestSession,
            COUNT(CASE WHEN isSessionStarter = true THEN 1 END) as startedSessions
          FROM user_voice_activities 
          WHERE guildId = ? 
            AND joinTime >= ? 
            AND joinTime < ?
            AND duration IS NOT NULL
          GROUP BY userId, username
          ORDER BY totalDuration DESC
        `,
        args: [guildId, startISO, endISO]
      });

      const users = userStats.rows.map(row => ({
        userId: row.userId as string,
        username: row.username as string,
        sessionCount: row.sessionCount as number,
        totalDuration: row.totalDuration as number,
        longestSession: row.longestSession as number,
        startedSessions: row.startedSessions as number
      }));

      const topUser = users[0];

      return {
        totalParticipants: users.length,
        totalSessions: users.reduce((sum, user) => sum + user.sessionCount, 0),
        totalDuration: users.reduce((sum, user) => sum + user.totalDuration, 0),
        longestSession: users.length > 0 ? Math.max(...users.map(user => user.longestSession)) : 0,
        topUser: topUser ? {
          userId: topUser.userId,
          username: topUser.username,
          duration: topUser.totalDuration
        } : null
      };
    },

    // 通知チェック関数
    async getActiveNotificationSchedules(scheduleType: 'daily' | 'weekly' | 'monthly', currentTime: string) {
      let sql = `SELECT * FROM notification_schedules WHERE scheduleType = ? AND isEnabled = true`;
      let args: any[] = [scheduleType];

      if (scheduleType === 'daily') {
        sql += ` AND dailyNotificationTime = ?`;
        args.push(currentTime);
      }

      const result = await client.execute({ sql, args });

      return result.rows.map(row => ({
        id: row.id as number,
        guildId: row.guildId as string,
        scheduleType: row.scheduleType as 'daily' | 'weekly' | 'monthly',
        isEnabled: Boolean(row.isEnabled),
        dailyNotificationTime: row.dailyNotificationTime as string | null,
        dailyActivityPeriodStart: row.dailyActivityPeriodStart as string | null,
        dailyActivityPeriodEnd: row.dailyActivityPeriodEnd as string | null,
        weeklyNotificationDay: row.weeklyNotificationDay as number | null,
        weeklyNotificationTime: row.weeklyNotificationTime as string | null,
        monthlyNotificationDay: row.monthlyNotificationDay as number | null,
        monthlyNotificationTime: row.monthlyNotificationTime as string | null,
        targetChannelId: row.targetChannelId as string,
        timezone: row.timezone as string,
        createdAt: row.createdAt as string,
        updatedAt: row.updatedAt as string,
      }));
    },

    // 期間の開始・終了日を取得するヘルパー関数
    getWeekStartEnd(weekKey: string): [string, string] {
      const [year, week] = weekKey.split('-W').map(Number);
      const startOfYear = new Date(year, 0, 1);
      const daysToFirstMonday = (8 - startOfYear.getDay()) % 7;
      const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
      const weekStart = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      
      return [
        weekStart.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0]
      ];
    },

    getMonthStartEnd(monthKey: string): [string, string] {
      const [year, month] = monthKey.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0); // 月の最終日
      
      return [
        monthStart.toISOString().split('T')[0],
        monthEnd.toISOString().split('T')[0]
      ];
    },
  };

  // Fastifyインスタンスに登録
  fastify.decorate('db', client);
  fastify.decorate('dbHelpers', dbHelpers);

  // アプリケーション終了時のクリーンアップ
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing Turso database connection...');
    client.close();
  });
};

// テーブル初期化関数
async function initializeTables(client: Client, logger: any) {
  // Notifications テーブル
  await client.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      voiceChannelId TEXT NOT NULL,
      textChannelId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // VoiceSessions テーブル
  await client.execute(`
    CREATE TABLE IF NOT EXISTS voice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      channelId TEXT NOT NULL,
      startTime DATETIME NOT NULL,
      endTime DATETIME,
      isActive BOOLEAN DEFAULT true,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // user_voice_activities テーブル（個人の入退室ログ）
  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_voice_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      channelId TEXT NOT NULL,
      sessionId INTEGER NOT NULL,
      joinTime DATETIME NOT NULL,
      leaveTime DATETIME,
      duration INTEGER,
      isSessionStarter BOOLEAN DEFAULT false,
      isActive BOOLEAN DEFAULT true,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sessionId) REFERENCES voice_sessions(id)
    )
  `);

  // period_user_stats テーブル（期間別集計統計）
  await client.execute(`
    CREATE TABLE IF NOT EXISTS period_user_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      periodType TEXT NOT NULL,
      periodKey TEXT NOT NULL,
      totalDuration INTEGER DEFAULT 0,
      sessionCount INTEGER DEFAULT 0,
      startedSessionCount INTEGER DEFAULT 0,
      longestSession INTEGER DEFAULT 0,
      averageSession INTEGER DEFAULT 0,
      lastActivityId INTEGER,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guildId, userId, periodType, periodKey)
    )
  `);

  // notification_schedules テーブル（通知設定管理）
  await client.execute(`
    CREATE TABLE IF NOT EXISTS notification_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      scheduleType TEXT NOT NULL,
      isEnabled BOOLEAN DEFAULT true,
      dailyNotificationTime TEXT,
      dailyActivityPeriodStart TEXT,
      dailyActivityPeriodEnd TEXT,
      weeklyNotificationDay INTEGER,
      weeklyNotificationTime TEXT,
      monthlyNotificationDay INTEGER,
      monthlyNotificationTime TEXT,
      targetChannelId TEXT NOT NULL,
      timezone TEXT DEFAULT 'Asia/Tokyo',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guildId, scheduleType, targetChannelId)
    )
  `);

  // daily_activity_summaries テーブル（日次活動サマリー）
  await client.execute(`
    CREATE TABLE IF NOT EXISTS daily_activity_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      activityDate DATE NOT NULL,
      periodStart DATETIME NOT NULL,
      periodEnd DATETIME NOT NULL,
      totalDuration INTEGER DEFAULT 0,
      totalParticipants INTEGER DEFAULT 0,
      totalSessions INTEGER DEFAULT 0,
      longestSession INTEGER DEFAULT 0,
      topUserId TEXT,
      topUsername TEXT,
      topUserDuration INTEGER DEFAULT 0,
      isNotified BOOLEAN DEFAULT false,
      notifiedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guildId, activityDate)
    )
  `);

  // weekly_activity_summaries テーブル（週次活動サマリー）
  await client.execute(`
    CREATE TABLE IF NOT EXISTS weekly_activity_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      weekKey TEXT NOT NULL,
      weekStart DATE NOT NULL,
      weekEnd DATE NOT NULL,
      totalDuration INTEGER DEFAULT 0,
      totalParticipants INTEGER DEFAULT 0,
      totalSessions INTEGER DEFAULT 0,
      averageDailyDuration INTEGER DEFAULT 0,
      topUserId TEXT,
      topUsername TEXT,
      topUserDuration INTEGER DEFAULT 0,
      isNotified BOOLEAN DEFAULT false,
      notifiedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guildId, weekKey)
    )
  `);

  // monthly_activity_summaries テーブル（月次活動サマリー）
  await client.execute(`
    CREATE TABLE IF NOT EXISTS monthly_activity_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      monthKey TEXT NOT NULL,
      monthStart DATE NOT NULL,
      monthEnd DATE NOT NULL,
      totalDuration INTEGER DEFAULT 0,
      totalParticipants INTEGER DEFAULT 0,
      totalSessions INTEGER DEFAULT 0,
      averageDailyDuration INTEGER DEFAULT 0,
      mostActiveDayDate DATE,
      mostActiveDayDuration INTEGER DEFAULT 0,
      topUserId TEXT,
      topUsername TEXT,
      topUserDuration INTEGER DEFAULT 0,
      isNotified BOOLEAN DEFAULT false,
      notifiedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guildId, monthKey)
    )
  `);

  // インデックス作成（パフォーマンス向上）
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_notifications_guild_text 
    ON notifications(guildId, textChannelId)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_voice_sessions_active 
    ON voice_sessions(guildId, channelId, isActive)
  `);

  // 新規テーブル用インデックス
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_user_activities_ranking 
    ON user_voice_activities(guildId, userId, joinTime)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_user_activities_session 
    ON user_voice_activities(sessionId, isActive)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_user_activities_timeline 
    ON user_voice_activities(guildId, joinTime, leaveTime)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_period_stats_ranking 
    ON period_user_stats(guildId, periodType, periodKey, totalDuration DESC)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_notification_schedules_check 
    ON notification_schedules(scheduleType, isEnabled, dailyNotificationTime)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_notification 
    ON daily_activity_summaries(guildId, activityDate, isNotified)
  `);

  logger.info('✅ Database tables and indexes created/verified');
}

export default fp(databasePlugin, {
  name: 'database',
  dependencies: ['env'], // env プラグインに依存
});