import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import ErrorDisplay from './components/ErrorDisplay'
import LoadingScreen from './components/LoadingScreen'
import Header from './components/Header'
import StatsCards from './components/StatsCards'
import TabNavigation from './components/TabNavigation'
import OverviewTab from './components/tabs/OverviewTabs'
import MessageTab from './components/tabs/MessageTab'
import ChannelTab from './components/tabs/ChannelTab'
import MembersTab from './components/tabs/MembersTab'
import VoiceTab from './components/tabs/VoiceTab'
import { useDiscordData } from './hooks/useDiscordData'
import './App.css'

// 認証後のメインアプリケーション
function AuthenticatedApp() {
  const [activeTab, setActiveTab] = useState('overview')
  const { user } = useAuth()
  
  // Discord データを取得（認証統合済み）
  const {
    guilds,
    selectedGuild,
    setSelectedGuild,
    stats,
    loading,
    result,
    loadData,
    showResult
  } = useDiscordData()

  // 選択中のサーバーデータ
  const selectedGuildData = guilds.find(g => g.id === selectedGuild)

  // データローディング中
  if (loading) {
    return (
      <LoadingScreen
        message="データを読み込み中..."
        submessage={user ? `ようこそ、${user.tag} さん` : undefined}
        showProgress={true}
      />
    )
  }

  // 管理権限のあるサーバーがない場合
  if (guilds.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-white mb-4">アクセス権限がありません</h2>
          <p className="text-white/80 mb-6">
            このBotが参加しているサーバーで管理者権限を持っていません。
          </p>
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <h3 className="text-white font-semibold mb-2">必要な条件:</h3>
            <ul className="text-white/70 text-sm text-left space-y-1">
              <li>• Botが参加しているサーバー</li>
              <li>• ユーザーも参加しているサーバー</li>  
              <li>• ユーザーが管理者権限を持っているサーバー</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  // タブコンテンツの共通プロパティ
  const tabProps = {
    guilds,
    selectedGuild,
    selectedGuildData,
    showResult,
    loadData
  }

  // アクティブタブのレンダリング
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab {...tabProps} />
      case 'messages':
        return <MessageTab {...tabProps} />
      case 'channels':
        return <ChannelTab {...tabProps} />
      case 'members':
        return <MembersTab {...tabProps} />
      case 'voice':
        return <VoiceTab {...tabProps} />
      default:
        return <OverviewTab {...tabProps} />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <Header
          stats={stats}
          guilds={guilds}
          selectedGuild={selectedGuild}
          setSelectedGuild={setSelectedGuild}
          selectedGuildData={selectedGuildData}
        />

        {/* 統計カード */}
        <StatsCards stats={stats} />

        {/* タブナビゲーション */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* アクティブタブのコンテンツ */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          {renderActiveTab()}
        </div>

        {/* 結果メッセージ */}
        {result && (
          <div className={`fixed bottom-4 right-4 p-4 rounded-lg text-white ${
            result.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  )
}

// 認証状態による条件付きレンダリング
function AppContent() {
  const { isAuthenticated, isLoading, error, retryAuth, clearError, login } = useAuth()

  // 認証状態確認中
  if (isLoading) {
    return (
      <LoadingScreen
        message="認証状態を確認中..."
        submessage="しばらくお待ちください"
      />
    )
  }

  // エラーが発生している場合
  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={error.canRetry ? retryAuth : undefined}
        onLogin={login}
        onDismiss={clearError}
      />
    )
  }

  // 認証状態に応じてコンポーネントを切り替え（ルーティング不要）
  return isAuthenticated ? <AuthenticatedApp /> : <LoginScreen />
}

// メインAppコンポーネント
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App