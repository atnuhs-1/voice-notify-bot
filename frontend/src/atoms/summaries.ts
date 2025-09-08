import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { selectedGuildIdAtom } from './discord';
import { selectedPresetAtom, customPeriodAtom } from './presets';
import { fetchSummaries } from '../utils/api';
import { getCurrentWeekPeriod, getLastWeekPeriod, getCurrentMonthPeriod, getLastMonthPeriod, getISOWeekBounds } from '../utils/period';
import type { 
  BackendPeriodPreset, 
  SummariesQuery, 
  SummariesData,
  SummaryItem
} from '../types/statistics';

// === Summary用の戦略・パラメータ生成 ===

// プリセット期間から最適なサマリータイプを決定
export const summaryTypeStrategyAtom = atom((get) => {
  const selectedPreset = get(selectedPresetAtom);
  
  // プリセット別の最適なサマリータイプマッピング
  const typeMapping: Record<BackendPeriodPreset | 'custom', 'weekly' | 'monthly'> = {
    'this_week': 'weekly',     // 今週の週次サマリー
    'last_week': 'weekly',     // 先週の週次サマリー
    'last_7_days': 'weekly',   // 過去7日間（直近週として扱う）
    'this_month': 'monthly',   // 今月の月次サマリー
    'last_month': 'monthly',   // 先月の月次サマリー
    'last_30_days': 'monthly', // 過去30日間（直近月として扱う）
    'this_year': 'monthly',    // 今年の月別推移
    'last_year': 'monthly',    // 昨年の月別推移
    'custom': 'weekly'         // カスタムはデフォルトでweekly
  };
  
  return typeMapping[selectedPreset];
});

// Summary API用パラメータ生成のatomFamily
export const summaryParamsAtomFamily = atomFamily((params: {
  type: 'weekly' | 'monthly';
  periodOffset?: number; // 0=現在期間, -1=前期間, -2=前々期間...
  limit?: number;
}) => atom((get) => {
  const guildId = get(selectedGuildIdAtom);
  const selectedPreset = get(selectedPresetAtom);
  const customPeriod = get(customPeriodAtom);
  const { type, periodOffset = 0, limit = 30 } = params;
  
  if (!guildId) return null;
  
  // 期間計算（プリセット・カスタムに対応）
  const periodRange = calculatePeriodRange(selectedPreset, customPeriod, periodOffset);
  
  const queryParams: SummariesQuery = {
    type,
    limit,
    offset: 0,
    ...(periodRange && {
      from: periodRange.from,
      to: periodRange.to
    })
  };
  
  return {
    guildId,
    query: queryParams,
    cacheKey: `${guildId}-${type}-${periodOffset}-${selectedPreset}-${JSON.stringify(periodRange)}`
  };
}));

// Summary APIコール用のatomFamily（キャッシュ付き）
export const summaryAtomFamily = atomFamily((params: {
  type: 'weekly' | 'monthly';
  periodOffset?: number;
  limit?: number;
}) => atom(async (get) => {
  const apiParams = get(summaryParamsAtomFamily(params));
  
  if (!apiParams) {
    return null;
  }
  
  try {
    console.log(`🔄 Summary API call: ${apiParams.cacheKey}`);
    const response = await fetchSummaries(apiParams.guildId, apiParams.query);
    
    return {
      data: response.data as SummariesData,
      meta: {
        ...response.meta,
        searchType: 'summaries',
        summaryType: params.type,
        periodOffset: params.periodOffset || 0,
        cacheKey: apiParams.cacheKey
      }
    };
  } catch (error) {
    console.error(`❌ Summary API error (${apiParams.cacheKey}):`, error);
    throw error;
  }
}));

// === 統合されたサマリーデータ atoms ===

// 現在期間のサマリーデータ
export const currentSummaryAtom = atom(async (get) => {
  const summaryType = get(summaryTypeStrategyAtom);
  const selectedPreset = get(selectedPresetAtom);
  
  // 年次表示の場合は複数月取得、その他は1件のみ
  const limit = selectedPreset === 'this_year' || selectedPreset === 'last_year' ? 12 : 1;
  
  return get(summaryAtomFamily({
    type: summaryType,
    periodOffset: 0,  // 現在期間
    limit
  }));
});

// 前期間のサマリーデータ（比較用）
export const previousSummaryAtom = atom(async (get) => {
  const summaryType = get(summaryTypeStrategyAtom);
  
  return get(summaryAtomFamily({
    type: summaryType,
    periodOffset: -1, // 前期間
    limit: 1          // 1件のみ
  }));
});

// トレンド用の複数期間サマリーデータ
export const trendSummariesAtom = atom(async (get) => {
  const summaryType = get(summaryTypeStrategyAtom);
  
  // 週次なら過去8週、月次なら過去12ヶ月
  const limit = summaryType === 'weekly' ? 8 : 12;
  
  return get(summaryAtomFamily({
    type: summaryType,
    periodOffset: 0,  // 現在を含む
    limit
  }));
});

// サマリー比較計算用atom
export const summaryComparisonAtom = atom(async (get) => {
  const currentData = await get(currentSummaryAtom);
  const previousData = await get(previousSummaryAtom);
  
  if (!currentData?.data?.summaries?.[0] || !previousData?.data?.summaries?.[0]) {
    return null;
  }
  
  const current = currentData.data.summaries[0];
  const previous = previousData.data.summaries[0];
  
  return calculateSummaryComparison(current, previous);
});

