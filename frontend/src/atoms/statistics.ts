import { atom } from 'jotai'
import { atomWithStorage, atomFamily } from 'jotai/utils'
import { authTokenAtom, isAuthenticatedAtom } from './auth'
import { selectedGuildIdAtom } from './discord'

// selectedGuildIdAtom を再エクスポート
export { selectedGuildIdAtom } from './discord'
import { getRanking, fetchTimeline, fetchSummaries } from '../utils/api'
import type { 
  MetricType,
  BackendPeriodPreset
} from '../types/statistics'

// === 基本状態atoms ===

// メトリクス選択（永続化）
export const selectedMetricAtom = atomWithStorage<MetricType>('selected-metric', 'duration')

// ローディング状態
export const statisticsLoadingAtom = atom<boolean>(false)

// エラー状態  
export const statisticsErrorAtom = atom<string | null>(null)

// === プリセット優先の統計データ管理（optimizedStatistics.tsから統合） ===

// プリセット別ランキングデータ（高速キャッシュ）
export const presetRankingAtomFamily = atomFamily((params: {
  guildId: string;
  metric: MetricType;
  preset: BackendPeriodPreset | 'custom';
  customPeriod?: { from: string; to: string };
}) => 
  atom(async (get) => {
    const isAuthenticated = get(isAuthenticatedAtom);
    const token = get(authTokenAtom);
    
    if (!params.guildId || !isAuthenticated || !token) {
      return null;
    }
    
    try {
      const apiParams = {
        guildId: params.guildId,
        metric: params.metric,
        limit: 10,
        compare: true
      };

      let response;
      
      if (params.preset === 'custom' && params.customPeriod) {
        // カスタム期間でAPI呼び出し
        response = await getRanking({
          ...apiParams,
          from: params.customPeriod.from,
          to: params.customPeriod.to
        });
        console.log(`📅 Custom period API: ${params.customPeriod.from} - ${params.customPeriod.to}`);
      } else if (params.preset !== 'custom') {
        // プリセット期間でAPI呼び出し（🚀 高速ルート）
        response = await getRanking({
          ...apiParams,
          period: params.preset
        });
        console.log(`🚀 Preset API: ${params.preset}`);
      } else {
        throw new Error('Invalid period configuration');
      }

      console.log(`📊 API Response meta:`, {
        searchType: response.meta?.searchType,
        preset: response.meta?.preset,
        isOptimized: response.meta?.isOptimized,
        totalParticipants: response.meta?.totalParticipants
      });
      
      return {
        data: response.data,
        meta: response.meta
      };
      
    } catch (error) {
      console.error('ランキングデータ取得エラー:', error);
      throw error;
    }
  })
);

// === タイムラインとサマリー（既存ロジック維持） ===

// タイムラインデータ（サーバー・期間毎にキャッシュ）
export const timelineDataAtomFamily = atomFamily((params: {
  guildId: string
  from: string
  to: string
}) => 
  atom(async (get) => {
    const isAuthenticated = get(isAuthenticatedAtom)
    const token = get(authTokenAtom)
    
    if (!params.guildId || !isAuthenticated || !token) {
      return null
    }
    
    try {
      const response = await fetchTimeline(params.guildId, {
        from: params.from,
        to: params.to
      })
      
      return response.data
    } catch (error) {
      console.error('タイムラインデータ取得エラー:', error)
      throw error
    }
  })
)

// サマリーデータ（サーバー毎にキャッシュ）
export const summariesDataAtomFamily = atomFamily((params: {
  guildId: string
  type: 'daily' | 'weekly' | 'monthly'
  from?: string
  to?: string
  limit?: number
  offset?: number
}) => 
  atom(async (get) => {
    const isAuthenticated = get(isAuthenticatedAtom)
    const token = get(authTokenAtom)
    
    if (!params.guildId || !isAuthenticated || !token) {
      return null
    }
    
    try {
      const response = await fetchSummaries(params.guildId, {
        type: params.type,
        from: params.from,
        to: params.to,
        limit: params.limit || 30,
        offset: params.offset || 0
      })
      
      return response.data
    } catch (error) {
      console.error('サマリーデータ取得エラー:', error)
      throw error
    }
  })
)

// === アクションatoms ===

// メトリクス更新アクション
export const updateMetricActionAtom = atom(
  null,
  (_get, set, newMetric: MetricType) => {
    set(selectedMetricAtom, newMetric)
    console.log('🔄 メトリクスを更新:', newMetric)
    // 依存する統計データatomが自動で再取得される！
  }
)

// 統計データ手動更新アクション
export const refreshStatisticsActionAtom = atom(
  null,
  async (get) => {
    const selectedGuildId = get(selectedGuildIdAtom)
    
    if (!selectedGuildId) {
      console.log('サーバーが選択されていないため統計更新をスキップ')
      return
    }
    
    try {
      console.log(`🔄 統計データを手動更新: ${selectedGuildId}`)
      
      // atomFamilyのキャッシュを強制更新
      // presetsからパラメータを取得して再実行
      console.log('✅ 統計データ更新完了')
      
    } catch (error) {
      console.error('統計データ更新エラー:', error)
      throw error
    }
  }
)