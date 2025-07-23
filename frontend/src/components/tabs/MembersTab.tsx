import React, { useState } from 'react';
import { performMemberAction, performBulkAction } from '../../utils/api';
import type { TabProps, MemberAction } from '../../types/discord';

type BulkActionType = 'move-all' | 'shuffle' | 'mute-all' | 'unmute-all';

const MembersTab: React.FC<TabProps> = ({ 
  selectedGuild, 
  selectedGuildData, 
  showResult 
}) => {
  const [memberAction, setMemberAction] = useState<MemberAction>({
    userId: '',
    action: 'nickname',
    value: ''
  });

  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  const handleMemberAction = async () => {
    if (!selectedGuild || !memberAction.userId) {
      showResult('サーバーとユーザーIDを入力してください', 'error');
      return;
    }

    try {
      const result = await performMemberAction({
        guildId: selectedGuild,
        ...memberAction
      });

      if (result.success) {
        showResult('メンバー操作を実行しました！', 'success');
        setMemberAction(prev => ({ ...prev, userId: '', value: '' }));
      } else {
        showResult(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showResult(`操作エラー: ${errorMessage}`, 'error');
    }
  };

  const handleBulkAction = async (action: BulkActionType, options: Record<string, unknown> = {}) => {
    if (!selectedGuild) {
      showResult('サーバーを選択してください', 'error');
      return;
    }

    setBulkLoading(action);
    try {
      const result = await performBulkAction({
        guildId: selectedGuild,
        action: action,
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
    } finally {
      setBulkLoading(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">👥 メンバー管理</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 個別メンバー操作 */}
        <div>
          <h3 className="text-white font-semibold mb-4">個別メンバー操作</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-white font-medium mb-2">ユーザーID</label>
              <input
                type="text"
                value={memberAction.userId}
                onChange={(e) => setMemberAction(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="123456789012345678"
                className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-4 py-3"
              />
              <p className="text-white/50 text-xs mt-1">
                ユーザーを右クリック→「IDをコピー」で取得
              </p>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">操作タイプ</label>
              <select
                value={memberAction.action}
                onChange={(e) => setMemberAction(prev => ({ 
                  ...prev, 
                  action: e.target.value as MemberAction['action'],
                  value: '' // 操作変更時に値をリセット
                }))}
                className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-3"
              >
                <option value="nickname" className="bg-gray-800">ニックネーム変更</option>
                <option value="move" className="bg-gray-800">ボイスチャンネル移動</option>
                <option value="mute" className="bg-gray-800">ミュート</option>
                <option value="unmute" className="bg-gray-800">ミュート解除</option>
                <option value="kick" className="bg-gray-800">キック</option>
              </select>
            </div>

            {(memberAction.action === 'nickname' || memberAction.action === 'move') && (
              <div>
                <label className="block text-white font-medium mb-2">
                  {memberAction.action === 'nickname' ? '新しいニックネーム' : '移動先チャンネル'}
                </label>
                {memberAction.action === 'move' ? (
                  <select
                    value={memberAction.value}
                    onChange={(e) => setMemberAction(prev => ({ ...prev, value: e.target.value }))}
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-3"
                  >
                    <option value="" className="bg-gray-800">チャンネルを選択...</option>
                    {selectedGuildData?.voiceChannels?.map(channel => (
                      <option key={channel.id} value={channel.id} className="bg-gray-800">
                        🔊 {channel.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={memberAction.value}
                    onChange={(e) => setMemberAction(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="新しい表示名..."
                    className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-4 py-3"
                  />
                )}
              </div>
            )}

            <button
              onClick={handleMemberAction}
              disabled={!memberAction.userId || (memberAction.action === 'nickname' && !memberAction.value) || (memberAction.action === 'move' && !memberAction.value)}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all"
            >
              🎯 操作実行
            </button>
          </div>

          {/* 操作説明 */}
          <div className="mt-6 bg-white/5 rounded-lg p-4 border border-white/20">
            <h4 className="text-white font-medium mb-2">💡 操作について</h4>
            <div className="text-white/70 text-sm space-y-1">
              <p>• <strong>ニックネーム変更</strong>: サーバー内での表示名を変更</p>
              <p>• <strong>ボイス移動</strong>: 参加中のボイスチャンネルから移動</p>
              <p>• <strong>ミュート</strong>: サーバーミュート（強制ミュート）</p>
              <p>• <strong>キック</strong>: サーバーから一時的に追放</p>
            </div>
          </div>
        </div>

        {/* 一括操作 */}
        <div>
          <h3 className="text-white font-semibold mb-4">一括操作</h3>
          <div className="space-y-4">
            {/* 全員移動 */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/20">
              <h4 className="text-white font-medium mb-3">👥 全員移動</h4>
              <div className="space-y-3">
                <label className="block text-white/70 text-sm">移動先チャンネル</label>
                <select 
                  className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-3 py-2"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkAction('move-all', { targetChannelId: e.target.value });
                      e.target.value = ''; // リセット
                    }
                  }}
                  defaultValue=""
                  disabled={bulkLoading === 'move-all'}
                >
                  <option value="" className="bg-gray-800">
                    {bulkLoading === 'move-all' ? '移動中...' : 'チャンネルを選択...'}
                  </option>
                  {selectedGuildData?.voiceChannels?.map(channel => (
                    <option key={channel.id} value={channel.id} className="bg-gray-800">
                      🔊 {channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* その他の一括操作 */}
            <div className="space-y-3">
              <button 
                onClick={() => handleBulkAction('shuffle')}
                disabled={bulkLoading === 'shuffle'}
                className="w-full bg-purple-600/50 hover:bg-purple-600/70 disabled:opacity-50 text-white py-3 rounded-lg transition-all"
              >
                {bulkLoading === 'shuffle' ? '実行中...' : '🔄 チームランダム分け'}
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleBulkAction('mute-all')}
                  disabled={bulkLoading === 'mute-all'}
                  className="bg-red-600/50 hover:bg-red-600/70 disabled:opacity-50 text-white py-3 rounded-lg transition-all"
                >
                  {bulkLoading === 'mute-all' ? '実行中...' : '🔇 全員ミュート'}
                </button>
                <button 
                  onClick={() => handleBulkAction('unmute-all')}
                  disabled={bulkLoading === 'unmute-all'}
                  className="bg-green-600/50 hover:bg-green-600/70 disabled:opacity-50 text-white py-3 rounded-lg transition-all"
                >
                  {bulkLoading === 'unmute-all' ? '実行中...' : '🔊 ミュート解除'}
                </button>
              </div>
            </div>

            {/* 一括操作の説明 */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/20">
              <h4 className="text-white font-medium mb-2">⚠️ 一括操作について</h4>
              <div className="text-white/70 text-sm space-y-1">
                <p>• <strong>全員移動</strong>: 現在ボイスチャンネルにいる全員を移動</p>
                <p>• <strong>ランダム分け</strong>: 全員を各ボイスチャンネルにランダム配置</p>
                <p>• <strong>全員ミュート</strong>: ボイス参加中で未ミュートの全員をミュート</p>
                <p>• <strong>ミュート解除</strong>: サーバーミュート状態の全員を解除</p>
              </div>
            </div>
          </div>

          {/* ショートカット操作 */}
          <div className="mt-6">
            <h4 className="text-white font-medium mb-3">⚡ ショートカット</h4>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  const voiceChannels = selectedGuildData?.voiceChannels;
                  if (voiceChannels && voiceChannels.length > 0) {
                    const randomChannel = voiceChannels[Math.floor(Math.random() * voiceChannels.length)];
                    handleBulkAction('move-all', { targetChannelId: randomChannel.id });
                  }
                }}
                className="bg-indigo-600/50 hover:bg-indigo-600/70 text-white py-2 px-3 rounded-lg transition-all text-sm"
              >
                🎲 ランダム集合
              </button>
              <button 
                onClick={() => {
                  // 最初のボイスチャンネルに全員移動（ロビー的な使い方）
                  const firstVoiceChannel = selectedGuildData?.voiceChannels?.[0];
                  if (firstVoiceChannel) {
                    handleBulkAction('move-all', { targetChannelId: firstVoiceChannel.id });
                  }
                }}
                className="bg-orange-600/50 hover:bg-orange-600/70 text-white py-2 px-3 rounded-lg transition-all text-sm"
              >
                🏠 ロビーに集合
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* サーバー情報 */}
      <div className="mt-8 bg-white/5 rounded-lg p-6 border border-white/20">
        <h3 className="text-white font-semibold mb-4">📊 サーバー情報</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{selectedGuildData?.memberCount || 0}</div>
            <div className="text-white/70 text-sm">総メンバー数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{selectedGuildData?.voiceChannels?.length || 0}</div>
            <div className="text-white/70 text-sm">ボイスチャンネル</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{selectedGuildData?.textChannels?.length || 0}</div>
            <div className="text-white/70 text-sm">テキストチャンネル</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">0</div>
            <div className="text-white/70 text-sm">オンライン</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembersTab;