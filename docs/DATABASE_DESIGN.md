# データベース設計仕様書

## 設計方針

### 採用するアーキテクチャ
**ハイブリッド設計**: 詳細ログ + 集計テーブルの組み合わせ
- **詳細ログ**: 全ての入退室行動を記録（正確性・分析性重視）
- **集計テーブル**: 期間別統計を事前計算（高速性重視）
- **Redis**: 後のフェーズで追加予定（リアルタイム性強化）

### 日跨ぎ処理方針
**入室時刻基準**: セッションが日を跨いでも入室した日の統計として計上
- 22:00入室 → 03:00退室の場合、全て入室日の統計に含める
- ユーザーの感覚に合致し、実装がシンプル

## データベーステーブル設計

### 1. 既存テーブル（変更なし）

#### notifications テーブル
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  voiceChannelId TEXT NOT NULL,
  textChannelId TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_guild_text 
ON notifications(guildId, textChannelId);
```

#### voice_sessions テーブル
```sql
CREATE TABLE voice_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  channelId TEXT NOT NULL,
  startTime DATETIME NOT NULL,
  endTime DATETIME,
  isActive BOOLEAN DEFAULT true,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_voice_sessions_active 
ON voice_sessions(guildId, channelId, isActive);
```

### 3. 通知スケジュール関連テーブル（新規）

#### notification_schedules テーブル（通知設定管理）
```sql
CREATE TABLE notification_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  scheduleType TEXT NOT NULL,         -- 'daily', 'weekly', 'monthly'
  isEnabled BOOLEAN DEFAULT true,     -- 通知のON/OFF
  
  -- 日次通知設定
  dailyNotificationTime TEXT,         -- '10:00' (HH:mm形式)
  dailyActivityPeriodStart TEXT,      -- '18:00' (前日からの開始時刻)
  dailyActivityPeriodEnd TEXT,        -- '10:00' (当日の終了時刻)
  
  -- 週次通知設定
  weeklyNotificationDay INTEGER,      -- 1=月曜, 7=日曜
  weeklyNotificationTime TEXT,        -- '12:00'
  
  -- 月次通知設定
  monthlyNotificationDay INTEGER,     -- 1-28 (月の何日に通知)
  monthlyNotificationTime TEXT,       -- '15:00'
  
  -- 通知先設定
  targetChannelId TEXT NOT NULL,      -- 通知送信先チャンネル
  
  timezone TEXT DEFAULT 'Asia/Tokyo', -- タイムゾーン
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(guildId, scheduleType, targetChannelId)
);

-- 検索用インデックス
CREATE INDEX idx_notification_schedules_check 
ON notification_schedules(scheduleType, isEnabled, dailyNotificationTime);
```

#### daily_activity_summaries テーブル（日次活動サマリー）
```sql
CREATE TABLE daily_activity_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  activityDate DATE NOT NULL,         -- '2025-01-19' (活動日の日付)
  periodStart DATETIME NOT NULL,      -- '2025-01-18T18:00:00Z' (実際の開始時刻)
  periodEnd DATETIME NOT NULL,        -- '2025-01-19T10:00:00Z' (実際の終了時刻)
  
  totalDuration INTEGER DEFAULT 0,    -- サーバー総活動時間（秒）
  totalParticipants INTEGER DEFAULT 0, -- 参加者数
  totalSessions INTEGER DEFAULT 0,    -- セッション数
  longestSession INTEGER DEFAULT 0,   -- 最長セッション（秒）
  
  topUserId TEXT,                     -- その日のトップユーザーID
  topUsername TEXT,                   -- トップユーザー名
  topUserDuration INTEGER DEFAULT 0,  -- トップユーザーの時間
  
  isNotified BOOLEAN DEFAULT false,   -- 通知済みフラグ
  notifiedAt DATETIME,                -- 通知送信時刻
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(guildId, activityDate)
);

