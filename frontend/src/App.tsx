import React, { useState } from 'react';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import TabNavigation from './components/TabNavigation';
import { useDiscordData } from './hooks/useDiscordData';
import OverviewTab from './components/tabs/OverviewTabs';
import MessagesTab from './components/tabs/MessageTab';
import ChannelsTab from './components/tabs/ChannelTab';

import VoiceTab from './components/tabs/VoiceTab';
import MembersTab from './components/tabs/MembersTab';


const DiscordControlDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const { 
    guilds, 
    stats, 
    selectedGuild, 
    setSelectedGuild, 
    loading, 
    loadData,
    showResult,
    result 
  } = useDiscordData();

  const tabs = [
    { id: 'overview', name: '概要', icon: '📊' },
    { id: 'messages', name: 'メッセージ', icon: '💬' },
    { id: 'channels', name: 'チャンネル', icon: '🏷️' },
    { id: 'members', name: 'メンバー', icon: '👥' },
    { id: 'voice', name: 'ボイス', icon: '🔊' }
  ];

  const selectedGuildData = guilds.find(g => g.id === selectedGuild);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Discord Bot 読み込み中...</div>
      </div>
    );
  }

  const renderTabContent = () => {
    const commonProps = {
      guilds,
      selectedGuild,
      selectedGuildData,
      showResult,
      loadData
    };

    switch (activeTab) {
      case 'overview':
        return <OverviewTab {...commonProps} />;
      case 'messages':
        return <MessagesTab {...commonProps} />;
      case 'channels':
        return <ChannelsTab {...commonProps} />;
      case 'members':
        return <MembersTab {...commonProps} />;
      case 'voice':
        return <VoiceTab {...commonProps} />;
      default:
        return <OverviewTab {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="container mx-auto px-4 py-8">
        <Header 
          stats={stats}
          guilds={guilds}
          selectedGuild={selectedGuild}
          setSelectedGuild={setSelectedGuild}
          selectedGuildData={selectedGuildData}
        />
        
        <StatsCards stats={stats} />
        
        <TabNavigation 
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          {renderTabContent()}
        </div>

        {/* 結果表示 */}
        {result && (
          <div className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-lg z-50 ${
            result.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscordControlDashboard;