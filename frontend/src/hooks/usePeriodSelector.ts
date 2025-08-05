import { useState, useCallback, useMemo } from 'react';
import type { PeriodSelection, PeriodPreset, PeriodType } from '../types/statistics';
import {
  getDefaultPeriod,
  getCurrentWeekPeriod,
  getLastWeekPeriod,
  getCurrentMonthPeriod,
  getLastMonthPeriod,
  getCurrentYearPeriod,
  getLast7DaysPeriod,
  getLast30DaysPeriod,
  getPeriodFromDate,
  getRelativePeriod,
  getPeriodDays,
  getWeekNumber,
} from '../utils/period';
import {
  formatPeriod,
  validatePeriod as validatePeriodInternal,
  isValidDateRange,
  formatDate,
} from '../utils/date';

interface UsePeriodSelectorOptions {
  defaultType?: PeriodType | 'custom';
  onPeriodChange?: (period: PeriodSelection) => void;
}

export const usePeriodSelector = (options: UsePeriodSelectorOptions = {}) => {
  const { defaultType = 'week', onPeriodChange } = options;

  // 現在選択されている期間
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(() => {
    return getDefaultPeriod(defaultType);
  });

  // カスタム期間選択時の一時的な値
  const [customFrom, setCustomFrom] = useState<string>(selectedPeriod.from);
  const [customTo, setCustomTo] = useState<string>(selectedPeriod.to);

  // 期間プリセット一覧
  const presets = useMemo<PeriodPreset[]>(() => [
    {
      label: '今週',
      value: getCurrentWeekPeriod(),
      isDefault: true,
    },
    {
      label: '先週',
      value: getLastWeekPeriod(),
    },
    {
      label: '今月',
      value: getCurrentMonthPeriod(),
    },
    {
      label: '先月',
      value: getLastMonthPeriod(),
    },
    {
      label: '今年',
      value: getCurrentYearPeriod(),
    },
    {
      label: '過去7日',
      value: getLast7DaysPeriod(),
    },
    {
      label: '過去30日',
      value: getLast30DaysPeriod(),
    },
  ], []);

  // 期間選択の更新
  const updatePeriod = useCallback((period: PeriodSelection) => {
    setSelectedPeriod(period);
    setCustomFrom(period.from);
    setCustomTo(period.to);
    onPeriodChange?.(period);
  }, [onPeriodChange]);

  // プリセット選択
  const selectPreset = useCallback((preset: PeriodPreset) => {
    updatePeriod(preset.value);
  }, [updatePeriod]);

  // カスタム期間の適用
  const applyCustomPeriod = useCallback(() => {
    if (!isValidDateRange(customFrom, customTo)) {
      throw new Error('無効な日付範囲です');
    }

    const customPeriod: PeriodSelection = {
      type: 'custom',
      from: customFrom,
      to: customTo,
    };
    
    updatePeriod(customPeriod);
  }, [customFrom, customTo, updatePeriod]);

  // 相対期間移動（前の期間・次の期間）
  const navigatePeriod = useCallback((direction: 'previous' | 'next') => {
    const newPeriod = getRelativePeriod(selectedPeriod, direction);
    updatePeriod(newPeriod);
  }, [selectedPeriod, updatePeriod]);

  // 期間タイプ変更（同じ開始日を維持）
  const changePeriodType = useCallback((type: PeriodType | 'custom') => {
    if (type === 'custom') {
      // カスタム期間に変更
      updatePeriod({
        type: 'custom',
        from: selectedPeriod.from,
        to: selectedPeriod.to,
      });
    } else {
      // 指定のタイプの期間に変更（現在の開始日を基準）
      const newPeriod = getPeriodFromDate(new Date(selectedPeriod.from), type);
      updatePeriod(newPeriod);
    }
  }, [selectedPeriod, updatePeriod]);

  // 今日にリセット
  const resetToToday = useCallback(() => {
    const todayPeriod = getCurrentWeekPeriod();
    updatePeriod(todayPeriod);
  }, [updatePeriod]);

  // 期間の表示用フォーマット
  const formatPeriod = useCallback((period: PeriodSelection): string => {
    const fromDate = new Date(period.from);
    const toDate = new Date(period.to);
    
    if (period.type === 'custom') {
      return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
    }
    
    switch (period.type) {
      case 'week': {
        const year = fromDate.getFullYear();
        const weekNum = getWeekNumber(fromDate);
        return `${year}年 第${weekNum}週 (${formatDate(fromDate)} - ${formatDate(toDate)})`;
      }
      case 'month': {
        return `${fromDate.getFullYear()}年${fromDate.getMonth() + 1}月`;
      }
      case 'year': {
        return `${fromDate.getFullYear()}年`;
      }
      default:
        return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
    }
  }, []);

  // 期間の日数計算
  const getPeriodDays = useCallback((period: PeriodSelection): number => {
    const fromDate = new Date(period.from);
    const toDate = new Date(period.to);
    return Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, []);

  // バリデーション関数
  const validatePeriod = useCallback((period: PeriodSelection): { isValid: boolean; error?: string } => {
    return validatePeriodInternal(period);
  }, []);

  return {
    // 現在の状態
    selectedPeriod,
    customFrom,
    customTo,
    presets,
    
    // アクション
    updatePeriod,
    selectPreset,
    applyCustomPeriod,
    navigatePeriod,
    changePeriodType,
    resetToToday,
    
    // カスタム期間の更新
    setCustomFrom,
    setCustomTo,
    
    // ユーティリティ
    formatPeriod,
    getPeriodDays,
    validatePeriod,
    
    // 状態チェック
    isCustomPeriod: selectedPeriod.type === 'custom',
    canNavigatePrevious: true, // 過去への移動は常に可能
    canNavigateNext: new Date(selectedPeriod.to) < new Date(), // 未来への移動は制限
  };
};