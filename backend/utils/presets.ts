// プリセット期間計算関数
// ハイブリッドAPI設計での期間プリセット対応

export type PeriodPreset = 
  | 'this_week' 
  | 'last_week' 
  | 'this_month' 
  | 'last_month' 
  | 'last_7_days' 
  | 'last_30_days' 
  | 'this_year' 
  | 'last_year';

export interface PeriodResult {
  from: string;
  to: string;
  type: 'week' | 'month' | 'year' | 'custom';
  isISOBoundary: boolean;
}

/**
 * プリセット期間を実際の日付範囲に変換
 * バックエンドで正確なISO境界計算を実行
 */
export function calculatePresetPeriod(preset: PeriodPreset): PeriodResult {
  const now = new Date();
  
  switch (preset) {
    case 'this_week': {
      // 今週のISO境界（確実に高速ルート）
      const { start, end } = getISOWeekBounds(now);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
        type: 'week',
        isISOBoundary: true
      };
    }
    
    case 'last_week': {
      // 先週のISO境界（確実に高速ルート）
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      const { start, end } = getISOWeekBounds(lastWeek);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
        type: 'week',
        isISOBoundary: true
      };
    }
    
    case 'this_month': {
      // 今月のISO境界（高速ルート）
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
        type: 'month',
        isISOBoundary: true
      };
    }
    
    case 'last_month': {
      // 先月のISO境界（高速ルート）
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
        type: 'month',
        isISOBoundary: true
      };
    }
    
    case 'last_7_days': {
      // 過去7日間（相対期間・カスタムルート）
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const start = new Date(now);
      start.setDate(now.getDate() - 6); // 今日を含む7日間
      start.setHours(0, 0, 0, 0);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
        type: 'custom',
        isISOBoundary: false
      };
    }
    
    case 'last_30_days': {
      // 過去30日間（相対期間・カスタムルート）
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const start = new Date(now);
      start.setDate(now.getDate() - 29); // 今日を含む30日間
      start.setHours(0, 0, 0, 0);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
        type: 'custom',
        isISOBoundary: false
      };
    }
    
    case 'this_year': {
      // 今年のISO境界（高速ルート）
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
        type: 'year',
        isISOBoundary: true
      };
    }
    
    case 'last_year': {
      // 去年のISO境界（高速ルート）
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      end.setHours(23, 59, 59, 999);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
        type: 'year',
        isISOBoundary: true
      };
    }
    
    default: {
      // 未知のプリセットはデフォルトで今週
      const { start, end } = getISOWeekBounds(now);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
        type: 'week',
        isISOBoundary: true
      };
    }
  }
}

/**
 * ISO 8601 週の開始日と終了日を取得
 * バックエンド専用の正確な境界計算
 */
function getISOWeekBounds(date: Date): { start: Date; end: Date } {
  const tempDate = new Date(date.getTime());
  const dayOfWeek = (tempDate.getDay() + 6) % 7; // 月曜=0, 日曜=6
  
  // 週の開始日（月曜日）
  const start = new Date(tempDate);
  start.setDate(tempDate.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  
  // 週の終了日（日曜日）
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * プリセット期間の説明文を取得
 */
export function getPresetDescription(preset: PeriodPreset): string {
  switch (preset) {
    case 'this_week': return '今週（月曜日〜日曜日）';
    case 'last_week': return '先週（月曜日〜日曜日）';
    case 'this_month': return '今月（1日〜月末）';
    case 'last_month': return '先月（1日〜月末）';
    case 'last_7_days': return '過去7日間（今日から7日前）';
    case 'last_30_days': return '過去30日間（今日から30日前）';
    case 'this_year': return '今年（1月1日〜12月31日）';
    case 'last_year': return '去年（1月1日〜12月31日）';
    default: return '不明な期間';
  }
}

/**
 * プリセット期間の有効性をチェック
 */
export function isValidPreset(preset: string): preset is PeriodPreset {
  const validPresets: PeriodPreset[] = [
    'this_week', 'last_week', 'this_month', 'last_month',
    'last_7_days', 'last_30_days', 'this_year', 'last_year'
  ];
  return validPresets.includes(preset as PeriodPreset);
}