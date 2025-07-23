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
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 mb-8 border border-white/20">
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-white/70 hover:bg-white/10'
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