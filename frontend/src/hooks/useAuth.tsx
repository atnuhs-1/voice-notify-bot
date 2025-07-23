import { useState, useEffect, createContext, useContext ,type ReactNode} from 'react'

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

// 認証コンテキストの型定義
interface AuthContextType {
  // 認証状態
  isAuthenticated: boolean
  isLoading: boolean
  user: AuthUser | null
  guilds: UserGuild[]
  token: string | null
  
  // 認証関数
  login: () => void
  logout: () => void
  setAuthFromToken: (token: string) => Promise<boolean>
}

// 認証コンテキストの作成
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// API Base URL
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://your-backend.koyeb.app'
  : 'http://localhost:3000'

// 認証プロバイダーコンポーネント
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [guilds, setGuilds] = useState<UserGuild[]>([])
  const [token, setToken] = useState<string | null>(null)

  // ローカルストレージからトークンを取得
  useEffect(() => {
    const initAuth = async () => {
      try {
        // URLパラメータからトークンを取得（OAuth2コールバック後）
        const urlParams = new URLSearchParams(window.location.search)
        const urlToken = urlParams.get('token')
        
        if (urlToken) {
          // URLからトークンを取得した場合
          const success = await setAuthFromToken(urlToken)
          if (success) {
            // URLパラメータを削除
            window.history.replaceState({}, document.title, window.location.pathname)
          }
        } else {
          // ローカルストレージからトークンを取得
          const savedToken = localStorage.getItem('discord_auth_token')
          if (savedToken) {
            await setAuthFromToken(savedToken)
          }
        }
      } catch (error) {
        console.error('認証初期化エラー:', error)
        // エラーの場合はトークンを削除
        localStorage.removeItem('discord_auth_token')
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

      // トークンの有効性をチェック
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`認証失敗: ${response.status}`)
      }

      const data = await response.json()

      // 認証情報を設定
      setToken(authToken)
      setUser(data.user)
      setGuilds(data.guilds)
      setIsAuthenticated(true)

      // ローカルストレージに保存
      localStorage.setItem('discord_auth_token', authToken)

      console.log(`✅ ログイン成功: ${data.user.tag}`)
      return true

    } catch (error) {
      console.error('認証エラー:', error)
      
      // 認証失敗時はクリア
      setToken(null)
      setUser(null)
      setGuilds([])
      setIsAuthenticated(false)
      localStorage.removeItem('discord_auth_token')
      
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // ログイン（Discord OAuth2開始）
  const login = () => {
    window.location.href = `${API_BASE_URL}/api/auth/discord`
  }

  // ログアウト
  const logout = async () => {
    try {
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
      localStorage.removeItem('discord_auth_token')
      
      console.log('✅ ログアウト完了')
    }
  }

  const contextValue: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    guilds,
    token,
    login,
    logout,
    setAuthFromToken
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
      // 認証されていない場合は自動でログイン画面へ
      console.log('未認証のため、ログイン画面に移動します')
    }
  }, [isAuthenticated, isLoading, login])

  return { isAuthenticated, isLoading }
}