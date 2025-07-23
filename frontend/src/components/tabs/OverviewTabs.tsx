import React from 'react';
import { performBulkAction } from '../../utils/api';
import type { TabProps } from '../../types/discord';

type BulkActionType = 'move-all' | 'shuffle' | 'mute-all' | 'unmute-all';

const OverviewTab: React.FC<TabProps> = ({ 
  selectedGuild, 
  selectedGuildData, 
  showResult, 
  loadData 
}) => {
 const handleBulkAction = async (action: BulkActionType, options: Record<string, unknown> = {}) => {
    if (!selectedGuild) {
      showResult('サーバーを選択してください', 'error');
      return;
    }

    try {
      const result = await performBulkAction({
        guildId: selectedGuild,
        action: action  ,
        ...options
      });

      if (result.success) {
        showResult(result.message, 'success');
      } else {
        showResult(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showResult(`操作エラー: ${errorMessage}`, 'error');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">🎮 クイックアクション</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 全員集合 */}
        <div className="bg-gradient-to-r from-purple-500/30 to-pink-500/30 p-6 rounded-xl border border-purple-400/30">
          <h3 className="text-white font-semibold mb-2">🎯 全員集合</h3>
          <p className="text-white/70 text-sm mb-4">全メンバーを指定ボイスチャンネルに移動</p>
          <select 
            className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-3 py-2 mb-3 text-sm"
            onChange={(e) => {
              if (e.target.value) {
                handleBulkAction('move-all', { targetChannelId: e.target.value });
              }
            }}
            defaultValue=""
          >
            <option value="" className="bg-gray-800">チャンネルを選択...</option>
            {selectedGuildData?.voiceChannels?.map(channel => (
              <option key={channel.id} value={channel.id} className="bg-gray-800">
                🔊 {channel.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* チャンネルシャッフル */}
        <div className="bg-gradient-to-r from-blue-500/30 to-cyan-500/30 p-6 rounded-xl border border-blue-400/30">
          <h3 className="text-white font-semibold mb-2">🔄 チャンネルシャッフル</h3>
          <p className="text-white/70 text-sm mb-4">メンバーをランダムに振り分け</p>
          <button 
            onClick={() => handleBulkAction('shuffle')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full"
          >
            実行
          </button>
        </div>
        
        {/* 全員ミュート */}
        <div className="bg-gradient-to-r from-green-500/30 to-emerald-500/30 p-6 rounded-xl border border-green-400/30">
          <h3 className="text-white font-semibold mb-2">🔇 全員ミュート</h3>
          <p className="text-white/70 text-sm mb-4">ボイス参加中の全員をミュート</p>
          <div className="space-y-2">
            <button 
              onClick={() => handleBulkAction('mute-all')}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg w-full text-sm"
            >
              🔇 全員ミュート
            </button>
            <button 
              onClick={() => handleBulkAction('unmute-all')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg w-full text-sm"
            >
              🔊 ミュート解除
            </button>
          </div>
        </div>
      </div>

      {/* 追加のクイックアクション */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-white mb-4">⚡ その他の操作</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/10 p-4 rounded-lg border border-white/20">
            <h4 className="text-white font-medium mb-3">📊 リアルタイム状況</h4>
            <button 
              onClick={loadData}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg w-full"
            >
              🔄 データ更新
            </button>
          </div>
          
          <div className="bg-white/10 p-4 rounded-lg border border-white/20">
            <h4 className="text-white font-medium mb-3">🎲 ランダム機能</h4>
            <button 
              onClick={() => {
                const voiceChannels = selectedGuildData?.voiceChannels;
                if (voiceChannels && voiceChannels.length > 0) {
                  const randomChannel = voiceChannels[Math.floor(Math.random() * voiceChannels.length)];
                  handleBulkAction('move-all', { targetChannelId: randomChannel.id });
                }
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg w-full"
            >
              🎯 ランダム集合
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;