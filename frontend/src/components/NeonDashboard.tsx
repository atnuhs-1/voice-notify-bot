import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useDiscordData } from '../hooks/useDiscordData'
import LoadingScreen from './LoadingScreen'
import { 
  fetchNotifications, 
  fetchSessions, 
  fetchLiveStatus,
} from '../utils/api'
import './NeonDashboard.css' // CSSファイルをインポート

// 型定義
interface VoiceSession {
  id: number;
  guildId: string;
  channelId: string;
  startTime: string;
  endTime: string | null;
  isActive: boolean;
  createdAt: string;
}

interface OnlineMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  status: string;
  activity: string | null;
}

interface NotificationSetting {
  id: number;
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  createdAt: string;
}

interface LiveStatus {
  guild: {
    id: string;
    name: string;
    memberCount: number;
    onlineCount: number;
  };
  onlineMembers: OnlineMember[];
  voiceChannels: Array<{
    id: string;
    name: string;
    userLimit: number;
    bitrate: number;
    members: OnlineMember[];
    memberCount: number;
    isActive: boolean;
  }>;
  stats: {
    totalVoiceChannels: number;
    activeVoiceChannels: number;
    totalUsersInVoice: number;
  };
}

const RealDataNeonDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null)
  const [recentSessions, setRecentSessions] = useState<VoiceSession[]>([])
  const [notifications, setNotifications] = useState<NotificationSetting[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  
  const { user } = useAuth()
  
  const {
    guilds,
    selectedGuild,
    setSelectedGuild,
    stats,
    loading,
    result
  } = useDiscordData()

  const selectedGuildData = guilds.find(g => g.id === selectedGuild)

  // データ取得関数
  const fetchAllData = useCallback(async () => {
    if (!selectedGuild || !selectedGuildData) return

    setDataLoading(true)
    try {
      console.log(`🔄 データ取得開始: ${selectedGuildData.name}`)

      // 並列でデータを取得
      const [
        notificationsData,
        sessionsData,
        liveStatusData,

      ] = await Promise.allSettled([
        fetchNotifications(selectedGuild),
        fetchSessions({ guildId: selectedGuild, limit: 20 }),
        fetchLiveStatus(selectedGuild),

      ])

      // 通知設定
      if (notificationsData.status === 'fulfilled') {
        setNotifications(notificationsData.value || [])
        console.log(`✅ 通知設定: ${notificationsData.value?.length || 0}件`)
      } else {
        console.error('❌ 通知設定取得エラー:', notificationsData.reason)
        setNotifications([])
      }

      // セッション履歴
      if (sessionsData.status === 'fulfilled') {
        setRecentSessions(sessionsData.value?.sessions || [])
        console.log(`✅ セッション履歴: ${sessionsData.value?.sessions?.length || 0}件`)
      } else {
        console.error('❌ セッション履歴取得エラー:', sessionsData.reason)
        setRecentSessions([])
      }

      // ライブステータス
      if (liveStatusData.status === 'fulfilled') {
        setLiveStatus(liveStatusData.value)
        console.log(`✅ ライブステータス: オンライン${liveStatusData.value?.onlineMembers?.length || 0}人`)
      } else {
        console.error('❌ ライブステータス取得エラー:', liveStatusData.reason)
        setLiveStatus(null)
      }

      setLastUpdate(new Date())
      console.log('✅ 全データ取得完了')

    } catch (error) {
      console.error('❌ データ取得エラー:', error)
    } finally {
      setDataLoading(false)
    }
  }, [selectedGuild, selectedGuildData])

  // 初回データ取得
  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // 自動リフレッシュ（30秒間隔）
  useEffect(() => {
    const interval = setInterval(fetchAllData, 30000)
    return () => clearInterval(interval)
  }, [fetchAllData])

  // 時間計算関数
  const calculateDuration = (startTime: string, endTime: string | null): string => {
    if (!endTime) return '進行中'
    
    const start = new Date(startTime)
    const end = new Date(endTime)
    const diffMs = end.getTime() - start.getTime()
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h${minutes}m`
    }
    return `${minutes}m`
  }

  // 日時フォーマット関数
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // チャンネル名取得関数
  const getChannelName = (channelId: string): string => {
    // まず実際のデータから検索
    const voiceChannel = selectedGuildData?.voiceChannels?.find(ch => ch.id === channelId)
    if (voiceChannel) return voiceChannel.name
    
    const textChannel = selectedGuildData?.textChannels?.find(ch => ch.id === channelId)
    if (textChannel) return textChannel.name
    
    // ライブステータスからも検索
    const liveChannel = liveStatus?.voiceChannels?.find(ch => ch.id === channelId)
    if (liveChannel) return liveChannel.name
    
    return `Unknown (${channelId.slice(-4)})`
  }

  if (loading) {
    return (
      <LoadingScreen
        message="システム初期化中..."
        submessage="ネオンモード起動中..."
      />
    )
  }

  // 管理権限のあるサーバーがない場合
  if (guilds.length === 0) {
    return (
      <div style={{
        fontFamily: '"Courier New", Monaco, "Lucida Console", monospace',
        background: '#000',
        color: '#ff0000',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: '#111',
          border: '2px solid #ff0000',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '400px',
          boxShadow: '0 0 30px #ff0000, inset 0 0 20px rgba(255,0,0,0.1)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💀</div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textShadow: '0 0 15px #ff0000'
          }}>
            ACCESS_DENIED
          </h2>
          <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            &gt; NO_ADMINISTRATIVE_PRIVILEGES_FOUND
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#ff0000',
              color: '#000',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              fontWeight: 'bold',
              boxShadow: '0 0 20px #ff0000',
              transition: 'all 0.3s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 0 30px #ff0000, 0 0 60px #ff0000'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 0 20px #ff0000'
            }}
          >
            [RETRY_CONNECTION]
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: '[OVERVIEW]' },
    { id: 'messages', label: '[MESSAGE]' },
    { id: 'channels', label: '[CHANNEL]' },
    { id: 'members', label: '[MEMBER]' },
    { id: 'voice', label: '[VOICE]' }
  ]

  const statCards = [
    { 
      label: '[TEXT_CH]', 
      value: selectedGuildData?.textChannels?.length || 0, 
      icon: '📄', 
      color: '#00ffff',
      desc: 'CHANNELS_ACTIVE'
    },
    { 
      label: '[VOICE_CH]', 
      value: selectedGuildData?.voiceChannelsCount || liveStatus?.stats.totalVoiceChannels || 0, 
      icon: '🔊', 
      color: '#00ff00',
      desc: 'VOICE_LINES'
    },
    { 
      label: '[USERS]', 
      value: selectedGuildData?.memberCount || liveStatus?.guild.memberCount || 0, 
      icon: '👥', 
      color: '#ff8800',
      desc: 'TOTAL_MEMBERS'
    },
    { 
      label: '[ONLINE]', 
      value: liveStatus?.guild.onlineCount || liveStatus?.onlineMembers?.length || 1, 
      icon: '🟢', 
      color: '#ff00ff',
      desc: 'ACTIVE_NOW'
    }
  ]

  return (
    <div style={{
      fontFamily: '"Courier New", Monaco, "Lucida Console", monospace',
      background: '#000',
      color: '#00ff00',
      minHeight: '100vh',
      overflowX: 'hidden',
      position: 'relative'
    }}>
      {/* スキャンライン */}
      <div className="scan-line"></div>

      {/* ヘッダー */}
      <header style={{
        background: '#0a0a0a',
        borderBottom: '3px solid #00ffff',
        padding: '1rem 0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 5px 20px rgba(0, 255, 255, 0.3)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* ブランド */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              background: 'linear-gradient(135deg, #00ffff, #ff00ff)',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              color: '#000',
              fontWeight: 'bold'
            }} className="brand-glow">
              🤖
            </div>
            <div>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#00ffff',
                textTransform: 'uppercase',
                letterSpacing: '3px'
              }} className="neon-text glitch-text">
                DISCORD.CONTROL
              </h1>
              <div style={{
                fontSize: '0.875rem',
                color: '#999',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                &gt; {selectedGuildData?.name || '助けて'}_server.exe
                {dataLoading && (
                  <span className="data-indicator" style={{ color: '#00ffff' }}>
                    [LOADING...]
                  </span>
                )}
                {lastUpdate && (
                  <span style={{ color: '#666', fontSize: '0.75rem' }}>
                    [LAST_UPDATE: {lastUpdate.toLocaleTimeString()}]
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* コントロール */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <select
              value={selectedGuild || ''}
              onChange={(e) => setSelectedGuild(e.target.value)}
              style={{
                background: '#111',
                border: '2px solid #00ffff',
                color: '#00ffff',
                fontSize: '0.875rem',
                borderRadius: '4px',
                padding: '0.5rem 0.75rem',
                fontFamily: 'monospace',
                outline: 'none',
                boxShadow: '0 0 10px rgba(0, 255, 255, 0.5)'
              }}
              onFocus={e => {
                e.target.style.boxShadow = '0 0 20px #00ffff'
              }}
              onBlur={e => {
                e.target.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)'
              }}
            >
              {guilds.map(guild => (
                <option key={guild.id} value={guild.id} style={{ background: '#111' }}>
                  [{guild.name.slice(0, 2).toUpperCase()}] {guild.name} ({guild.memberCount} users)
                </option>
              ))}
            </select>
            
            {/* リフレッシュボタン */}
            <button
              onClick={fetchAllData}
              disabled={dataLoading}
              style={{
                background: dataLoading ? '#333' : '#111',
                border: '2px solid #00ff00',
                color: dataLoading ? '#666' : '#00ff00',
                padding: '0.5rem',
                borderRadius: '4px',
                cursor: dataLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                transition: 'all 0.3s'
              }}
              onMouseEnter={e => {
                if (!dataLoading) {
                  e.currentTarget.style.boxShadow = '0 0 15px #00ff00'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {dataLoading ? '[SYNC...]' : '[REFRESH]'}
            </button>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: '#111',
              border: '2px solid #333',
              borderRadius: '0.5rem',
              padding: '0.5rem',
              boxShadow: '0 0 10px rgba(0, 255, 255, 0.2)'
            }}>
              <div style={{
                width: '0.5rem',
                height: '0.5rem',
                background: '#00ff00',
                borderRadius: '50%'
              }} className="pulse-dot" />
              {user?.avatar && (
                <img
                 src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=64`}
                  alt={user.tag}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    border: '2px solid #00ffff',
                    boxShadow: '0 0 10px #00ffff'
                  }}
                />
              )}
              <span style={{
                fontSize: '0.875rem',
                color: '#00ffff',
                fontFamily: 'monospace'
              }}>
                {user?.username || user?.tag || 'admin'}@system
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* タブナビゲーション */}
        <nav style={{ marginBottom: '2rem' }}>
          <div style={{
            gap: '0.25rem',
            background: '#111',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            border: '2px solid #333',
            display: 'inline-flex',
            boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  background: activeTab === tab.id ? '#00ffff' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  color: activeTab === tab.id ? '#000' : '#666',
                  textTransform: 'uppercase',
                  boxShadow: activeTab === tab.id ? '0 0 30px #00ffff' : 'none'
                }}
                onMouseEnter={e => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.color = '#00ffff'
                    e.currentTarget.style.background = '#222'
                    e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.5)'
                  }
                }}
                onMouseLeave={e => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.color = '#666'
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* 統計カード */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {statCards.map((stat, index) => (
            <div
              key={index}
              style={{
                background: '#111',
                border: `2px solid ${stat.color}`,
                borderRadius: '0.5rem',
                padding: '1.5rem',
                transition: 'all 0.3s',
                position: 'relative',
                overflow: 'hidden',
                color: stat.color,
                cursor: 'pointer'
              }}
              className={`neon-glow-${stat.color === '#00ffff' ? 'cyan' : stat.color === '#00ff00' ? 'green' : stat.color === '#ff8800' ? 'orange' : 'purple'}`}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-8px)'
                e.currentTarget.style.boxShadow = `
                  0 0 10px ${stat.color},
                  0 0 20px ${stat.color},
                  0 0 40px ${stat.color},
                  0 0 80px ${stat.color}
                `
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div className="scan-effect" style={{ background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)` }} />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  fontFamily: 'monospace'
                }}>
                  {stat.label}
                </span>
                <span style={{ fontSize: '2rem' }}>{stat.icon}</span>
              </div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                marginBottom: '0.5rem',
                textShadow: `0 0 20px ${stat.color}`
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#666',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {stat.desc}
              </div>
            </div>
          ))}
        </div>

        {/* コンテンツグリッド */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth > 1024 ? '2fr 1fr' : '1fr',
          gap: '2rem'
        }}>
          {/* 通話ログ */}
          <div style={{
            background: '#111',
            border: '2px solid #00ffff',
            borderRadius: '0.5rem',
            overflow: 'hidden'
          }} className="neon-glow-cyan">
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '2px solid #333',
              background: '#0a0a0a'
            }}>
              <h3 style={{
                fontSize: '1.25rem',
                color: '#00ffff',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }} className="neon-text">
                &gt; CALL_HISTORY.LOG [{recentSessions.length} ENTRIES]
              </h3>
              
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{
                maxHeight: '40rem',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.875rem'
              }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {recentSessions.length > 0 ? recentSessions.map((session) => (
                    <div
                      key={session.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.75rem',
                        background: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        transition: 'all 0.3s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#00ffff'
                        e.currentTarget.style.background = '#222'
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.3)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#333'
                        e.currentTarget.style.background = '#0a0a0a'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <span style={{ 
                        color: session.isActive ? '#00ff00' : '#666', 
                        minWidth: '100px', 
                        fontSize: '0.75rem', 
                        textShadow: session.isActive ? '0 0 10px #00ff00' : 'none' 
                      }}>
                        {session.isActive ? '[ACTIVE]' : '[TERMINATED]'}
                      </span>
                      <span style={{ color: '#fff', minWidth: '150px', flex: 1 }}>
                        {getChannelName(session.channelId)}
                      </span>
                      <span style={{ color: '#666', minWidth: '100px', fontSize: '0.75rem' }}>
                        {formatDate(session.startTime)}
                      </span>
                      <span style={{ color: '#00ffff', fontWeight: 'bold', textShadow: '0 0 10px #00ffff' }}>
                        {calculateDuration(session.startTime, session.endTime)}
                      </span>
                    </div>
                  )) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '2rem',
                      color: '#666',
                      fontFamily: 'monospace',
                      textTransform: 'uppercase'
                    }}>
                      {dataLoading ? 'LOADING_SESSION_DATA...' : 'NO_SESSION_DATA_FOUND'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* サイドバー */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* アクティブ通話 */}
            <div style={{
              background: '#111',
              border: '2px solid #ff0000',
              borderRadius: '0.5rem',
              overflow: 'hidden'
            }} className="neon-glow-red">
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: '2px solid #333',
                background: '#0a0a0a'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  color: '#ff0000',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '2px'
                }} className="neon-text">
                  &gt; ACTIVE_SESSIONS [{liveStatus?.stats.activeVoiceChannels || 0}]
                </h3>
              </div>
              <div style={{ padding: '1.5rem' }}>
                {liveStatus?.voiceChannels && liveStatus.voiceChannels.some(ch => ch.isActive) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {liveStatus.voiceChannels.filter(ch => ch.isActive).map((channel) => (
                      <div
                        key={channel.id}
                        style={{
                          padding: '0.75rem',
                          background: 'rgba(255, 0, 0, 0.1)',
                          border: '1px solid #ff0000',
                          borderRadius: '4px',
                          fontFamily: 'monospace'
                        }}
                      >
                        <div style={{ color: '#ff0000', fontSize: '0.875rem', fontWeight: 'bold' }}>
                          {channel.name}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.75rem' }}>
                          USERS: {channel.memberCount} | LIMIT: {channel.userLimit || '∞'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💀</div>
                    <div style={{
                      color: '#666',
                      fontFamily: 'monospace',
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      letterSpacing: '2px'
                    }}>
                      {dataLoading ? 'SCANNING_CHANNELS...' : 'NO_ACTIVE_CONNECTIONS'}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#ff0000',
                      marginTop: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      textShadow: '0 0 15px #ff0000'
                    }} className="pulse-dot">
                      [STATUS: IDLE]
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 通知ノード */}
            <div style={{
              background: '#111',
              border: '2px solid #00ff00',
              borderRadius: '0.5rem',
              overflow: 'hidden'
            }} className="neon-glow-green">
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: '2px solid #333',
                background: '#0a0a0a'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  color: '#00ff00',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '2px'
                }} className="neon-text">
                  &gt; NOTIFICATION_NODES [{notifications.length}]
                </h3>
                
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {notifications.length > 0 ? notifications.map((notification, index) => (
                    <div
                      key={notification.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        background: 'rgba(0, 255, 0, 0.1)',
                        border: '1px solid #00ff00',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(0, 255, 0, 0.2)'
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.5)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(0, 255, 0, 0.1)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div style={{
                        width: '0.5rem',
                        height: '0.5rem',
                        background: '#00ff00',
                        borderRadius: '50%',
                        boxShadow: '0 0 10px #00ff00'
                      }} className="pulse-dot" />
                      <div style={{ flex: 1, fontFamily: 'monospace' }}>
                        <div style={{
                          color: '#00ff00',
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          textShadow: '0 0 5px #00ff00'
                        }}>
                          NODE_{(index + 1).toString().padStart(2, '0')}
                        </div>
                        <div style={{ color: '#fff', fontSize: '0.75rem' }}>
                          {getChannelName(notification.voiceChannelId)}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.65rem' }}>
                          → {getChannelName(notification.textChannelId)}
                        </div>
                      </div>
                      <span style={{
                        color: '#00ff00',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        textShadow: '0 0 5px #00ff00'
                      }}>
                        [ACTIVE]
                      </span>
                    </div>
                  )) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '2rem 1rem',
                      color: '#666',
                      fontFamily: 'monospace',
                      textTransform: 'uppercase',
                      fontSize: '0.75rem'
                    }}>
                      {dataLoading ? 'LOADING_NODES...' : 'NO_NOTIFICATION_NODES'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* オンラインメンバー */}
            {liveStatus && liveStatus.onlineMembers.length > 0 && (
              <div style={{
                background: '#111',
                border: '2px solid #ff00ff',
                borderRadius: '0.5rem',
                overflow: 'hidden'
              }} className="neon-glow-purple">
                <div style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '2px solid #333',
                  background: '#0a0a0a'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    color: '#ff00ff',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }} className="neon-text">
                    &gt; ONLINE_MEMBERS [{liveStatus.onlineMembers.length}]
                  </h3>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {liveStatus.onlineMembers.slice(0, 5).map((member) => (
                      <div
                        key={member.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem',
                          background: 'rgba(255, 0, 255, 0.1)',
                          border: '1px solid #ff00ff',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(255, 0, 255, 0.2)'
                          e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 0, 255, 0.5)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255, 0, 255, 0.1)'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        <img
                          src={member.avatar}
                          alt={member.displayName}
                          style={{
                            width: '2rem',
                            height: '2rem',
                            borderRadius: '50%',
                            border: '1px solid #ff00ff',
                            boxShadow: '0 0 5px #ff00ff'
                          }}
                        />
                        <div style={{ flex: 1, fontFamily: 'monospace' }}>
                          <div style={{
                            color: '#ff00ff',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            textShadow: '0 0 5px #ff00ff'
                          }}>
                            {member.displayName}
                          </div>
                          <div style={{ color: '#666', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                            {member.status}
                            {member.activity && ` | ${member.activity}`}
                          </div>
                        </div>
                        <div style={{
                          width: '0.5rem',
                          height: '0.5rem',
                          background: member.status === 'online' ? '#00ff00' : 
                                     member.status === 'idle' ? '#ffff00' :
                                     member.status === 'dnd' ? '#ff0000' : '#666',
                          borderRadius: '50%',
                          boxShadow: member.status === 'online' ? '0 0 5px #00ff00' : 'none'
                        }} />
                      </div>
                    ))}
                    {liveStatus.onlineMembers.length > 5 && (
                      <div style={{
                        textAlign: 'center',
                        padding: '0.75rem',
                        color: '#666',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        textTransform: 'uppercase'
                      }}>
                        +{liveStatus.onlineMembers.length - 5} MORE_USERS
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* システムステータス */}
        <div style={{
          marginTop: '2rem',
          background: '#111',
          border: '2px solid #666',
          borderRadius: '0.5rem',
          padding: '1rem',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem'
          }}>
            <div>
              <span style={{ color: '#666' }}>GUILD_ID:</span>{' '}
              <span style={{ color: '#00ffff', fontWeight: 'bold' }}>{selectedGuildData?.id.slice(-8)}</span>
            </div>
            <div>
              <span style={{ color: '#666' }}>TOTAL_CHANNELS:</span>{' '}
              <span style={{ color: '#00ff00', fontWeight: 'bold' }}>
                {(selectedGuildData?.textChannels?.length || 0) + (selectedGuildData?.voiceChannelsCount || 0)}
              </span>
            </div>
            <div>
              <span style={{ color: '#666' }}>NOTIFICATIONS:</span>{' '}
              <span style={{ color: '#ff8800', fontWeight: 'bold' }}>{notifications.length}</span>
            </div>
            <div>
              <span style={{ color: '#666' }}>SESSION_HISTORY:</span>{' '}
              <span style={{ color: '#ff00ff', fontWeight: 'bold' }}>{recentSessions.length}</span>
            </div>
            <div>
              <span style={{ color: '#666' }}>DATA_STATUS:</span>{' '}
              <span style={{ 
                color: dataLoading ? '#ffff00' : '#00ff00', 
                fontWeight: 'bold',
                textShadow: dataLoading ? '0 0 5px #ffff00' : '0 0 5px #00ff00'
              }}>
                {dataLoading ? 'SYNCING' : 'ONLINE'}
              </span>
            </div>
            <div>
              <span style={{ color: '#666' }}>AUTO_REFRESH:</span>{' '}
              <span style={{ color: '#00ffff', fontWeight: 'bold' }}>30s</span>
            </div>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer style={{ marginTop: '4rem', padding: '2rem 0', borderTop: '2px solid #333' }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 1.5rem',
          textAlign: 'center'
        }}>
          <p style={{
            color: '#666',
            fontFamily: 'monospace',
            fontSize: '0.875rem'
          }}>
            &gt; SYSTEM_STATUS: <span style={{ color: '#00ff00', textShadow: '0 0 10px #00ff00' }}>OPERATIONAL</span> |{' '}
            UPTIME: <span style={{ color: '#00ffff', textShadow: '0 0 10px #00ffff' }}>
              {stats?.servers?.total || 0}h:24m:33s
            </span> |{' '}
            VERSION: <span style={{ color: '#ff00ff', textShadow: '0 0 10px #ff00ff' }}>v2.1.0-NEON</span> |{' '}
            MEMORY: <span style={{ color: '#ff8800', textShadow: '0 0 10px #ff8800' }}>
              {Math.round((stats?.memory?.used || 0) / 1024 / 1024)}MB
            </span> |{' '}
            API_CALLS: <span style={{ color: '#00ffff', textShadow: '0 0 10px #00ffff' }}>
              {((notifications?.length || 0) + (recentSessions?.length || 0))}
            </span>
          </p>
        </div>
      </footer>

      {/* 結果メッセージ */}
      {result && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          padding: '1rem 1.5rem',
          background: '#111',
          border: `3px solid ${result.type === 'success' ? '#00ff00' : '#ff0000'}`,
          borderRadius: '0.5rem',
          color: result.type === 'success' ? '#00ff00' : '#ff0000',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          zIndex: 1000,
          textShadow: `0 0 15px ${result.type === 'success' ? '#00ff00' : '#ff0000'}`,
          boxShadow: `
            0 0 10px ${result.type === 'success' ? '#00ff00' : '#ff0000'},
            0 0 20px ${result.type === 'success' ? '#00ff00' : '#ff0000'},
            0 0 40px ${result.type === 'success' ? '#00ff00' : '#ff0000'}
          `,
          maxWidth: '400px'
        }}>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
            [{new Date().toLocaleTimeString()}] SYSTEM_MESSAGE:
          </div>
          {result.message}
        </div>
      )}
    </div>
  )
}

export default RealDataNeonDashboard