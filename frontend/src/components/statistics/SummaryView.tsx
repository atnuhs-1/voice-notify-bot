import React from 'react';
import { useAtomValue } from 'jotai';
import { selectedGuildIdAtom } from '../../atoms/discord';
import { 
  currentSummaryAtom
} from '../../atoms/summaries';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  Users,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { formatDuration, formatDateTime } from '../../utils/datetime';

const SummaryView: React.FC = () => {
  const selectedGuildId = useAtomValue(selectedGuildIdAtom);
  const currentSummary = useAtomValue(currentSummaryAtom);

  if (!selectedGuildId) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🤖</div>
        <h3 className="text-xl font-semibold text-foreground mb-2 font-sans">サーバーを選択してください</h3>
        <p className="text-muted-foreground font-serif">
          左のサイドバーからサーバーを選択して、統計サマリーを表示しましょう
        </p>
      </div>
    );
  }

  const currentData = currentSummary?.data?.summaries?.[0];

  if (!currentData) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-foreground mb-2 font-sans">データがありません</h3>
        <p className="text-muted-foreground mb-4 font-serif">
          選択された期間にはデータがまだ蓄積されていません
        </p>
        <Card className="bg-blue-50 border border-blue-200 p-4 max-w-md mx-auto">
          <p className="text-sm text-blue-700 font-serif">
            💡 ボイスチャンネルでの活動後、数分でデータが表示されます
          </p>
        </Card>
      </div>
    );
  }

  const stats = [
    {
      title: "総活動時間",
      value: formatDuration(currentData.metrics.totalDuration),
      icon: Clock,
      trend: undefined,
      colorClasses: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      title: "参加者数",
      value: `${currentData.metrics.totalParticipants}人`,
      icon: Users,
      trend: undefined,
      colorClasses: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    {
      title: "セッション数",
      value: `${currentData.metrics.totalSessions}回`,
      icon: Activity,
      trend: undefined,
      colorClasses: "bg-cyan-50 text-cyan-700 border-cyan-200",
    },
    {
      title: currentData.metrics.averageSessionDuration !== null ? "セッション平均時間" : "最長セッション",
      value: formatDuration(currentData.metrics.averageSessionDuration !== null 
        ? currentData.metrics.averageSessionDuration 
        : currentData.metrics.longestSession || 0),
      icon: TrendingUp,
      trend: undefined,
      colorClasses: "bg-amber-50 text-amber-700 border-amber-200",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatsCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            colorClasses={stat.colorClasses}
          />
        ))}
      </div>

      {/* MVP Section */}
      {currentData.topUser && (
        <Card className="p-4 border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🏆</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1 font-sans">期間MVP</h3>
              <div className="flex items-center gap-3">
                <div className="text-xl font-bold text-amber-600 font-sans">
                  {currentData.topUser.username}
                </div>
                <div className="text-xs text-muted-foreground font-serif">
                  総活動時間: <span className="font-medium">{formatDuration(currentData.topUser.duration)}</span>
                </div>
              </div>
              <Progress 
                value={currentData.metrics.totalDuration > 0 
                  ? (currentData.topUser.duration / currentData.metrics.totalDuration) * 100 
                  : 0
                } 
                className="mt-2 w-40" 
              />
            </div>
          </div>
        </Card>
      )}

      {/* Summary Generation Info */}
      {currentData.createdAt && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs text-blue-700 font-serif">
                生成日時: <span className="font-medium">{formatDateTime(currentData.createdAt)}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Debug Info (Development only) */}
      {process.env.NODE_ENV === 'development' && currentSummary?.meta && (
        <Card className="p-4 bg-muted">
          <h4 className="text-sm font-medium text-foreground mb-2 font-sans">🔧 デバッグ情報</h4>
          <div className="text-xs text-muted-foreground space-y-1 font-serif">
            <div>検索タイプ: {currentSummary.meta.searchType}</div>
            <div>サマリータイプ: {currentSummary.meta.summaryType}</div>
            <div>キャッシュキー: {currentSummary.meta.cacheKey}</div>
            {currentData.createdAt && (
              <div>生成日時: {formatDateTime(currentData.createdAt)}</div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

// Statistics Card Component (v0 style)
interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClasses: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: IconComponent, 
  colorClasses 
}) => {
  return (
    <Card className={`p-4 border-2 ${colorClasses} hover:shadow-lg transition-all duration-200`}>
      <div className="flex items-center mb-3">
        <IconComponent className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground font-serif">{title}</p>
        <p className="text-xl font-bold text-foreground font-sans">{value}</p>
      </div>
    </Card>
  );
};

export default SummaryView;