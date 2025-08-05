// Phase 2.2.2 & 2.2.3: 統計計算ロジック
// ランキング計算関数とタイムライン生成関数

import type { Client } from '@libsql/client';
import type { PeriodType, UserVoiceActivity } from '../types/database.js';
import { getCurrentPeriodKeys, getPreviousPeriodKey, getPeriodStart, getPeriodEnd } from './period.js';

/**
 * Phase 2.2.2: 前期間比較付きランキング計算
 * 大量データでの高速処理を考慮
 */
export async function calculateRankingWithComparison(
  client: Client,
  guildId: string,
  metric: 'duration' | 'sessions' | 'started_sessions',
  from: string,
  to: string,
  limit: number = 10,
  compare: boolean = true
) {
  // 期間タイプを自動判定
  const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
  let periodType: PeriodType;
  let currentPeriod: string;
  
  const periods = getCurrentPeriodKeys(new Date(from));
  if (daysDiff <= 7) {
    periodType = 'week';
    currentPeriod = periods.currentWeek;
  } else if (daysDiff <= 31) {
    periodType = 'month';
    currentPeriod = periods.currentMonth;
  } else {
    periodType = 'year';
    currentPeriod = periods.currentYear;
  }

  // SQLの最適化: 適切なインデックスを利用
  const orderBy = metric === 'duration' ? 'totalDuration DESC' : 
                  metric === 'sessions' ? 'sessionCount DESC' : 
                  'startedSessionCount DESC';

  // 現在期間のランキング取得
  const currentRanking = await client.execute({
    sql: `
      SELECT 
        userId,
        username,
        totalDuration,
        sessionCount,
        startedSessionCount,
        longestSession,
        ROW_NUMBER() OVER (ORDER BY ${metric === 'duration' ? 'totalDuration' : 
                                    metric === 'sessions' ? 'sessionCount' : 
                                    'startedSessionCount'} DESC) as rank
      FROM period_user_stats 
      WHERE guildId = ? AND periodType = ? AND periodKey = ?
      ORDER BY ${orderBy}
      LIMIT ?
    `,
    args: [guildId, periodType, currentPeriod, limit]
  });

  let previousData: { [userId: string]: any } = {};
  let previousPeriod: string | null = null;

  // 比較データの取得
  if (compare) {
    previousPeriod = getPreviousPeriodKey(periodType, currentPeriod);
    const previousRanking = await client.execute({
      sql: `
        SELECT 
          userId,
          totalDuration,
          sessionCount,
          startedSessionCount,
          ROW_NUMBER() OVER (ORDER BY ${metric === 'duration' ? 'totalDuration' : 
                                      metric === 'sessions' ? 'sessionCount' : 
                                      'startedSessionCount'} DESC) as rank
        FROM period_user_stats 
        WHERE guildId = ? AND periodType = ? AND periodKey = ?
        ORDER BY ${orderBy}
      `,
      args: [guildId, periodType, previousPeriod]
    });

    // 前期間データをハッシュマップに格納（高速検索用）
    previousRanking.rows.forEach((row: any) => {
      previousData[row.userId] = {
        value: metric === 'duration' ? row.totalDuration :
               metric === 'sessions' ? row.sessionCount :
               row.startedSessionCount,
        rank: row.rank
      };
    });
  }

  // ランキングデータの構築
  const rankings = currentRanking.rows.map((current: any) => {
    const currentValue = metric === 'duration' ? current.totalDuration :
                        metric === 'sessions' ? current.sessionCount :
                        current.startedSessionCount;
    
    const previous = previousData[current.userId];
    
    return {
      rank: current.rank,
      userId: current.userId,
      username: current.username,
      avatar: null, // フロントエンドでDiscord APIから取得
      value: currentValue,
      sessionCount: current.sessionCount,
      longestSession: current.longestSession,
      comparison: previous ? {
        previousValue: previous.value,
        change: currentValue - previous.value,
        changePercentage: previous.value > 0 ? 
          Math.round(((currentValue - previous.value) / previous.value) * 100) : null,
        rankChange: previous.rank - current.rank, // 正の値：順位上昇
        isNew: false
      } : compare ? {
        previousValue: 0,
        change: currentValue,
        changePercentage: null,
        rankChange: null,
        isNew: true
      } : undefined
    };
  });

  // サーバー統計の計算
  const serverStats = await client.execute({
    sql: `
      SELECT 
        COUNT(DISTINCT userId) as totalParticipants,
        SUM(totalDuration) as serverTotalDuration
      FROM period_user_stats 
      WHERE guildId = ? AND periodType = ? AND periodKey = ?
    `,
    args: [guildId, periodType, currentPeriod]
  });

  return {
    rankings,
    period: {
      from,
      to,
      previous: previousPeriod ? {
        from: getPeriodStart(periodType, previousPeriod),
        to: getPeriodEnd(periodType, previousPeriod)
      } : undefined
    },
    totalParticipants: serverStats.rows[0]?.totalParticipants || 0,
    serverTotalDuration: serverStats.rows[0]?.serverTotalDuration || 0,
    periodType,
    currentPeriod
  };
}

/**
 * Phase 2.2.3: タイムライン生成関数
 * 重複セッション・途中参加の複雑な処理を含む
 */
