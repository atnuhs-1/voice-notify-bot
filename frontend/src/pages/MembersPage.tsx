import React from 'react';
import MembersTab from '../components/tabs/MembersTab';

interface MembersPageProps {
  guilds: any[];
  selectedGuild: string;
  selectedGuildData: any;
  showResult: (message: string, type: 'success' | 'error') => void;
  loadData: () => void;
  stats: any;
  setSelectedGuild: (guildId: string) => void;
}

const MembersPage: React.FC<MembersPageProps> = (props) => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          👥 メンバー管理
        </h1>
        <p className="text-gray-600 mt-2">
          サーバーメンバーの一覧と権限管理
        </p>
      </div>

      {/* メンバー管理コンテンツ */}
      <div className="bg-white rounded-lg shadow-sm">
        <MembersTab {...props} />
      </div>
    </div>
  );
};

export default MembersPage;