-- 通知チェック用インデックス
CREATE INDEX idx_daily_summaries_notification 
ON daily_activity_summaries(guildId, activityDate, isNotified);
```

#### weekly_activity_summaries テーブル（週次活動サマリー）
```sql
CREATE TABLE weekly_activity_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  weekKey TEXT NOT NULL,              -- '2025-W03' (週キー)
  weekStart DATE NOT NULL,            -- '2025-01-13' (その週の月曜日)
  weekEnd DATE NOT NULL,              -- '2025-01-19' (その週の日曜日)
  
  totalDuration INTEGER DEFAULT 0,    -- 週間総活動時間（秒）
  totalParticipants INTEGER DEFAULT 0, -- 参加者数
  totalSessions INTEGER DEFAULT 0,    -- セッション数
  averageDailyDuration INTEGER DEFAULT 0, -- 1日平均活動時間
  
  topUserId TEXT,                     -- 週間MVP
  topUsername TEXT,
  topUserDuration INTEGER DEFAULT 0,
  
  isNotified BOOLEAN DEFAULT false,
  notifiedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(guildId, weekKey)
);
```

#### monthly_activity_summaries テーブル（月次活動サマリー）
```sql
CREATE TABLE monthly_activity_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  monthKey TEXT NOT NULL,             -- '2025-01' (月キー)
  monthStart DATE NOT NULL,           -- '2025-01-01'
  monthEnd DATE NOT NULL,             -- '2025-01-31'
  
  totalDuration INTEGER DEFAULT 0,    -- 月間総活動時間（秒）
  totalParticipants INTEGER DEFAULT 0, -- 参加者数
  totalSessions INTEGER DEFAULT 0,    -- セッション数
  averageDailyDuration INTEGER DEFAULT 0, -- 1日平均活動時間
  mostActiveDayDate DATE,             -- 最も活発だった日
  mostActiveDayDuration INTEGER DEFAULT 0,
  
  topUserId TEXT,                     -- 月間MVP
  topUsername TEXT,
  topUserDuration INTEGER DEFAULT 0,
  
  isNotified BOOLEAN DEFAULT false,
  notifiedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(guildId, monthKey)
);
```

### 4. PWA プッシュ通知関連テーブル（将来拡張用）

#### push_subscriptions テーブル
```sql
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,               -- Discord ユーザーID
  guildId TEXT NOT NULL,              -- 対象サーバーID
  endpoint TEXT NOT NULL,             -- プッシュ通知エンドポイント
  p256dh TEXT NOT NULL,               -- 暗号化キー
  auth TEXT NOT NULL,                 -- 認証キー
  
  -- 通知設定
  dailyNotificationEnabled BOOLEAN DEFAULT true,
  weeklyNotificationEnabled BOOLEAN DEFAULT true,
  monthlyNotificationEnabled BOOLEAN DEFAULT true,
  
  isActive BOOLEAN DEFAULT true,      -- 購読状態
  lastNotifiedAt DATETIME,            -- 最後の通知時刻
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(userId, guildId, endpoint)
);

CREATE INDEX idx_push_subscriptions_active 
ON push_subscriptions(isActive, dailyNotificationEnabled);
```

### 5. 統計テーブル（統計ダッシュボード用）

#### user_voice_activities テーブル（個人の入退室ログ）
```sql
CREATE TABLE user_voice_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  username TEXT NOT NULL,              -- Discord表示名（統計表示用）
  channelId TEXT NOT NULL,
  sessionId INTEGER NOT NULL,          -- voice_sessions.id への参照
  joinTime DATETIME NOT NULL,          -- 入室時刻（ISO形式）
  leaveTime DATETIME,                  -- 退室時刻（NULL = 接続中）
  duration INTEGER,                    -- 滞在時間（秒）※leaveTime時に計算
  isSessionStarter BOOLEAN DEFAULT false, -- 通話開始者フラグ
  isActive BOOLEAN DEFAULT true,       -- アクティブ状態
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (sessionId) REFERENCES voice_sessions(id)
);

