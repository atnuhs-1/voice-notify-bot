// Phase 2.2.1: 期間キー生成関数
// 日本時間基準での正確な期間計算

import type { PeriodType } from '../types/database.js';

/**
 * 現在の期間キーを生成（日本時間基準）
 */
export function getCurrentPeriodKeys(baseTime?: Date) {
  const date = baseTime || new Date();
  // 日本時間に変換（JST UTC+9）
  const jstTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  
  return {
    currentWeek: getWeekKey(jstTime),
    currentMonth: getMonthKey(jstTime),
    currentYear: getYearKey(jstTime),
    statisticsDate: getStatisticsDate(jstTime)
  };
}

/**
 * 週キーを生成（ISO 8601 week numbering）
 * 例: '2025-W03'
 */
export function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const weekNumber = getISOWeek(date);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * 月キーを生成
 * 例: '2025-01'
 */
export function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * 年キーを生成
 * 例: '2025'
 */
export function getYearKey(date: Date): string {
  return String(date.getFullYear());
}

/**
 * 統計日付を生成（入室日基準）
 * 例: '2025-01-19'
 */
export function getStatisticsDate(date: Date): string {
  return date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

/**
 * ISO週番号を計算（月曜始まり）
 * ISO 8601 standard: 木曜日を含む週が年の第1週
 */
export function getISOWeek(date: Date): number {
  const tempDate = new Date(date.getTime());
  const dayOfWeek = (tempDate.getDay() + 6) % 7; // 月曜=0, 日曜=6
  tempDate.setDate(tempDate.getDate() - dayOfWeek + 3); // 木曜日に移動
  const firstThursday = tempDate.getTime();
  tempDate.setMonth(0, 1); // 1月1日
  if (tempDate.getDay() !== 4) {
    tempDate.setMonth(0, 1 + ((4 - tempDate.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - tempDate.getTime()) / 604800000); // 604800000 = 7 * 24 * 60 * 60 * 1000
}

/**
 * 前期間のキーを計算
 */
export function getPreviousPeriodKey(periodType: PeriodType, currentKey: string): string {
  switch (periodType) {
    case 'week': {
      const [year, week] = currentKey.split('-W');
      const weekNum = parseInt(week);
      if (weekNum === 1) {
        // 前年の最終週
        const prevYear = parseInt(year) - 1;
        const lastWeek = getWeeksInYear(prevYear);
        return `${prevYear}-W${String(lastWeek).padStart(2, '0')}`;
      } else {
        return `${year}-W${String(weekNum - 1).padStart(2, '0')}`;
      }
    }
    
    case 'month': {
      const [year, month] = currentKey.split('-');
      const monthNum = parseInt(month);
      if (monthNum === 1) {
        return `${parseInt(year) - 1}-12`;
      } else {
        return `${year}-${String(monthNum - 1).padStart(2, '0')}`;
      }
    }
    
    case 'year': {
      return String(parseInt(currentKey) - 1);
    }
    
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }
}

/**
 * 年の週数を取得（ISO 8601）
 */
function getWeeksInYear(year: number): number {
  const dec28 = new Date(year, 11, 28); // 12月28日
  return getISOWeek(dec28);
}

/**
 * 期間の開始日を取得
 */
export function getPeriodStart(periodType: PeriodType, periodKey: string): string {
  switch (periodType) {
    case 'week': {
      const [year, week] = periodKey.split('-W');
      const weekNum = parseInt(week);
      const jan4 = new Date(parseInt(year), 0, 4); // 1月4日（必ず第1週に含まれる）
      const weekStart = new Date(jan4);
      weekStart.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + (weekNum - 1) * 7);
      return weekStart.toISOString().split('T')[0];
    }
    
    case 'month': {
      const [year, month] = periodKey.split('-');
      return `${year}-${month}-01`;
    }
    
    case 'year': {
      return `${periodKey}-01-01`;
    }
    
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }
}

/**
 * 期間の終了日を取得
 */
export function getPeriodEnd(periodType: PeriodType, periodKey: string): string {
  switch (periodType) {
    case 'week': {
      const startDate = new Date(getPeriodStart(periodType, periodKey));
      startDate.setDate(startDate.getDate() + 6); // 6日後（日曜日）
      return startDate.toISOString().split('T')[0];
    }
    
    case 'month': {
      const [year, month] = periodKey.split('-');
      const nextMonth = new Date(parseInt(year), parseInt(month), 0); // 月の最終日
      return nextMonth.toISOString().split('T')[0];
    }
    
    case 'year': {
      return `${periodKey}-12-31`;
    }
    
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }
}

/**
 * 日跨ぎ処理: セッションが日を跨いでも入室日の統計として計上
 * 入室時刻基準でセッションを分類
 */
export function getSessionStatisticsDate(joinTime: string): string {
  const joinDate = new Date(joinTime);
  const jstDate = new Date(joinDate.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return getStatisticsDate(jstDate);
}

/**
 * 期間内かどうかを判定
 */
export function isWithinPeriod(date: string, periodType: PeriodType, periodKey: string): boolean {
  const checkDate = date.split('T')[0]; // 日付部分のみを比較
  const periodStart = getPeriodStart(periodType, periodKey);
  const periodEnd = getPeriodEnd(periodType, periodKey);
  
  return checkDate >= periodStart && checkDate <= periodEnd;
}