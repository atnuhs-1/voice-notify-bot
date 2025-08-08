import React from 'react';
import type { RankingData, MetricSelection } from '../../types/statistics';

interface RankingTableNormalProps {
  data: RankingData | null;
  metric: MetricSelection;
  loading: boolean;
  error: string | null;
  showComparison?: boolean;
  limit?: number;
}

const RankingTableNormal: React.FC<RankingTableNormalProps> = ({
  data,
  metric,
  loading,
  error,
  showComparison = true,
  limit = 10
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🏆 {metric.label}ランキング</h3>
        </div>
        <div className="p-10 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🏆 {metric.label}ランキング</h3>
        </div>
        <div className="p-10 text-center">
          <p className="text-red-600">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.rankings || data.rankings.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🏆 {metric.label}ランキング</h3>
        </div>
        <div className="p-10 text-center">
          <p className="text-gray-500">📊 この期間にはデータがありません</p>
        </div>
      </div>
    );
  }

  const displayedRankings = data.rankings.slice(0, limit);

  const formatValue = (value: number, metricType: string): string => {
    switch (metricType) {
      case 'duration':
        return `${Math.floor(value / 3600)}時間${Math.floor((value % 3600) / 60)}分`;
      case 'sessions':
      case 'started_sessions':
        return `${value}回`;
      default:
        return String(value);
    }
  };

  const getRankEmoji = (rank: number): string => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `${rank}.`;
    }
  };

  const getRankBorderClass = (rank: number): string => {
    switch (rank) {
      case 1: return 'border-l-4 border-yellow-400';
      case 2: return 'border-l-4 border-gray-300';
      case 3: return 'border-l-4 border-orange-400';
      default: return '';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-6 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">🏆 {metric.label}ランキング</h3>
        <div className="text-gray-600 text-sm">
          {data.period.from} 〜 {data.period.to}
          {showComparison && data.period.previous && (
            <div className="mt-1 text-xs text-gray-500">
              前期間: {data.period.previous.from} 〜 {data.period.previous.to} と比較
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {displayedRankings.map((item) => (
          <div 
            key={item.userId} 
            className={`flex items-center p-4 hover:bg-gray-50 transition-all duration-200 ${getRankBorderClass(item.rank)}`}
          >
            <div className="min-w-[40px] text-center">
              <span className="text-lg font-semibold text-blue-600">
                {getRankEmoji(item.rank)}
              </span>
            </div>
            
            <div className="flex items-center flex-1 ml-4">
              <div className="mr-3">
                {item.avatar ? (
                  <img 
                    src={`https://cdn.discordapp.com/avatars/${item.userId}/${item.avatar}.png?size=32`}
                    alt={item.username}
                    className="w-8 h-8 rounded-full border border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                    {item.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-gray-900 font-medium">{item.username}</div>
                <div className="text-gray-500 text-sm">
                  {item.sessionCount}回参加 • 最長{Math.floor((item.longestSession || 0) / 3600)}時間{Math.floor(((item.longestSession || 0) % 3600) / 60)}分
                </div>
              </div>
            </div>

            <div className="text-right min-w-[120px]">
              <div className="text-blue-600 text-lg font-semibold mb-1">
                {formatValue(item.value, metric.type)}
              </div>
              {showComparison && item.comparison && (
                <div className="text-xs">
                  {item.comparison.isNew ? (
                    <span className="text-green-600 font-semibold">🆕 NEW</span>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <span className={`${item.comparison.change > 0 ? 'text-green-600' : item.comparison.change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {item.comparison.change > 0 ? '↗' : item.comparison.change < 0 ? '↘' : '→'} {item.comparison.changePercentage}%
                      </span>
                      {item.comparison.rankChange !== null && (
                        <span className={`${item.comparison.rankChange > 0 ? 'text-green-600' : item.comparison.rankChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {item.comparison.rankChange > 0 ? `↑${item.comparison.rankChange}` : item.comparison.rankChange < 0 ? `↓${Math.abs(item.comparison.rankChange)}` : '='}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.rankings.length > limit && (
        <div className="p-4 text-center border-t border-gray-200">
          <p className="text-gray-500 text-sm">他 {data.rankings.length - limit} 人のユーザー</p>
        </div>
      )}
    </div>
  );
};

export default RankingTableNormal;