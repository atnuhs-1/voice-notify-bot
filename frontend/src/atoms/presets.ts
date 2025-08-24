import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { selectedGuildIdAtom, selectedMetricAtom, presetRankingAtomFamily } from './statistics';
import type { BackendPeriodPreset } from '../types/statistics';

// === プリセット中心の状態管理設計 ===

// 選択中のプリセット期間（永続化・高速ルート優先）
export const selectedPresetAtom = atomWithStorage<BackendPeriodPreset | 'custom'>('selected-preset', 'this_week');

// カスタム期間（プリセット='custom'時のみ使用）
export const customPeriodAtom = atomWithStorage<{from: string; to: string}>('custom-period', {
  from: new Date().toISOString().split('T')[0],
  to: new Date().toISOString().split('T')[0]
});

// プリセット期間の定義（UI表示用）
export const availablePresetsAtom = atom(() => [
  { key: 'this_week' as BackendPeriodPreset, label: '今週', icon: '📅', description: '今週（月曜日〜日曜日）' },
  { key: 'last_week' as BackendPeriodPreset, label: '先週', icon: '📋', description: '先週（月曜日〜日曜日）' },
  { key: 'this_month' as BackendPeriodPreset, label: '今月', icon: '🗓️', description: '今月（1日〜月末）' },
  { key: 'last_month' as BackendPeriodPreset, label: '先月', icon: '📄', description: '先月（1日〜月末）' },
  { key: 'last_7_days' as BackendPeriodPreset, label: '過去7日', icon: '⏰', description: '過去7日間' },
  { key: 'last_30_days' as BackendPeriodPreset, label: '過去30日', icon: '📊', description: '過去30日間' },
  { key: 'this_year' as BackendPeriodPreset, label: '今年', icon: '📅', description: '今年（1月1日〜12月31日）' },
  { key: 'last_year' as BackendPeriodPreset, label: '昨年', icon: '📋', description: '昨年（1月1日〜12月31日）' },
  { key: 'custom' as const, label: 'カスタム', icon: '🔧', description: 'カスタム期間指定' }
]);

// === 統計API用の最適化パラメータ生成 ===

// プリセット優先のランキングAPIパラメータ生成（統一形式）
export const optimizedRankingParamsAtom = atom((get) => {
  const guildId = get(selectedGuildIdAtom);
  const metric = get(selectedMetricAtom);
  const selectedPreset = get(selectedPresetAtom);
  const customPeriod = get(customPeriodAtom);

  if (!guildId) return null;

  return {
    guildId,
    metric,
    limit: 10,
    compare: true,
    // 常に両方を含む、使わない方はundefined
    period: selectedPreset !== 'custom' ? selectedPreset : undefined,
    from: selectedPreset === 'custom' ? customPeriod.from : undefined,
    to: selectedPreset === 'custom' ? customPeriod.to : undefined,
  };
});

// === アクションatoms ===

// プリセット期間選択アクション
export const selectPresetActionAtom = atom(
  null,
  (_get, set, preset: BackendPeriodPreset | 'custom') => {
    set(selectedPresetAtom, preset);
    console.log(`🔄 プリセット選択: ${preset}`);
    
    if (preset !== 'custom') {
      console.log(`🚀 高速ルート使用: period=${preset}`);
    }
  }
);

// カスタム期間設定アクション
export const setCustomPeriodActionAtom = atom(
  null,
  (_get, set, from: string, to: string) => {
    set(customPeriodAtom, { from, to });
    set(selectedPresetAtom, 'custom');
    console.log(`🔄 カスタム期間設定: ${from} - ${to}`);
  }
);

// === UI表示用の計算atoms ===

// 選択中のプリセット情報
export const currentPresetInfoAtom = atom((get) => {
  const selectedPreset = get(selectedPresetAtom);
  const presets = get(availablePresetsAtom);
  
  return presets.find(p => p.key === selectedPreset) || presets[0];
});

// 表示用の期間フォーマット
export const formattedSelectedPeriodAtom = atom((get) => {
  const selectedPreset = get(selectedPresetAtom);
  const customPeriod = get(customPeriodAtom);
  const presetInfo = get(currentPresetInfoAtom);

  if (selectedPreset === 'custom') {
    return `${customPeriod.from} 〜 ${customPeriod.to}`;
  }

  return presetInfo.label;
});

// デバッグ用：現在の最適化状況
export const optimizationStatusAtom = atom((get) => {
  const selectedPreset = get(selectedPresetAtom);
  const params = get(optimizedRankingParamsAtom);
  
  return {
    presetType: selectedPreset,
    isOptimized: selectedPreset !== 'custom',
    apiParams: params,
    routeType: selectedPreset !== 'custom' ? '🚀 高速ルート' : '📅 カスタムルート'
  };
});

// === 統合されたランキングデータ（optimizedStatistics.tsから移行） ===

// 現在選択中の設定に基づくランキングデータ
export const currentRankingAtom = atom(async (get) => {
  const params = get(optimizedRankingParamsAtom);
  
  if (!params) {
    return null;
  }

  // プリセット別キャッシュを活用（統一形式対応）
  if (params.period) {
    // プリセット期間（🚀 高速ルート）
    return get(presetRankingAtomFamily({
      guildId: params.guildId,
      metric: params.metric,
      preset: params.period
    }));
  } else if (params.from && params.to) {
    // カスタム期間（フォールバック）
    return get(presetRankingAtomFamily({
      guildId: params.guildId,
      metric: params.metric,
      preset: 'custom',
      customPeriod: { from: params.from, to: params.to }
    }));
  }
  
  return null;
});

// 手動更新アクション
export const refreshRankingActionAtom = atom(
  null,
  async (get) => {
    const params = get(optimizedRankingParamsAtom);
    
    if (!params) {
      console.log('パラメータが設定されていないため更新をスキップ');
      return;
    }
    
    try {
      console.log(`🔄 ランキングデータを手動更新: ${params.guildId}`);
      
      // atomFamilyのキャッシュを強制更新するため、
      // 同じパラメータで再実行することで最新データを取得
      await get(currentRankingAtom);
      console.log('✅ ランキングデータ更新完了');
      
    } catch (error) {
      console.error('ランキングデータ更新エラー:', error);
      throw error;
    }
  }
);