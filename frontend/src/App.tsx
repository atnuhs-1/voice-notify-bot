import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend.koyeb.app'
  : 'http://localhost:3000';

const DiscordControlDashboard = () => {
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // メッセージ送信用
  const [messageForm, setMessageForm] = useState({
    channelId: '',
    content: '',
    embedTitle: '',
    embedDescription: '',
    embedColor: '#5865F2'
  });

  // チャンネル作成用
  const [channelForm, setChannelForm] = useState({
    name: '',
    type: 'text',
    topic: '',
    slowmode: 0
  });

  // メンバー管理用
  const [memberAction, setMemberAction] = useState({
    userId: '',
    action: 'nickname',
    value: ''
  });

  // 結果表示用
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadData();
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
      
      if (guildsData.guilds?.length > 0) {
        setSelectedGuild(guildsData.guilds[0].id);
      }
    } catch (error) {
      console.error('データの取得に失敗:', error);
      showResult('データの取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showResult = (message, type) => {
    setResult({ message, type });
    setTimeout(() => setResult(null), 5000);
  };

  // メッセージ送信
  const sendMessage = async () => {
    if (!messageForm.channelId) {
      showResult('チャンネルを選択してください', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/control/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageForm)
      });

      const result = await response.json();
      if (result.success) {
        showResult('メッセージを送信しました！', 'success');
        setMessageForm(prev => ({ ...prev, content: '', embedDescription: '' }));
      } else {
        showResult(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      showResult(`送信エラー: ${error.message}`, 'error');
    }
  };

  // チャンネル作成
  const createChannel = async () => {
    if (!selectedGuild || !channelForm.name) {
      showResult('サーバーとチャンネル名を選択してください', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/control/create-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId: selectedGuild,
          ...channelForm
        })
      });

      const result = await response.json();
      if (result.success) {
        showResult(`${channelForm.type === 'text' ? 'テキスト' : 'ボイス'}チャンネルを作成しました！`, 'success');
        setChannelForm({ name: '', type: 'text', topic: '', slowmode: 0 });
        loadData();
      } else {
        showResult(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      showResult(`作成エラー: ${error.message}`, 'error');
    }
  };

  // メンバー操作
  const performMemberAction = async () => {
    if (!selectedGuild || !memberAction.userId) {
      showResult('サーバーとユーザーIDを入力してください', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/control/member-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId: selectedGuild,
          ...memberAction
        })
      });

      const result = await response.json();
      if (result.success) {
        showResult('メンバー操作を実行しました！', 'success');
        setMemberAction({ userId: '', action: 'nickname', value: '' });
      } else {
        showResult(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      showResult(`操作エラー: ${error.message}`, 'error');
    }
  };

  // 一括操作
  const performBulkAction = async (action, options = {}) => {
    if (!selectedGuild) {
      showResult('サーバーを選択してください', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/control/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId: selectedGuild,
          action,
          ...options
        })
      });

      const result = await response.json();
      if (result.success) {
        showResult(`${result.message}`, 'success');
      } else {
        showResult(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      showResult(`操作エラー: ${error.message}`, 'error');
    }
  };

  const selectedGuildData = guilds.find(g => g.id === selectedGuild);

  const tabs = [
    { id: 'overview', name: '概要', icon: '📊' },
    { id: 'messages', name: 'メッセージ', icon: '💬' },
    { id: 'channels', name: 'チャンネル', icon: '🏷️' },
    { id: 'members', name: 'メンバー', icon: '👥' },
    { id: 'voice', name: 'ボイス', icon: '🔊' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Discord Bot 読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">🤖</span>
              Discord Bot Control Panel
            </h1>
            {stats && (
              <div className="text-white/80">
                <div className="text-sm">Bot: {stats.bot?.tag}</div>
                <div className="text-sm">ステータス: <span className="text-green-400">オンライン</span></div>
              </div>
            )}
          </div>

          {/* サーバー選択 */}
          <div className="flex items-center gap-4">
            <label className="text-white font-medium">サーバー選択:</label>
            <select 
              value={selectedGuild}
              onChange={(e) => setSelectedGuild(e.target.value)}
              className="bg-white/20 text-white border border-white/30 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-400"
            >
              {guilds.map(guild => (
                <option key={guild.id} value={guild.id} className="bg-gray-800">
                  {guild.name} ({guild.memberCount}人)
                </option>
              ))}
            </select>
            {selectedGuildData && (
              <div className="text-white/80 text-sm">
                テキスト: {selectedGuildData.textChannels?.length || 0}ch / 
                ボイス: {selectedGuildData.voiceChannels?.length || 0}ch
              </div>
            )}
          </div>
        </div>

        {/* 統計カード */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-500/20 backdrop-blur-md rounded-lg p-4 border border-blue-400/30">
              <div className="text-2xl font-bold text-white">{stats.servers?.total || 0}</div>
              <div className="text-blue-200">参加サーバー</div>
            </div>
            <div className="bg-green-500/20 backdrop-blur-md rounded-lg p-4 border border-green-400/30">
              <div className="text-2xl font-bold text-white">{stats.activity?.usersInVoice || 0}</div>
              <div className="text-green-200">ボイス参加中</div>
            </div>
            <div className="bg-purple-500/20 backdrop-blur-md rounded-lg p-4 border border-purple-400/30">
              <div className="text-2xl font-bold text-white">{stats.database?.notifications || 0}</div>
              <div className="text-purple-200">通知設定</div>
            </div>
            <div className="bg-yellow-500/20 backdrop-blur-md rounded-lg p-4 border border-yellow-400/30">
              <div className="text-2xl font-bold text-white">{stats.memory?.used || 0}MB</div>
              <div className="text-yellow-200">メモリ使用量</div>
            </div>
          </div>
        )}

        {/* タブナビゲーション */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 mb-8 border border-white/20">
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

        {/* タブコンテンツ */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          {/* 概要タブ */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">🎮 クイックアクション</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-purple-500/30 to-pink-500/30 p-6 rounded-xl border border-purple-400/30">
                  <h3 className="text-white font-semibold mb-2">🎯 全員集合</h3>
                  <p className="text-white/70 text-sm mb-4">全メンバーを指定ボイスチャンネルに移動</p>
                  <select 
                    className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-3 py-2 mb-3 text-sm"
                    onChange={(e) => {
                      if (e.target.value) {
                        performBulkAction('move-all', { targetChannelId: e.target.value });
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
                
                <div className="bg-gradient-to-r from-blue-500/30 to-cyan-500/30 p-6 rounded-xl border border-blue-400/30">
                  <h3 className="text-white font-semibold mb-2">🔄 チャンネルシャッフル</h3>
                  <p className="text-white/70 text-sm mb-4">メンバーをランダムに振り分け</p>
                  <button 
                    onClick={() => performBulkAction('shuffle')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full"
                  >
                    実行
                  </button>
                </div>
                
                <div className="bg-gradient-to-r from-green-500/30 to-emerald-500/30 p-6 rounded-xl border border-green-400/30">
                  <h3 className="text-white font-semibold mb-2">🔇 全員ミュート</h3>
                  <p className="text-white/70 text-sm mb-4">ボイス参加中の全員をミュート</p>
                  <div className="space-y-2">
                    <button 
                      onClick={() => performBulkAction('mute-all')}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg w-full text-sm"
                    >
                      🔇 全員ミュート
                    </button>
                    <button 
                      onClick={() => performBulkAction('unmute-all')}
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
                          performBulkAction('move-all', { targetChannelId: randomChannel.id });
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
          )}

          {/* メッセージタブ */}
          {activeTab === 'messages' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">💬 メッセージ送信</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    onClick={sendMessage}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 rounded-lg transition-all"
                  >
                    📤 メッセージ送信
                  </button>
                </div>

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
                </div>
              </div>
            </div>
          )}

          {/* チャンネルタブ */}
          {activeTab === 'channels' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">🏷️ チャンネル管理</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    </div>

                    <div>
                      <label className="block text-white font-medium mb-2">チャンネルタイプ</label>
                      <select
                        value={channelForm.type}
                        onChange={(e) => setChannelForm(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-4 py-3"
                      >
                        <option value="text" className="bg-gray-800">💬 テキストチャンネル</option>
                        <option value="voice" className="bg-gray-800">🔊 ボイスチャンネル</option>
                      </select>
                    </div>

                    {channelForm.type === 'text' && (
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
                    )}

                    <button
                      onClick={createChannel}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-3 rounded-lg transition-all"
                    >
                      ➕ チャンネル作成
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-4">現在のチャンネル</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <div>
                      <h4 className="text-white/70 text-sm mb-2">💬 テキストチャンネル</h4>
                      {selectedGuildData?.textChannels?.map(channel => (
                        <div key={channel.id} className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                          <span className="text-white">#{channel.name}</span>
                          <div className="flex gap-2">
                            <button className="text-blue-400 hover:text-blue-300 text-sm">編集</button>
                            <button className="text-red-400 hover:text-red-300 text-sm">削除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div>
                      <h4 className="text-white/70 text-sm mb-2 mt-4">🔊 ボイスチャンネル</h4>
                      {selectedGuildData?.voiceChannels?.map(channel => (
                        <div key={channel.id} className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                          <span className="text-white">🔊 {channel.name}</span>
                          <div className="flex gap-2">
                            <button className="text-blue-400 hover:text-blue-300 text-sm">編集</button>
                            <button className="text-red-400 hover:text-red-300 text-sm">削除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* メンバータブ */}
          {activeTab === 'members' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">👥 メンバー管理</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-white font-semibold mb-4">メンバー操作</h3>
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
                    </div>

                    <div>
                      <label className="block text-white font-medium mb-2">操作タイプ</label>
                      <select
                        value={memberAction.action}
                        onChange={(e) => setMemberAction(prev => ({ ...prev, action: e.target.value }))}
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
                          {memberAction.action === 'nickname' ? '新しいニックネーム' : '移動先チャンネルID'}
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
                      onClick={performMemberAction}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-3 rounded-lg transition-all"
                    >
                      🎯 操作実行
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-4">一括操作</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-white/70 text-sm mb-2">全員移動先</label>
                      <select 
                        className="w-full bg-white/20 text-white border border-white/30 rounded-lg px-3 py-2 mb-2"
                        onChange={(e) => {
                          if (e.target.value) {
                            performBulkAction('move-all', { targetChannelId: e.target.value });
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
                    
                    <button 
                      onClick={() => performBulkAction('shuffle')}
                      className="w-full bg-purple-600/50 hover:bg-purple-600/70 text-white py-3 rounded-lg transition-all"
                    >
                      🔄 チームランダム分け
                    </button>
                    <button 
                      onClick={() => performBulkAction('mute-all')}
                      className="w-full bg-red-600/50 hover:bg-red-600/70 text-white py-3 rounded-lg transition-all"
                    >
                      🔇 全員ミュート
                    </button>
                    <button 
                      onClick={() => performBulkAction('unmute-all')}
                      className="w-full bg-green-600/50 hover:bg-green-600/70 text-white py-3 rounded-lg transition-all"
                    >
                      🔊 全員ミュート解除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ボイスタブ */}
          {activeTab === 'voice' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">🔊 ボイス操作</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-white font-semibold mb-4">音楽Bot機能</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white font-medium mb-2">YouTube URL</label>
                      <input
                        type="text"
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-4 py-3"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button className="bg-green-600/50 hover:bg-green-600/70 text-white py-2 px-4 rounded-lg transition-all">
                        ▶️ 再生
                      </button>
                      <button className="bg-red-600/50 hover:bg-red-600/70 text-white py-2 px-4 rounded-lg transition-all">
                        ⏹️ 停止
                      </button>
                      <button className="bg-blue-600/50 hover:bg-blue-600/70 text-white py-2 px-4 rounded-lg transition-all">
                        ⏸️ 一時停止
                      </button>
                      <button className="bg-purple-600/50 hover:bg-purple-600/70 text-white py-2 px-4 rounded-lg transition-all">
                        ⏭️ スキップ
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-white font-medium mb-2">音量</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        defaultValue="50"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-4">ボイス管理</h3>
                  <div className="space-y-4">
                    <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                      <h4 className="text-white font-medium mb-3">現在のボイス状況</h4>
                      <div className="space-y-2">
                        {selectedGuildData?.voiceChannels?.map(channel => (
                          <div key={channel.id} className="flex items-center justify-between text-sm">
                            <span className="text-white">🔊 {channel.name}</span>
                            <span className="text-white/70">0人参加中</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <button className="w-full bg-orange-600/50 hover:bg-orange-600/70 text-white py-2 px-4 rounded-lg transition-all">
                        🔊 Botをボイスチャンネルに接続
                      </button>
                      <button className="w-full bg-gray-600/50 hover:bg-gray-600/70 text-white py-2 px-4 rounded-lg transition-all">
                        🔌 Botを切断
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 text-center">
                <div className="text-white/50 mb-4">
                  <div className="text-4xl mb-2">🚧</div>
                  <div className="text-lg">音楽Bot機能は開発中です</div>
                  <div className="text-sm">近日実装予定...</div>
                </div>
              </div>
            </div>
          )}
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