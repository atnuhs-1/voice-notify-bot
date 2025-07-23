import React, { useState, useEffect } from 'react';
import { fetchLiveStatus } from '../../utils/api';
import type { TabProps } from '../../types/discord';

interface VoiceChannelStatus {
  id: string;
  name: string;
  position: number;
  userLimit: number;
  members: Array<{
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    muted: boolean;
    deafened: boolean;
  }>;
  memberCount: number;
}

interface LiveStatus {
  guild: {
    id: string;
    name: string;
    memberCount: number;
    onlineCount: number;
  };
  voiceChannels: VoiceChannelStatus[];
  onlineMembers: Array<{
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    status: string;
    activity: string | null;
  }>;
  stats: {
    totalVoiceChannels: number;
    activeVoiceChannels: number;
    totalUsersInVoice: number;
  };
}

const VoiceTab: React.FC<TabProps> = ({ 
  selectedGuild, 
  selectedGuildData, 
  showResult 
}) => {
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [musicForm, setMusicForm] = useState({
    url: '',
    volume: 50
  });

  useEffect(() => {
    if (selectedGuild) {
      loadLiveStatus();
    }
  }, [selectedGuild]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && selectedGuild) {
      interval = setInterval(loadLiveStatus, 5000); // 5秒ごとに更新
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, selectedGuild]);

  const loadLiveStatus = async () => {
    if (!selectedGuild) return;
    
    try {
      setLoading(true);
      const status = await fetchLiveStatus(selectedGuild);
      setLiveStatus(status);
    } catch (error) {
      showResult(`ライブ状況の取得に失敗: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'idle': return 'text-yellow-400';
      case 'dnd': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'idle': return '🟡';
      case 'dnd': return '🔴';
      default: return '⚫';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">🔊 ボイス操作</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-white">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">自動更新</span>
          </label>
          <button
            onClick={loadLiveStatus}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-all"
          >
            {loading ? '更新中...' : '🔄 更新'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 音楽Bot機能（将来実装） */}
        <div>
          <h3 className="text-white font-semibold mb-4">🎵 音楽Bot機能</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-white font-medium mb-2">YouTube URL</label>
              <input
                type="text"
                value={musicForm.url}
                onChange={(e) => setMusicForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-4 py-3"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => showResult('音楽機能は開発中です', 'error')}
                className="bg-green-600/50 hover:bg-green-600/70 text-white py-2 px-4 rounded-lg transition-all"
              >
                ▶️ 再生
              </button>
              <button 
                onClick={() => showResult('音楽機能は開発中です', 'error')}
                className="bg-red-600/50 hover:bg-red-600/70 text-white py-2 px-4 rounded-lg transition-all"
              >
                ⏹️ 停止
              </button>
              <button 
                onClick={() => showResult('音楽機能は開発中です', 'error')}
                className="bg-blue-600/50 hover:bg-blue-600/70 text-white py-2 px-4 rounded-lg transition-all"
              >
                ⏸️ 一時停止
              </button>
              <button 
                onClick={() => showResult('音楽機能は開発中です', 'error')}
                className="bg-purple-600/50 hover:bg-purple-600/70 text-white py-2 px-4 rounded-lg transition-all"
              >
                ⏭️ スキップ
              </button>
            </div>
            
            <div>
              <label className="block text-white font-medium mb-2">
                音量: {musicForm.volume}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={musicForm.volume}
                onChange={(e) => setMusicForm(prev => ({ ...prev, volume: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <button 
                onClick={() => showResult('Bot接続機能は開発中です', 'error')}
                className="w-full bg-orange-600/50 hover:bg-orange-600/70 text-white py-2 px-4 rounded-lg transition-all"
              >
                🔊 Botをボイスチャンネルに接続
              </button>
              <button 
                onClick={() => showResult('Bot切断機能は開発中です', 'error')}
                className="w-full bg-gray-600/50 hover:bg-gray-600/70 text-white py-2 px-4 rounded-lg transition-all"
              >
                🔌 Botを切断
              </button>
            </div>
          </div>

          {/* 開発中メッセージ */}
          <div className="mt-6 text-center">
            <div className="text-white/50 mb-4">
              <div className="text-4xl mb-2">🚧</div>
              <div className="text-lg">音楽Bot機能は開発中です</div>
              <div className="text-sm">近日実装予定...</div>
            </div>
          </div>
        </div>

        {/* リアルタイムボイス状況 */}
        <div>
          <h3 className="text-white font-semibold mb-4">📊 リアルタイムボイス状況</h3>
          
          {liveStatus && (
            <div className="space-y-4">
              {/* 統計情報 */}
              <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold text-white">
                      {liveStatus.stats.totalUsersInVoice}
                    </div>
                    <div className="text-white/70 text-sm">ボイス参加中</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">
                      {liveStatus.stats.activeVoiceChannels}
                    </div>
                    <div className="text-white/70 text-sm">アクティブ</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">
                      {liveStatus.guild.onlineCount}
                    </div>
                    <div className="text-white/70 text-sm">オンライン</div>
                  </div>
                </div>
              </div>

              {/* ボイスチャンネル一覧 */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                <h4 className="text-white/70 text-sm mb-2">🔊 ボイスチャンネル</h4>
                {liveStatus.voiceChannels.map(channel => (
                  <div key={channel.id} className="bg-white/10 rounded-lg p-3 border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">🔊 {channel.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/70 text-sm">
                          {channel.memberCount}/{channel.userLimit || '∞'}
                        </span>
                        {channel.memberCount > 0 && (
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        )}
                      </div>
                    </div>
                    
                    {channel.members.length > 0 && (
                      <div className="space-y-1">
                        {channel.members.map(member => (
                          <div key={member.id} className="flex items-center gap-2 text-sm">
                            {member.avatar ? (
                              <img 
                                src={member.avatar} 
                                alt={member.displayName}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                                <span className="text-xs">👤</span>
                              </div>
                            )}
                            <span className="text-white/80">{member.displayName}</span>
                            <div className="flex gap-1">
                              {member.muted && <span className="text-red-400">🔇</span>}
                              {member.deafened && <span className="text-gray-400">🔇</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {channel.memberCount === 0 && (
                      <div className="text-white/50 text-sm text-center py-2">
                        誰もいません
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!liveStatus && !loading && (
            <div className="text-center py-8 text-white/50">
              <div className="text-4xl mb-2">📡</div>
              <div>「更新」ボタンでリアルタイム状況を取得</div>
            </div>
          )}
        </div>
      </div>

      {/* オンラインメンバー一覧 */}
      {liveStatus && liveStatus.onlineMembers.length > 0 && (
        <div className="mt-8">
          <h3 className="text-white font-semibold mb-4">
            👥 オンラインメンバー ({liveStatus.onlineMembers.length}人)
          </h3>
          <div className="bg-white/10 rounded-lg p-4 border border-white/20 max-h-60 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveStatus.onlineMembers.map(member => (
                <div key={member.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-2">
                  {member.avatar ? (
                    <img 
                      src={member.avatar} 
                      alt={member.displayName}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-sm">👤</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate">{member.displayName}</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${getStatusColor(member.status)}`}>
                        {getStatusIcon(member.status)}
                      </span>
                      {member.activity && (
                        <span className="text-white/60 text-xs truncate">
                          {member.activity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceTab;