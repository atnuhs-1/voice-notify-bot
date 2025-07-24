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