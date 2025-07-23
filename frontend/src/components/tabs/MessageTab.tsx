import React, { useState } from 'react';
import { sendMessage } from '../../utils/api';
import type { TabProps, MessageForm } from '../../types/discord';

const MessagesTab: React.FC<TabProps> = ({ 
  selectedGuildData, 
  showResult 
}) => {
  const [messageForm, setMessageForm] = useState<MessageForm>({
    channelId: '',
    content: '',
    embedTitle: '',
    embedDescription: '',
    embedColor: '#5865F2'
  });

  const handleSendMessage = async () => {
    if (!messageForm.channelId) {
      showResult('チャンネルを選択してください', 'error');
      return;
    }

    try {
      const result = await sendMessage(messageForm);
      if (result.success) {
        showResult('メッセージを送信しました！', 'success');
        setMessageForm(prev => ({ 
          ...prev, 
          content: '', 
          embedDescription: '' 
        }));
      } else {
        showResult(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showResult(`送信エラー: ${errorMessage}`, 'error');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">💬 メッセージ送信</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* フォーム部分 */}
        <div className="space-y-4">
          <div>
            <label className="block text-white font-medium mb-2">送信先チャンネル</label>
            <select 
              value={messageForm.channelId}
              onChange={(e) => setMessageForm(prev => ({ ...prev, channelId: e.target.value }))}
              className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-3"
            >
              <option value="" className="bg-gray-800">チャンネルを選択...</option>
              {selectedGuildData?.textChannels?.map(channel => (
                <option key={channel.id} value={channel.id} className="bg-gray-800">
                  #{channel.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white font-medium mb-2">通常メッセージ</label>
            <textarea
              value={messageForm.content}
              onChange={(e) => setMessageForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="メッセージ内容..."
              rows={3}
              className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-white font-medium mb-2">埋め込みタイトル</label>
            <input
              type="text"
              value={messageForm.embedTitle}
              onChange={(e) => setMessageForm(prev => ({ ...prev, embedTitle: e.target.value }))}
              placeholder="埋め込みのタイトル..."
              className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-white font-medium mb-2">埋め込み内容</label>
            <textarea
              value={messageForm.embedDescription}
              onChange={(e) => setMessageForm(prev => ({ ...prev, embedDescription: e.target.value }))}
              placeholder="詳細な説明..."
              rows={4}
              className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-white font-medium mb-2">埋め込み色</label>
            <input
              type="color"
              value={messageForm.embedColor}
              onChange={(e) => setMessageForm(prev => ({ ...prev, embedColor: e.target.value }))}
              className="w-16 h-12 bg-transparent border border-white/30 rounded-lg cursor-pointer"
            />
          </div>

          <button
            onClick={handleSendMessage}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 rounded-lg transition-all"
          >
            📤 メッセージ送信
          </button>
        </div>

        {/* プレビュー部分 */}
        <div>
          <h3 className="text-white font-medium mb-4">プレビュー</h3>
          <div className="bg-white/5 rounded-lg p-4 border border-white/20">
            {messageForm.content && (
              <div className="text-white mb-4">
                {messageForm.content}
              </div>
            )}
            {(messageForm.embedTitle || messageForm.embedDescription) && (
              <div 
                className="border-l-4 pl-4"
                style={{ borderColor: messageForm.embedColor }}
              >
                {messageForm.embedTitle && (
                  <div className="text-white font-semibold mb-2">
                    {messageForm.embedTitle}
                  </div>
                )}
                {messageForm.embedDescription && (
                  <div className="text-white/80">
                    {messageForm.embedDescription}
                  </div>
                )}
              </div>
            )}
            {!messageForm.content && !messageForm.embedTitle && !messageForm.embedDescription && (
              <div className="text-white/50 text-center py-8">
                プレビューが表示されます
              </div>
            )}
          </div>

          {/* 定型文テンプレート */}
          <div className="mt-6">
            <h4 className="text-white font-medium mb-3">📝 定型文テンプレート</h4>
            <div className="space-y-2">
              <button
                onClick={() => setMessageForm(prev => ({
                  ...prev,
                  embedTitle: '🎮 ゲーム募集',
                  embedDescription: '一緒にゲームしませんか？\n参加希望者は👍をクリック！',
                  embedColor: '#00ff00'
                }))}
                className="w-full bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-3 rounded-lg text-left"
              >
                🎮 ゲーム募集テンプレート
              </button>
              <button
                onClick={() => setMessageForm(prev => ({
                  ...prev,
                  embedTitle: '📢 お知らせ',
                  embedDescription: '重要なお知らせがあります。',
                  embedColor: '#ff9900'
                }))}
                className="w-full bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-3 rounded-lg text-left"
              >
                📢 お知らせテンプレート
              </button>
              <button
                onClick={() => setMessageForm(prev => ({
                  ...prev,
                  embedTitle: '🎉 イベント告知',
                  embedDescription: 'サーバーイベントを開催します！\n詳細は以下をご確認ください。',
                  embedColor: '#ff00ff'
                }))}
                className="w-full bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-3 rounded-lg text-left"
              >
                🎉 イベント告知テンプレート
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesTab; 