export interface Channel {
  id: string;
  name: string;
  type: string;
}

export interface Guild {
  id: string;
  name: string;
  memberCount: number;
  channels: number;
  voiceChannelsCount: number;  // 数値用にリネーム
  owner: string;
  icon: string | null;
  joinedAt: string;
  textChannels?: Channel[];
  voiceChannels?: Channel[];   // 配列用
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