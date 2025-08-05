// バックエンド・フロントエンド間で共有する型定義
// APIレスポンス形式の統一を保証

// APIレスポンス共通型（フロントエンドと完全一致）
export interface APIResponse<T> {
  data: T;
  meta: APIResponseMeta;
  error?: APIError;
}

export interface APIResponseMeta {
  timestamp: string;
  requestId: string;
  [key: string]: any;
}

export interface APIError {
  code: string;
  message: string;
  details?: {
    field?: string;
    value?: any;
    validation?: string;
    [key: string]: any;
  };
}

// 期間・メトリクス共通型
export type PeriodType = 'week' | 'month' | 'year';
export type MetricType = 'duration' | 'sessions' | 'started_sessions';
export type ScheduleType = 'daily' | 'weekly' | 'monthly';

// API Query パラメータ共通型
export interface RankingQuery {
  metric: MetricType;
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
  limit?: number;
  compare?: boolean;
}

export interface TimelineQuery {
  from: string; // ISO datetime
  to: string;   // ISO datetime
}

export interface SummariesQuery {
  type: ScheduleType;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// 統計データ共通型（フロントエンドとAPIレスポンスで一致）
export interface RankingItem {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  value: number;
  sessionCount: number;
  longestSession: number;
  comparison?: {
    previousValue: number;
    change: number;
    changePercentage: number;
    rankChange: number | null;
    isNew: boolean;
  };
}

export interface TimelineSession {
  joinTime: string;
  leaveTime: string | null;
  duration: number;
  channelId: string;
  channelName: string;
  isSessionStarter: boolean;
  isActive: boolean;
}

export interface NotificationScheduleSettings {
  notificationTime: string;
  activityPeriodStart?: string;
  activityPeriodEnd?: string;
  notificationDay?: number;
}

// エラーコード定数（フロントエンドでも使用）
export const API_ERROR_CODES = {
  // 認証・認可関連
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSION: 'INSUFFICIENT_PERMISSION',

  // バリデーション関連
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_GUILD_ID: 'INVALID_GUILD_ID',
  INVALID_USER_ID: 'INVALID_USER_ID',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',

  // リソース関連
  GUILD_NOT_FOUND: 'GUILD_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND',

  // Discord関連
  DISCORD_API_ERROR: 'DISCORD_API_ERROR',
  DISCORD_PERMISSION_ERROR: 'DISCORD_PERMISSION_ERROR',
  DISCORD_RATE_LIMIT: 'DISCORD_RATE_LIMIT',
  BOT_NOT_IN_GUILD: 'BOT_NOT_IN_GUILD',

  // システム関連
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
} as const;

export type APIErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

// バリデーション用の型定義
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

// 日付・時刻関連のユーティリティ型
export interface DateRange {
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
}

export interface TimeRange {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

// 統計値の共通型
export interface MetricValue {
  value: number;
  unit: string;
  formatted: string;
}

// 比較データの共通型
export interface ComparisonData {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
  trend: 'up' | 'down' | 'stable';
}