// 手動更新アクション
export const refreshSummariesActionAtom = atom(
  null,
  async (get) => {
    const summaryType = get(summaryTypeStrategyAtom);
    const guildId = get(selectedGuildIdAtom);
    
    if (!guildId) {
      console.log('guildIdが設定されていないため更新をスキップ');
      return;
    }
    
    try {
      console.log(`🔄 Summariesデータを手動更新: ${guildId} (${summaryType})`);
      
      // 現在・前期間・トレンドデータを並列更新
      await Promise.all([
        get(currentSummaryAtom),
        get(previousSummaryAtom),
        get(trendSummariesAtom)
      ]);
      
      console.log('✅ Summariesデータ更新完了');
    } catch (error) {
      console.error('❌ Summariesデータ更新エラー:', error);
      throw error;
    }
  }
);

// === ユーティリティ関数 ===

/**
 * プリセット・カスタム期間から具体的な日付範囲を計算
 */
function calculatePeriodRange(
  preset: BackendPeriodPreset | 'custom',
  customPeriod: { from: string; to: string },
  offset: number = 0
): { from: string; to: string } | null {
  
  if (preset === 'custom') {
    // カスタム期間の場合、オフセット計算は複雑なので現在期間のみ対応
    if (offset !== 0) return null;
    return customPeriod;
  }
  
  // プリセット期間のオフセット計算
  const today = new Date();
  
  switch (preset) {
    case 'this_week': {
      const weekPeriod = getCurrentWeekPeriod();
      if (offset !== 0) {
        // offset対応が必要な場合はperiod.tsのgetRelativePeriodを使用
        const startDate = new Date(weekPeriod.from);
        startDate.setDate(startDate.getDate() + (offset * 7));
        const { start, end } = getISOWeekBounds(startDate);
        return {
          from: start.toISOString().split('T')[0],
          to: end.toISOString().split('T')[0]
        };
      }
      return { from: weekPeriod.from, to: weekPeriod.to };
    }
    
    case 'last_week': {
      const weekPeriod = getLastWeekPeriod();
      if (offset !== 0) {
        const startDate = new Date(weekPeriod.from);
        startDate.setDate(startDate.getDate() + (offset * 7));
        const { start, end } = getISOWeekBounds(startDate);
        return {
          from: start.toISOString().split('T')[0],
          to: end.toISOString().split('T')[0]
        };
      }
      return { from: weekPeriod.from, to: weekPeriod.to };
    }
    
    case 'this_month': {
      const monthPeriod = getCurrentMonthPeriod();
      if (offset !== 0) {
        const startDate = new Date(monthPeriod.from);
        startDate.setMonth(startDate.getMonth() + offset);
        startDate.setDate(1);
        const monthEnd = new Date(startDate);
        monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
        return {
          from: startDate.toISOString().split('T')[0],
          to: monthEnd.toISOString().split('T')[0]
        };
      }
      return { from: monthPeriod.from, to: monthPeriod.to };
    }
    
    case 'last_month': {
      const monthPeriod = getLastMonthPeriod();
      if (offset !== 0) {
        const startDate = new Date(monthPeriod.from);
        startDate.setMonth(startDate.getMonth() + offset);
        startDate.setDate(1);
        const monthEnd = new Date(startDate);
        monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
        return {
          from: startDate.toISOString().split('T')[0],
          to: monthEnd.toISOString().split('T')[0]
        };
      }
      return { from: monthPeriod.from, to: monthPeriod.to };
    }
    
    case 'last_7_days': {
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + offset); // offsetを適用
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6); // 7日間
      return {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      };
    }
    
    case 'last_30_days': {
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + offset);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 29); // 30日間
      return {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      };
    }
    
    default:
      return null;
  }
}

/**
 * サマリー比較計算
 */
function calculateSummaryComparison(current: SummaryItem, previous: SummaryItem) {
  return {
    duration: {
      current: current.metrics.totalDuration,
      previous: previous.metrics.totalDuration,
      change: current.metrics.totalDuration - previous.metrics.totalDuration,
      changePercent: previous.metrics.totalDuration > 0 
        ? Math.round(((current.metrics.totalDuration - previous.metrics.totalDuration) / previous.metrics.totalDuration) * 100)
        : null
    },
    participants: {
      current: current.metrics.totalParticipants,
      previous: previous.metrics.totalParticipants,
      change: current.metrics.totalParticipants - previous.metrics.totalParticipants,
      changePercent: previous.metrics.totalParticipants > 0
        ? Math.round(((current.metrics.totalParticipants - previous.metrics.totalParticipants) / previous.metrics.totalParticipants) * 100)
        : null
    },
    sessions: {
      current: current.metrics.totalSessions,
      previous: previous.metrics.totalSessions,
      change: current.metrics.totalSessions - previous.metrics.totalSessions,
      changePercent: previous.metrics.totalSessions > 0
        ? Math.round(((current.metrics.totalSessions - previous.metrics.totalSessions) / previous.metrics.totalSessions) * 100)
        : null
    }
  };
}
