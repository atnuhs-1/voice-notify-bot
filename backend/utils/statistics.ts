// Phase 2.2.2 & 2.2.3: 統計計算ロジック
// ランキング計算関数とタイムライン生成関数

import type { Client } from '@libsql/client';
import type { UserVoiceActivity } from '../types/database';
import type { Client as DiscordClient } from 'discord.js';
import { getCurrentPeriodKeys, getPreviousPeriodKey, getPeriodStart, getPeriodEnd, isISOWeekBoundary, isISOMonthBoundary } from './period';

/**
 * Discord ユーザーのアバター情報を取得
 */
async function getUserAvatar(discordClient: DiscordClient, userId: string): Promise<string | null> {
  try {
    const user = await discordClient.users.fetch(userId);
    return user.avatar || null;
  } catch (error) {
    // ユーザーが見つからない場合やAPIエラーの場合はnullを返す
    return null;
  }
}

/**
 * 複数ユーザーのアバター情報を一括取得（パフォーマンス最適化）
 */
async function getUserAvatars(discordClient: DiscordClient, userIds: string[]): Promise<{ [userId: string]: string | null }> {
  const avatars: { [userId: string]: string | null } = {};
  
  // 並列処理でアバターを取得（Discord API rate limitに注意）
  const promises = userIds.map(async (userId) => {
    const avatar = await getUserAvatar(discordClient, userId);
    avatars[userId] = avatar;
  });
  
  await Promise.all(promises);
  return avatars;
}

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
  compare: boolean = true,
  discordClient?: DiscordClient
) {
  // ハイブリッド検索: 期間境界判定
  const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
  
  // ISO境界チェック
  if (daysDiff <= 7 && isISOWeekBoundary(from, to)) {
    // 高速: period_user_stats検索（週境界）
    return await calculateWeeklyRankingFast(client, guildId, metric, from, to, limit, compare, discordClient);
  } else if (daysDiff <= 31 && isISOMonthBoundary(from, to)) {
    // 高速: period_user_stats検索（月境界）
    // TODO: 月境界計算を後で実装
    console.log(`⚡ Monthly boundary detected, falling back to custom calculation`);
    return await calculateCustomRanking(client, guildId, metric, from, to, limit, compare, discordClient);
  } else {
    // 柔軟: user_voice_activities検索（カスタム期間）
    console.log(`🔄 Using custom period calculation for ${from} - ${to}`);
    return await calculateCustomRanking(client, guildId, metric, from, to, limit, compare, discordClient);
  }
}

/**
 * 週境界での高速ランキング計算（既存ロジック）
 */
