import { FastifyPluginAsync } from 'fastify'

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // ルートエンドポイント - Discord Bot情報ページ
  fastify.get('/', async function (request, reply) {
    const discordBot = fastify.discord
    
    let botInfo = {
      isReady: false,
      tag: 'Bot not initialized',
      id: 'N/A',
      guilds: 0,
      uptime: 'N/A',
      status: 'Offline',
      avatar: null as string | null
    }

    if (discordBot && discordBot.isReady()) {
      const uptimeMs = discordBot.uptime || 0
      const uptimeSeconds = Math.floor(uptimeMs / 1000)
      const hours = Math.floor(uptimeSeconds / 3600)
      const minutes = Math.floor((uptimeSeconds % 3600) / 60)
      const seconds = uptimeSeconds % 60

      botInfo = {
        isReady: true,
        tag: discordBot.user?.tag || 'Unknown',
        id: discordBot.user?.id || 'Unknown',
        guilds: discordBot.guilds.cache.size,
        uptime: `${hours}時間 ${minutes}分 ${seconds}秒`,
        status: 'Online',
        avatar: discordBot.user?.avatarURL({ size: 128 })
      }
    }

    // データベースからの統計情報も取得
    let dbStats = {
      notifications: 0,
      activeSessions: 0,
      totalSessions: 0
    }

    // サーバー一覧とセッション履歴も取得
    let guildsData: any[] = []
    let recentSessions: any[] = []

    try {
      if (fastify.db) {
        // 統計情報を取得
        const notificationsResult = await fastify.db.execute('SELECT COUNT(*) as count FROM notifications')
        dbStats.notifications = notificationsResult.rows[0]?.count as number || 0

        const activeSessionsResult = await fastify.db.execute('SELECT COUNT(*) as count FROM voice_sessions WHERE isActive = true')
        dbStats.activeSessions = activeSessionsResult.rows[0]?.count as number || 0

        const totalSessionsResult = await fastify.db.execute('SELECT COUNT(*) as count FROM voice_sessions')
        dbStats.totalSessions = totalSessionsResult.rows[0]?.count as number || 0

        // 最近のセッション履歴を取得（最新10件）
        const sessionsResult = await fastify.db.execute({
          sql: 'SELECT * FROM voice_sessions ORDER BY startTime DESC LIMIT 10',
          args: []
        })

        recentSessions = sessionsResult.rows.map(row => ({
          id: row.id,
          guildId: row.guildId as string,
          channelId: row.channelId as string,
          startTime: row.startTime as string,
          endTime: row.endTime as string | null,
          isActive: Boolean(row.isActive),
          createdAt: row.createdAt as string
        }))
      }
    } catch (error) {
      fastify.log.error('Error fetching database stats:', error)
    }

    // Discordサーバー一覧を取得
    if (discordBot && discordBot.isReady()) {
      guildsData = discordBot.guilds.cache.map(guild => {
        const voiceChannels = guild.channels.cache.filter(ch => ch.type === 2)
        const activeVoiceChannels = guild.voiceStates.cache
          .filter(vs => vs.channelId)
          .map(vs => vs.channelId)
        
        return {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
          voiceChannels: voiceChannels.size,
          activeVoiceChannels: new Set(activeVoiceChannels).size,
          icon: guild.iconURL({ size: 64 }),
          joinedAt: guild.joinedAt?.toISOString()
        }
      })
    }

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Bot - ボイスチャンネル通知システム</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            text-align: center;
            margin-bottom: 3rem;
        }

        .header h1 {
            color: white;
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .header p {
            color: rgba(255,255,255,0.9);
            font-size: 1.2rem;
        }

        .bot-card {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 2rem;
        }

        .bot-header {
            display: flex;
            align-items: center;
            margin-bottom: 2rem;
        }

        .bot-avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin-right: 1rem;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .bot-avatar.placeholder {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: white;
        }

        .bot-details h2 {
            color: #333;
            margin-bottom: 0.5rem;
        }

        .status-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-weight: bold;
            font-size: 0.9rem;
        }

        .status-online {
            background-color: #5cb85c;
            color: white;
            animation: pulse 2s infinite;
        }

        .status-offline {
            background-color: #d9534f;
            color: white;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-top: 2rem;
        }

        .info-item {
            text-align: center;
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 4px solid #667eea;
            transition: transform 0.2s ease;
        }

        .info-item:hover {
            transform: translateY(-2px);
        }

        .info-item h3 {
            color: #667eea;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .info-item p {
            font-size: 1.4rem;
            font-weight: bold;
            color: #333;
        }

        .features {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 2rem;
        }

        .features h2 {
            color: #667eea;
            margin-bottom: 1.5rem;
            text-align: center;
        }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }

        .feature-category h3 {
            color: #333;
            margin-bottom: 1rem;
            font-size: 1.1rem;
        }

        .feature-list {
            list-style: none;
            padding: 0;
        }

        .feature-list li {
            padding: 0.5rem 0;
            display: flex;
            align-items: center;
            color: #555;
        }

        .feature-list li:before {
            margin-right: 0.75rem;
            font-size: 1.1rem;
        }

        .feature-list.notifications li:before { content: "🔔"; }
        .feature-list.commands li:before { content: "⚡"; }
        .feature-list.tracking li:before { content: "📊"; }

        .data-sections {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .data-section {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .data-section h2 {
            color: #667eea;
            margin-bottom: 1.5rem;
            text-align: center;
            font-size: 1.3rem;
        }

        .server-item, .session-item {
            display: flex;
            align-items: center;
            padding: 1rem;
            margin-bottom: 0.5rem;
            background: #f8f9fa;
            border-radius: 10px;
            transition: transform 0.2s ease;
        }

        .server-item:hover, .session-item:hover {
            transform: translateY(-2px);
            background: #e9ecef;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .server-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            margin-right: 1rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            flex-shrink: 0;
        }

        .server-info {
            flex: 1;
        }

        .server-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 0.2rem;
        }

        .server-stats {
            font-size: 0.85rem;
            color: #666;
        }

        .session-info {
            flex: 1;
        }

        .session-guild {
            font-weight: bold;
            color: #333;
            margin-bottom: 0.2rem;
            font-size: 0.9rem;
        }

        .session-details {
            font-size: 0.8rem;
            color: #666;
        }

        .session-status {
            padding: 0.2rem 0.6rem;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: bold;
            margin-left: 0.5rem;
        }

        .session-active {
            background: #d4edda;
            color: #155724;
        }

        .session-completed {
            background: #f8d7da;
            color: #721c24;
        }

        .no-data {
            text-align: center;
            color: #666;
            font-style: italic;
            padding: 2rem;
        }

        .scroll-container {
            max-height: 400px;
            overflow-y: auto;
        }

        .scroll-container::-webkit-scrollbar {
            width: 6px;
        }

        .scroll-container::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }

        .scroll-container::-webkit-scrollbar-thumb {
            background: #667eea;
            border-radius: 3px;
        }

        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: bold;
            transition: all 0.3s ease;
            margin: 0 0.5rem;
            text-decoration: none;
            display: inline-block;
        }

        .btn:hover {
            background: #5a67d8;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }

        .btn.secondary {
            background: #6c757d;
        }

        .btn.secondary:hover {
            background: #5a6268;
        }

        .pulse {
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            .container {
                padding: 1rem;
            }
            .data-sections {
                grid-template-columns: 1fr;
            }
            .info-grid {
                grid-template-columns: 1fr;
            }
            .bot-header {
                flex-direction: column;
                text-align: center;
            }
            .bot-avatar {
                margin-right: 0;
                margin-bottom: 1rem;
            }
        }
    </style>
</head>
<body>

    <div class="container">
        <header class="header">
            <h1>🤖 Discord Bot Dashboard</h1>
            <p>ボイスチャンネル通知システム</p>
        </header>

        <div class="bot-card">
            <div class="bot-header">
                ${botInfo.avatar 
                  ? `<img src="${botInfo.avatar}" alt="Bot Avatar" class="bot-avatar">`
                  : `<div class="bot-avatar placeholder">🤖</div>`
                }
                <div class="bot-details">
                    <h2>${botInfo.tag}</h2>
                    <div class="status-badge ${botInfo.isReady ? 'status-online' : 'status-offline'}">
                        ${botInfo.status}
                    </div>
                </div>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <h3>Bot ID</h3>
                    <p>${botInfo.id}</p>
                </div>
                <div class="info-item">
                    <h3>参加サーバー数</h3>
                    <p>${botInfo.guilds}</p>
                </div>
                <div class="info-item">
                    <h3>稼働時間</h3>
                    <p>${botInfo.uptime}</p>
                </div>
                <div class="info-item">
                    <h3>通知設定数</h3>
                    <p>${dbStats.notifications}</p>
                </div>
                <div class="info-item">
                    <h3>アクティブ通話</h3>
                    <p>${dbStats.activeSessions}</p>
                </div>
                <div class="info-item">
                    <h3>総通話回数</h3>
                    <p>${dbStats.totalSessions}</p>
                </div>
            </div>
        </div>

        <div class="data-sections">
            <div class="data-section">
                <h2>🏠 参加サーバー一覧</h2>
                <div class="scroll-container">
                    ${guildsData.length > 0 ? guildsData.map(guild => `
                        <div class="server-item">
                            ${guild.icon 
                                ? `<img src="${guild.icon}" alt="${guild.name}" class="server-icon">`
                                : `<div class="server-icon">${guild.name.charAt(0).toUpperCase()}</div>`
                            }
                            <div class="server-info">
                                <div class="server-name">${guild.name}</div>
                                <div class="server-stats">
                                    👥 ${guild.memberCount}人 | 🎤 ${guild.voiceChannels}ch | 🔊 ${guild.activeVoiceChannels}active
                                </div>
                            </div>
                        </div>
                    `).join('') : '<div class="no-data">参加しているサーバーがありません</div>'}
                </div>
            </div>

            <div class="data-section">
                <h2>📊 最近のセッション履歴</h2>
                <div class="scroll-container">
                    ${recentSessions.length > 0 ? recentSessions.map(session => {
                        const guild = guildsData.find(g => g.id === session.guildId)
                        const guildName = guild ? guild.name : `Unknown Server`
                        
                        // 時間計算
                        let duration = ''
                        if (session.endTime && session.startTime) {
                            const start = new Date(session.startTime)
                            const end = new Date(session.endTime)
                            const diffMs = end.getTime() - start.getTime()
                            const seconds = Math.floor(diffMs / 1000)
                            const minutes = Math.floor(seconds / 60)
                            const hours = Math.floor(minutes / 60)
                            
                            if (hours > 0) {
                                duration = `${hours}時間${minutes % 60}分`
                            } else if (minutes > 0) {
                                duration = `${minutes}分${seconds % 60}秒`
                            } else {
                                duration = `${seconds}秒`
                            }
                        }

                        // 開始時刻フォーマット
                        const startTime = new Date(session.startTime).toLocaleString('ja-JP', {
                            timeZone: 'Asia/Tokyo',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        })

                        return `
                        <div class="session-item">
                            <div class="session-info">
                                <div class="session-guild">${guildName}</div>
                                <div class="session-details">
                                    📅 ${startTime} ${duration ? `| ⏱️ ${duration}` : ''}
                                </div>
                            </div>
                            <span class="session-status ${session.isActive ? 'session-active' : 'session-completed'}">
                                ${session.isActive ? '進行中' : '終了'}
                            </span>
                        </div>
                        `
                    }).join('') : '<div class="no-data">セッション履歴がありません</div>'}
                </div>
            </div>
        </div>

        <div class="features">
            <h2>📋 システム機能</h2>
            <div class="feature-grid">
                <div class="feature-category">
                    <h3>🔔 通知機能</h3>
                    <ul class="feature-list notifications">
                        <li>リアルタイムボイスチャンネル監視</li>
                        <li>通話開始・終了の自動通知</li>
                        <li>メンバー参加・退室の通知</li>
                  
                    </ul>
                </div>
                
                <div class="feature-category">
                    <h3>⚡ スラッシュコマンド</h3>
                    <ul class="feature-list commands">
                        <li>/notify configure - 通知設定</li>
                        <li>/notify status - 設定状況確認</li>
                        <li>/notify list - 全設定一覧</li>
                        <li>/notify delete - 設定削除</li>
                    </ul>
                </div>
                
                <div class="feature-category">
                    <h3>📊 データ管理</h3>
                    <ul class="feature-list tracking">
                        <li>通話時間の自動計算・記録</li>
                        <li>セッション履歴の保存</li>
                        <li>最大20チャンネル同時監視</li>
                        <li>Turso Database統合</li>
                    </ul>
                </div>
            </div>

        </div>
    </div>

    <script>
        // 30秒ごとに自動更新
        let refreshTimer = setInterval(() => {
            location.reload();
        }, 30000);

        // ページがアクティブでない時は更新を停止
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(refreshTimer);
            } else {
                refreshTimer = setInterval(() => {
                    location.reload();
                }, 30000);
            }
        });
        
        // ページ読み込み時のアニメーション
        document.addEventListener('DOMContentLoaded', function() {
            const cards = document.querySelectorAll('.bot-card, .data-section, .features');
            cards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    card.style.transition = 'all 0.6s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 200);
            });
        });

        // エラー時の処理
        window.addEventListener('error', (e) => {
            console.error('Page error:', e);
        });
    </script>
