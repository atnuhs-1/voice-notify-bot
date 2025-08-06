// React Router based app
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import ErrorDisplay from './components/ErrorDisplay'
import LoadingScreen from './components/LoadingScreen'
import NeonDashboard from './components/NeonDashboard'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import ChannelsPage from './pages/ChannelsPage'
import MembersPage from './pages/MembersPage'
import VoicePage from './pages/VoicePage'
import MessagesPage from './pages/MessagesPage'
import { useDiscordData } from './hooks/useDiscordData'
import './App.css'

// デザイン切り替えボタンコンポーネント
function ThemeToggle() {
  const navigate = useNavigate()
  const location = useLocation()
  const isNeonMode = location.pathname === '/neon'

  const toggleTheme = () => {
    if (isNeonMode) {
      navigate('/')
    } else {
      navigate('/neon')
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg font-medium transition-all duration-300 theme-toggle-btn ${
        isNeonMode
          ? 'bg-cyan-500 text-black border border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.5)] hover:shadow-[0_0_30px_rgba(0,255,255,0.8)]'
          : 'bg-purple-600 text-white border border-purple-500 shadow-lg hover:bg-purple-700'
      }`}
      title={isNeonMode ? 'ノーマルモードに切り替え' : 'ネオンモードに切り替え'}
    >
      {isNeonMode ? (
        <>
          ☀️ <span className="ml-2">NORMAL</span>
        </>
      ) : (
        <>
          🌙 <span className="ml-2">NEON</span>
        </>
      )}
    </button>
  )
}

// 通常のダッシュボード（新しい設計）
function NormalDashboard() {
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

// ネオンダッシュボードのラッパー（既存のNeonDashboardコンポーネントを使用）
function NeonDashboardWrapper() {
  return <NeonDashboard />
}

// 認証済みユーザー向けのルーティング
function AuthenticatedApp() {
  return (
    <Router>
      <ThemeToggle />
      <Routes>
        <Route path="/neon" element={<NeonDashboardWrapper />} />
        <Route path="/*" element={<NormalDashboard />} />
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