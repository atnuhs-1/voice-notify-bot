const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
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

// === 認証関連API（新規追加） ===

// 現在のユーザー情報を取得
export const fetchCurrentUser = () => apiCall('/api/auth/me');

// ログアウト
export const logoutUser = () => apiCall('/api/auth/logout', {
  method: 'POST',
});