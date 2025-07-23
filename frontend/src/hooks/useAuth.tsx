import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'

// 認証ユーザーの型定義
export interface AuthUser {
  id: string
  username: string
  discriminator: string
  avatar: string | null
  tag: string
}

// ユーザーのサーバー情報
export interface UserGuild {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
}

// 認証エラーの型定義
export interface AuthError {
  type: 'network' | 'auth' | 'permission' | 'unknown'
  message: string
  canRetry: boolean
}

// 認証コンテキストの型定義
interface AuthContextType {
  // 認証状態
  isAuthenticated: boolean
  isLoading: boolean
  user: AuthUser | null
  guilds: UserGuild[]
  token: string | null
  error: AuthError | null
  
  // 認証関数
  login: () => void
  logout: () => void
  setAuthFromToken: (token: string) => Promise<boolean>
  clearError: () => void
  retryAuth: () => Promise<void>
}

// 認証コンテキストの作成
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// 認証プロバイダーコンポーネント
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [guilds, setGuilds] = useState<UserGuild[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<AuthError | null>(null)

  // ローカルストレージからトークンを取得
  useEffect(() => {
    const initAuth = async () => {
      try {
        setError(null)
        
        // URLパラメータからトークンを取得（OAuth2コールバック後）
        const urlParams = new URLSearchParams(window.location.search)
        const urlToken = urlParams.get('token')
        
        if (urlToken) {
          // URLからトークンを取得した場合
          console.log('🔄 URLからトークンを取得...')
          const success = await setAuthFromToken(urlToken)
          if (success) {
            // URLパラメータを削除
            window.history.replaceState({}, document.title, window.location.pathname)
          }
        } else {
          // ローカルストレージからトークンを取得
          const savedToken = localStorage.getItem('discord_auth_token')
          if (savedToken) {
            console.log('🔄 保存済みトークンで認証中...')
            await setAuthFromToken(savedToken)
          }
        }
      } catch (error) {
        console.error('認証初期化エラー:', error)
        handleAuthError(error)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  // トークンから認証情報を設定
  const setAuthFromToken = async (authToken: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      // トークンの有効性をチェック
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('TOKEN_EXPIRED')
        } else if (response.status === 403) {
          throw new Error('INSUFFICIENT_PERMISSIONS')
        } else {
          throw new Error(`AUTH_FAILED_${response.status}`)
        }
      }

      const data = await response.json()

      // 管理者権限のあるサーバーをチェック
      if (!data.guilds || data.guilds.length === 0) {
        throw new Error('NO_ADMIN_GUILDS')
      }

      // 認証情報を設定
      setToken(authToken)
      setUser(data.user)
      setGuilds(data.guilds)
      setIsAuthenticated(true)

      // ローカルストレージに保存
      localStorage.setItem('discord_auth_token', authToken)

      console.log(`✅ ログイン成功: ${data.user.tag} (${data.guilds.length}サーバー)`)
      return true

    } catch (error) {
      console.error('認証エラー:', error)
      handleAuthError(error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // エラーハンドリング
  const handleAuthError = (error: any) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    let authError: AuthError

    switch (errorMessage) {
      case 'TOKEN_EXPIRED':
        authError = {
          type: 'auth',
          message: 'ログインの有効期限が切れました。再度ログインしてください。',
          canRetry: false
        }
        break
      case 'INSUFFICIENT_PERMISSIONS':
        authError = {
          type: 'permission',
          message: 'このBotが参加しているサーバーで管理者権限を持っていません。',
          canRetry: false
        }
        break
      case 'NO_ADMIN_GUILDS':
        authError = {
          type: 'permission',
          message: '管理者権限を持つサーバーが見つかりませんでした。',
          canRetry: false
        }
        break
      default:
        if (errorMessage.includes('fetch')) {
          authError = {
            type: 'network',
            message: 'ネットワークエラーが発生しました。接続を確認してください。',
            canRetry: true
          }
        } else {
          authError = {
            type: 'unknown',
            message: '認証中に予期しないエラーが発生しました。',
            canRetry: true
          }
        }
    }

    setError(authError)
    
    // 認証失敗時はクリア
    setToken(null)
    setUser(null)
    setGuilds([])
    setIsAuthenticated(false)
    localStorage.removeItem('discord_auth_token')
  }

  // ログイン（Discord OAuth2開始）
  const login = () => {
    setError(null)
    console.log('🔄 Discord OAuth2認証を開始...')
    window.location.href = `${API_BASE_URL}/api/auth/discord`
  }

  // ログアウト
  const logout = async () => {
    try {
      setIsLoading(true)
      
      // サーバー側のログアウトAPIを呼び出し（オプション）
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).catch(() => {
          // ログアウトAPIが失敗してもクライアント側はクリア
        })
      }
    } finally {
      // クライアント側の認証情報をクリア
      setToken(null)
      setUser(null)
      setGuilds([])
      setIsAuthenticated(false)
      setError(null)
      localStorage.removeItem('discord_auth_token')
      setIsLoading(false)
      
      console.log('✅ ログアウト完了')
    }
  }

  // エラークリア
  const clearError = () => {
    setError(null)
  }

  // 認証リトライ
  const retryAuth = async () => {
    const savedToken = localStorage.getItem('discord_auth_token')
    if (savedToken) {
      await setAuthFromToken(savedToken)
    } else {
      login()
    }
  }

  const contextValue: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    guilds,
    token,
    error,
    login,
    logout,
    setAuthFromToken,
    clearError,
    retryAuth
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// 認証フックの使用
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// 認証が必要なコンポーネント用のヘルパーフック
export function useRequireAuth() {
  const { isAuthenticated, isLoading, login } = useAuth()
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('未認証のため、ログイン画面に移動します')
    }
  }, [isAuthenticated, isLoading, login])

  return { isAuthenticated, isLoading }
}