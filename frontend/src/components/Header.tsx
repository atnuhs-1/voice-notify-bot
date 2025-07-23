import React from 'react';
import { useAuth } from '../hooks/useAuth';
import type { Guild, BotStats } from "./../types/discord"

interface HeaderProps {
  stats: BotStats | null;
  guilds: Guild[];
  selectedGuild: string;
  setSelectedGuild: (guildId: string) => void;
  selectedGuildData?: Guild;
}

const Header: React.FC<HeaderProps> = ({
  stats,
  guilds,
  selectedGuild,
  setSelectedGuild,
  selectedGuildData
}) => {
  const { user, logout } = useAuth();

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8 border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <span className="text-4xl">🤖</span>
          Discord Bot Control Panel
        </h1>
        
        {/* 右側：Bot情報 + ユーザー情報 */}
        <div className="flex items-center gap-6">
          {/* Bot情報 */}
          {stats && (
            <div className="text-white/80 text-right">
              <div className="text-sm">Bot: {stats.bot?.tag}</div>
              <div className="text-sm">
                ステータス: <span className="text-green-400">オンライン</span>
              </div>
            </div>
          )}

          {/* 区切り線 */}
          <div className="w-px h-12 bg-white/20"></div>

          {/* ユーザー情報 */}
          {user && (
            <div className="flex items-center gap-3">
              {/* ユーザーアバター */}
              {user.avatar ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=64`}
                  alt={user.tag}
                  className="w-12 h-12 rounded-full border-2 border-white/30 shadow-lg"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center border-2 border-white/30 shadow-lg">
                  <span className="text-white font-bold text-lg">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              {/* ユーザー詳細 */}
              <div className="text-white">
                <div className="font-semibold text-lg">{user.tag}</div>
                <div className="text-sm text-white/70">
                  {guilds.length}サーバーを管理中
                </div>
              </div>

              {/* ログアウトボタン */}
              <button
                onClick={logout}
                className="ml-4 bg-red-600/20 hover:bg-red-600/40 text-red-300 hover:text-red-100 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-red-500/30 hover:border-red-400/50 shadow-lg hover:shadow-red-500/20"
                title="ログアウト"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  ログアウト
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* サーバー選択エリア */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-white font-medium">サーバー選択:</label>
        
        <select 
          value={selectedGuild}
          onChange={(e) => setSelectedGuild(e.target.value)}
          className="bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-400 min-w-[200px] hover:bg-white/25 transition-colors"
        >
          {guilds.map(guild => (
            <option key={guild.id} value={guild.id} className="bg-gray-800">
              {guild.name} ({guild.memberCount}人)
            </option>
          ))}
        </select>

        {/* 選択中のサーバー詳細情報 */}
        {selectedGuildData && (
          <div className="flex items-center gap-4 text-white/80 text-sm">
            {/* サーバーアイコン */}
            {selectedGuildData.icon ? (
              <img
                src={selectedGuildData.icon}
                alt={selectedGuildData.name}
                className="w-8 h-8 rounded-full border border-white/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/20">
                <span className="text-xs font-bold">
                  {selectedGuildData.name.charAt(0)}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <span>📄 テキスト: {selectedGuildData.textChannels?.length || 0}ch</span>
              <span>🔊 ボイス: {selectedGuildData.voiceChannelsCount || 0}ch</span>
              <span>👥 {selectedGuildData.memberCount}人</span>
            </div>
          </div>
        )}
      </div>

      {/* 権限情報バー */}
      <div className="mt-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-3 border border-green-400/30">
        <div className="flex items-center gap-2 text-green-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">認証済み</span>
          <span className="text-white/70">- あなたが管理者権限を持つサーバーのみ表示されています</span>
        </div>
      </div>
    </div>
  );
};

export default Header;