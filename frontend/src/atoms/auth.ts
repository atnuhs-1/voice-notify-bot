import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

// 認証ユーザーの型定義（既存のuseAuthから移行）
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

// === 基本状態atoms ===

// 認証ユーザー情報
export const authUserAtom = atom<AuthUser | null>(null)

// 認証トークン（永続化）
export const authTokenAtom = atomWithStorage<string | null>('discord_auth_token', null)

// ユーザーが管理するサーバー一覧
export const userGuildsAtom = atom<UserGuild[]>([])

// 認証関連の状態
export const authLoadingAtom = atom<boolean>(true) // 初期状態はtrue（初期化中）
export const authErrorAtom = atom<AuthError | null>(null)

// === 計算atoms ===

// 認証状態の判定
export const isAuthenticatedAtom = atom((get) => {
  const user = get(authUserAtom)
  const token = get(authTokenAtom)
  return user !== null && token !== null
})

// === アクションatoms ===

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// ログイン（Discord OAuth2開始）
export const loginActionAtom = atom(
  null,
  (_get, set) => {
    set(authErrorAtom, null)
    console.log('🔄 Discord OAuth2認証を開始...')
    window.location.href = `${API_BASE_URL}/api/auth/discord`
  }
)

// ログアウト
export const logoutActionAtom = atom(
  null,
  async (get, set) => {
    try {
      set(authLoadingAtom, true)
      
      const token = get(authTokenAtom)
      
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
      set(authTokenAtom, null)
      set(authUserAtom, null)
      set(userGuildsAtom, [])
      set(authErrorAtom, null)
      set(authLoadingAtom, false)
      
      console.log('✅ ログアウト完了')
    }
  }
)

// エラークリア
export const clearAuthErrorActionAtom = atom(
  null,
  (_get, set) => {
    set(authErrorAtom, null)
  }
)

// トークンから認証情報を設定
export const setAuthFromTokenActionAtom = atom(
  null,
  async (_get, set, authToken: string): Promise<boolean> => {
    try {
      set(authLoadingAtom, true)
      set(authErrorAtom, null)
      
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
      set(authTokenAtom, authToken)
      set(authUserAtom, data.user)
      set(userGuildsAtom, data.guilds)

      console.log(`✅ ログイン成功: ${data.user.tag} (${data.guilds.length}サーバー)`)
      return true

    } catch (error) {
      console.error('認証エラー:', error)
      handleAuthError(error, set)
      return false
    } finally {
      set(authLoadingAtom, false)
    }
  }
)

// 認証リトライ
export const retryAuthActionAtom = atom(
  null,
  async (get, set) => {
    const savedToken = get(authTokenAtom)
    if (savedToken) {
      return await set(setAuthFromTokenActionAtom, savedToken)
    } else {
      set(loginActionAtom)
    }
  }
)

// エラーハンドリングヘルパー関数
function handleAuthError(error: any, set: any) {
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

  set(authErrorAtom, authError)
  
  // 認証失敗時はクリア
  set(authTokenAtom, null)
  set(authUserAtom, null)
  set(userGuildsAtom, [])
}

// 認証初期化atom（アプリ起動時の処理）
export const authInitActionAtom = atom(
  null,
  async (get, set) => {
    try {
      set(authErrorAtom, null)
      
      // URLパラメータからトークンを取得（OAuth2コールバック後）
      const urlParams = new URLSearchParams(window.location.search)
      const urlToken = urlParams.get('token')
      
      if (urlToken) {
        // URLからトークンを取得した場合
        console.log('🔄 URLからトークンを取得...')
        const success = await set(setAuthFromTokenActionAtom, urlToken)
        if (success) {
          // URLパラメータを削除
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      } else {
        // ローカルストレージからトークンを取得
        const savedToken = get(authTokenAtom)
        if (savedToken) {
          console.log('🔄 保存済みトークンで認証中...')
          await set(setAuthFromTokenActionAtom, savedToken)
        }
      }
    } catch (error) {
      console.error('認証初期化エラー:', error)
      handleAuthError(error, set)
    } finally {
      set(authLoadingAtom, false)
    }
  }
)