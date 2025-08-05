// フロントエンド統計データ用型定義
// バックエンドAPI型との一致を保証

// 基本API レスポンス形式（バックエンドと一致）
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

// 統計API関連の型定義

// ランキング表示用
export interface RankingItem {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  value: number; // メトリクスの値（滞在時間、セッション数等）
  sessionCount: number;
  longestSession: number;
  comparison?: RankingComparison;
}

export interface RankingComparison {
  previousValue: number;
  change: number; // 変化量
  changePercentage: number; // 変化率（%）
  rankChange: number | null; // 順位変動（正の値：上昇、負の値：下降）
  isNew: boolean; // 新規ランクイン
}

export interface RankingData {
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

export interface RankingMeta extends APIResponseMeta {
  totalParticipants: number;
  serverTotalDuration: number;
  metric: string;
  hasComparison: boolean;
}

// タイムライン表示用
export interface TimelineActivity {
  userId: string;
  username: string;
  avatar?: string;
  sessions: TimelineSession[];
}

export interface TimelineSession {
  joinTime: string; // ISO datetime
  leaveTime: string | null; // ISO datetime or null if active
  duration: number; // 秒数
  channelId: string;
  channelName: string;
  isSessionStarter: boolean;
  isActive: boolean;
}

export interface TimelineData {
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

// サマリー履歴表示用
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

export interface SummariesData {
  summaries: SummaryItem[];
}

// 通知設定表示用
export interface NotificationScheduleSettings {
  notificationTime: string; // 'HH:mm'
  activityPeriodStart?: string; // 日次のみ 'HH:mm'
  activityPeriodEnd?: string;   // 日次のみ 'HH:mm'
  notificationDay?: number;     // 週次・月次（1-7 or 1-31）
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

export interface NotificationSchedulesData {
  schedules: NotificationScheduleItem[];
}

// フォーム・UI用の型定義
export interface PeriodSelection {
  type: 'week' | 'month' | 'year' | 'custom';
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
}

export interface MetricSelection {
  type: 'duration' | 'sessions' | 'started_sessions';
  label: string;
  unit: string; // '時間', '回', etc.
}

// 統計表示用のカスタム型
export interface StatisticsSummary {
  totalDuration: number;
  totalParticipants: number;
  totalSessions: number;
  averageSessionDuration: number;
  longestSession: number;
  mostActiveUser: {
    userId: string;
    username: string;
    duration: number;
    percentage: number; // サーバー総活動時間に対する割合
  } | null;
}

// チャート表示用のデータ型
export interface ChartDataPoint {
  date: string; // 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'
  value: number;
  label?: string;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  }[];
}

// ユーザー詳細統計用
export interface UserStatistics {
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

// APIクエリ用パラメータ型
export interface RankingQuery {
  metric: 'duration' | 'sessions' | 'started_sessions';
  from: string;
  to: string;
  limit?: number;
  compare?: boolean;
}

export interface TimelineQuery {
  from: string; // ISO datetime
  to: string;   // ISO datetime
}

export interface SummariesQuery {
  type: 'daily' | 'weekly' | 'monthly';
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// UI状態管理用
export interface StatisticsState {
  loading: boolean;
  error: string | null;
  data: {
    rankings: RankingData | null;
    timeline: TimelineData | null;
    summaries: SummariesData | null;
  };
  settings: {
    selectedPeriod: PeriodSelection;
    selectedMetric: MetricSelection;
    autoRefresh: boolean;
    refreshInterval: number; // ミリ秒
  };
}

export interface NotificationState {
  loading: boolean;
  error: string | null;
  schedules: NotificationScheduleItem[];
  testingNotification: boolean;
}

// フォームバリデーション用
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState {
  isSubmitting: boolean;
  errors: ValidationError[];
  isDirty: boolean;
}

// ユーティリティ型
export type PeriodType = 'week' | 'month' | 'year';
export type MetricType = 'duration' | 'sessions' | 'started_sessions';
export type ScheduleType = 'daily' | 'weekly' | 'monthly';

// 期間プリセット
export interface PeriodPreset {
  label: string;
  value: PeriodSelection;
  isDefault?: boolean;
}

// 統計カード表示用
export interface StatCard {
  title: string;
  value: string;
  change?: {
    value: string;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: string;
  tooltip?: string;
}

// エクスポート機能用
export interface ExportOptions {
  format: 'csv' | 'json' | 'png';
  includeComparison: boolean;
  dateRange: PeriodSelection;
}

// 色テーマ設定用
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}

// モバイル対応用のレスポンシブ設定
export interface ResponsiveSettings {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  breakpoint: 'sm' | 'md' | 'lg' | 'xl';
}