</body>
</html>
    `

    return reply.type('text/html').send(html)
  })

  // Bot情報をJSON形式で取得するAPI
  fastify.get('/api/bot-info', async function (request, reply) {
    const discordBot = fastify.discord
    
    if (!discordBot || !discordBot.isReady()) {
      return reply.code(503).send({
        error: 'Discord bot is not ready',
        status: 'offline'
      })
    }

    try {
      const uptimeMs = discordBot.uptime || 0
      const uptimeSeconds = Math.floor(uptimeMs / 1000)
      const hours = Math.floor(uptimeSeconds / 3600)
      const minutes = Math.floor((uptimeSeconds % 3600) / 60)
      const seconds = uptimeSeconds % 60

      // データベース統計も含める
      let dbStats = {}
      if (fastify.db) {
        try {
          // 全通知設定数を取得
          const notificationsResult = await fastify.db.execute('SELECT COUNT(*) as count FROM notifications')
          const notifications = notificationsResult.rows[0]?.count as number || 0

          // アクティブセッション数を取得
          const activeSessionsResult = await fastify.db.execute('SELECT COUNT(*) as count FROM voice_sessions WHERE isActive = true')
          const activeSessions = activeSessionsResult.rows[0]?.count as number || 0

          // 総セッション数を取得
          const totalSessionsResult = await fastify.db.execute('SELECT COUNT(*) as count FROM voice_sessions')
          const totalSessions = totalSessionsResult.rows[0]?.count as number || 0
          
          dbStats = {
            notifications,
            activeSessions,
            totalSessions
          }
        } catch (dbError) {
          fastify.log.error('Database stats error:', dbError)
          dbStats = { error: 'Database not available' }
        }
      }

      return reply.send({
        bot: {
          tag: discordBot.user?.tag,
          id: discordBot.user?.id,
          avatar: discordBot.user?.avatarURL({ size: 128 }),
          guilds: discordBot.guilds.cache.size,
          uptime: {
            raw: uptimeMs,
            formatted: `${hours}時間 ${minutes}分 ${seconds}秒`,
            hours,
            minutes,
            seconds
          }
        },
        database: dbStats,
        status: 'online',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      fastify.log.error('Error getting bot info:', error)
      return reply.code(500).send({
        error: 'Failed to get bot information',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}

export default root