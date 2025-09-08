// Phase 2.2.1: 期間キー生成関数
// 日本時間基準での正確な期間計算（UTC保存データベース対応）

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';

import type { PeriodType } from '../types/database';

// プラグイン初期化
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

// 日本時間のタイムゾーン定数
const JST_TIMEZONE = 'Asia/Tokyo';

/**
 * 日本時間でのdayjsインスタンスを生成
 */
function dayjsJST(date?: string | Date | dayjs.Dayjs) {
  if (date) {
    // UTC文字列またはDateオブジェクトを日本時間として解釈
    return dayjs.utc(date).tz(JST_TIMEZONE);
  }
  // 現在時刻を日本時間で取得
  return dayjs().tz(JST_TIMEZONE);
}

/**
 * UTC時刻を日本時間の日付文字列に変換
 */
function utcToJSTDate(utcTime: string | Date): string {
  return dayjsJST(utcTime).format('YYYY-MM-DD');
}

/**
 * 日本時間の日付を指定時刻のUTC文字列に変換
 */
function jstDateToUTC(jstDate: string, time: string = '00:00:00'): string {
  return dayjs.tz(`${jstDate} ${time}`, JST_TIMEZONE).utc().toISOString();
}

/**
 * 現在の期間キーを生成（日本時間基準）
 */
export function getCurrentPeriodKeys(baseTime?: Date | string) {
  const jstTime = baseTime ? dayjsJST(baseTime) : dayjsJST();
  
  return {
    currentWeek: getWeekKey(jstTime.toDate()),
    currentMonth: getMonthKey(jstTime.toDate()),
    currentYear: getYearKey(jstTime.toDate()),
    statisticsDate: getStatisticsDate(jstTime.toDate())
  };
}

/**
 * 週キーを生成（ISO 8601 week numbering）
 * 例: '2025-W03'
 */
