// バリデーション関数
// 統計API用のデータ検証とエラーハンドリング

/**
 * メトリクス値の検証
 */
export function validateMetric(metric: string): metric is 'duration' | 'sessions' | 'started_sessions' {
  return ['duration', 'sessions', 'started_sessions'].includes(metric);
}

/**
 * 日付範囲の検証
 */
export function validateDateRange(from: string, to: string): { isValid: boolean; error?: string } {
  // 日付形式の検証（YYYY-MM-DD または ISO datetime）
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  
  const fromValid = dateRegex.test(from) || datetimeRegex.test(from);
  const toValid = dateRegex.test(to) || datetimeRegex.test(to);
  
  if (!fromValid) {
    return { isValid: false, error: 'from パラメータの日付形式が無効です（YYYY-MM-DD または ISO datetime）' };
  }
  
  if (!toValid) {
    return { isValid: false, error: 'to パラメータの日付形式が無効です（YYYY-MM-DD または ISO datetime）' };
  }
  
  // 日付の論理的検証
  const fromDate = new Date(from);
  const toDate = new Date(to);
  
  if (isNaN(fromDate.getTime())) {
    return { isValid: false, error: 'from パラメータが無効な日付です' };
  }
  
  if (isNaN(toDate.getTime())) {
    return { isValid: false, error: 'to パラメータが無効な日付です' };
  }
  
  if (fromDate >= toDate) {
    return { isValid: false, error: 'from は to より前の日付である必要があります' };
  }
  
  // 範囲制限（1年以内）
  const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 365) {
    return { isValid: false, error: '期間は1年以内で指定してください' };
  }
  
  return { isValid: true };
}

/**
 * サマリータイプの検証
 */
export function validateSummaryType(type: string): type is 'daily' | 'weekly' | 'monthly' {
  return ['daily', 'weekly', 'monthly'].includes(type);
}

/**
 * ページネーション値の検証
 */
export function validatePagination(limit?: number, offset?: number): { limit: number; offset: number } {
  const validLimit = Math.min(Math.max(limit || 30, 1), 100);
  const validOffset = Math.max(offset || 0, 0);
  
  return { limit: validLimit, offset: validOffset };
}

/**
 * サーバーIDの検証（Discord Snowflake）
 */
export function validateGuildId(guildId: string): boolean {
  // Discord Snowflake: 17-19桁の数字
  const snowflakeRegex = /^\d{17,19}$/;
  return snowflakeRegex.test(guildId);
}

/**
 * ユーザーIDの検証（Discord Snowflake）
 */
export function validateUserId(userId: string): boolean {
  const snowflakeRegex = /^\d{17,19}$/;
  return snowflakeRegex.test(userId);
}

/**
 * チャンネルIDの検証（Discord Snowflake）
 */
export function validateChannelId(channelId: string): boolean {
  const snowflakeRegex = /^\d{17,19}$/;
  return snowflakeRegex.test(channelId);
}

/**
 * 時刻の検証（HH:mm形式）
 */
export function validateTime(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * タイムゾーンの検証
 */
export function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * 通知スケジュールタイプの検証
 */
export function validateScheduleType(type: string): type is 'daily' | 'weekly' | 'monthly' {
  return ['daily', 'weekly', 'monthly'].includes(type);
}

/**
 * 通知日の検証（週次・月次）
 */
export function validateNotificationDay(type: 'weekly' | 'monthly', day: number): boolean {
  if (type === 'weekly') {
    return day >= 1 && day <= 7; // 1=月曜, 7=日曜
  } else if (type === 'monthly') {
    return day >= 1 && day <= 28; // 月の1-28日
  }
  return false;
}

/**
 * 粒度の検証
 */
export function validateGranularity(granularity: string): granularity is 'daily' | 'weekly' | 'monthly' {
  return ['daily', 'weekly', 'monthly'].includes(granularity);
}