-- 効率的な検索用インデックス
CREATE INDEX idx_user_activities_ranking 
ON user_voice_activities(guildId, userId, joinTime);

CREATE INDEX idx_user_activities_session 
ON user_voice_activities(sessionId, isActive);

CREATE INDEX idx_user_activities_timeline 
ON user_voice_activities(guildId, joinTime, leaveTime);
```

#### period_user_stats テーブル（期間別集計統計）
```sql
CREATE TABLE period_user_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  username TEXT NOT NULL,              -- 最新のDiscord表示名
  periodType TEXT NOT NULL,            -- 'week', 'month', 'year'
  periodKey TEXT NOT NULL,             -- '2025-W03', '2025-01', '2025'
  totalDuration INTEGER DEFAULT 0,     -- 総滞在時間（秒）
  sessionCount INTEGER DEFAULT 0,      -- 参加セッション数
  startedSessionCount INTEGER DEFAULT 0, -- 開始したセッション数
  longestSession INTEGER DEFAULT 0,    -- 最長セッション時間（秒）
  averageSession INTEGER DEFAULT 0,    -- 平均セッション時間（秒）
  lastActivityId INTEGER,              -- 最後に処理したactivity.id（増分更新用）
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(guildId, userId, periodType, periodKey)
);

-- ランキング取得用インデックス
CREATE INDEX idx_period_stats_ranking 
ON period_user_stats(guildId, periodType, periodKey, totalDuration DESC);
```

## 通知システムの実装

### 1. スケジュール管理システム

#### Cron ジョブでの定期チェック
```javascript
// 毎分実行されるスケジューラー
async function checkNotificationSchedules() {
  const now = new Date();
  const currentTime = now.toLocaleTimeString('ja-JP', { 
    timeZone: 'Asia/Tokyo', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const currentDay = now.getDay(); // 0=日曜, 1=月曜...
  const currentDate = now.getDate(); // 月の日付
  
  // 日次通知チェック
  await processDailyNotifications(currentTime);
  
  // 週次通知チェック
  await processWeeklyNotifications(currentTime, currentDay);
  
  // 月次通知チェック
  await processMonthlyNotifications(currentTime, currentDate);
}

async function processDailyNotifications(currentTime) {
  const schedules = await db.execute({
    sql: `
      SELECT * FROM notification_schedules 
      WHERE scheduleType = 'daily' 
        AND isEnabled = true 
        AND dailyNotificationTime = ?
    `,
    args: [currentTime]
  });
  
  for (const schedule of schedules.rows) {
    await generateAndSendDailySummary(schedule);
  }
}
```

### 2. 日次サマリー生成

#### カスタム活動期間での集計
```javascript
async function generateAndSendDailySummary(schedule) {
  const today = new Date().toISOString().split('T')[0];
  
  // 重複チェック
  const existing = await db.execute({
    sql: 'SELECT * FROM daily_activity_summaries WHERE guildId = ? AND activityDate = ? AND isNotified = true',
    args: [schedule.guildId, today]
  });
  
  if (existing.rows.length > 0) return;
  
  // 活動期間の計算
  const periodStart = new Date(`${today}T${schedule.dailyActivityPeriodStart}:00.000Z`);
  periodStart.setDate(periodStart.getDate() - 1); // 前日開始
  
  const periodEnd = new Date(`${today}T${schedule.dailyActivityPeriodEnd}:00.000Z`);
  
  // 活動データを集計
  const summary = await calculateActivitySummary(
    schedule.guildId, 
    periodStart, 
    periodEnd
  );
  
  // サマリーを保存
  await saveDailySummary(schedule.guildId, today, periodStart, periodEnd, summary);
  
  // Discord通知送信
  await sendDailyNotificationToDiscord(schedule.targetChannelId, summary, periodStart, periodEnd);
  
  // PWAプッシュ通知送信（将来実装）
  await sendDailyPushNotifications(schedule.guildId, summary);
  
  // 通知済みフラグ更新
  await markSummaryAsNotified(schedule.guildId, today);
}

async function calculateActivitySummary(guildId, periodStart, periodEnd) {
  // ユーザー別統計
  const userStats = await db.execute({
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
  });
  
  const users = userStats.rows;
  const topUser = users[0];
  
  return {
    totalParticipants: users.length,
    totalSessions: users.reduce((sum, user) => sum + user.sessionCount, 0),
    totalDuration: users.reduce((sum, user) => sum + user.totalDuration, 0),
    longestSession: users.length > 0 ? Math.max(...users.map(user => user.longestSession)) : 0,
    topUser: topUser ? {
      userId: topUser.userId,
      username: topUser.username,
      duration: topUser.totalDuration,
      sessions: topUser.sessionCount,
      started: topUser.startedSessions
    } : null,
    allUsers: users.slice(0, 10) // トップ10
  };
}
```

### 3. Discord通知フォーマット

#### 日次サマリー通知
```javascript
async function sendDailyNotificationToDiscord(channelId, summary, periodStart, periodEnd) {
  const embed = new EmbedBuilder()
    .setTitle('📊 昨日の活動サマリー')
    .setDescription(`${formatDateTime(periodStart)} - ${formatDateTime(periodEnd)}`)
    .setColor(0x5865f2);
  
  // 基本統計
  embed.addFields(
    { 
      name: '⏱️ サーバー総活動時間', 
      value: formatDuration(summary.totalDuration), 
      inline: true 
    },
    { 
      name: '👥 参加者数', 
      value: `${summary.totalParticipants}人`, 
      inline: true 
    },
    { 
      name: '🎮 セッション数', 
      value: `${summary.totalSessions}回`, 
      inline: true 
    }
  );
  
  // MVP表示
  if (summary.topUser) {
    embed.addFields({
      name: '🏆 昨日のMVP',
      value: `<@${summary.topUser.userId}> (${formatDuration(summary.topUser.duration)})\n` +
             `${summary.topUser.sessions}回参加 • ${summary.topUser.started}回開始`,
      inline: false
    });
  }
  
  // トップ5ランキング
  if (summary.allUsers.length > 1) {
    const ranking = summary.allUsers.slice(0, 5).map((user, index) => {
      const rank = index + 1;
      const rankEmoji = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `${rank}.`;
      return `${rankEmoji} <@${user.userId}> ${formatDuration(user.totalDuration)}`;
    }).join('\n');
    
    embed.addFields({
      name: '📈 昨日のランキング',
      value: ranking,
      inline: false
    });
  }
  
  embed.addFields({
    name: '⏰ 最長セッション',
    value: formatDuration(summary.longestSession),
    inline: true
  });
  
  embed.setFooter({ 
    text: '詳細な統計はダッシュボードで確認できます • 次回通知: 明日同時刻' 
  });
  embed.setTimestamp();
  
  await sendNotification(channelId, embed);
}

function formatDateTime(date) {
  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  } else if (minutes > 0) {
    return `${minutes}分`;
  } else {
    return `${seconds}秒`;
  }
}
```

### 4. 設定管理API

#### 通知設定の保存・取得
```javascript
// 設定保存API
async function saveNotificationSchedule(guildId, settings) {
  await db.execute({
    sql: `
      INSERT OR REPLACE INTO notification_schedules 
      (guildId, scheduleType, isEnabled, dailyNotificationTime, 
       dailyActivityPeriodStart, dailyActivityPeriodEnd, targetChannelId, updatedAt)
      VALUES (?, 'daily', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    args: [
      guildId,
      settings.enabled,
      settings.notificationTime,
      settings.periodStart,
      settings.periodEnd,
      settings.targetChannelId
    ]
  });
}

// 設定取得API
async function getNotificationSchedule(guildId, scheduleType = 'daily') {
  const result = await db.execute({
    sql: 'SELECT * FROM notification_schedules WHERE guildId = ? AND scheduleType = ?',
    args: [guildId, scheduleType]
  });
  
  return result.rows[0] || null;
}
```

## データ記録のタイミングと処理

### 1. リアルタイム記録（Discord イベント時）

#### ユーザー入室時
```javascript
async function onUserJoinVoice(guildId, userId, channelId) {
  // 1. セッション管理（既存ロジック）
  let sessionId = await getCurrentActiveSession(guildId, channelId);
  const isSessionStarter = !sessionId;
  
  if (!sessionId) {
    sessionId = await createVoiceSession(guildId, channelId);
  }
  
  // 2. 個人記録開始（新規）
  const activityId = await createUserActivity({
    guildId,
    userId,
    username: getUserDisplayName(userId), // Discord APIから取得
    channelId,
    sessionId,
    joinTime: new Date().toISOString(),
    isSessionStarter,
    isActive: true
  });
  
  console.log(`User ${userId} joined, activity: ${activityId}, starter: ${isSessionStarter}`);
}
```

#### ユーザー退室時
```javascript
async function onUserLeaveVoice(guildId, userId, channelId) {
  // 1. 個人記録終了（新規）
  const activity = await endUserActivity(guildId, userId, channelId);
  if (!activity) return;
  
  // 2. 期間別統計を即座に更新
  await updatePeriodStats(guildId, userId, activity);
  
  // 3. セッション管理（既存ロジック）
  const remainingUsers = await getActiveUsersInChannel(guildId, channelId);
  if (remainingUsers.length === 0) {
    await endVoiceSession(guildId, channelId);
  }
  
  console.log(`User ${userId} left, duration: ${activity.duration}s`);
}

async function endUserActivity(guildId, userId, channelId) {
  const now = new Date().toISOString();
  
  // アクティブな記録を取得
  const activity = await db.execute({
    sql: 'SELECT * FROM user_voice_activities WHERE guildId = ? AND userId = ? AND channelId = ? AND isActive = true ORDER BY joinTime DESC LIMIT 1',
    args: [guildId, userId, channelId]
  });
  
  if (!activity.rows[0]) return null;
  
  const activityRecord = activity.rows[0];
  const duration = Math.floor((new Date(now).getTime() - new Date(activityRecord.joinTime).getTime()) / 1000);
  
  // 記録を終了
  await db.execute({
    sql: 'UPDATE user_voice_activities SET leaveTime = ?, duration = ?, isActive = false WHERE id = ?',
    args: [now, duration, activityRecord.id]
  });
  
  return {
    ...activityRecord,
    leaveTime: now,
    duration,
    isActive: false
  };
}
```

### 2. 期間別統計の更新

#### リアルタイム統計更新
```javascript
async function updatePeriodStats(guildId, userId, activity) {
  const periods = getCurrentPeriodKeys(activity.joinTime);
  
  // 現在の週・月・年の統計を更新
  await Promise.all([
    updateSinglePeriodStats(guildId, userId, 'week', periods.currentWeek, activity),
    updateSinglePeriodStats(guildId, userId, 'month', periods.currentMonth, activity),
    updateSinglePeriodStats(guildId, userId, 'year', periods.currentYear, activity)
  ]);
}

async function updateSinglePeriodStats(guildId, userId, periodType, periodKey, activity) {
  const username = activity.username;
  const duration = activity.duration;
  const sessionIncrement = 1;
  const startedIncrement = activity.isSessionStarter ? 1 : 0;
  
  // UPSERT（存在しない場合は作成、存在する場合は更新）
  await db.execute({
    sql: `
      INSERT INTO period_user_stats 
      (guildId, userId, username, periodType, periodKey, totalDuration, sessionCount, startedSessionCount, longestSession, averageSession, lastActivityId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guildId, userId, periodType, periodKey) DO UPDATE SET
        username = ?,
        totalDuration = totalDuration + ?,
        sessionCount = sessionCount + ?,
        startedSessionCount = startedSessionCount + ?,
        longestSession = MAX(longestSession, ?),
        averageSession = totalDuration / sessionCount,
        lastActivityId = ?,
        updatedAt = CURRENT_TIMESTAMP
    `,
    args: [
      guildId, userId, username, periodType, periodKey, duration, sessionIncrement, startedIncrement, duration, duration, activity.id,
      username, duration, sessionIncrement, startedIncrement, duration, activity.id
    ]
  });
}
```

### 3. 期間キーの生成

#### 日本時間基準の期間計算
```javascript
function getCurrentPeriodKeys(baseTime = new Date()) {
  // 日本時間に変換
  const jstTime = new Date(baseTime.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  
  return {
    currentWeek: getWeekKey(jstTime),      // '2025-W03'
    currentMonth: getMonthKey(jstTime),    // '2025-01'
    currentYear: getYearKey(jstTime),      // '2025'
    statisticsDate: getStatisticsDate(jstTime) // '2025-01-15'（入室日基準）
  };
}

function getWeekKey(date) {
  const year = date.getFullYear();
  const weekNumber = getISOWeek(date); // ISO週番号（月曜始まり）
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getYearKey(date) {
  return String(date.getFullYear());
}

function getStatisticsDate(date) {
  return date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}
```

## 統計機能の実装

### 1. ランキング取得

#### 週間ランキング（比較付き）
```javascript
async function getWeeklyRankingWithComparison(guildId) {
  const periods = getCurrentPeriodKeys();
  
  // 今週のランキング
  const currentRanking = await db.execute({
    sql: `
      SELECT *, ROW_NUMBER() OVER (ORDER BY totalDuration DESC) as rank
      FROM period_user_stats 
      WHERE guildId = ? AND periodType = 'week' AND periodKey = ?
      ORDER BY totalDuration DESC
    `,
    args: [guildId, periods.currentWeek]
  });
  
  // 先週のランキング
  const previousWeek = getPreviousPeriodKey('week', periods.currentWeek);
  const previousRanking = await db.execute({
    sql: `
      SELECT *, ROW_NUMBER() OVER (ORDER BY totalDuration DESC) as rank
      FROM period_user_stats 
      WHERE guildId = ? AND periodType = 'week' AND periodKey = ?
      ORDER BY totalDuration DESC
    `,
    args: [guildId, previousWeek]
  });
  
  // 比較データを生成
  const rankingWithComparison = currentRanking.rows.map(current => {
    const previous = previousRanking.rows.find(p => p.userId === current.userId);
    
    return {
      ...current,
      comparison: {
        previousDuration: previous?.totalDuration || 0,
        durationChange: current.totalDuration - (previous?.totalDuration || 0),
        previousRank: previous?.rank || null,
        rankChange: previous ? (previous.rank - current.rank) : null,
        isNew: !previous,
        changePercentage: previous?.totalDuration 
          ? Math.round(((current.totalDuration - previous.totalDuration) / previous.totalDuration) * 100)
          : null
      }
    };
  });
  
  return {
    current: rankingWithComparison,
    period: {
      current: periods.currentWeek,
      previous: previousWeek,
      type: 'week'
    }
  };
}
```

### 2. タイムライン取得

#### 昨夜のセッションタイムライン
```javascript
async function getLastNightTimeline(guildId) {
  // 昨日18:00 - 今日10:00の範囲
  const yesterday18 = new Date();
  yesterday18.setDate(yesterday18.getDate() - 1);
  yesterday18.setHours(18, 0, 0, 0);
  
  const today10 = new Date();
  today10.setHours(10, 0, 0, 0);
  
  // 該当期間のアクティビティを取得
  const activities = await db.execute({
    sql: `
      SELECT * FROM user_voice_activities 
      WHERE guildId = ? 
        AND joinTime >= ? 
        AND (leaveTime <= ? OR (leaveTime IS NULL AND joinTime <= ?))
      ORDER BY userId, joinTime
    `,
    args: [
      guildId, 
      yesterday18.toISOString(), 
      today10.toISOString(),
      today10.toISOString()
    ]
  });
  
  // ユーザー別にグループ化
  const userSessions = {};
  activities.rows.forEach(activity => {
    if (!userSessions[activity.userId]) {
      userSessions[activity.userId] = {
        userId: activity.userId,
        username: activity.username,
        activities: []
      };
    }
    
    userSessions[activity.userId].activities.push({
      joinTime: activity.joinTime,
      leaveTime: activity.leaveTime || today10.toISOString(),
      duration: activity.duration || Math.floor((today10.getTime() - new Date(activity.joinTime).getTime()) / 1000),
      isSessionStarter: activity.isSessionStarter,
      isActive: activity.isActive
    });
  });
  
  return {
    period: {
      start: yesterday18.toISOString(),
      end: today10.toISOString()
    },
    sessions: Object.values(userSessions)
  };
}
```

## データ量試算（通知機能追加後）

### 想定使用量（5サーバー、平均20人/サーバー）

#### 既存テーブル
```
user_voice_activities: 500レコード/日 × 365日 = 182,500レコード/年 (約20MB)
period_user_stats: 6,500レコード/年 (約1MB)
```

#### 新規通知関連テーブル
```
notification_schedules: 5サーバー × 3種類(日/週/月) = 15レコード (数KB)
daily_activity_summaries: 5サーバー × 365日 = 1,825レコード/年 (約200KB)
weekly_activity_summaries: 5サーバー × 52週 = 260レコード/年 (約50KB)
monthly_activity_summaries: 5サーバー × 12月 = 60レコード/年 (約20KB)
push_subscriptions: 最大100ユーザー = 100レコード (約20KB)
```

**総データ量**: 年間約22MB（Turso無料枠内で十分対応可能）

## 実装フェーズ（通知機能追加版）

### Phase 1: 基本統計機能
1. **Week 1-2**: データベーステーブル作成・マイグレーション
   - `user_voice_activities`, `period_user_stats` テーブル
   - インデックス作成・最適化
2. **Week 3-4**: 個人入退室記録の実装
   - Discord イベントハンドラー拡張
   - リアルタイム統計更新機能
3. **Week 5-6**: 週間ランキング表示・Web UI
   - 統計ダッシュボード画面
   - タイムライン表示機能

### Phase 2: 通知システム
1. **Week 7-8**: 通知基盤システム実装
   - 通知スケジュール管理テーブル作成
   - Cron ジョブによるスケジューラー実装
   - 日次・週次・月次サマリー生成ロジック
2. **Week 9-10**: Discord通知機能
   - 自動通知送信システム
   - 通知フォーマット・Embed作成
   - Web UI での通知設定画面
3. **Week 11**: テスト・調整
   - 通知タイミングの調整
   - 重複防止機能のテスト

### Phase 3: PWA・プッシュ通知
1. **Week 12-13**: PWA基盤実装
   - Service Worker 実装
   - Web Push API 対応
   - プッシュ通知購読管理
2. **Week 14**: プッシュ通知機能
   - サーバー側プッシュ送信機能
   - 通知設定の個別管理

### Phase 4: 最適化・拡張
1. **Week 15-16**: パフォーマンス最適化
   - Redis導入検討
   - 通知配信の最適化
   - 統計計算の高速化

## 技術的考慮事項

### パフォーマンス対策
- **適切なインデックス**: ランキング・タイムライン取得を高速化
- **増分更新**: 期間統計の効率的な更新
- **データ保持期間**: 詳細ログは1年、統計データは永続保持

### データ整合性
- **外部キー制約**: セッションとアクティビティの関連性保証
- **トランザクション処理**: 複数テーブル更新の原子性
- **重複防止**: 期間統計のUNIQUE制約

### 拡張性
- **期間タイプ追加**: 将来的にカスタム期間対応可能
- **統計項目拡張**: 新しい集計項目の追加容易
- **マルチサーバー対応**: guildId による完全分離