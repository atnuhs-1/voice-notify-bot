export interface Channel {
  id: string;
  name: string;
  type: string;
}

export interface GuildUserPermissions {
  isOwner: boolean;
  permissions: string;
}

export interface Guild {
  id: string;
  name: string;
  memberCount: number;
  channels: number;
  // APIには voiceChannelsCount が無いためオプショナルに変更
  voiceChannelsCount?: number;
  owner: string;
  icon: string | null;
  joinedAt: string;
  userPermissions: GuildUserPermissions; // 追加
  textChannels?: Channel[];
  voiceChannels?: Channel[];
}


// ギルド一覧レスポンス
export interface GuildsResponse {
  guilds: Guild[];
  total: number;
  user: {
    id: string;
    username: string;
    totalAdminGuilds: number;
  };
  timestamp: string;
}

export interface BotStats {
  bot: {
    tag: string;
    id: string;
    avatar: string | null;
    status: string;
  };
  servers: {
    total: number;
    totalMembers: number;
    totalChannels: number;
    totalVoiceChannels: number;
    activeVoiceChannels: number;
  };
  activity: {
    usersInVoice: number;
    uptime: number;
  };
  database: {
    notifications: number;
    activeSessions: number;
    totalSessions: number;
  };
  memory: {
    used: number;
    total: number;
  };
  timestamp: string;
}

export interface ResultMessage {
  message: string;
  type: 'success' | 'error';
}

export interface MessageForm {
  channelId: string;
  content: string;
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
}

export interface ChannelForm {
  name: string;
  type: 'text' | 'voice';
  topic: string;
  slowmode: number;
}

export interface MemberAction {
  userId: string;
  action: 'nickname' | 'move' | 'mute' | 'unmute' | 'kick';
  value: string;
}

export interface TabProps {
  guilds: Guild[];
  selectedGuild: string;
  selectedGuildData?: Guild;
  showResult: (message: string, type: 'success' | 'error') => void;
  loadData: () => void;
}

/**
 * 通知設定の型定義
 */
export interface NotificationSetting {
  id: number;
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  createdAt: string;
}

/**
 * ボイスセッションの型定義
 */
export interface VoiceSession {
  id: number;
  guildId: string;
  channelId: string;
  startTime: string;
  endTime: string | null;
  isActive: boolean;
  createdAt: string;
}

/**
 * ボイスチャンネル詳細情報の型定義
 */
export interface VoiceChannelDetail {
  id: string;
  name: string;
  userLimit: number;
  bitrate: number;
  members: Array<{
    id: string;
    displayName: string;
    avatar: string;
  }>;
  memberCount: number;
  isActive: boolean;
}

/**
 * オンラインメンバーの型定義
 */
export interface OnlineMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  status: string;
  activity: string | null;
}

/**
 * リアルタイム状況の型定義
 */
export interface LiveStatus {
  guild: {
    id: string;
    name: string;
    memberCount: number;
    onlineCount: number;
  };
  voiceChannels: VoiceChannelDetail[];
  onlineMembers: OnlineMember[];
  stats: {
    totalVoiceChannels: number;
    activeVoiceChannels: number;
    totalUsersInVoice: number;
  };
}