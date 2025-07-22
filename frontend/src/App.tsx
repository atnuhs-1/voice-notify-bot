import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend.koyeb.app'
  : 'http://localhost:3000';

const ControlPanel = () => {
  const [guilds, setGuilds] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // カスタム通知用state
  const [notifyForm, setNotifyForm] = useState({
    channelId: '',
    title: '📢 お知らせ',
    message: 'テスト通知です！',
    color: '#007bff'
  });
  const [notifyResult, setNotifyResult] = useState(null);
  const [notifyLoading, setNotifyLoading] = useState(false);
  
  // ゲームアンケート用state
  const [gamePollForm, setGamePollForm] = useState({
    channelId: '',
    gameName: '',
    gameDate: '',
    gameTime: '20:00',
    description: '一緒にやりませんか？',
    maxPlayers: ''
  });
  const [gamePollResult, setGamePollResult] = useState(null);
  const [gamePollLoading, setGamePollLoading] = useState(false);

  useEffect(() => {
    loadData();
    setDefaultDate();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [guildsResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/guilds?includeChannels=true`),
        fetch(`${API_BASE_URL}/api/stats`)
      ]);
      
      const guildsData = await guildsResponse.json();
      const statsData = await statsResponse.json();
      
      setGuilds(guildsData.guilds || []);
      setStats(statsData);
    } catch (error) {
      console.error('データの取得に失敗:', error);
      showResult('データの取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  const setDefaultDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setGamePollForm(prev => ({
      ...prev,
      gameDate: tomorrow.toISOString().split('T')[0]
    }));
  };

  const showResult = (message, type, setter = setNotifyResult) => {
    setter({ message, type });
    setTimeout(() => setter(null), 5000);
  };

  const sendNotification = async (isTest = false) => {
    if (!notifyForm.channelId || !notifyForm.message) {
      showResult('必要な項目を入力してください', 'error');
      return;
    }

    try {
      setNotifyLoading(true);
      const response = await fetch(`${API_BASE_URL}/control/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId: notifyForm.channelId,
          title: isTest ? `[テスト] ${notifyForm.title}` : notifyForm.title,
          message: notifyForm.message,
          color: notifyForm.color.replace('#', '0x'),
          isTest
        })
      });

      const result = await response.json();

      if (result.success) {
        showResult(
          isTest ? 'テスト通知を送信しました！' : '通知を送信しました！',
          'success'
        );
        if (!isTest) {
          setNotifyForm(prev => ({ ...prev, message: '' }));
        }
      } else {
        showResult(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      showResult(`送信エラー: ${error.message}`, 'error');
    } finally {
      setNotifyLoading(false);
    }
  };

  const createGamePoll = async () => {
    if (!gamePollForm.channelId || !gamePollForm.gameName || !gamePollForm.gameDate || !gamePollForm.gameTime) {
      showResult('必要な項目を入力してください', 'error', setGamePollResult);
      return;
    }

    try {
      setGamePollLoading(true);
      const response = await fetch(`${API_BASE_URL}/control/create-game-poll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gamePollForm)
      });

      const result = await response.json();

      if (result.success) {
        showResult('ゲーム参加アンケートを作成しました！', 'success', setGamePollResult);
        setGamePollForm({
          channelId: '',
          gameName: '',
          gameDate: '',
          gameTime: '20:00',
          description: '一緒にやりませんか？',
          maxPlayers: ''
        });
        setDefaultDate();
      } else {
        showResult(`エラー: ${result.error}`, 'error', setGamePollResult);
      }
    } catch (error) {
      showResult(`作成エラー: ${error.message}`, 'error', setGamePollResult);
    } finally {
      setGamePollLoading(false);
    }
  };

  const ResultMessage = ({ result }) => {
    if (!result) return null;
    
    const bgColor = result.type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700';
    
    return (
      <div className={`mt-4 p-4 rounded-lg border ${bgColor}`}>
        {result.message}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 mb-6 shadow-xl">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">🤖 Bot Control Panel</h1>
            <p className="text-gray-600 text-lg">サーバー管理とBot操作のコントロールパネル</p>
          </div>
          
          {stats && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.servers?.total || 0}</div>
                <div className="text-sm text-gray-600">サーバー数</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{stats.database?.notifications || 0}</div>
                <div className="text-sm text-gray-600">通知設定</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.activity?.usersInVoice || 0}</div>
                <div className="text-sm text-gray-600">ボイス参加中</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.database?.activeSessions || 0}</div>
                <div className="text-sm text-gray-600">アクティブ通話</div>
              </div>
            </div>
          )}
        </div>

        {/* カスタム通知セクション */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 mb-6 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            📢 カスタム通知送信
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  送信先チャンネル
                </label>
                <select 
                  value={notifyForm.channelId}
                  onChange={(e) => setNotifyForm(prev => ({ ...prev, channelId: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">チャンネルを選択...</option>
                  {guilds.map(guild => 
                    guild.textChannels?.map(channel => (
                      <option key={channel.id} value={channel.id}>
                        {guild.name} - #{channel.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  タイトル
                </label>
                <input
                  type="text"
                  value={notifyForm.title}
                  onChange={(e) => setNotifyForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="例: 今日のゲーム予定"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  メッセージ
                </label>
                <textarea
                  value={notifyForm.message}
                  onChange={(e) => setNotifyForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="送信したいメッセージを入力..."
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  埋め込み色
                </label>
                <input
                  type="color"
                  value={notifyForm.color}
                  onChange={(e) => setNotifyForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-16 h-12 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                プレビュー
              </label>
              <div className="bg-gray-50 border rounded-lg p-4">
                <div 
                  className="border-l-4 pl-4"
                  style={{ borderColor: notifyForm.color }}
                >
                  <div className="font-semibold text-gray-800 mb-2">
                    {notifyForm.title || '📢 お知らせ'}
                  </div>
                  <div className="text-gray-600 mb-2">
                    {notifyForm.message || 'メッセージが入力されていません'}
                  </div>
                  <div className="text-xs text-gray-500">
                    今すぐ
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => sendNotification(true)}
              disabled={notifyLoading}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {notifyLoading ? '送信中...' : '🧪 テスト送信'}
            </button>
            <button
              onClick={() => sendNotification(false)}
              disabled={notifyLoading}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {notifyLoading ? '送信中...' : '📤 送信'}
            </button>
          </div>

          <ResultMessage result={notifyResult} />
        </div>

        {/* ゲーム参加アンケートセクション */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 mb-6 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            🎮 ゲーム参加アンケート
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  送信先チャンネル
                </label>
                <select 
                  value={gamePollForm.channelId}
                  onChange={(e) => setGamePollForm(prev => ({ ...prev, channelId: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">チャンネルを選択...</option>
                  {guilds.map(guild => 
                    guild.textChannels?.map(channel => (
                      <option key={channel.id} value={channel.id}>
                        {guild.name} - #{channel.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ゲーム名
                </label>
                <input
                  type="text"
                  value={gamePollForm.gameName}
                  onChange={(e) => setGamePollForm(prev => ({ ...prev, gameName: e.target.value }))}
                  placeholder="例: Apex Legends"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    日付
                  </label>
                  <input
                    type="date"
                    value={gamePollForm.gameDate}
                    onChange={(e) => setGamePollForm(prev => ({ ...prev, gameDate: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    時間
                  </label>
                  <input
                    type="time"
                    value={gamePollForm.gameTime}
                    onChange={(e) => setGamePollForm(prev => ({ ...prev, gameTime: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  詳細
                </label>
                <textarea
                  value={gamePollForm.description}
                  onChange={(e) => setGamePollForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="ゲームの詳細情報..."
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大人数 (空欄で制限なし)
                </label>
                <input
                  type="number"
                  value={gamePollForm.maxPlayers}
                  onChange={(e) => setGamePollForm(prev => ({ ...prev, maxPlayers: e.target.value }))}
                  min="1"
                  max="20"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <button
            onClick={createGamePoll}
            disabled={gamePollLoading}
            className="mt-6 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {gamePollLoading ? '作成中...' : '🎮 アンケート作成'}
          </button>

          <ResultMessage result={gamePollResult} />
        </div>

        {/* 将来の機能 */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">🚀 今後の機能</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { emoji: '👥', title: 'メンバー管理', desc: 'オンラインメンバー一覧、ロール管理' },
              { emoji: '📊', title: '統計ダッシュボード', desc: '通話パターン分析、活動統計' },
              { emoji: '🎵', title: '音楽Bot機能', desc: 'YouTube音楽再生、プレイリスト' },
              { emoji: '⚙️', title: '自動化機能', desc: '定期通知、イベント管理' }
            ].map((feature, index) => (
              <div key={index} className="bg-gray-50 p-6 rounded-lg text-center hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{feature.emoji}</div>
                <h3 className="font-semibold text-gray-800 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;