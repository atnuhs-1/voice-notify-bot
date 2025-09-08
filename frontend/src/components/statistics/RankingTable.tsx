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
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="p-6 bg-muted border-b border-border">
          <h3 className="text-lg font-semibold text-foreground mb-2">{metric.label}ランキング</h3>
        </div>
        <div className="p-10 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="p-6 bg-muted border-b border-border">
          <h3 className="text-lg font-semibold text-foreground mb-2">{metric.label}ランキング</h3>
        </div>
        <div className="p-10 text-center">
          <p className="text-red-600">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.rankings || data.rankings.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="p-6 bg-muted border-b border-border">
          <h3 className="text-lg font-semibold text-foreground mb-2">{metric.label}ランキング</h3>
        </div>
        <div className="p-10 text-center">
          <p className="text-muted-foreground">📊 この期間にはデータがありません</p>
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

  const getRankNumberColor = (rank: number): string => {
    switch (rank) {
      case 1: return 'text-yellow-600';
      case 2: return 'text-gray-500';
      case 3: return 'text-orange-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      <div className="p-6 bg-muted border-b border-border">
        <h3 className="text-lg font-semibold text-foreground mb-2">{metric.label}ランキング</h3>
        <div className="text-muted-foreground text-sm">
          {data.period.from} 〜 {data.period.to}
          {showComparison && data.period.previous && (
            <div className="mt-1 text-xs text-muted-foreground">
              前期間: {data.period.previous.from} 〜 {data.period.previous.to} と比較
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {displayedRankings.map((item) => (
          <div 
            key={item.userId} 
            className="flex items-center p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-[40px] text-center">
              <span className={`text-lg font-semibold ${getRankNumberColor(item.rank)}`}>
                {item.rank}
              </span>
            </div>
            
            <div className="flex items-center flex-1 ml-4">
              <div className="mr-3">
                {item.avatar ? (
                  <img 
                    src={`https://cdn.discordapp.com/avatars/${item.userId}/${item.avatar}.png?size=128`}
                    alt={item.username}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                    {item.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-foreground font-medium">{item.username}</div>
                <div className="text-muted-foreground text-sm">
                  {item.sessionCount}回参加
                </div>
              </div>
            </div>

            <div className="text-right min-w-[120px]">
              <div className="text-blue-600 text-lg font-semibold">
                {formatValue(item.value, metric.type)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.rankings.length > limit && (
        <div className="p-4 text-center border-t border-border">
          <p className="text-muted-foreground text-sm">他 {data.rankings.length - limit} 人のユーザー</p>
        </div>
      )}
    </div>
  );
};

export default RankingTableNormal;