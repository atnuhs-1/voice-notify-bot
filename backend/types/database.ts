// データベーステーブル型定義
// 新テーブル用のTypeScript型定義

// 既存テーブル型定義
export interface Notification {
  id: number;
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  createdAt: string;
}

export interface VoiceSession {
  id: number;
  guildId: string;
  channelId: string;
  startTime: string;
  endTime: string | null;
  isActive: boolean;
  createdAt: string;
}

// 新規テーブル型定義

export interface UserVoiceActivity {
  id: number;
  guildId: string;
  userId: string;
  username: string;
  channelId: string;
  sessionId: number;
  joinTime: string;
  leaveTime: string | null;
  duration: number | null;
  isSessionStarter: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface PeriodUserStats {
  id: number;
  guildId: string;
  userId: string;
  username: string;
  periodType: 'week' | 'month' | 'year';
  periodKey: string; // '2025-W03', '2025-01', '2025'
  totalDuration: number;
  sessionCount: number;
  startedSessionCount: number;
  longestSession: number;
  averageSession: number;
  lastActivityId: number | null;
  updatedAt: string;
}

export interface NotificationSchedule {
  id: number;
  guildId: string;
  scheduleType: 'daily' | 'weekly' | 'monthly';
  isEnabled: boolean;
  // 日次通知設定
  dailyNotificationTime: string | null; // 'HH:mm'
  dailyActivityPeriodStart: string | null; // 'HH:mm'
  dailyActivityPeriodEnd: string | null; // 'HH:mm'
  // 週次通知設定
  weeklyNotificationDay: number | null; // 1=月曜, 7=日曜
  weeklyNotificationTime: string | null; // 'HH:mm'
  // 月次通知設定
  monthlyNotificationDay: number | null; // 1-28
  monthlyNotificationTime: string | null; // 'HH:mm'
  // 通知先
  targetChannelId: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyActivitySummary {
  id: number;
  guildId: string;
  activityDate: string; // 'YYYY-MM-DD'
  periodStart: string; // ISO datetime
  periodEnd: string; // ISO datetime
  totalDuration: number;
  totalParticipants: number;
  totalSessions: number;
  longestSession: number;
  topUserId: string | null;
  topUsername: string | null;
  topUserDuration: number;
  isNotified: boolean;
  notifiedAt: string | null;
  createdAt: string;
}

export interface WeeklyActivitySummary {
  id: number;
  guildId: string;
  weekKey: string; // '2025-W03'
  weekStart: string; // 'YYYY-MM-DD'
  weekEnd: string; // 'YYYY-MM-DD'
  totalDuration: number;
  totalParticipants: number;
  totalSessions: number;
  averageDailyDuration: number;
  topUserId: string | null;
  topUsername: string | null;
  topUserDuration: number;
  isNotified: boolean;
  notifiedAt: string | null;
  createdAt: string;
}

export interface MonthlyActivitySummary {
  id: number;
  guildId: string;
  monthKey: string; // '2025-01'
  monthStart: string; // 'YYYY-MM-DD'
  monthEnd: string; // 'YYYY-MM-DD'
  totalDuration: number;
  totalParticipants: number;
  totalSessions: number;
  averageDailyDuration: number;
  mostActiveDayDate: string | null;
  mostActiveDayDuration: number;
  topUserId: string | null;
  topUsername: string | null;
  topUserDuration: number;
  isNotified: boolean;
  notifiedAt: string | null;
  createdAt: string;
}

// データベースヘルパー関数用の型定義
export interface CreateUserActivityParams {
  guildId: string;
  userId: string;
  username: string;
  channelId: string;
  sessionId: number;
  joinTime: string;
  isSessionStarter: boolean;
}

export interface UpdatePeriodStatsParams {
  guildId: string;
  userId: string;
  username: string;
  periodType: 'week' | 'month' | 'year';
  periodKey: string;
  activity: UserVoiceActivity;
}

export interface CreateDailySummaryParams {
  guildId: string;
  activityDate: string;
  summary: Partial<DailyActivitySummary>;
}

// エクスポート用の統合型
export type PeriodType = 'week' | 'month' | 'year';
export type ScheduleType = 'daily' | 'weekly' | 'monthly';

// ユニオン型
export type ActivitySummary = DailyActivitySummary | WeeklyActivitySummary | MonthlyActivitySummary;