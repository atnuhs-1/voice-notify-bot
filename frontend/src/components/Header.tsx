import React from 'react';
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
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8 border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <span className="text-4xl">🤖</span>
          Discord Bot Control Panel
        </h1>
        {stats && (
          <div className="text-white/80">
            <div className="text-sm">Bot: {stats.bot?.tag}</div>
            <div className="text-sm">
              ステータス: <span className="text-green-400">オンライン</span>
            </div>
          </div>
        )}
      </div>

      {/* サーバー選択 */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-white font-medium">サーバー選択:</label>
        <select 
          value={selectedGuild}
          onChange={(e) => setSelectedGuild(e.target.value)}
          className="bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-400 min-w-[200px]"
        >
          {guilds.map(guild => (
            <option key={guild.id} value={guild.id} className="bg-gray-800">
              {guild.name} ({guild.memberCount}人)
            </option>
          ))}
        </select>
        {selectedGuildData && (
          <div className="text-white/80 text-sm">
            テキスト: {selectedGuildData.textChannels?.length || 0}ch / 
            ボイス: {selectedGuildData.voiceChannelsCount || 0}ch
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;