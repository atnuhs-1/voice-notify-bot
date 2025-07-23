import React, { useState } from 'react';
import { createChannel, deleteChannel } from '../../utils/api';
import type { TabProps, ChannelForm } from '../../types/discord';

const ChannelsTab: React.FC<TabProps> = ({ 
  selectedGuild, 
  selectedGuildData, 
  showResult, 
  loadData 
}) => {
  const [channelForm, setChannelForm] = useState<ChannelForm>({
    name: '',
    type: 'text',
    topic: '',
    slowmode: 0
  });

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleCreateChannel = async () => {
    if (!selectedGuild || !channelForm.name) {
      showResult('サーバーとチャンネル名を選択してください', 'error');
      return;
    }

    try {
      const result = await createChannel({
        guildId: selectedGuild,
        ...channelForm
      });

      if (result.success) {
        showResult(
          `${channelForm.type === 'text' ? 'テキスト' : 'ボイス'}チャンネルを作成しました！`, 
          'success'
        );
        setChannelForm({ name: '', type: 'text', topic: '', slowmode: 0 });
        loadData();
      } else {
        showResult(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showResult(`作成エラー: ${errorMessage}`, 'error');
    }
  };

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    if (deleteConfirm !== channelId) {
      setDeleteConfirm(channelId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      const result = await deleteChannel(channelId);
      if (result.success) {
        showResult(`チャンネル「${channelName}」を削除しました`, 'success');
        loadData();
      } else {
        showResult(`削除エラー: ${result.error}`, 'error');
      }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showResult(`削除エラー: ${errorMessage}`, 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">🏷️ チャンネル管理</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* チャンネル作成フォーム */}
        <div>
          <h3 className="text-white font-semibold mb-4">新しいチャンネルを作成</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-white font-medium mb-2">チャンネル名</label>
              <input
                type="text"
                value={channelForm.name}
                onChange={(e) => setChannelForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="チャンネル名（半角英数字推奨）"
                className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-4 py-3"
              />
              <p className="text-white/50 text-xs mt-1">
                特殊文字は自動的にハイフンに変換されます
              </p>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">チャンネルタイプ</label>
              <select
                value={channelForm.type}
                onChange={(e) => setChannelForm(prev => ({ ...prev, type: e.target.value as 'text' | 'voice' }))}
                className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-3"
              >
                <option value="text" className="bg-gray-800">💬 テキストチャンネル</option>
                <option value="voice" className="bg-gray-800">🔊 ボイスチャンネル</option>
              </select>
            </div>

            {channelForm.type === 'text' && (
              <>
                <div>
                  <label className="block text-white font-medium mb-2">トピック</label>
                  <input
                    type="text"
                    value={channelForm.topic}
                    onChange={(e) => setChannelForm(prev => ({ ...prev, topic: e.target.value }))}
                    placeholder="チャンネルの説明..."
                    className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    低速モード (秒)
                  </label>
                  <select
                    value={channelForm.slowmode}
                    onChange={(e) => setChannelForm(prev => ({ ...prev, slowmode: parseInt(e.target.value) }))}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-3"
                  >
                    <option value={0} className="bg-gray-800">無効</option>
                    <option value={5} className="bg-gray-800">5秒</option>
                    <option value={10} className="bg-gray-800">10秒</option>
                    <option value={15} className="bg-gray-800">15秒</option>
                    <option value={30} className="bg-gray-800">30秒</option>
                    <option value={60} className="bg-gray-800">1分</option>
                    <option value={300} className="bg-gray-800">5分</option>
                  </select>
                </div>
              </>
            )}

            <button
              onClick={handleCreateChannel}
              disabled={!channelForm.name}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all"
            >
              ➕ チャンネル作成
            </button>
          </div>

          {/* チャンネルテンプレート */}
          <div className="mt-6">
            <h4 className="text-white font-medium mb-3">📋 テンプレート</h4>
            <div className="space-y-2">
              <button
                onClick={() => setChannelForm({
                  name: 'general-chat',
                  type: 'text',
                  topic: '雑談用チャンネル',
                  slowmode: 0
                })}
                className="w-full bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-3 rounded-lg text-left"
              >
                💬 雑談チャンネル
              </button>
              <button
                onClick={() => setChannelForm({
                  name: 'gaming-voice',
                  type: 'voice',
                  topic: '',
                  slowmode: 0
                })}
                className="w-full bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-3 rounded-lg text-left"
              >
                🎮 ゲーム用ボイス
              </button>
              <button
                onClick={() => setChannelForm({
                  name: 'announcements',
                  type: 'text',
                  topic: '重要なお知らせ専用',
                  slowmode: 30
                })}
                className="w-full bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-3 rounded-lg text-left"
              >
                📢 お知らせチャンネル
              </button>
            </div>
          </div>
        </div>

        {/* 既存チャンネル一覧 */}
        <div>
          <h3 className="text-white font-semibold mb-4">現在のチャンネル</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* テキストチャンネル */}
            <div>
              <h4 className="text-white/70 text-sm mb-3 flex items-center gap-2">
                💬 テキストチャンネル 
                <span className="bg-white/20 px-2 py-1 rounded text-xs">
                  {selectedGuildData?.textChannels?.length || 0}個
                </span>
              </h4>
              <div className="space-y-2">
                {selectedGuildData?.textChannels?.map(channel => (
                  <div key={channel.id} className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-white flex items-center gap-2">
                      <span className="text-gray-400">#</span>
                      {channel.name}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        className="text-blue-400 hover:text-blue-300 text-sm px-2 py-1 rounded hover:bg-white/10"
                        onClick={() => {
                          // 編集機能は将来実装
                          showResult('編集機能は準備中です', 'error');
                        }}
                      >
                        編集
                      </button>
                      <button 
                        className={`text-sm px-2 py-1 rounded transition-colors ${
                          deleteConfirm === channel.id
                            ? 'bg-red-600 text-white'
                            : 'text-red-400 hover:text-red-300 hover:bg-white/10'
                        }`}
                        onClick={() => handleDeleteChannel(channel.id, channel.name)}
                      >
                        {deleteConfirm === channel.id ? '確認' : '削除'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* ボイスチャンネル */}
            <div>
              <h4 className="text-white/70 text-sm mb-3 mt-6 flex items-center gap-2">
                🔊 ボイスチャンネル
                <span className="bg-white/20 px-2 py-1 rounded text-xs">
                  {selectedGuildData?.voiceChannels?.length || 0}個
                </span>
              </h4>
              <div className="space-y-2">
                {selectedGuildData?.voiceChannels?.map(channel => (
                  <div key={channel.id} className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-white flex items-center gap-2">
                      🔊 {channel.name}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        className="text-blue-400 hover:text-blue-300 text-sm px-2 py-1 rounded hover:bg-white/10"
                        onClick={() => {
                          showResult('編集機能は準備中です', 'error');
                        }}
                      >
                        編集
                      </button>
                      <button 
                        className={`text-sm px-2 py-1 rounded transition-colors ${
                          deleteConfirm === channel.id
                            ? 'bg-red-600 text-white'
                            : 'text-red-400 hover:text-red-300 hover:bg-white/10'
                        }`}
                        onClick={() => handleDeleteChannel(channel.id, channel.name)}
                      >
                        {deleteConfirm === channel.id ? '確認' : '削除'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(!selectedGuildData?.textChannels?.length && !selectedGuildData?.voiceChannels?.length) && (
              <div className="text-center py-8 text-white/50">
                チャンネルが見つかりません
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelsTab;