import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { fetchGuilds, fetchStats } from '../utils/api'
import { authTokenAtom, isAuthenticatedAtom, userGuildsAtom } from './auth'
import type { Guild, BotStats, ResultMessage } from '../types/discord'

// === 基本状態atoms ===

// サーバー一覧
export const guildsAtom = atom<Guild[]>([])

// 選択中のサーバーID（永続化）
export const selectedGuildIdAtom = atomWithStorage<string>('selected-guild-id', '')

// 初回ロード中かどうか（UI用）
export const guildsInitialLoadingAtom = atom((get) => {
  const loading = get(discordLoadingAtom)
  const guilds = get(guildsAtom)
  return loading && guilds.length === 0
})

// Bot統計情報
export const botStatsAtom = atom<BotStats | null>(null)

// ローディング状態
export const discordLoadingAtom = atom<boolean>(false)

// 結果メッセージ
export const discordResultAtom = atom<ResultMessage | null>(null)

// === 計算atoms ===

// 選択中のサーバー情報（詳細なGuild型、統計画面用）
export const selectedGuildAtom = atom((get) => {
  const guilds = get(guildsAtom)
  const selectedId = get(selectedGuildIdAtom)
  console.log(`selectedGuildAtom: selectedId=${selectedId}, guildsCount=${guilds.length}`)
  return guilds.find(guild => guild.id === selectedId) || null
})

// 選択中のサーバー情報（認証時のUserGuild型、Sidebar用）
export const selectedUserGuildAtom = atom((get) => {
  const userGuilds = get(userGuildsAtom)
  const selectedId = get(selectedGuildIdAtom)
  return userGuilds.find(guild => guild.id === selectedId) || null
})

// 総ローディング状態（認証ローディングも含む）
export const totalLoadingAtom = atom((get) => {
  // authLoadingAtom は auth.ts で定義される予定
  const discordLoading = get(discordLoadingAtom)
  return discordLoading
})

// === 非同期データfetch atoms ===

// サーバー一覧の取得（認証状態に依存）
export const guildsDataAtom = atom(async (get) => {
  const isAuthenticated = get(isAuthenticatedAtom)
  const token = get(authTokenAtom)
  
  if (!isAuthenticated || !token) {
    return []
  }
  
  try {
    const guildsData = await fetchGuilds()
    return guildsData.guilds || []
  } catch (error) {
    console.error('サーバー一覧の取得に失敗:', error)
    throw error
  }
})

// Bot統計情報の取得（認証状態に依存）
export const botStatsDataAtom = atom(async (get) => {
  const isAuthenticated = get(isAuthenticatedAtom)
  const token = get(authTokenAtom)
  
  if (!isAuthenticated || !token) {
    return null
  }
  
  try {
    const statsData = await fetchStats()
    return statsData
  } catch (error) {
    console.error('Bot統計情報の取得に失敗:', error)
    throw error
  }
})

// === アクションatoms ===

// サーバー選択
export const selectGuildActionAtom = atom(
  null,
  (get, set, newGuildId: string) => {
    const currentGuildId = get(selectedGuildIdAtom)
    if (currentGuildId === newGuildId) return
    
    set(selectedGuildIdAtom, newGuildId)
    console.log(`🔄 サーバーを選択: ${newGuildId}`)
  }
)

// 結果メッセージ表示
export const showResultActionAtom = atom(
  null,
  (_get, set, message: string, type: 'success' | 'error') => {
    set(discordResultAtom, { message, type })
    
    // 5秒後に自動でクリア
    setTimeout(() => {
      set(discordResultAtom, null)
    }, 5000)
  }
)

// 結果メッセージクリア
export const clearResultActionAtom = atom(
  null,
  (_get, set) => {
    set(discordResultAtom, null)
  }
)

// データの手動更新
export const refreshDiscordDataActionAtom = atom(
  null,
  async (get, set) => {
    const isAuthenticated = get(isAuthenticatedAtom)
    const token = get(authTokenAtom)
    
    if (!isAuthenticated || !token) {
      console.log('未認証のためデータ更新をスキップ')
      return
    }

    try {
      set(discordLoadingAtom, true)
      
      // サーバー一覧とBot統計を並行取得
      const [guildsData, statsData] = await Promise.all([
        fetchGuilds(),
        fetchStats()
      ])

      const newGuilds = guildsData.guilds || []
      // 状態を更新
      set(guildsAtom, guildsData.guilds || [])
      set(botStatsAtom, statsData)
      
      const currentSelectedId = get(selectedGuildIdAtom)
      const exists = currentSelectedId && newGuilds.some(g => g.id === currentSelectedId)

      // 1) 未選択（''）の場合
      // 2) 既存選択が消えている場合
      if ((!currentSelectedId || !exists) && newGuilds.length > 0) {
        set(selectedGuildIdAtom, newGuilds[0].id)
        console.log(`🔄 自動選択: ${newGuilds[0].name}`)
      }
      if (newGuilds.length === 0) {
        // サーバーが無い場合は選択状態をクリア
        if (currentSelectedId !== '') {
          set(selectedGuildIdAtom, '')
        }
      }
      
      set(showResultActionAtom, `データ取得完了: ${newGuilds.length}サーバー`, 'success')
      console.log(`✅ データ取得完了: ${newGuilds.length}サーバー`)
      
    } catch (error) {
      console.error('データの取得に失敗:', error)
      set(showResultActionAtom, 'データの取得に失敗しました', 'error')
      throw error
    } finally {
      set(discordLoadingAtom, false)
    }
  }
)

// 認証状態変更時の自動データ更新
export const autoRefreshOnAuthAtom = atom(
  null,
  async (get, set) => {
    const isAuthenticated = get(isAuthenticatedAtom)
    
    if (isAuthenticated) {
      // 認証成功時にデータを自動取得
      console.log('🔄 認証成功 - Discord データを自動取得中...')
      await set(refreshDiscordDataActionAtom)
    } else {
      // 未認証時はデータをクリア
      console.log('🔄 未認証 - Discord データをクリア')
      set(guildsAtom, [])
      set(selectedGuildIdAtom, '')
      set(botStatsAtom, null)
      set(discordResultAtom, null)
    }
  }
)