export function getWeekKey(date: Date): string {
  const jstDate = dayjsJST(date);
  const weekYear = jstDate.isoWeekYear();
  const weekNumber = jstDate.isoWeek();
  return `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * 月キーを生成（日本時間基準）
 * 例: '2025-01'
 */
export function getMonthKey(date: Date): string {
  const jstDate = dayjsJST(date);
  return jstDate.format('YYYY-MM');
}

/**
 * 年キーを生成（日本時間基準）
 * 例: '2025'
 */
export function getYearKey(date: Date): string {
  const jstDate = dayjsJST(date);
  return jstDate.format('YYYY');
}

/**
 * 統計日付を生成（入室日基準・日本時間）
 * UTC時刻を日本時間の日付に変換
 * 例: '2025-01-19'
 */
export function getStatisticsDate(date: Date | string): string {
  return dayjsJST(date).format('YYYY-MM-DD');
}

/**
 * ISO週番号を計算（日本時間基準）
 */
export function getISOWeek(date: Date | string): number {
  return dayjsJST(date).isoWeek();
}

/**
 * 前期間のキーを計算
 */
export function getPreviousPeriodKey(periodType: PeriodType, currentKey: string): string {
  switch (periodType) {
    case 'week': {
      const [yearStr, weekStr] = currentKey.split('-W');
      const year = parseInt(yearStr);
      const week = parseInt(weekStr);
      
      if (week === 1) {
        // 前年の最終週
        const prevYear = year - 1;
        const lastWeek = getWeeksInYear(prevYear);
        return `${prevYear}-W${String(lastWeek).padStart(2, '0')}`;
      } else {
        return `${year}-W${String(week - 1).padStart(2, '0')}`;
      }
    }
    
    case 'month': {
      const currentMonth = dayjs(currentKey + '-01');
      const prevMonth = currentMonth.subtract(1, 'month');
      return prevMonth.format('YYYY-MM');
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
  // その年の12月28日の週番号が年の週数
  const dec28 = dayjsJST(`${year}-12-28`);
  return dec28.isoWeek();
}

/**
 * 指定期間がISO週の境界と完全に一致するかを判定
 * 例: 2025-08-11 ～ 2025-08-17 → true (Week 33)
 *     2025-08-10 ～ 2025-08-16 → false (複数週にまたがる)
 */
export function isISOWeekBoundary(from: string, to: string): boolean {
  const fromWeek = getCurrentPeriodKeys(from).currentWeek;
  const toWeek = getCurrentPeriodKeys(to).currentWeek;
  
  if (fromWeek !== toWeek) {
    return false; // 異なる週にまたがる
  }
  
  // 週の開始日・終了日と一致するかチェック
  const weekStart = getPeriodStart('week', fromWeek);
  const weekEnd = getPeriodEnd('week', fromWeek);
  
  return from === weekStart && to === weekEnd;
}

/**
 * 指定期間がISO月の境界と完全に一致するかを判定
 */
export function isISOMonthBoundary(from: string, to: string): boolean {
  const fromMonth = getCurrentPeriodKeys(from).currentMonth;
  const toMonth = getCurrentPeriodKeys(to).currentMonth;
  
  if (fromMonth !== toMonth) {
    return false;
  }
  
  const monthStart = getPeriodStart('month', fromMonth);
  const monthEnd = getPeriodEnd('month', fromMonth);
  
  return from === monthStart && to === monthEnd;
}

/**
 * 期間の開始日を取得（日本時間の日付）
 */
export function getPeriodStart(periodType: PeriodType, periodKey: string): string {
  switch (periodType) {
    case 'week': {
      const [yearStr, weekStr] = periodKey.split('-W');
      const year = parseInt(yearStr);
      const week = parseInt(weekStr);
      
      // ISO週の開始日（月曜日）を手動計算
      const jan4 = new Date(year, 0, 4); // 1月4日
      const jan4Day = jan4.getDay(); // 曜日 (0=日, 1=月, ...)

      // 1月4日の週の月曜日を求める
      const firstMondayOffset = jan4Day === 0 ? -6 : 1 - jan4Day;
      const firstMonday = new Date(jan4);
      firstMonday.setDate(jan4.getDate() + firstMondayOffset);

      // 目標週の月曜日を計算
      const targetMonday = new Date(firstMonday);
      targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);

      // 日本時間での日付文字列に変換
      const jstDate = dayjsJST(targetMonday);
      const weekStart = jstDate.format('YYYY-MM-DD');
      
      return weekStart
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
 * 期間の終了日を取得（日本時間の日付）
 */
export function getPeriodEnd(periodType: PeriodType, periodKey: string): string {
  switch (periodType) {
    case 'week': {
      const [yearStr, weekStr] = periodKey.split('-W');
      const year = parseInt(yearStr);
      const week = parseInt(weekStr);
      
      // ISO週の終了日（日曜日）を手動計算
      const jan4 = new Date(year, 0, 4); // 1月4日
      const jan4Day = jan4.getDay(); // 曜日 (0=日, 1=月, ...)
      
      // 1月4日の週の月曜日を求める
      const firstMondayOffset = jan4Day === 0 ? -6 : 1 - jan4Day;
      const firstMonday = new Date(jan4);
      firstMonday.setDate(jan4.getDate() + firstMondayOffset);
      
      // 目標週の日曜日を計算（月曜日 + 6日）
      const targetSunday = new Date(firstMonday);
      targetSunday.setDate(firstMonday.getDate() + (week - 1) * 7 + 6);
      
      // 日本時間での日付文字列に変換
      const jstDate = dayjsJST(targetSunday);
      return jstDate.format('YYYY-MM-DD');
    }
    
    case 'month': {
      const monthStart = dayjs(periodKey + '-01');
      const monthEnd = monthStart.endOf('month');
      return monthEnd.format('YYYY-MM-DD');
    }
    
    case 'year': {
      return `${periodKey}-12-31`;
    }
    
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }
}

/**
 * 期間の開始時刻をUTCで取得（データベース検索用）
 * 日本時間の日付の00:00:00をUTCに変換
 */
export function getPeriodStartUTC(periodType: PeriodType, periodKey: string): string {
  const jstDate = getPeriodStart(periodType, periodKey);
  return jstDateToUTC(jstDate, '00:00:00');
}

/**
 * 期間の終了時刻をUTCで取得（データベース検索用）
 * 日本時間の日付の23:59:59.999をUTCに変換
 */
export function getPeriodEndUTC(periodType: PeriodType, periodKey: string): string {
  const jstDate = getPeriodEnd(periodType, periodKey);
  return jstDateToUTC(jstDate, '23:59:59.999');
}

/**
 * 日跨ぎ処理: セッションが日を跨いでも入室日の統計として計上
 * UTC入室時刻を日本時間の日付に変換
 */
export function getSessionStatisticsDate(joinTimeUTC: string): string {
  return utcToJSTDate(joinTimeUTC);
}

/**
 * 期間内かどうかを判定（UTC時刻でチェック）
 */
export function isWithinPeriod(utcDateTime: string, periodType: PeriodType, periodKey: string): boolean {
  const periodStartUTC = getPeriodStartUTC(periodType, periodKey);
  const periodEndUTC = getPeriodEndUTC(periodType, periodKey);
  
  return utcDateTime >= periodStartUTC && utcDateTime <= periodEndUTC;
}

/**
 * UTC時刻が指定された日本時間の日付に含まれるかを判定
 */
export function isWithinJSTDate(utcDateTime: string, jstDate: string): boolean {
  const jstStart = jstDateToUTC(jstDate, '00:00:00');
  const jstEnd = jstDateToUTC(jstDate, '23:59:59.999');
  
  return utcDateTime >= jstStart && utcDateTime <= jstEnd;
}

/**
 * 期間キーの配列を生成（指定期間数分）
 * トレンド分析や複数期間の集計で使用
 */
export function generatePeriodKeys(periodType: PeriodType, baseKey: string, count: number, direction: 'past' | 'future' = 'past'): string[] {
  const keys: string[] = [];
  let currentKey = baseKey;
  
  for (let i = 0; i < count; i++) {
    keys.push(currentKey);
    
    if (direction === 'past') {
      currentKey = getPreviousPeriodKey(periodType, currentKey);
    } else {
      currentKey = getNextPeriodKey(periodType, currentKey);
    }
  }
  
  return direction === 'past' ? keys.reverse() : keys;
}

/**
 * 次期間のキーを計算
 */
export function getNextPeriodKey(periodType: PeriodType, currentKey: string): string {
  switch (periodType) {
    case 'week': {
      const [yearStr, weekStr] = currentKey.split('-W');
      const year = parseInt(yearStr);
      const week = parseInt(weekStr);
      const weeksInYear = getWeeksInYear(year);
      
      if (week === weeksInYear) {
        // 翌年の第1週
        return `${year + 1}-W01`;
      } else {
        return `${year}-W${String(week + 1).padStart(2, '0')}`;
      }
    }
    
    case 'month': {
      const currentMonth = dayjs(currentKey + '-01');
      const nextMonth = currentMonth.add(1, 'month');
      return nextMonth.format('YYYY-MM');
    }
    
    case 'year': {
      return String(parseInt(currentKey) + 1);
    }
    
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }
}

/**
 * デバッグ用: タイムゾーン情報を表示
 */
export function debugTimezoneInfo(date?: Date | string) {
  const now = date ? dayjsJST(date) : dayjsJST();
  
  return {
    input: date?.toString() || 'current time',
    jst: now.format('YYYY-MM-DD HH:mm:ss'),
    utc: now.utc().format('YYYY-MM-DD HH:mm:ss'),
    timezone: JST_TIMEZONE,
    offset: now.format('Z'),
    isoWeek: now.isoWeek(),
    weekYear: now.isoWeekYear(),
    periodKeys: getCurrentPeriodKeys(now.toDate())
  };
}