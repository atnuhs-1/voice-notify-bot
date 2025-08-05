import type { 
  APIResponse, 
  APIError, 
  RankingQuery, 
  TimelineQuery, 
  SummariesQuery 
} from '../types/statistics';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// APIエラーハンドリング用のカスタムエラークラス
export class APIException extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'APIException';
    this.code = code;
    this.details = details;
  }
}

// 認証ヘッダー付きAPI呼び出し関数
const apiCall = async (endpoint: string, options?: RequestInit) => {
  // ローカルストレージからトークンを取得
  const token = localStorage.getItem('discord_auth_token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 既存のヘッダーがある場合は安全に追加
  if (options?.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  // トークンがある場合は認証ヘッダーを追加
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // 401エラーの場合は認証切れ
  if (response.status === 401) {
    localStorage.removeItem('discord_auth_token');
    // ページリロードしてログイン画面へ
    window.location.reload();
    throw new Error('認証が期限切れです。再ログインしてください。');
  }

  const data = await response.json();

  if (!response.ok) {
    // 新API設計のエラーレスポンス処理
    if (data.error) {
      const apiError = data.error as APIError;
      throw new APIException(apiError.message, apiError.code, apiError.details);
    }
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return data;
};

// データ取得API
export const fetchGuilds = () => apiCall('/api/guilds?includeChannels=true');
export const fetchStats = () => apiCall('/api/stats');

// メッセージ送信API
export const sendMessage = (data: {
  channelId: string;
  content?: string;
  embedTitle?: string;
  embedDescription?: string;
  embedColor?: string;
}) => apiCall('/api/control/send-message', {
  method: 'POST',
  body: JSON.stringify(data),
});

// チャンネル作成API
export const createChannel = (data: {
  guildId: string;
  name: string;
  type: 'text' | 'voice';
  topic?: string;
  slowmode?: number;
}) => apiCall('/api/control/create-channel', {
  method: 'POST',
  body: JSON.stringify(data),
});

// メンバー操作API
export const performMemberAction = (data: {
  guildId: string;
  userId: string;
  action: 'nickname' | 'move' | 'mute' | 'unmute' | 'kick';
  value?: string;
}) => apiCall('/api/control/member-action', {
  method: 'POST',
  body: JSON.stringify(data),
});

// 一括操作API
export const performBulkAction = (data: {
  guildId: string;
  action: 'move-all' | 'shuffle' | 'mute-all' | 'unmute-all';
  targetChannelId?: string;
  sourceChannelId?: string;
}) => apiCall('/api/control/bulk-action', {
  method: 'POST',
  body: JSON.stringify(data),
});

// チャンネル削除API
export const deleteChannel = (channelId: string) => 
  apiCall(`/api/control/delete-channel/${channelId}`, {
    method: 'DELETE',
  });

// ライブステータス取得API
export const fetchLiveStatus = (guildId: string) => 
  apiCall(`/api/control/live-status/${guildId}`);

// === 新規追加：サーバー概要データ取得 ===

// 通知設定取得
export const fetchNotifications = (guildId?: string) => {
  const params = guildId ? `?guildId=${guildId}` : '';
  return apiCall(`/api/notifications${params}`);
};

// セッション履歴取得
export const fetchSessions = (options: {
  guildId?: string;
  limit?: number;
  active?: boolean;
} = {}) => {
  const params = new URLSearchParams();
  if (options.guildId) params.append('guildId', options.guildId);
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.active !== undefined) params.append('active', options.active.toString());
  
  const queryString = params.toString();
  return apiCall(`/api/sessions${queryString ? `?${queryString}` : ''}`);
};

// サーバーのボイスチャンネル詳細取得
export const fetchGuildVoiceDetails = (guildId: string) => 
  apiCall(`/api/guild/${guildId}/voice`);

// === 認証関連API（新規追加） ===

// 現在のユーザー情報を取得
export const fetchCurrentUser = () => apiCall('/api/auth/me');

// ログアウト
export const logoutUser = () => apiCall('/api/auth/logout', {
  method: 'POST',
});

// === 新統計API（v1エンドポイント） ===

// ランキング取得API
export const fetchRankings = async (
  guildId: string, 
  query: RankingQuery
): Promise<APIResponse<any>> => {
  const params = new URLSearchParams();
  params.append('metric', query.metric);
  params.append('from', query.from);
  params.append('to', query.to);
  if (query.limit) params.append('limit', query.limit.toString());
  if (query.compare !== undefined) params.append('compare', query.compare.toString());

  return apiCall(`/api/v1/guilds/${guildId}/statistics/rankings?${params.toString()}`);
};

// タイムライン取得API  
export const fetchTimeline = async (
  guildId: string,
  query: TimelineQuery
): Promise<APIResponse<any>> => {
  const params = new URLSearchParams();
  params.append('from', query.from);
  params.append('to', query.to);

  return apiCall(`/api/v1/guilds/${guildId}/statistics/timeline?${params.toString()}`);
};

// サマリー履歴取得API
export const fetchSummaries = async (
  guildId: string,
  query: SummariesQuery
): Promise<APIResponse<any>> => {
  const params = new URLSearchParams();
  params.append('type', query.type);
  if (query.from) params.append('from', query.from);
  if (query.to) params.append('to', query.to);
  if (query.limit) params.append('limit', query.limit.toString());
  if (query.offset) params.append('offset', query.offset.toString());

  return apiCall(`/api/v1/guilds/${guildId}/statistics/summaries?${params.toString()}`);
};

// 通知設定取得API
export const fetchNotificationSchedules = async (
  guildId: string
): Promise<APIResponse<any>> => {
  return apiCall(`/api/v1/guilds/${guildId}/notifications/schedules`);
};

// 通知設定更新API
export const updateNotificationSchedule = async (
  guildId: string,
  scheduleType: 'daily' | 'weekly' | 'monthly',
  settings: any
): Promise<APIResponse<any>> => {
  return apiCall(`/api/v1/guilds/${guildId}/notifications/schedules/${scheduleType}`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
};

// テスト通知送信API
export const sendTestNotification = async (
  guildId: string,
  testData: {
    scheduleType: 'daily' | 'weekly' | 'monthly';
    targetChannelId: string;
    testData?: any;
  }
): Promise<APIResponse<any>> => {
  return apiCall(`/api/v1/guilds/${guildId}/notifications/test`, {
    method: 'POST',
    body: JSON.stringify(testData),
  });
};

// サーバー設定取得API
export const fetchGuildSettings = async (
  guildId: string
): Promise<APIResponse<any>> => {
  return apiCall(`/api/v1/guilds/${guildId}/settings`);
};

// 機能設定更新API
export const updateGuildFeatures = async (
  guildId: string,
  features: {
    statisticsEnabled?: boolean;
    notificationsEnabled?: boolean;
    timelineEnabled?: boolean;
  }
): Promise<APIResponse<any>> => {
  return apiCall(`/api/v1/guilds/${guildId}/settings/features`, {
    method: 'PUT',
    body: JSON.stringify(features),
  });
};

// 統計データリフレッシュAPI
export const refreshStatistics = async (
  guildId: string
): Promise<APIResponse<any>> => {
  return apiCall(`/api/v1/guilds/${guildId}/statistics/refresh`, {
    method: 'POST',
  });
};

// 変更検出API
export const checkStatisticsChanges = async (
  guildId: string,
  since: string
): Promise<APIResponse<any>> => {
  const params = new URLSearchParams();
  params.append('since', since);
  
  return apiCall(`/api/v1/guilds/${guildId}/statistics/changes?${params.toString()}`);
};