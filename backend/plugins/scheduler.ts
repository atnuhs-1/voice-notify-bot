// Phase 4: 通知システム・スケジューラー実装
// サマリー生成とDiscord通知の定期実行システム

import fp from 'fastify-plugin'
import * as cron from 'node-cron'
import type { FastifyPluginAsync } from 'fastify'
import { getPeriodStart, getPeriodEnd } from '../utils/period'

declare module 'fastify' {
  interface FastifyInstance {
    generateSummary: {
      daily: (guildId: string) => Promise<void>
      weekly: (guildId: string, force?: boolean) => Promise<void>
      monthly: (guildId: string, force?: boolean) => Promise<void>
    }
  }
}

const schedulerPlugin: FastifyPluginAsync = async (fastify) => {
  let cronJobs: cron.ScheduledTask[] = []

  // サマリー生成・通知スケジューラーの開始
  const startScheduler = () => {
    // 毎分実行：通知スケジュールチェック（本番運用時は分単位で十分）
    const notificationCheckJob = cron.schedule('* * * * *', async () => {
      try {
        await checkNotificationSchedules()
      } catch (error) {
        fastify.log.error('通知スケジュールチェックエラー:', error)
      }
    }, { 
      timezone: 'Asia/Tokyo'
    })

    // 毎時0分実行：サマリー生成チェック（時間単位で効率化）
    const summaryGenerationJob = cron.schedule('0 * * * *', async () => {
      try {
        await generateHourlySummaries()
      } catch (error) {
        fastify.log.error('サマリー生成エラー:', error)
      }
    }, { 
      timezone: 'Asia/Tokyo'
    })

    // 毎日4:00実行：データクリーンアップ
    const cleanupJob = cron.schedule('0 4 * * *', async () => {
      try {
        await performDataCleanup()
      } catch (error) {
        fastify.log.error('データクリーンアップエラー:', error)
      }
    }, { 
      timezone: 'Asia/Tokyo'
    })

    // ジョブを開始
    notificationCheckJob.start()
    summaryGenerationJob.start()
    cleanupJob.start()

    cronJobs = [notificationCheckJob, summaryGenerationJob, cleanupJob]

    fastify.log.info('📅 スケジューラーを開始しました')
    fastify.log.info('  ├─ 通知チェック: 毎分実行')
    fastify.log.info('  ├─ サマリー生成: 毎時0分実行')
    fastify.log.info('  └─ データクリーンアップ: 毎日4:00実行')
  }

  // 通知スケジュールチェック（メイン処理）
  const checkNotificationSchedules = async () => {
    const now = new Date()
    const currentTime = now.toLocaleTimeString('ja-JP', { 
      timeZone: 'Asia/Tokyo', 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    })
    const currentDay = now.getDay() // 0=日曜, 1=月曜...
    const currentDate = now.getDate() // 月の日付

    fastify.log.debug(`🔍 通知スケジュールチェック: ${currentTime}`)

    // 日次通知チェック
    await processDailyNotifications(currentTime)
    
    // 週次通知チェック（月曜日のみ）
    if (currentDay === 1) {
      await processWeeklyNotifications(currentTime)
    }
    
    // 月次通知チェック（1日のみ）
    if (currentDate === 1) {
      await processMonthlyNotifications(currentTime)
    }
  }

  // 毎時サマリー生成（効率化）
  const generateHourlySummaries = async () => {
    const now = new Date()
    const currentHour = now.getHours()
    
    fastify.log.info(`🔄 時間別サマリー生成チェック: ${currentHour}:00`)

    // 各サーバーのアクティブなギルドを取得
    const activeGuilds = await getActiveGuilds()
    
    for (const guildId of activeGuilds) {
      try {
        // 日次サマリーが必要かチェック（朝の時間帯）
        if (currentHour >= 6 && currentHour <= 12) {
          await generateDailySummaryIfNeeded(guildId)
        }

        // 週次サマリーが必要かチェック（月曜日の午後）
        if (now.getDay() === 1 && currentHour >= 12 && currentHour <= 18) {
          await generateWeeklySummaryIfNeeded(guildId)
        }

        // 月次サマリーが必要かチェック（月初の午後）
        if (now.getDate() === 1 && currentHour >= 15 && currentHour <= 21) {
          await generateMonthlySummaryIfNeeded(guildId)
        }

      } catch (error) {
        fastify.log.error(`サマリー生成エラー (guild: ${guildId}):`, error)
      }
    }
  }

  // 日次通知処理
  const processDailyNotifications = async (currentTime: string) => {
    const { dbHelpers } = fastify

    // 現在時刻に設定されている日次通知スケジュールを取得
    const schedules = await dbHelpers.query({
      sql: `
        SELECT * FROM notification_schedules 
        WHERE scheduleType = 'daily' 
          AND isEnabled = true 
          AND dailyNotificationTime = ?
      `,
      args: [currentTime]
    })

    for (const schedule of schedules.rows) {
      try {
        await generateAndSendDailySummary(schedule)
      } catch (error) {
        fastify.log.error(`日次通知送信エラー (guild: ${schedule.guildId}):`, error)
      }
    }
  }

  // 週次通知処理
  const processWeeklyNotifications = async (currentTime: string) => {
    const { dbHelpers } = fastify

    const schedules = await dbHelpers.query({
      sql: `
        SELECT * FROM notification_schedules 
        WHERE scheduleType = 'weekly' 
          AND isEnabled = true 
          AND weeklyNotificationTime = ?
          AND weeklyNotificationDay = 1
      `,
      args: [currentTime]
    })

    for (const schedule of schedules.rows) {
      try {
        await generateAndSendWeeklySummary(schedule)
      } catch (error) {
        fastify.log.error(`週次通知送信エラー (guild: ${schedule.guildId}):`, error)
      }
    }
  }

  // 月次通知処理
  const processMonthlyNotifications = async (currentTime: string) => {
    const { dbHelpers } = fastify

    const schedules = await dbHelpers.query({
      sql: `
        SELECT * FROM notification_schedules 
        WHERE scheduleType = 'monthly' 
          AND isEnabled = true 
          AND monthlyNotificationTime = ?
          AND monthlyNotificationDay = 1
      `,
      args: [currentTime]
    })

    for (const schedule of schedules.rows) {
      try {
        await generateAndSendMonthlySummary(schedule)
      } catch (error) {
        fastify.log.error(`月次通知送信エラー (guild: ${schedule.guildId}):`, error)
      }
    }
  }

  // 日次サマリー生成・通知送信
  const generateAndSendDailySummary = async (schedule: any) => {
    const { dbHelpers } = fastify
    const today = new Date().toISOString().split('T')[0]

    // 重複チェック
    const existing = await dbHelpers.getDailySummary(schedule.guildId, today)
    if (existing && existing.isNotified) {
      fastify.log.debug(`日次サマリー既に送信済み: ${schedule.guildId}/${today}`)
      return
    }

    // 活動期間の計算
    const periodStart = new Date(`${today}T${schedule.dailyActivityPeriodStart || '18:00'}:00.000Z`)
    periodStart.setDate(periodStart.getDate() - 1) // 前日開始

    const periodEnd = new Date(`${today}T${schedule.dailyActivityPeriodEnd || '10:00'}:00.000Z`)

    // 活動データを集計
    const summary = await calculateActivitySummary(
      schedule.guildId, 
      periodStart, 
      periodEnd
    )

    // サマリーを保存
    await dbHelpers.createDailySummary(schedule.guildId, today, {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalDuration: summary.totalDuration,
      totalParticipants: summary.totalParticipants,
      totalSessions: summary.totalSessions,
      longestSession: summary.longestSession,
      topUserId: summary.topUser?.userId || null,
      topUsername: summary.topUser?.username || null,
      topUserDuration: summary.topUser?.duration || 0,
      isNotified: true,
      notifiedAt: new Date().toISOString()
    })

    // Discord通知送信（将来実装）
    // await sendDailyNotificationToDiscord(schedule.targetChannelId, summary, periodStart, periodEnd)

    fastify.log.info(`✅ 日次サマリー生成・通知完了: ${schedule.guildId}/${today}`)
  }

  // 週次サマリー生成（簡易版）
  const generateAndSendWeeklySummary = async (schedule: any) => {
    const { dbHelpers } = fastify
    const periods = await dbHelpers.getCurrentPeriodKeys()
    const weekKey = periods.currentWeek

    // 重複チェック
    const existing = await dbHelpers.query({
      sql: 'SELECT * FROM weekly_activity_summaries WHERE guildId = ? AND weekKey = ? AND isNotified = true',
      args: [schedule.guildId, weekKey]
    })
    
    if (existing.rows.length > 0) {
      fastify.log.debug(`週次サマリー既に送信済み: ${schedule.guildId}/${weekKey}`)
      return
    }

    // 週次統計計算
    const summary = await calculateWeeklySummary(schedule.guildId, weekKey)

    // サマリー保存
    await dbHelpers.createWeeklySummary(schedule.guildId, weekKey, {
      ...summary,
      isNotified: true,
      notifiedAt: new Date().toISOString()
    })

    fastify.log.info(`✅ 週次サマリー生成・通知完了: ${schedule.guildId}/${weekKey}`)
  }

  // 月次サマリー生成（簡易版）
  const generateAndSendMonthlySummary = async (schedule: any) => {
    const { dbHelpers } = fastify
    const periods = await dbHelpers.getCurrentPeriodKeys()
    const monthKey = periods.currentMonth

    // 重複チェック
    const existing = await dbHelpers.query({
      sql: 'SELECT * FROM monthly_activity_summaries WHERE guildId = ? AND monthKey = ? AND isNotified = true',
      args: [schedule.guildId, monthKey]
    })
    
    if (existing.rows.length > 0) {
      fastify.log.debug(`月次サマリー既に送信済み: ${schedule.guildId}/${monthKey}`)
      return
    }

    // 月次統計計算
    const summary = await calculateMonthlySummary(schedule.guildId, monthKey)

    // サマリー保存
    await dbHelpers.createMonthlySummary(schedule.guildId, monthKey, {
      ...summary,
      isNotified: true,
      notifiedAt: new Date().toISOString()
    })

    fastify.log.info(`✅ 月次サマリー生成・通知完了: ${schedule.guildId}/${monthKey}`)
  }

  // 活動統計計算（日次用）
  const calculateActivitySummary = async (
    guildId: string, 
    periodStart: Date, 
    periodEnd: Date
  ) => {
    const { dbHelpers } = fastify

    // ユーザー別統計を集計
    const userStats = await dbHelpers.query({
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
      args: [guildId, periodStart.toISOString(), periodEnd.toISOString()]
    })

    const users = userStats.rows
    const topUser = users[0]

    return {
      totalParticipants: users.length,
      totalSessions: users.reduce((sum: number, user: any) => sum + user.sessionCount, 0),
      totalDuration: users.reduce((sum: number, user: any) => sum + (user.totalDuration || 0), 0),
      longestSession: users.length > 0 ? Math.max(...users.map((user: any) => user.longestSession || 0)) : 0,
      topUser: topUser ? {
        userId: topUser.userId,
        username: topUser.username,
        duration: topUser.totalDuration || 0,
        sessions: topUser.sessionCount,
        started: topUser.startedSessions
      } : null,
      allUsers: users.slice(0, 10) // トップ10
    }
  }

  // 週次統計計算（実セッション時間ベース）
  const calculateWeeklySummary = async (guildId: string, weekKey: string) => {
    const { dbHelpers } = fastify

    // 週の開始・終了日を計算
    const weekStart = getPeriodStart('week', weekKey)
    const weekEnd = getPeriodEnd('week', weekKey)

    fastify.log.info(`🔍 週次サマリー生成開始: ${guildId}/${weekKey} (${weekStart} - ${weekEnd})`)

    // 実セッション時間ベースの統計
    const stats = await dbHelpers.query({
      sql: `
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN endTime IS NOT NULL 
              THEN (julianday(endTime) - julianday(startTime)) * 86400
              ELSE 0 
            END
          ), 0) as totalDuration,
          COUNT(id) as totalSessions,
          COALESCE(MAX(
            CASE 
              WHEN endTime IS NOT NULL 
              THEN (julianday(endTime) - julianday(startTime)) * 86400
              ELSE 0 
            END
          ), 0) as longestSession,
          COALESCE(AVG(
            CASE 
              WHEN endTime IS NOT NULL 
              THEN (julianday(endTime) - julianday(startTime)) * 86400
              ELSE 0 
            END
          ) / 7, 0) as averageDailyDuration
        FROM voice_sessions 
        WHERE guildId = ? 
          AND startTime >= ? 
          AND startTime <= ?
          AND endTime IS NOT NULL
      `,
      args: [guildId, weekStart, weekEnd + 'T23:59:59Z']
    })

    fastify.log.info(`🔍 voice_sessions クエリ結果:`, stats.rows[0])

    // 参加者数は別途計算（ユニークユーザー数）
    const participants = await dbHelpers.query({
      sql: `
        SELECT COUNT(DISTINCT userId) as totalParticipants
        FROM period_user_stats 
        WHERE guildId = ? AND periodType = 'week' AND periodKey = ?
      `,
      args: [guildId, weekKey]
    })

    fastify.log.info(`🔍 参加者数クエリ結果:`, participants.rows[0])

    const topUser = await dbHelpers.query({
      sql: `
        SELECT userId, username, totalDuration 
        FROM period_user_stats 
        WHERE guildId = ? AND periodType = 'week' AND periodKey = ?
        ORDER BY totalDuration DESC LIMIT 1
      `,
      args: [guildId, weekKey]
    })

    const summary = stats.rows[0] || {}
    const participantsData = participants.rows[0] || {}
    const mvp = topUser.rows[0]

    const result = {
      totalDuration: Math.round(summary.totalDuration || 0),
      totalParticipants: participantsData.totalParticipants || 0,
      totalSessions: summary.totalSessions || 0,
      longestSession: Math.round(summary.longestSession || 0),
      averageDailyDuration: Math.round(summary.averageDailyDuration || 0),
      topUserId: mvp?.userId || null,
      topUsername: mvp?.username || null,
      topUserDuration: mvp?.totalDuration || 0
    }

    // デバッグログ出力
    fastify.log.info(`📊 週次サマリー生成結果 (${guildId}/${weekKey}):`)
    fastify.log.info(`  期間: ${weekStart} - ${weekEnd}`)
    fastify.log.info(`  実セッション時間: ${result.totalDuration}秒 (${Math.round(result.totalDuration / 3600 * 100) / 100}時間)`)
    fastify.log.info(`  セッション数: ${result.totalSessions}`)
    fastify.log.info(`  参加者数: ${result.totalParticipants}人`)
    fastify.log.info(`  最長セッション: ${result.longestSession}秒`)
    fastify.log.info(`  1日平均: ${result.averageDailyDuration}秒`)
    fastify.log.info(`  MVP: ${result.topUsername} (${result.topUserDuration}秒)`)
    
    return result
  }

  // 月次統計計算（period_user_statsから）
  const calculateMonthlySummary = async (guildId: string, monthKey: string) => {
    const { dbHelpers } = fastify

    // 月の開始・終了日を計算
    const monthStart = getPeriodStart('month', monthKey)
    const monthEnd = getPeriodEnd('month', monthKey)

    fastify.log.info(`🔍 月次サマリー生成開始: ${guildId}/${monthKey} (${monthStart} - ${monthEnd})`)

    const stats = await dbHelpers.query({
      sql: `
        SELECT 
          SUM(totalDuration) as totalDuration,
          COUNT(DISTINCT userId) as totalParticipants,
          SUM(sessionCount) as totalSessions,
          AVG(totalDuration / 30) as averageDailyDuration
        FROM period_user_stats 
        WHERE guildId = ? AND periodType = 'month' AND periodKey = ?
      `,
      args: [guildId, monthKey]
    })

    fastify.log.info(`🔍 period_user_stats クエリ結果:`, stats.rows[0])

    const topUser = await dbHelpers.query({
      sql: `
        SELECT userId, username, totalDuration 
        FROM period_user_stats 
        WHERE guildId = ? AND periodType = 'month' AND periodKey = ?
        ORDER BY totalDuration DESC LIMIT 1
      `,
      args: [guildId, monthKey]
    })

    fastify.log.info(`🔍 MVP取得クエリ結果:`, topUser.rows[0])

    const summary = stats.rows[0] || {}
    const mvp = topUser.rows[0]

    const result = {
      totalDuration: summary.totalDuration || 0,
      totalParticipants: summary.totalParticipants || 0,
      totalSessions: summary.totalSessions || 0,
      averageDailyDuration: Math.round(summary.averageDailyDuration || 0),
      mostActiveDayDate: null, // 将来実装：日別統計から計算
      mostActiveDayDuration: 0,
      topUserId: mvp?.userId || null,
      topUsername: mvp?.username || null,
      topUserDuration: mvp?.totalDuration || 0
    }

    // デバッグログ出力
    fastify.log.info(`📊 月次サマリー生成結果 (${guildId}/${monthKey}):`)
    fastify.log.info(`  期間: ${monthStart} - ${monthEnd}`)
    fastify.log.info(`  総滞在時間: ${result.totalDuration}秒 (${Math.round(result.totalDuration / 3600 * 100) / 100}時間)`)
    fastify.log.info(`  セッション数: ${result.totalSessions}`)
    fastify.log.info(`  参加者数: ${result.totalParticipants}人`)
    fastify.log.info(`  1日平均: ${result.averageDailyDuration}秒`)
    fastify.log.info(`  MVP: ${result.topUsername} (${result.topUserDuration}秒)`)
    
    return result
  }

  // 個別サマリー生成チェック関数
  const generateDailySummaryIfNeeded = async (guildId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { dbHelpers } = fastify

    const existing = await dbHelpers.getDailySummary(guildId, today)
    if (!existing) {
      // 通知スケジュール無しでもサマリーは生成
      const summary = await calculateActivitySummary(
        guildId,
        new Date(Date.now() - 24 * 60 * 60 * 1000), // 昨日
        new Date()
      )

      await dbHelpers.createDailySummary(guildId, today, {
        periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
        ...summary,
        topUserId: summary.topUser?.userId || null,
        topUsername: summary.topUser?.username || null,
        topUserDuration: summary.topUser?.duration || 0,
        isNotified: false
      })

      fastify.log.info(`📊 自動日次サマリー生成: ${guildId}/${today}`)
    }
  }

  const generateWeeklySummaryIfNeeded = async (guildId: string, force = false) => {
    const { dbHelpers } = fastify
    const periods = await dbHelpers.getCurrentPeriodKeys()
    const weekKey = periods.currentWeek

    const existing = await dbHelpers.query({
      sql: 'SELECT * FROM weekly_activity_summaries WHERE guildId = ? AND weekKey = ?',
      args: [guildId, weekKey]
    })

    if (existing.rows.length === 0 || force) {
      const summary = await calculateWeeklySummary(guildId, weekKey)
      
      if (existing.rows.length > 0 && force) {
        // 既存データを更新
        const updateResult = await dbHelpers.query({
          sql: `UPDATE weekly_activity_summaries 
                SET totalDuration = ?, totalParticipants = ?, totalSessions = ?, 
                    averageDailyDuration = ?, topUserId = ?, topUsername = ?, 
                    topUserDuration = ?, createdAt = CURRENT_TIMESTAMP
                WHERE guildId = ? AND weekKey = ?`,
          args: [
            summary.totalDuration, summary.totalParticipants, summary.totalSessions,
            summary.averageDailyDuration, summary.topUserId, summary.topUsername,
            summary.topUserDuration, guildId, weekKey
          ]
        })
        fastify.log.info(`📊 週次サマリー強制更新: ${guildId}/${weekKey} (更新行数: ${updateResult.rowsAffected})`)
      } else {
        // 新規作成
        await dbHelpers.createWeeklySummary(guildId, weekKey, {
          ...summary,
          isNotified: false
        })
        fastify.log.info(`📊 自動週次サマリー生成: ${guildId}/${weekKey}`)
      }
    } else {
      fastify.log.info(`ℹ️ 週次サマリー既に存在: ${guildId}/${weekKey} (force=false)`)
    }
  }

  const generateMonthlySummaryIfNeeded = async (guildId: string, force = false) => {
    const { dbHelpers } = fastify
    const periods = await dbHelpers.getCurrentPeriodKeys()
    const monthKey = periods.currentMonth
    
    const existing = await dbHelpers.query({
      sql: 'SELECT * FROM monthly_activity_summaries WHERE guildId = ? AND monthKey = ?',
      args: [guildId, monthKey]
    })

    if (existing.rows.length === 0 || force) {
      const summary = await calculateMonthlySummary(guildId, monthKey)
      
      if (existing.rows.length > 0 && force) {
        // 既存データを更新
        const updateResult = await dbHelpers.query({
          sql: `UPDATE monthly_activity_summaries 
                SET totalDuration = ?, totalParticipants = ?, totalSessions = ?, 
                    averageDailyDuration = ?, mostActiveDayDate = ?, mostActiveDayDuration = ?,
                    topUserId = ?, topUsername = ?, topUserDuration = ?, createdAt = CURRENT_TIMESTAMP
                WHERE guildId = ? AND monthKey = ?`,
          args: [
            summary.totalDuration, summary.totalParticipants, summary.totalSessions,
            summary.averageDailyDuration, summary.mostActiveDayDate, summary.mostActiveDayDuration,
            summary.topUserId, summary.topUsername, summary.topUserDuration, guildId, monthKey
          ]
        })
        fastify.log.info(`📊 月次サマリー強制更新: ${guildId}/${monthKey} (更新行数: ${updateResult.rowsAffected})`)
      } else {
        // 新規作成
        await dbHelpers.createMonthlySummary(guildId, monthKey, {
          ...summary,
          isNotified: false
        })
        fastify.log.info(`📊 自動月次サマリー生成: ${guildId}/${monthKey}`)
      }
    } else {
      fastify.log.info(`ℹ️ 月次サマリー既に存在: ${guildId}/${monthKey} (force=false)`)
    }
  }

  // アクティブなギルド取得
  const getActiveGuilds = async (): Promise<string[]> => {
    const { dbHelpers } = fastify

    // 過去7日間に活動があるギルドを取得
    const result = await dbHelpers.query({
      sql: `
        SELECT DISTINCT guildId 
        FROM user_voice_activities 
        WHERE joinTime >= ?
      `,
      args: [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()]
    })

    return result.rows.map((row: any) => row.guildId)
  }

  // データクリーンアップ
  const performDataCleanup = async () => {
    const { dbHelpers } = fastify
    
    // 90日以前の詳細ログをクリーンアップ（設定可能）
    const cleanupDays = parseInt(process.env.DATA_CLEANUP_DAYS || '90')
    const cleanupDate = new Date(Date.now() - cleanupDays * 24 * 60 * 60 * 1000)

    const result = await dbHelpers.query({
      sql: 'DELETE FROM user_voice_activities WHERE joinTime < ? AND isActive = false',
      args: [cleanupDate.toISOString()]
    })

    if (result.rowsAffected && result.rowsAffected > 0) {
      fastify.log.info(`🗑️ データクリーンアップ完了: ${result.rowsAffected}件の古い活動記録を削除`)
    }
  }

  // プラグイン初期化
  fastify.addHook('onReady', async () => {
    // 開発環境では無効化可能
    if (process.env.DISABLE_SCHEDULER !== 'true') {
      // 5秒後に開始（他のプラグイン初期化待ち）
      setTimeout(() => {
        startScheduler()
      }, 5000)
    } else {
      fastify.log.info('📅 スケジューラー無効（DISABLE_SCHEDULER=true）')
    }
  })

  // アプリ終了時のクリーンアップ
  fastify.addHook('onClose', async () => {
    cronJobs.forEach(job => {
      try {
        job.stop()
      } catch (error) {
        fastify.log.warn('スケジューラー停止エラー:', error)
      }
    })
    fastify.log.info('📅 スケジューラーを停止しました')
  })

  // 手動サマリー生成API（テスト用）
  fastify.decorate('generateSummary', {
    daily: generateDailySummaryIfNeeded,
    weekly: (guildId: string, force = false) => generateWeeklySummaryIfNeeded(guildId, force),  
    monthly: (guildId: string, force = false) => generateMonthlySummaryIfNeeded(guildId, force)
  })
}

export default fp(schedulerPlugin, {
  name: 'scheduler',
  dependencies: ['database', 'discord'] // 依存プラグイン
})