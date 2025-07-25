import React from 'react';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

// タブの定義（固定）
const TABS = [
  { id: 'overview', name: '概要', icon: '📊' },
  { id: 'messages', name: 'メッセージ', icon: '💬' },
  { id: 'channels', name: 'チャンネル', icon: '🏷️' },
  { id: 'members', name: 'メンバー', icon: '👥' },
  { id: 'voice', name: 'ボイス', icon: '🔊' }
];

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange
}) => {
  return (
    <div className="bg-white rounded-lg p-2 mb-4 shadow-sm">
      <div className="flex flex-wrap gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-2 rounded text-gray-500 text-sm font-medium flex items-center gap-1.5 transition-all ${
              activeTab === tab.id
                ? 'bg-discord-blurple text-white shadow-lg'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;