export async function generateTimeline(
  client: Client,
  guildId: string,
  from: string,
  to: string
) {
  // 指定期間の全活動を取得
  const activities = await client.execute({
    sql: `
      SELECT 
        uva.userId,
        uva.username,
        uva.channelId,
        uva.joinTime,
        uva.leaveTime,
        uva.duration,
        uva.isSessionStarter,
        uva.isActive,
        vs.channelId as sessionChannelId
      FROM user_voice_activities uva
      LEFT JOIN voice_sessions vs ON uva.sessionId = vs.id
      WHERE uva.guildId = ? 
        AND uva.joinTime >= ? 
        AND (uva.leaveTime <= ? OR (uva.leaveTime IS NULL AND uva.joinTime <= ?))
      ORDER BY uva.userId, uva.joinTime
    `,
    args: [guildId, from, to, to]
  });

  // チャンネル名の取得（簡易実装）
  const getChannelName = (channelId: string): string => {
    // 実際の実装ではDiscord APIまたはキャッシュから取得
    return `Channel-${channelId.substring(0, 8)}`;
  };

  // ユーザー別セッションのグループ化
  const userSessions: { [userId: string]: any } = {};
  let totalDuration = 0;
  let totalSessions = 0;
  let longestSession = 0;
  const userDurations: { [userId: string]: number } = {};

  activities.rows.forEach((activity: any) => {
    if (!userSessions[activity.userId]) {
      userSessions[activity.userId] = {
        userId: activity.userId,
        username: activity.username,
        avatar: null,
        sessions: []
      };
      userDurations[activity.userId] = 0;
    }

    // セッション時間の計算（途中参加の処理）
    let sessionDuration: number;
    let leaveTime: string;
    
    if (activity.leaveTime) {
      sessionDuration = activity.duration;
      leaveTime = activity.leaveTime;
    } else {
      // アクティブセッション：終了時刻を期間終了時刻に設定
      const joinDate = new Date(activity.joinTime);
      const endDate = new Date(to);
      sessionDuration = Math.floor((endDate.getTime() - joinDate.getTime()) / 1000);
      leaveTime = to;
    }

    // 重複セッションのチェック（同一ユーザーの同時間帯セッション）
    const existingSession = userSessions[activity.userId].sessions.find((s: any) => {
      const existingStart = new Date(s.joinTime);
      const existingEnd = new Date(s.leaveTime);
      const currentStart = new Date(activity.joinTime);
      const currentEnd = new Date(leaveTime);
      
      // 時間の重複チェック
      return (currentStart <= existingEnd && currentEnd >= existingStart);
    });

    if (!existingSession) {
      userSessions[activity.userId].sessions.push({
        joinTime: activity.joinTime,
        leaveTime,
        duration: sessionDuration,
        channelId: activity.channelId,
        channelName: getChannelName(activity.channelId),
        isSessionStarter: activity.isSessionStarter,
        isActive: !activity.leaveTime
      });

      // 統計の更新
      totalDuration += sessionDuration;
      totalSessions++;
      longestSession = Math.max(longestSession, sessionDuration);
      userDurations[activity.userId] += sessionDuration;
    }
  });

  // 最もアクティブなユーザーの特定
  let mostActiveUser: any = null;
  let maxDuration = 0;
  
  Object.entries(userDurations).forEach(([userId, duration]) => {
    if (duration > maxDuration) {
      maxDuration = duration;
      mostActiveUser = {
        userId,
        username: userSessions[userId].username,
        duration
      };
    }
  });

  return {
    activities: Object.values(userSessions),
    summary: {
      totalDuration,
      totalParticipants: Object.keys(userSessions).length,
      totalSessions,
      longestSession,
      mostActiveUser
    },
    metadata: {
      period: { from, to },
      generatedAt: new Date().toISOString(),
      hasOverlappingSessions: false, // 重複処理により解決済み
      activeSessionsCount: Object.values(userSessions)
        .reduce((count, user: any) => 
          count + user.sessions.filter((s: any) => s.isActive).length, 0)
    }
  };
}

/**
 * 期間統計の効率的な集計
 * リアルタイム更新での使用を想定
 */
export function aggregateSessionStats(activities: UserVoiceActivity[]) {
  let totalDuration = 0;
  let sessionCount = 0;
  let startedSessionCount = 0;
  let longestSession = 0;
  
  activities.forEach(activity => {
    if (activity.duration !== null) {
      totalDuration += activity.duration;
      sessionCount++;
      longestSession = Math.max(longestSession, activity.duration);
      
      if (activity.isSessionStarter) {
        startedSessionCount++;
      }
    }
  });

  const averageSession = sessionCount > 0 ? Math.floor(totalDuration / sessionCount) : 0;

  return {
    totalDuration,
    sessionCount,
    startedSessionCount,
    longestSession,
    averageSession
  };
}

/**
 * 大量データ処理用のバッチ統計計算
 * メモリ効率とパフォーマンスを重視
 */
export async function calculateBatchStatistics(
  client: Client,
  guildId: string,
  batchSize: number = 1000
) {
  let offset = 0;
  let hasMore = true;
  const userStats: { [userId: string]: any } = {};

  while (hasMore) {
    const batch = await client.execute({
      sql: `
        SELECT userId, username, duration, isSessionStarter
        FROM user_voice_activities 
        WHERE guildId = ? 
        ORDER BY userId, joinTime
        LIMIT ? OFFSET ?
      `,
      args: [guildId, batchSize, offset]
    });

    if (batch.rows.length === 0) {
      hasMore = false;
      break;
    }

    // バッチ処理
    batch.rows.forEach((row: any) => {
      const userId = row.userId as string;
      if (!userStats[userId]) {
        userStats[userId] = {
          userId,
          username: row.username,
          totalDuration: 0,
          sessionCount: 0,
          startedSessionCount: 0,
          longestSession: 0
        };
      }

      const duration = row.duration as number;
      if (duration > 0) {
        userStats[userId].totalDuration += duration;
        userStats[userId].sessionCount++;
        userStats[userId].longestSession = Math.max(userStats[userId].longestSession, duration);
        
        if (row.isSessionStarter) {
          userStats[userId].startedSessionCount++;
        }
      }
    });

    offset += batchSize;
  }

  return Object.values(userStats);
}