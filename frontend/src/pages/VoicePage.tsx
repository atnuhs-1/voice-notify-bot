import React from 'react';
import VoiceTab from '../components/tabs/VoiceTab';

interface VoicePageProps {
  guilds: any[];
  selectedGuild: string;
  selectedGuildData: any;
  showResult: (message: string, type: 'success' | 'error') => void;
  loadData: () => void;
  stats: any;
  setSelectedGuild: (guildId: string) => void;
}

const VoicePage: React.FC<VoicePageProps> = (props) => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          🔊 ボイス設定
        </h1>
        <p className="text-gray-600 mt-2">
          ボイスチャンネルの設定と通知管理
        </p>
      </div>

      {/* ボイス設定コンテンツ */}
      <div className="bg-white rounded-lg shadow-sm">
        <VoiceTab {...props} />
      </div>
    </div>
  );
};

export default VoicePage;