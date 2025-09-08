import type { PeriodSelection, PeriodType } from '../types/statistics';
import dayjs from 'dayjs';
import ja from 'dayjs/locale/ja';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// プラグイン拡張
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.locale(ja);

// 日本時間のタイムゾーン定数
const JST_TIMEZONE = 'Asia/Tokyo';

/**
 * 日本時間でのdayjsインスタンスを生成
 */
function dayjsJST(date?: string | Date | dayjs.Dayjs) {
  return dayjs(date).tz(JST_TIMEZONE);
}

/**
 * 現在の日本時間を取得
 */
function nowJST() {
  return dayjs().tz(JST_TIMEZONE);
}

/**
 * 期間計算に関するユーティリティ関数群（日本時間統一版）
 */

// ISO 8601 週の開始日と終了日を取得（日本時間）
export function getISOWeekBounds(date: Date): { start: Date; end: Date } {    
  // 日本時間でISO週の境界を計算
  const jstDate = dayjsJST(date);
  const start = jstDate.startOf("isoWeek").toDate(); // 月曜日の00:00 JST
  const end = jstDate.endOf("isoWeek").toDate();     // 日曜日の23:59:59.999 JST
  
  return { start, end };
}

// 現在の週期間を取得（日本時間基準）
export function getCurrentWeekPeriod(): PeriodSelection {
  const now = nowJST().toDate();
  const { start, end } = getISOWeekBounds(now);
  
  return {
    type: 'week',
    from: dayjsJST(start).format('YYYY-MM-DD'),
    to: dayjsJST(end).format('YYYY-MM-DD'),
  };
}

// 先週の期間を取得（日本時間）
export function getLastWeekPeriod(): PeriodSelection {
  const lastWeek = nowJST().subtract(1, 'week').toDate();
  const { start, end } = getISOWeekBounds(lastWeek);
  
  return {
    type: 'week',
    from: dayjsJST(start).format('YYYY-MM-DD'),
    to: dayjsJST(end).format('YYYY-MM-DD'),
  };
}

// 現在の月期間を取得（日本時間）
export function getCurrentMonthPeriod(): PeriodSelection {
  const now = nowJST();
  const firstDay = now.startOf('month');
  const lastDay = now.endOf('month');
  
  return {
    type: 'month',
    from: firstDay.format('YYYY-MM-DD'),
    to: lastDay.format('YYYY-MM-DD'),
  };
}

// 先月の期間を取得（日本時間）
export function getLastMonthPeriod(): PeriodSelection {
  const lastMonth = nowJST().subtract(1, 'month');
  const firstDay = lastMonth.startOf('month');
  const lastDay = lastMonth.endOf('month');
  
  return {
    type: 'month',
    from: firstDay.format('YYYY-MM-DD'),
    to: lastDay.format('YYYY-MM-DD'),
  };
}

// 現在の年期間を取得（日本時間）
export function getCurrentYearPeriod(): PeriodSelection {
  const now = nowJST();
  const firstDay = now.startOf('year');
  const lastDay = now.endOf('year');
  
  return {
    type: 'year',
    from: firstDay.format('YYYY-MM-DD'),
    to: lastDay.format('YYYY-MM-DD'),
  };
}

// 過去N日の期間を取得（日本時間）
export function getLastNDaysPeriod(days: number): PeriodSelection {
  const now = nowJST();
  const startDate = now.subtract(days - 1, 'day');
  
  return {
    type: 'custom',
    from: startDate.format('YYYY-MM-DD'),
    to: now.format('YYYY-MM-DD'),
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

// 指定した日付から期間を生成（日本時間）
export function getPeriodFromDate(date: Date, type: PeriodType): PeriodSelection {
  const jstDate = dayjsJST(date);
  
  switch (type) {
    case 'week': {
      const { start, end } = getISOWeekBounds(date);
      return {
        type: 'week',
        from: dayjsJST(start).format('YYYY-MM-DD'),
        to: dayjsJST(end).format('YYYY-MM-DD'),
      };
    }
    case 'month': {
      const firstDay = jstDate.startOf('month');
      const lastDay = jstDate.endOf('month');
      
      return {
        type: 'month',
        from: firstDay.format('YYYY-MM-DD'),
        to: lastDay.format('YYYY-MM-DD'),
      };
    }
    case 'year': {
      const firstDay = jstDate.startOf('year');
      const lastDay = jstDate.endOf('year');
      
      return {
        type: 'year',
        from: firstDay.format('YYYY-MM-DD'),
        to: lastDay.format('YYYY-MM-DD'),
      };
    }
    default:
      return getCurrentWeekPeriod();
  }
}

// 相対期間の移動（前/次の期間）- 日本時間版
export function getRelativePeriod(current: PeriodSelection, direction: 'previous' | 'next'): PeriodSelection {
  const multiplier = direction === 'previous' ? -1 : 1;
  const startDate = dayjsJST(current.from);
  
  switch (current.type) {
    case 'week': {
      const newDate = startDate.add(7 * multiplier, 'day');
      return getPeriodFromDate(newDate.toDate(), 'week');
    }
    case 'month': {
      const newDate = startDate.add(multiplier, 'month');
      return getPeriodFromDate(newDate.toDate(), 'month');
    }
    case 'year': {
      const newDate = startDate.add(multiplier, 'year');
      return getPeriodFromDate(newDate.toDate(), 'year');
    }
    case 'custom': {
      // カスタム期間の場合は同じ日数分移動
      const toDate = dayjsJST(current.to);
      const days = toDate.diff(startDate, 'day') + 1;
      
      const newStart = startDate.add(days * multiplier, 'day');
      const newEnd = newStart.add(days - 1, 'day');
      
      return {
        type: 'custom',
        from: newStart.format('YYYY-MM-DD'),
        to: newEnd.format('YYYY-MM-DD'),
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

// 期間の日数を計算（日本時間）
export function getPeriodDays(period: PeriodSelection): number {
  const fromDate = dayjsJST(period.from);
  const toDate = dayjsJST(period.to);
  return toDate.diff(fromDate, 'day') + 1;
}

// ISO週番号を取得（日本時間）
export function getISOWeek(date: Date): number {
  return dayjsJST(date).isoWeek();
}

// 週番号を取得（年内通し番号）
export function getWeekNumber(date: Date): number {
  return dayjsJST(date).week();
}

// 期間が有効かチェック
export function isValidPeriod(period: PeriodSelection): boolean {
  const fromDate = dayjsJST(period.from);
  const toDate = dayjsJST(period.to);
  return fromDate.isValid() && toDate.isValid() && (fromDate.isBefore(toDate) || fromDate.isSame(toDate, 'day'));
}

// デフォルトの週開始日と終了日を取得
export function getDefaultWeekStart(): string {
  return getCurrentWeekPeriod().from;
}

export function getDefaultWeekEnd(): string {
  return getCurrentWeekPeriod().to;
}

// タイムゾーン情報を取得
export function getTimezoneInfo() {
  const now = nowJST();
  return {
    timezone: JST_TIMEZONE,
    offset: now.format('Z'),
    current: now.format('YYYY-MM-DD HH:mm:ss'),
    isoWeek: now.isoWeek(),
    weekYear: now.isoWeekYear()
  };
}