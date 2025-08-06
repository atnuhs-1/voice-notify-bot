import React from 'react';
import { formatDuration, formatNumber, formatChangePercentage } from '../../utils/date';
import type { RankingData, RankingItem, MetricSelection } from '../../types/statistics';

interface RankingTableProps {
  data: RankingData | null;
  metric: MetricSelection;
  loading: boolean;
  error: string | null;
  showComparison?: boolean;
  limit?: number;
  theme?: 'normal' | 'neon';
}

const RankingTable: React.FC<RankingTableProps> = ({
  data,
  metric,
  loading,
  error,
  showComparison = true,
  limit = 10,
  theme = 'neon'
}) => {
  
  // テーマに基づくスタイルクラス
  const getThemeClasses = () => {
    if (theme === 'normal') {
      return {
        container: 'bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm',
        header: 'p-6 bg-gray-50 border-b border-gray-200',
        headerTitle: 'text-lg font-semibold text-gray-900 mb-2',
        headerSubtitle: 'text-gray-600 text-sm',
        loadingText: 'text-gray-600',
        errorText: 'text-red-600',
        emptyText: 'text-gray-500',
        divider: 'divide-y divide-gray-100',
        itemContainer: 'flex items-center p-4 hover:bg-gray-50 transition-all duration-200',
        rankText: 'text-lg font-semibold text-blue-600',
        usernameText: 'text-gray-900 font-medium',
        subtitleText: 'text-gray-500 text-sm',
        valueText: 'text-blue-600 text-lg font-semibold mb-1'
      };
    } else {
      return {
        container: 'bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden',
        header: 'p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10',
        headerTitle: 'text-lg font-semibold text-white mb-2',
        headerSubtitle: 'text-white/70 text-sm',
        loadingText: 'text-white/70',
        errorText: 'text-red-400',
        emptyText: 'text-white/70',
        divider: 'divide-y divide-white/10',
        itemContainer: 'flex items-center p-4 hover:bg-white/5 transition-all duration-200',
        rankText: 'text-lg font-semibold text-blue-400',
        usernameText: 'text-white font-medium',
        subtitleText: 'text-white/60 text-sm',
        valueText: 'text-blue-400 text-lg font-semibold mb-1'
      };
    }
  };

  const themeClasses = getThemeClasses();
  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">🏆 {metric.label}ランキング</h3>
        </div>
        <div className="p-10 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white/70">データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">🏆 {metric.label}ランキング</h3>
        </div>
        <div className="p-10 text-center">
          <p className="text-red-400">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.rankings || data.rankings.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">🏆 {metric.label}ランキング</h3>
        </div>
        <div className="p-10 text-center">
          <p className="text-white/70">📊 この期間にはデータがありません</p>
        </div>
      </div>
    );
  }

  const displayedRankings = data.rankings.slice(0, limit);

  const formatValue = (value: number, metricType: string): string => {
    switch (metricType) {
      case 'duration':
        return formatDuration(value);
      case 'sessions':
      case 'started_sessions':
        return `${formatNumber(value)}回`;
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

  const getChangeIndicator = (comparison: RankingItem['comparison']) => {
    if (!comparison) return null;

    const { change, changePercentage, rankChange, isNew } = comparison;
    
    if (isNew) {
      return <span className="text-green-400 text-xs font-semibold">🆕 NEW</span>;
    }

    const changeIcon = change > 0 ? '↗' : change < 0 ? '↘' : '→';
    const changeColorClass = change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-white/60';
    const rankChangeColorClass = rankChange && rankChange > 0 ? 'text-green-400' : rankChange && rankChange < 0 ? 'text-red-400' : 'text-white/60';

    return (
      <div className="flex flex-col items-end gap-1">
        <span className={`text-xs ${changeColorClass}`}>
          {changeIcon} {formatChangePercentage(changePercentage)}
        </span>
        {rankChange !== null && (
          <span className={`text-xs ${rankChangeColorClass}`}>
            {rankChange > 0 ? `↑${rankChange}` : rankChange < 0 ? `↓${Math.abs(rankChange)}` : '='}
          </span>
        )}
      </div>
    );
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
    <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white mb-2">🏆 {metric.label}ランキング</h3>
        <div className="text-white/70 text-sm">
          {data.period.from} 〜 {data.period.to}
          {showComparison && data.period.previous && (
            <div className="mt-1 text-xs text-white/50 hidden sm:block">
              前期間: {data.period.previous.from} 〜 {data.period.previous.to} と比較
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-white/10">
        {displayedRankings.map((item) => (
          <div 
            key={item.userId} 
            className={`flex items-center p-4 hover:bg-white/5 transition-all duration-200 ${getRankBorderClass(item.rank)}`}
          >
            <div className="min-w-[40px] text-center">
              <span className="text-lg font-semibold text-blue-400">
                {getRankEmoji(item.rank)}
              </span>
            </div>
            
            <div className="flex items-center flex-1 ml-4">
              <div className="mr-3">
                {item.avatar ? (
                  <img 
                    src={`https://cdn.discordapp.com/avatars/${item.userId}/${item.avatar}.png?size=32`}
                    alt={item.username}
                    className="w-8 h-8 rounded-full border border-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                    {item.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-white font-medium">{item.username}</div>
                <div className="text-white/60 text-sm">
                  {item.sessionCount}回参加 • 最長{formatDuration(item.longestSession)}
                </div>
              </div>
            </div>

            <div className="text-right min-w-[120px]">
              <div className="text-blue-400 text-lg font-semibold mb-1">
                {formatValue(item.value, metric.type)}
              </div>
              {showComparison && item.comparison && (
                <div className="text-xs">
                  {getChangeIndicator(item.comparison)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.rankings.length > limit && (
        <div className="p-4 text-center border-t border-white/10">
          <p className="text-white/60 text-sm">他 {data.rankings.length - limit} 人のユーザー</p>
        </div>
      )}
    </div>
  );
};

export default RankingTable;