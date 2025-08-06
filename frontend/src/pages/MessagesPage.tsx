import React from 'react';
import MessageTab from '../components/tabs/MessageTab';

interface MessagesPageProps {
  guilds: any[];
  selectedGuild: string;
  selectedGuildData: any;
  showResult: (message: string, type: 'success' | 'error') => void;
  loadData: () => void;
  stats: any;
  setSelectedGuild: (guildId: string) => void;
}

const MessagesPage: React.FC<MessagesPageProps> = (props) => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          💬 メッセージ管理
        </h1>
        <p className="text-gray-600 mt-2">
          メッセージの送信と管理機能
        </p>
      </div>

      {/* メッセージ管理コンテンツ */}
      <div className="bg-white rounded-lg shadow-sm">
        <MessageTab {...props} />
      </div>
    </div>
  );
};

export default MessagesPage;