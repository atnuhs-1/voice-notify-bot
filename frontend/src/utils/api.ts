const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// 基本的なAPI呼び出し関数
const apiCall = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

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