
import type { PeriodSelection } from '../types/statistics';
import { getWeekNumber } from './period';

/**
 * 日付フォーマット・バリデーションに関するユーティリティ関数群
 */

// 日付を日本語形式でフォーマット
export function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 日付を短縮形式でフォーマット（MM/DD）
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
  });
}

// 日時を詳細形式でフォーマット
export function formatDateTime(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 時刻のみをフォーマット（Date またはISO文字列）
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 期間を表示用にフォーマット
export function formatPeriod(period: PeriodSelection): string {
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
}

// 期間を短縮形式でフォーマット
export function formatPeriodShort(period: PeriodSelection): string {
  const fromDate = new Date(period.from);
  const toDate = new Date(period.to);
  
  switch (period.type) {
    case 'week': {
      const weekNum = getWeekNumber(fromDate);
      return `第${weekNum}週`;
    }
    case 'month': {
      return `${fromDate.getMonth() + 1}月`;
    }
    case 'year': {
      return `${fromDate.getFullYear()}年`;
    }
    case 'custom': {
      return `${formatDateShort(fromDate)}-${formatDateShort(toDate)}`;
    }
    default:
      return formatDate(fromDate);
  }
}

// 日付範囲の妥当性をチェック
export function isValidDateRange(from: string, to: string): boolean {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return fromDate <= toDate && !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime());
}

// 日付文字列の妥当性をチェック
export function isValidDateString(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// 未来の日付かどうかをチェック
export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date > new Date();
}

// 日付の差を日数で計算
export function getDaysDifference(from: string, to: string): number {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
}

// 相対的な日付表示（今日、昨日、N日前）（Date またはISO文字列）
export function formatRelativeDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return '今日';
  } else if (diffDays === -1) {
    return '昨日';
  } else if (diffDays === 1) {
    return '明日';
  } else if (diffDays > 1 && diffDays <= 7) {
    return `${diffDays}日後`;
  } else if (diffDays < -1 && diffDays >= -7) {
    return `${Math.abs(diffDays)}日前`;
  } else {
    return formatDate(dateObj);
  }
}

// 時間の長さをフォーマット（秒 → 時間分秒）
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0秒';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return minutes > 0 
      ? `${hours}時間${minutes}分`
      : `${hours}時間`;
  } else if (minutes > 0) {
    return remainingSeconds > 0
      ? `${minutes}分${remainingSeconds}秒`
      : `${minutes}分`;
  } else {
    return `${remainingSeconds}秒`;
  }
}

// 時間の長さを短縮形式でフォーマット
export function formatDurationShort(seconds: number): string {
  if (seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// ISO日付文字列をローカル日付文字列に変換
export function isoToLocalDate(isoString: string): string {
  return new Date(isoString).toISOString().split('T')[0];
}

// ローカル日付文字列をISO文字列に変換
export function localDateToIso(localDate: string, time: string = '00:00:00'): string {
  return new Date(`${localDate}T${time}.000Z`).toISOString();
}

// 今日の日付を YYYY-MM-DD 形式で取得
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// 昨日の日付を YYYY-MM-DD 形式で取得
export function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

// 数値を3桁区切りでフォーマット
export function formatNumber(num: number): string {
  return num.toLocaleString('ja-JP');
}

// パーセンテージ変化をフォーマット
export function formatChangePercentage(percentage: number): string {
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}


// 期間の妥当性を詳細にバリデート
export function validatePeriod(period: PeriodSelection): { isValid: boolean; error?: string } {
  if (!isValidDateRange(period.from, period.to)) {
    return { isValid: false, error: '開始日は終了日より前である必要があります' };
  }

  const days = getDaysDifference(period.from, period.to) + 1;
  if (days > 365) {
    return { isValid: false, error: '期間は365日以内で選択してください' };
  }

  if (isFutureDate(period.to)) {
    return { isValid: false, error: '未来の日付は選択できません' };
  }

  // 過去3年以内の制限
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  if (new Date(period.from) < threeYearsAgo) {
    return { isValid: false, error: '3年以上前のデータは選択できません' };
  }

  return { isValid: true };
}