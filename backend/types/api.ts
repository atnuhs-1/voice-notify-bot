// 統一APIレスポンス形式の型定義
// 技術仕様書に基づく新API設計での型定義

// 基本API レスポンス形式
export interface APIResponse<T> {
  data: T;
  meta: APIResponseMeta;
  error?: APIError;
}

export interface APIResponseMeta {
  timestamp: string;
  requestId: string;
  [key: string]: any; // 追加のメタデータ用
}

// 構造化エラー形式
export interface APIError {
  code: string; // エラーコード（例: INVALID_GUILD_ID）
  message: string; // ユーザー向けメッセージ
  details?: APIErrorDetails;
}

export interface APIErrorDetails {
  field?: string;
  value?: any;
  validation?: string;
  [key: string]: any; // 追加の詳細情報用
}

// 権限レベル定義
export enum PermissionLevel {
  VIEW = 'view',       // 統計データの閲覧（一般ユーザー）
  MANAGE = 'manage',   // 設定変更（管理者）
  EXECUTE = 'execute'  // 通知送信・テスト実行（管理者）
}

// 統計API関連の型定義

// ランキング取得API
export interface RankingQuery {
  metric: 'duration' | 'sessions' | 'started_sessions';
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
  limit?: number;
  compare?: boolean; // 前期間との比較
}

export interface RankingItem {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  value: number; // メトリクスの値
  sessionCount: number;
  longestSession: number;
  comparison?: RankingComparison;
}

export interface RankingComparison {
  previousValue: number;
  change: number;
  changePercentage: number;
  rankChange: number | null;
  isNew: boolean;
}

export interface RankingResponse {
  rankings: RankingItem[];
  period: {
    from: string;
    to: string;
    previous?: {
      from: string;
      to: string;
    };
  };
}

export interface RankingResponseMeta extends APIResponseMeta {
  totalParticipants: number;
  serverTotalDuration: number;
  metric: string;
  hasComparison: boolean;
}

// タイムライン取得API
export interface TimelineQuery {
  from: string; // ISO datetime
  to: string;   // ISO datetime
}

export interface TimelineActivity {
  userId: string;
  username: string;
  avatar?: string;
  sessions: TimelineSession[];
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

export interface TimelineResponse {
  activities: TimelineActivity[];
  summary: TimelineSummary;
}

export interface TimelineSummary {
  totalDuration: number;
  totalParticipants: number;
  totalSessions: number;
  longestSession: number;
  mostActiveUser: {
    userId: string;
    username: string;
    duration: number;
  } | null;
}

export interface TimelineResponseMeta extends APIResponseMeta {
  period: { from: string; to: string };
}

// サマリー履歴取得API
export interface SummariesQuery {
  type: 'daily' | 'weekly' | 'monthly';
  from?: string; // 'YYYY-MM-DD'
  to?: string;   // 'YYYY-MM-DD'
  limit?: number;
  offset?: number;
}

export interface SummaryItem {
  id: string;
  period: {
    key: string; // '2025-01-19', '2025-W03', '2025-01'
    start: string;
    end: string;
  };
  metrics: {
    totalDuration: number;
    totalParticipants: number;
    totalSessions: number;
    longestSession: number;
  };
  topUser: {
    userId: string;
    username: string;
    duration: number;
  } | null;
  notifications: {
    isNotified: boolean;
    notifiedAt: string | null;
  };
}

export interface SummariesResponse {
  summaries: SummaryItem[];
}

export interface SummariesResponseMeta extends APIResponseMeta {
  total: number;
  hasMore: boolean;
  summaryType: string;
}

// 通知API関連の型定義

// 通知スケジュール取得・設定
export interface NotificationScheduleSettings {
  notificationTime: string; // 'HH:mm'
  activityPeriodStart?: string; // 日次のみ
  activityPeriodEnd?: string;   // 日次のみ
  notificationDay?: number;     // 週次・月次
}

export interface NotificationScheduleItem {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  isEnabled: boolean;
  settings: NotificationScheduleSettings;
  target: {
    channelId: string;
    channelName: string;
  };
  timezone: string;
  updatedAt: string;
}

export interface NotificationSchedulesResponse {
  schedules: NotificationScheduleItem[];
}

export interface UpdateNotificationScheduleRequest {
  isEnabled: boolean;
  settings: NotificationScheduleSettings;
  targetChannelId: string;
  timezone?: string;
}

export interface UpdateNotificationScheduleResponse {
  schedule: NotificationScheduleItem;
}

// テスト通知API
export interface TestNotificationRequest {
  scheduleType: 'daily' | 'weekly' | 'monthly';
  targetChannelId: string;
  testData?: {
    period?: { from: string; to: string };
    mockUsers?: Array<{ userId: string; duration: number }>;
  };
}

export interface TestNotificationResponse {
  result: {
    sent: boolean;
    messageId: string | null;
    timestamp: string;
  };
}

// 設定API関連の型定義

// サーバー設定取得
export interface ServerSettingsResponse {
  guild: {
    id: string;
    name: string;
    icon: string | null;
  };
  permissions: {
    level: 'view' | 'manage' | 'execute';
    canViewStatistics: boolean;
    canManageSettings: boolean;
    canExecuteActions: boolean;
  };
  features: {
    statisticsEnabled: boolean;
    notificationsEnabled: boolean;
    timelineEnabled: boolean;
  };
}

// 機能設定更新
export interface UpdateFeaturesRequest {
  statisticsEnabled?: boolean;
  notificationsEnabled?: boolean;
  timelineEnabled?: boolean;
}

export interface UpdateFeaturesResponse {
  features: {
    statisticsEnabled: boolean;
    notificationsEnabled: boolean;
    timelineEnabled: boolean;
  };
}

// ユーザー管理API関連
export interface UserStatisticsQuery {
  from?: string; // 'YYYY-MM-DD'
  to?: string;   // 'YYYY-MM-DD'
  granularity?: 'daily' | 'weekly' | 'monthly';
}

export interface UserStatisticsResponse {
  user: {
    userId: string;
    username: string;
    avatar?: string;
  };
  statistics: {
    totalDuration: number;
    totalSessions: number;
    startedSessions: number;
    averageSessionDuration: number;
    longestSession: number;
    activeDays: number;
  };
  trends: Array<{
    date: string; // 'YYYY-MM-DD'
    duration: number;
    sessions: number;
  }>;
}

// サーバー一覧API
export interface GuildsResponse {
  guilds: Array<{
    id: string;
    name: string;
    icon: string | null;
    memberCount: number;
    permissions: {
      level: 'view' | 'manage' | 'execute';
    };
    features: {
      statisticsEnabled: boolean;
      notificationsEnabled: boolean;
    };
    stats: {
      totalVoiceChannels: number;
      activeVoiceChannels: number;
      currentUsersInVoice: number;
    };
  }>;
}

// システム情報API
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    discord: {
      status: 'healthy' | 'unhealthy';
      details: {
        connected: boolean;
        guilds: number;
        uptime: number;
      };
    };
    database: {
      status: 'healthy' | 'unhealthy';
      details: {
        connected: boolean;
        responseTime: number;
      };
    };
  };
}

// エラーコード定数
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

// 権限チェック用の型定義
export interface PermissionContext {
  userId: string;
  guildId: string;
  requiredLevel: PermissionLevel;
}

// FastifyRequestへの型拡張用
export interface AuthenticatedUser {
  userId: string;
  username: string;
  avatar?: string;
  guilds: string[]; // 管理権限を持つサーバーIDリスト
}

// Fastify型拡張は別ファイルで管理（plugins/database.tsで既に定義済み）