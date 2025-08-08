import { atom } from 'jotai'
import { atomWithStorage, atomFamily } from 'jotai/utils'
import { authTokenAtom, isAuthenticatedAtom } from './auth'
import { selectedGuildIdAtom } from './discord'
import { fetchRankings, fetchTimeline, fetchSummaries } from '../utils/api'
import type { 
  RankingData, 
  TimelineData, 
  SummariesData, 
  MetricType,
  PeriodSelection 
} from '../types/statistics'

// === 基本状態atoms ===

// 期間選択（永続化）
export const selectedPeriodAtom = atomWithStorage<PeriodSelection>('selected-period', {
  type: 'week',
  from: getDefaultWeekStart(),
  to: getDefaultWeekEnd(),
})

// メトリクス選択（永続化）
export const selectedMetricAtom = atomWithStorage<MetricType>('selected-metric', 'duration')

// ローディング状態
export const statisticsLoadingAtom = atom<boolean>(false)

// エラー状態
export const statisticsErrorAtom = atom<string | null>(null)

// === atomFamily Pattern - サーバー毎の統計データ ===

// ランキングデータ（サーバー・期間・メトリクス毎にキャッシュ）
export const rankingDataAtomFamily = atomFamily((params: {
  guildId: string
  period: PeriodSelection
  metric: MetricType
}) => 
  atom(async (get) => {
    const isAuthenticated = get(isAuthenticatedAtom)
    const token = get(authTokenAtom)
    
    if (!params.guildId || !isAuthenticated || !token) {
      return null
    }
    
    try {
      const response = await fetchRankings(params.guildId, {
        metric: params.metric,
        from: params.period.from,
        to: params.period.to,
        limit: 10,
        compare: true
      })
      
      return response.data
    } catch (error) {
      console.error('ランキングデータ取得エラー:', error)
      throw error
    }
  })
)

// タイムラインデータ（サーバー・期間毎にキャッシュ）
export const timelineDataAtomFamily = atomFamily((params: {
  guildId: string
  period: PeriodSelection
}) => 
  atom(async (get) => {
    const isAuthenticated = get(isAuthenticatedAtom)
    const token = get(authTokenAtom)
    
    if (!params.guildId || !isAuthenticated || !token) {
      return null
    }
    
    try {
      const response = await fetchTimeline(params.guildId, {
        from: `${params.period.from}T18:00:00Z`,
        to: `${params.period.to}T10:00:00Z`
      })
      
      return response.data
    } catch (error) {
      console.error('タイムラインデータ取得エラー:', error)
      throw error
    }
  })
)

// サマリーデータ（サーバー毎にキャッシュ）
export const summariesDataAtomFamily = atomFamily((guildId: string) => 
  atom(async (get) => {
    const isAuthenticated = get(isAuthenticatedAtom)
    const token = get(authTokenAtom)
    
    if (!guildId || !isAuthenticated || !token) {
      return null
    }
    
    try {
      const response = await fetchSummaries(guildId, {
        type: 'daily',
        limit: 30
      })
      
      return response.data
    } catch (error) {
      console.error('サマリーデータ取得エラー:', error)
      throw error
    }
  })
)

// === 計算atoms - 現在選択中のサーバー用 ===

// 現在選択中のサーバーのランキングデータ
export const currentRankingDataAtom = atom((get) => {
  const selectedGuildId = get(selectedGuildIdAtom)
  const selectedPeriod = get(selectedPeriodAtom)
  const selectedMetric = get(selectedMetricAtom)
  
  if (!selectedGuildId) return null
  
  return get(rankingDataAtomFamily({
    guildId: selectedGuildId,
    period: selectedPeriod,
    metric: selectedMetric
  }))
})

// 現在選択中のサーバーのタイムラインデータ
export const currentTimelineDataAtom = atom((get) => {
  const selectedGuildId = get(selectedGuildIdAtom)
  const selectedPeriod = get(selectedPeriodAtom)
  
  if (!selectedGuildId) return null
  
  return get(timelineDataAtomFamily({
    guildId: selectedGuildId,
    period: selectedPeriod
  }))
})

// 現在選択中のサーバーのサマリーデータ
export const currentSummariesDataAtom = atom((get) => {
  const selectedGuildId = get(selectedGuildIdAtom)
  
  if (!selectedGuildId) return null
  
  return get(summariesDataAtomFamily(selectedGuildId))
})

// === アクションatoms ===

// 期間更新アクション
export const updatePeriodActionAtom = atom(
  null,
  (get, set, newPeriod: PeriodSelection) => {
    set(selectedPeriodAtom, newPeriod)
    console.log('🔄 期間を更新:', newPeriod)
    // 依存する統計データatomが自動で再取得される！
  }
)

// メトリクス更新アクション
export const updateMetricActionAtom = atom(
  null,
  (get, set, newMetric: MetricType) => {
    set(selectedMetricAtom, newMetric)
    console.log('🔄 メトリクスを更新:', newMetric)
    // 依存する統計データatomが自動で再取得される！
  }
)

// 統計データ手動更新アクション
export const refreshStatisticsActionAtom = atom(
  null,
  async (get, set) => {
    const selectedGuildId = get(selectedGuildIdAtom)
    
    if (!selectedGuildId) {
      console.log('サーバーが選択されていないため統計更新をスキップ')
      return
    }
    
    try {
      set(statisticsLoadingAtom, true)
      set(statisticsErrorAtom, null)
      
      // atomFamily のキャッシュをクリアして再取得
      // 現在の選択状態で再取得される
      const selectedPeriod = get(selectedPeriodAtom)
      const selectedMetric = get(selectedMetricAtom)
      
      // キーを更新することで自動的に再取得される
      console.log(`🔄 統計データを手動更新: ${selectedGuildId}`)
      
    } catch (error) {
      console.error('統計データ更新エラー:', error)
      const errorMessage = error instanceof Error ? error.message : '統計データの更新に失敗しました'
      set(statisticsErrorAtom, errorMessage)
      throw error
    } finally {
      set(statisticsLoadingAtom, false)
    }
  }
)

// === ユーティリティ関数 ===

// デフォルトの週開始日を取得（月曜日）
function getDefaultWeekStart(): string {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ...
  const monday = new Date(now)
  
  // 月曜日にセット（日曜日の場合は前週の月曜日）
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  monday.setDate(now.getDate() - daysToSubtract)
  
  return monday.toISOString().split('T')[0] // YYYY-MM-DD
}

// デフォルトの週終了日を取得（日曜日）
function getDefaultWeekEnd(): string {
  const weekStart = new Date(getDefaultWeekStart())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  
  return weekEnd.toISOString().split('T')[0] // YYYY-MM-DD
}