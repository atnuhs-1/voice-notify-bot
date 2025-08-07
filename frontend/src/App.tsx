// React Router based app
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import ErrorDisplay from './components/ErrorDisplay'
import LoadingScreen from './components/LoadingScreen'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import ChannelsPage from './pages/ChannelsPage'
import MembersPage from './pages/MembersPage'
import VoicePage from './pages/VoicePage'
import MessagesPage from './pages/MessagesPage'
import { useDiscordData } from './hooks/useDiscordData'
import './App.css'

// メインダッシュボード
function MainDashboard() {
  const {
    guilds,
    selectedGuild,
    setSelectedGuild,
    stats,
    loadData,
    showResult
  } = useDiscordData()

  // 選択中のサーバーデータ
  const selectedGuildData = guilds.find(g => g.id === selectedGuild)

  // 共通のページプロパティ
  const pageProps = {
    guilds,
    selectedGuild,
    selectedGuildData,
    showResult,
    loadData,
    stats,
    setSelectedGuild
  }

  return (
    <Layout
      guilds={guilds}
      selectedGuild={selectedGuild}
      setSelectedGuild={setSelectedGuild}
    >
      <Routes>
        <Route 
          path="/" 
          element={
            <DashboardPage 
              selectedGuild={selectedGuild}
              selectedGuildData={selectedGuildData}
              showResult={showResult}
            />
          } 
        />
        <Route path="/channels" element={<ChannelsPage {...pageProps} />} />
        <Route path="/members" element={<MembersPage {...pageProps} />} />
        <Route path="/voice" element={<VoicePage {...pageProps} />} />
        <Route path="/messages" element={<MessagesPage {...pageProps} />} />
      </Routes>
    </Layout>
  )
}

// 認証済みユーザー向けのルーティング
function AuthenticatedApp() {
  return (
    <Router>
      <Routes>
        <Route path="/*" element={<MainDashboard />} />
      </Routes>
    </Router>
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

  // 認証状態に応じてコンポーネントを切り替え
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