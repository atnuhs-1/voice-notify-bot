/**
 * 通話時間の計算
 * @param startTime 開始時刻（ISO文字列）
 * @param endTime 終了時刻（ISO文字列 | null）
 * @returns フォーマットされた時間文字列
 */
export const calculateDuration = (startTime: string, endTime: string | null): string => {
  if (!endTime) return '進行中';
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const remainingSeconds = seconds % 60;
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}時間${remainingMinutes}分`;
  } else if (minutes > 0) {
    return `${remainingMinutes}分${remainingSeconds}秒`;
  } else {
    return `${remainingSeconds}秒`;
  }
};

/**
 * 日時を日本時間でフォーマット
 * @param dateString ISO文字列（UTC想定）
 * @returns MM/dd HH:mm 形式の日本時間文字列
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 秒数を時間・分単位の文字列にフォーマット
 * @param seconds 秒数
 * @returns フォーマットされた時間文字列（例: "2時間30分", "15分", "45秒"）
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  } else if (minutes > 0) {
    return `${minutes}分`;
  } else {
    return `${seconds}秒`;
  }
};

/**
 * データベースのUTC時刻を日本時間でフォーマット（サマリー表示用）
 * @param utcTimeString UTC時刻文字列（タイムゾーン情報なしの場合もある）
 * @returns 日本語形式の日時文字列（例: "2025年1月15日 14:30"）
 */
export const formatDateTime = (utcTimeString: string): string => {
  // データベースから返される時刻はUTCで保存されている
  // タイムゾーン情報が付加されていない場合は、UTCとして解釈してJSTに変換
  let date: Date;
  
  if (utcTimeString.endsWith('Z') || utcTimeString.includes('+')) {
    // タイムゾーン情報がある場合はそのまま使用
    date = new Date(utcTimeString);
  } else {
    // タイムゾーン情報がない場合は、UTCとして解釈
    date = new Date(utcTimeString + 'Z');
  }
  
  // JST（Asia/Tokyo）で表示
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo'
  }).format(date);
};