import type { PeriodSelection, PeriodType } from '../types/statistics';

/**
 * 期間計算に関するユーティリティ関数群
 */

// 現在の週期間を取得（月曜始まり）
export function getCurrentWeekPeriod(): PeriodSelection {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=日曜日
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    type: 'week',
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0],
  };
}

// 先週の期間を取得
export function getLastWeekPeriod(): PeriodSelection {
  const currentWeek = getCurrentWeekPeriod();
  const lastWeekStart = new Date(currentWeek.from);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  
  const lastWeekEnd = new Date(currentWeek.to);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
  
  return {
    type: 'week',
    from: lastWeekStart.toISOString().split('T')[0],
    to: lastWeekEnd.toISOString().split('T')[0],
  };
}

// 現在の月期間を取得
export function getCurrentMonthPeriod(): PeriodSelection {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return {
    type: 'month',
    from: firstDay.toISOString().split('T')[0],
    to: lastDay.toISOString().split('T')[0],
  };
}

// 先月の期間を取得
export function getLastMonthPeriod(): PeriodSelection {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  
  return {
    type: 'month',
    from: firstDay.toISOString().split('T')[0],
    to: lastDay.toISOString().split('T')[0],
  };
}

// 現在の年期間を取得
export function getCurrentYearPeriod(): PeriodSelection {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const lastDay = new Date(now.getFullYear(), 11, 31);
  
  return {
    type: 'year',
    from: firstDay.toISOString().split('T')[0],
    to: lastDay.toISOString().split('T')[0],
  };
}

// 過去N日の期間を取得
export function getLastNDaysPeriod(days: number): PeriodSelection {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - (days - 1));
  
  return {
    type: 'custom',
    from: startDate.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  };
}

// 過去7日の期間を取得
export function getLast7DaysPeriod(): PeriodSelection {
  return getLastNDaysPeriod(7);
}

// 過去30日の期間を取得
export function getLast30DaysPeriod(): PeriodSelection {
  return getLastNDaysPeriod(30);
}

// 指定した日付から期間を生成
export function getPeriodFromDate(date: Date, type: PeriodType): PeriodSelection {
  switch (type) {
    case 'week': {
      const dayOfWeek = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      return {
        type: 'week',
        from: monday.toISOString().split('T')[0],
        to: sunday.toISOString().split('T')[0],
      };
    }
    case 'month': {
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      return {
        type: 'month',
        from: firstDay.toISOString().split('T')[0],
        to: lastDay.toISOString().split('T')[0],
      };
    }
    case 'year': {
      const firstDay = new Date(date.getFullYear(), 0, 1);
      const lastDay = new Date(date.getFullYear(), 11, 31);
      
      return {
        type: 'year',
        from: firstDay.toISOString().split('T')[0],
        to: lastDay.toISOString().split('T')[0],
      };
    }
    default:
      return getCurrentWeekPeriod();
  }
}

// 相対期間の移動（前/次の期間）
export function getRelativePeriod(current: PeriodSelection, direction: 'previous' | 'next'): PeriodSelection {
  const multiplier = direction === 'previous' ? -1 : 1;
  const startDate = new Date(current.from);
  
  switch (current.type) {
    case 'week': {
      startDate.setDate(startDate.getDate() + (7 * multiplier));
      return getPeriodFromDate(startDate, 'week');
    }
    case 'month': {
      startDate.setMonth(startDate.getMonth() + multiplier);
      return getPeriodFromDate(startDate, 'month');
    }
    case 'year': {
      startDate.setFullYear(startDate.getFullYear() + multiplier);
      return getPeriodFromDate(startDate, 'year');
    }
    case 'custom': {
      // カスタム期間の場合は同じ日数分移動
      const days = Math.ceil((new Date(current.to).getTime() - new Date(current.from).getTime()) / (1000 * 60 * 60 * 24));
      const newStart = new Date(startDate);
      newStart.setDate(startDate.getDate() + (days * multiplier));
      
      const newEnd = new Date(newStart);
      newEnd.setDate(newStart.getDate() + days);
      
      return {
        type: 'custom',
        from: newStart.toISOString().split('T')[0],
        to: newEnd.toISOString().split('T')[0],
      };
    }
    default:
      return current;
  }
}

// デフォルト期間を取得
export function getDefaultPeriod(type: PeriodType | 'custom'): PeriodSelection {
  switch (type) {
    case 'week':
      return getCurrentWeekPeriod();
    case 'month':
      return getCurrentMonthPeriod();
    case 'year':
      return getCurrentYearPeriod();
    case 'custom':
      return getCurrentWeekPeriod(); // デフォルトは今週
    default:
      return getCurrentWeekPeriod();
  }
}

// 期間の日数を計算
export function getPeriodDays(period: PeriodSelection): number {
  const fromDate = new Date(period.from);
  const toDate = new Date(period.to);
  return Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// 週番号を取得
export function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.ceil(dayOfYear / 7);
}

// 期間が有効かチェック
export function isValidPeriod(period: PeriodSelection): boolean {
  const fromDate = new Date(period.from);
  const toDate = new Date(period.to);
  return fromDate <= toDate && !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime());
}

// デフォルトの週開始日と終了日を取得（useStatistics用）
export function getDefaultWeekStart(): string {
  return getCurrentWeekPeriod().from;
}

export function getDefaultWeekEnd(): string {
  return getCurrentWeekPeriod().to;
}