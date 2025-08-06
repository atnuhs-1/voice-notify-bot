import React from 'react';
import ChannelTab from '../components/tabs/ChannelTab';

interface ChannelsPageProps {
  guilds: any[];
  selectedGuild: string;
  selectedGuildData: any;
  showResult: (message: string, type: 'success' | 'error') => void;
  loadData: () => void;
  stats: any;
  setSelectedGuild: (guildId: string) => void;
}

const ChannelsPage: React.FC<ChannelsPageProps> = (props) => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          🏷️ チャンネル管理
        </h1>
        <p className="text-gray-600 mt-2">
          チャンネルの設定と管理を行います
        </p>
      </div>

      {/* チャンネル管理コンテンツ */}
      <div className="bg-white rounded-lg shadow-sm">
        <ChannelTab {...props} />
      </div>
    </div>
  );
};

export default ChannelsPage;