async function calculateWeeklyRankingFast(
  client: Client,
  guildId: string,
  metric: 'duration' | 'sessions' | 'started_sessions',
  from: string,
  to: string,
  limit: number,
  compare: boolean,
  discordClient?: DiscordClient
) {
  const periods = getCurrentPeriodKeys(new Date(from));
  const periodType = 'week';
  const currentPeriod = periods.currentWeek;
  
  console.log(`⚡ Using fast weekly calculation for period: ${currentPeriod}`);

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

  // アバター情報を一括取得
  let avatars: { [userId: string]: string | null } = {};
  if (discordClient) {
    const userIds = currentRanking.rows.map((row: any) => row.userId);
    avatars = await getUserAvatars(discordClient, userIds);
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
      avatar: avatars[current.userId] || null,
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

  // レスポンス構築
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
    totalParticipants: currentRanking.rows.length,
    serverTotalDuration: currentRanking.rows.reduce((sum: number, row: any) => sum + Number(row.totalDuration), 0),
    isCustomPeriod: false
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
  to: string,
  discordClient?: DiscordClient
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

  // まずユーザーセッションを構築
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

  // アバター情報を一括取得
  if (discordClient) {
    const userIds = Object.keys(userSessions);
    const avatars = await getUserAvatars(discordClient, userIds);
    
    // ユーザーセッションにアバター情報を設定
    Object.keys(userSessions).forEach(userId => {
      userSessions[userId].avatar = avatars[userId];
    });
  }

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
 * カスタム期間でのランキング計算（user_voice_activitiesベース）
 * 任意期間対応・複数週にまたがる期間でも対応
 */
export async function calculateCustomRanking(
  client: Client,
  guildId: string,
  metric: 'duration' | 'sessions' | 'started_sessions',
  from: string,
  to: string,
  limit: number = 10,
  compare: boolean = true,
  discordClient?: DiscordClient
) {
  // カスタム期間の統計を計算
  const currentStats = await calculateCustomPeriodStats(client, guildId, from, to);
  
  // 比較期間の計算（期間の長さに基づいて前期間を決定）
  let previousStats: any = {};
  let previousPeriod: { from: string; to: string } | null = null;
  
  if (compare) {
    const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
    const fromDate = new Date(from);
    const previousFrom = new Date(fromDate);
    previousFrom.setDate(previousFrom.getDate() - daysDiff);
    const previousTo = new Date(fromDate);
    previousTo.setDate(previousTo.getDate() - 1);
    
    previousPeriod = {
      from: previousFrom.toISOString().split('T')[0],
      to: previousTo.toISOString().split('T')[0]
    };
    
    const prevStats = await calculateCustomPeriodStats(client, guildId, previousPeriod.from, previousPeriod.to);
    previousStats = prevStats.userStats.reduce((acc: any, user: any) => {
      acc[user.userId] = user;
      return acc;
    }, {});
  }
  
  // ランキング生成
  const sortField = metric === 'duration' ? 'totalDuration' : 
                   metric === 'sessions' ? 'sessionCount' : 
                   'startedSessionCount';
  
  const sortedUsers = currentStats.userStats
    .sort((a: any, b: any) => b[sortField] - a[sortField])
    .slice(0, limit);

  // アバター情報を一括取得
  let avatars: { [userId: string]: string | null } = {};
  if (discordClient) {
    const userIds = sortedUsers.map((user: any) => user.userId);
    avatars = await getUserAvatars(discordClient, userIds);
  }

  const rankings = sortedUsers.map((user: any, index: number) => {
    const previous = previousStats[user.userId];
    
    let comparison = null;
    if (compare && previous) {
      const previousValue = previous[sortField] || 0;
      const change = user[sortField] - previousValue;
      const changePercentage = previousValue > 0 ? Math.round((change / previousValue) * 100) : null;
      
      comparison = {
        previousValue,
        change,
        changePercentage,
        rankChange: null, // カスタム期間では順位変動は複雑なため省略
        isNew: false
      };
    } else if (compare && !previous) {
      comparison = {
        previousValue: 0,
        change: user[sortField],
        changePercentage: null,
        rankChange: null,
        isNew: true
      };
    }
    
    return {
      rank: index + 1,
      userId: user.userId,
      username: user.username,
      avatar: avatars[user.userId] || null,
      value: user[sortField],
      sessionCount: user.sessionCount,
      longestSession: user.longestSession,
      comparison: comparison || undefined
    };
  });
  
  return {
    rankings,
    period: {
      from,
      to,
      previous: previousPeriod || undefined
    },
    totalParticipants: currentStats.userStats.length,
    serverTotalDuration: currentStats.summary.totalDuration,
    isCustomPeriod: true
  };
}

/**
 * カスタム期間での統計計算（内部関数）
 */
async function calculateCustomPeriodStats(client: Client, guildId: string, from: string, to: string) {
  const activities = await client.execute({
    sql: `
      SELECT 
        userId,
        username,
        duration,
        isSessionStarter
      FROM user_voice_activities 
      WHERE guildId = ? 
        AND joinTime >= ? 
        AND leaveTime <= ?
        AND duration IS NOT NULL
      ORDER BY userId, joinTime
    `,
    args: [guildId, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`]
  });
  
  // ユーザー別統計集計
  const userStats: { [userId: string]: any } = {};
  let totalDuration = 0;
  let totalSessions = 0;
  let longestSession = 0;
  
  activities.rows.forEach((activity: any) => {
    const { userId, username, duration, isSessionStarter } = activity;
    
    if (!userStats[userId]) {
      userStats[userId] = {
        userId,
        username,
        totalDuration: 0,
        sessionCount: 0,
        startedSessionCount: 0,
        longestSession: 0
      };
    }
    
    userStats[userId].totalDuration += Number(duration);
    userStats[userId].sessionCount += 1;
    if (isSessionStarter) {
      userStats[userId].startedSessionCount += 1;
    }
    userStats[userId].longestSession = Math.max(userStats[userId].longestSession, Number(duration));
    
    totalDuration += Number(duration);
    totalSessions += 1;
    longestSession = Math.max(longestSession, Number(duration));
  });
  
  return {
    userStats: Object.values(userStats),
    summary: {
      totalDuration,
      totalSessions,
      totalParticipants: Object.keys(userStats).length,
      longestSession
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