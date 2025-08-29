// React Router based app with Jotai
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { 
  authLoadingAtom, 
  authErrorAtom, 
  isAuthenticatedAtom,
  retryAuthActionAtom,
  clearAuthErrorActionAtom,
  loginActionAtom,
  authInitActionAtom
} from './atoms/auth'
import LoginScreen from './components/LoginScreen'
import ErrorDisplay from './components/ErrorDisplay'
import LoadingScreen from './components/LoadingScreen'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import ChannelsPage from './pages/ChannelsPage'
import MembersPage from './pages/MembersPage'
import VoicePage from './pages/VoicePage'
import MessagesPage from './pages/MessagesPage'
import { useEffect } from 'react'
import './App.css'

// 認証保護付きのレイアウト（未認証なら /login へ）
function ProtectedLayout({ isAuthenticated, isLoading }: { isAuthenticated: boolean; isLoading: boolean }) {
  // 認証確認中は専用のローディング画面を表示
  if (isLoading) {
    return <LoadingScreen 
      message="認証状態を確認中..." 
      submessage="しばらくお待ちください"
    />
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

// 認証状態による条件付きレンダリング（ルーティング版）
function AppContent() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const isLoading = useAtomValue(authLoadingAtom)
  const error = useAtomValue(authErrorAtom)
  const retryAuth = useSetAtom(retryAuthActionAtom)
  const clearError = useSetAtom(clearAuthErrorActionAtom)
  const login = useSetAtom(loginActionAtom)
  const initAuth = useSetAtom(authInitActionAtom)

  useEffect(() => {
    initAuth()
  }, [initAuth])

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

  // ルーティング構成:
  // /login → 未認証のみ。認証済みなら /
  // 保護領域 (/) は ProtectedLayout 配下
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/" replace />
              : (isLoading ? <LoadingScreen message="認証情報を確認中..." submessage="Discordアカウントを確認しています" /> : <LoginScreen />)
          }
        />
        <Route element={<ProtectedLayout isAuthenticated={isAuthenticated} isLoading={isLoading} />}>
          <Route path="/" element={<DashboardPage />} />
            {/* 既存で /channels などを絶対パスで扱っていたのでそのまま */}
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/voice" element={<VoicePage />} />
          <Route path="/messages" element={<MessagesPage />} />
        </Route>
        {/* 不明ルートはトップへ */}
        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </Router>
  )
}

// メインAppコンポーネント（Jotai版 - AuthProvider不要）
function App() {
  return <AppContent />
}

export default App