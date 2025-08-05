import React from 'react';
import { formatDuration, formatNumber, formatChangePercentage } from '../../utils/date';
import type { StatisticsSummary, StatCard } from '../../types/statistics';

interface StatsSummaryProps {
  data: StatisticsSummary | null;
  loading: boolean;
  error: string | null;
  showComparison?: boolean;
  comparisonData?: StatisticsSummary | null;
  periodLabel?: string;
}

const StatsSummary: React.FC<StatsSummaryProps> = ({
  data,
  loading,
  error,
  showComparison = false,
  comparisonData,
  periodLabel = '期間統計'
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-white/20 rounded mb-3"></div>
              <div className="h-8 bg-white/20 rounded mb-2"></div>
              <div className="h-3 bg-white/20 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
        <div className="text-center">
          <p className="text-red-400">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
        <div className="text-center">
          <p className="text-white/70">📊 統計データがありません</p>
        </div>
      </div>
    );
  }

  // 比較データの計算
  const getComparison = (current: number, previous?: number) => {
    if (!showComparison || !previous || previous === 0) return undefined;
    
    const change = current - previous;
    const changePercentage = (change / previous) * 100;
    
    return {
      value: formatChangePercentage(changePercentage),
      type: change > 0 ? 'increase' as const : change < 0 ? 'decrease' as const : 'neutral' as const
    };
  };

  // 統計カードデータを生成
  const statsCards: StatCard[] = [
    {
      title: '総活動時間',
      value: formatDuration(data.totalDuration),
      change: getComparison(data.totalDuration, comparisonData?.totalDuration),
      icon: '⏰',
      tooltip: 'すべてのユーザーの合計活動時間'
    },
    {
      title: '参加者数',
      value: `${formatNumber(data.totalParticipants)}人`,
      change: getComparison(data.totalParticipants, comparisonData?.totalParticipants),
      icon: '👥',
      tooltip: 'ボイスチャンネルに参加したユーザー数'
    },
    {
      title: 'セッション数',
      value: `${formatNumber(data.totalSessions)}回`,
      change: getComparison(data.totalSessions, comparisonData?.totalSessions),
      icon: '🎮',
      tooltip: '通話セッションの総数'
    },
    {
      title: '平均セッション時間',
      value: formatDuration(data.averageSessionDuration),
      change: getComparison(data.averageSessionDuration, comparisonData?.averageSessionDuration),
      icon: '📊',
      tooltip: '1セッションあたりの平均時間'
    },
    {
      title: '最長セッション',
      value: formatDuration(data.longestSession),
      change: getComparison(data.longestSession, comparisonData?.longestSession),
      icon: '🏆',
      tooltip: '最も長く続いた単一セッション'
    }
  ];

  // MVPカード（最も活発なユーザー）
  const mvpCard = data.mostActiveUser ? {
    title: 'MVP',
    value: data.mostActiveUser.username,
    icon: '👑',
    tooltip: `最も活発なユーザー（${formatDuration(data.mostActiveUser.duration)}）`
  } : null;

  const StatCard = ({ card }: { card: StatCard }) => {
    const getChangeIcon = (type: string) => {
      switch (type) {
        case 'increase': return '↗️';
        case 'decrease': return '↘️';
        default: return '→';
      }
    };

    const getChangeColorClass = (type: string) => {
      switch (type) {
        case 'increase': return 'text-green-400';
        case 'decrease': return 'text-red-400';
        default: return 'text-white/60';
      }
    };

    return (
      <div 
        className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 group"
        title={card.tooltip}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white/80 text-sm font-medium">{card.title}</h3>
          <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
            {card.icon}
          </span>
        </div>
        
        <div className="mb-2">
          <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
          {card.change && (
            <div className={`flex items-center text-xs ${getChangeColorClass(card.change.type)}`}>
              <span className="mr-1">{getChangeIcon(card.change.type)}</span>
              <span>{card.change.value}</span>
              {showComparison && (
                <span className="ml-1 text-white/50">前期間比</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const MvpCard = ({ card }: { card: typeof mvpCard }) => {
    if (!card) return null;

    return (
      <div 
        className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-md rounded-2xl border border-yellow-400/30 p-6 hover:from-yellow-500/30 hover:to-orange-500/30 transition-all duration-200 group"
        title={card.tooltip}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-yellow-400 text-sm font-medium">{card.title}</h3>
          <span className="text-3xl group-hover:scale-110 transition-transform duration-200">
            {card.icon}
          </span>
        </div>
        
        <div className="mb-2">
          <div className="text-xl font-bold text-white mb-1">{card.value}</div>
          <div className="text-xs text-yellow-300">
            {formatDuration(data.mostActiveUser!.duration)} • {data.mostActiveUser!.percentage.toFixed(1)}%
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{periodLabel}</h2>
        {showComparison && comparisonData && (
          <div className="text-sm text-white/60">
            前期間との比較表示中
          </div>
        )}
      </div>

      {/* 統計カードグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statsCards.map((card, index) => (
          <StatCard key={index} card={card} />
        ))}
        
        {/* MVPカード */}
        {mvpCard && (
          <div className="sm:col-span-2 lg:col-span-1">
            <MvpCard card={mvpCard} />
          </div>
        )}
      </div>

      {/* 詳細情報カード */}
      {data.mostActiveUser && (
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <span>🎯</span>
            詳細情報
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* MVP詳細 */}
            <div className="text-center">
              <div className="mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white font-bold text-xl mx-auto">
                  {data.mostActiveUser.username.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="text-white font-medium">{data.mostActiveUser.username}</div>
              <div className="text-yellow-400 text-sm">
                サーバー活動の{data.mostActiveUser.percentage.toFixed(1)}%を占有
              </div>
            </div>

            {/* 活動効率 */}
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {data.totalSessions > 0 ? (data.totalDuration / data.totalSessions / 60).toFixed(1) : '0'}分
              </div>
              <div className="text-white/80 text-sm">平均セッション時間</div>
              <div className="text-white/60 text-xs mt-1">
                全{formatNumber(data.totalSessions)}セッション
              </div>
            </div>

            {/* 参加率 */}
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {data.totalParticipants > 0 ? ((data.totalSessions / data.totalParticipants)).toFixed(1) : '0'}
              </div>
              <div className="text-white/80 text-sm">1人あたり平均セッション</div>
              <div className="text-white/60 text-xs mt-1">
                参加者{formatNumber(data.totalParticipants)}人
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsSummary;