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
  guilds,
  selectedGuild,
  setSelectedGuild,
  selectedGuildData
}) => {
  const { user, logout } = useAuth();

  return (
    <div className="bg-white rounded-lg p-4 mb-4 shadow-sm flex justify-between items-center">

        <h1 className="text-xl font-bold flex items-center gap-3">
          <span className="text-xl">🤖</span>
          Discord Bot Control Panel
        </h1>
        
        {/* 右側：Bot情報 + ユーザー情報 */}
        <div className="flex items-center gap-6">

          {/* 選択中のサーバー詳細情報 */}
          {selectedGuildData && (
            <div className="flex items-center gap-4 text-sm">
              {/* サーバーアイコン */}
              {selectedGuildData.icon ? (
                <img
                  src={selectedGuildData.icon}
                  alt={selectedGuildData.name}
                  className="w-8 h-8 rounded-full border border-white/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center border border-white/20">
                  <span className="text-xs font-bold">
                    {selectedGuildData.name.charAt(0)}
                  </span>
                </div>
              )}
            
            </div>
          )}

          {/* サーバー選択エリア */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="font-medium">サーバー選択:</label>
            
            <select 
              value={selectedGuild}
              onChange={(e) => setSelectedGuild(e.target.value)}
              className="bg-white/20  border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-400 min-w-[200px] hover:bg-white/25 transition-colors"
            >
              {guilds.map(guild => (
                <option key={guild.id} value={guild.id} className="">
                  {guild.name} ({guild.memberCount}人)
                </option>
              ))}
            </select>
          </div>

          {/* 区切り線 */}
          <div className="w-px h-12 bg-gray-300"></div>

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
                  <span className="font-bold text-lg">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              {/* ユーザー詳細 */}
              <div className="">
                <div className="font-semibold text-lg">{user.tag}</div>
                <div className="text-sm">
                  {guilds.length}サーバーを管理中
                </div>
              </div>

              {/* ログアウトボタン */}
              <button
                onClick={logout}
                className="ml-4 bg-red-600/20 hover:bg-red-600/40 text- hover:text-red-100 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-red-500/30 hover:border-red-400/50 shadow-lg hover:shadow-red-500/20"
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
  );
};

export default Header;