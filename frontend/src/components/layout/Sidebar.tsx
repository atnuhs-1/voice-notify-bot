import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  guilds: any[];
  selectedGuild: string;
  setSelectedGuild: (guildId: string) => void;
  selectedGuildData: any;
}

const Sidebar: React.FC<SidebarProps> = ({
  guilds,
  selectedGuild,
  setSelectedGuild,
  selectedGuildData
}) => {
  const location = useLocation();

  const navigation = [
    { 
      name: 'ダッシュボード', 
      href: '/', 
      icon: '📊',
      description: '統計とサーバー概要'
    },
    { 
      name: 'チャンネル管理', 
      href: '/channels', 
      icon: '🏷️',
      description: 'チャンネル設定と管理'
    },
    { 
      name: 'メンバー管理', 
      href: '/members', 
      icon: '👥',
      description: 'メンバー一覧と権限'
    },
    { 
      name: 'ボイス設定', 
      href: '/voice', 
      icon: '🔊',
      description: 'ボイスチャンネル設定'
    },
    { 
      name: 'メッセージ管理', 
      href: '/messages', 
      icon: '💬',
      description: 'メッセージ送信と管理'
    }
  ];

  return (
    <div className="w-64 bg-white shadow-lg h-screen sticky top-0 flex flex-col">
      {/* ブランドロゴ */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xl font-bold">
            🤖
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Discord Bot</h1>
            <p className="text-sm text-gray-500">管理パネル</p>
          </div>
        </div>
      </div>

      {/* サーバー選択 */}
      <div className="p-4 border-b border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          サーバー選択
        </label>
        <select
          value={selectedGuild || ''}
          onChange={(e) => setSelectedGuild(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">サーバーを選択...</option>
          {guilds.map(guild => (
            <option key={guild.id} value={guild.id}>
              {guild.name} ({guild.memberCount}人)
            </option>
          ))}
        </select>
        
        {selectedGuildData && (
          <div className="mt-2 p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              {selectedGuildData.icon && (
                <img
                  src={`https://cdn.discordapp.com/icons/${selectedGuildData.id}/${selectedGuildData.icon}.webp?size=32`}
                  alt={selectedGuildData.name}
                  className="w-6 h-6 rounded"
                />
              )}
              <div>
                <p className="text-sm font-medium text-gray-800">{selectedGuildData.name}</p>
                <p className="text-xs text-gray-500">{selectedGuildData.memberCount}人のメンバー</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500 group-hover:text-gray-600">
                    {item.description}
                  </div>
                </div>
                {isActive && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* フッター情報 */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 space-y-1">
          <div>バージョン: v2.3.0</div>
          <div>最終更新: {new Date().toLocaleString('ja-JP')}</div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;