import React from 'react';
import { useAtomValue } from 'jotai';
import { selectedGuildIdAtom } from '../../atoms/discord';
import { 
  currentSummaryAtom, 
  summaryComparisonAtom,
  summaryTypeStrategyAtom 
} from '../../atoms/summaries';
import { formattedSelectedPeriodAtom } from '../../atoms/presets';

const SummaryView: React.FC = () => {
  const selectedGuildId = useAtomValue(selectedGuildIdAtom);
  const formattedPeriod = useAtomValue(formattedSelectedPeriodAtom);
  const summaryType = useAtomValue(summaryTypeStrategyAtom);
  const currentSummary = useAtomValue(currentSummaryAtom);
  const summaryComparison = useAtomValue(summaryComparisonAtom);

  if (!selectedGuildId) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🤖</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">サーバーを選択してください</h3>
        <p className="text-gray-500">
          左のサイドバーからサーバーを選択して、統計サマリーを表示しましょう
        </p>
      </div>
    );
  }

  const currentData = currentSummary?.data?.summaries?.[0];
  console.log("currentData: ", currentData);

  if (!currentData) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">データがありません</h3>
        <p className="text-gray-500 mb-4">
          選択された期間にはデータがまだ蓄積されていません
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-blue-700">
            💡 ボイスチャンネルでの活動後、数分でデータが表示されます
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 期間情報ヘッダー */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">📊 統計サマリー</h2>
            <p className="text-sm text-gray-600">{formattedPeriod}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">集計タイプ</div>
            <div className="text-sm font-medium text-gray-700">
              {summaryType === 'weekly' ? '📊 週次' : '🗓️ 月次'}
            </div>
          </div>
        </div>
      </div>

      {/* メイン統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="総活動時間"
          value={formatDuration(currentData.metrics.totalDuration)}
          icon="⏱️"
          comparison={summaryComparison?.duration}
          color="blue"
        />
        <StatCard
          title="参加者数"
          value={`${currentData.metrics.totalParticipants}人`}
          icon="👥"
          comparison={summaryComparison?.participants}
          color="green"
        />
        <StatCard
          title="セッション数"
          value={`${currentData.metrics.totalSessions}回`}
          icon="🎮"
          comparison={summaryComparison?.sessions}
          color="purple"
        />
        <StatCard
          title={currentData.metrics.averageDailyDuration !== null ? "1日平均活動時間" : "最長セッション"}
          value={formatDuration(currentData.metrics.averageDailyDuration !== null ? currentData.metrics.averageDailyDuration : currentData.metrics.longestSession || 0)}
          icon="🏆"
          color="orange"
        />
      </div>

      {/* MVP表示 */}
      {currentData.topUser && (
        <div className="bg-white rounded-lg p-6 border-l-4 border-yellow-400">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏆</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">期間MVP</h3>
              <div className="flex items-center gap-3">
                <div className="text-xl font-bold text-yellow-600">
                  {currentData.topUser.username}
                </div>
                <div className="text-sm text-gray-600">
                  総活動時間: <span className="font-medium">{formatDuration(currentData.topUser.duration)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 期間比較情報 */}
      {summaryComparison && (
        <div className="bg-white rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 前期間との比較</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComparisonItem
              title="活動時間"
              current={formatDuration(summaryComparison.duration.current)}
              change={summaryComparison.duration.change}
              changePercent={summaryComparison.duration.changePercent}
              formatChange={formatDuration}
            />
            <ComparisonItem
              title="参加者数"
              current={`${summaryComparison.participants.current}人`}
              change={summaryComparison.participants.change}
              changePercent={summaryComparison.participants.changePercent}
              formatChange={(val) => `${val > 0 ? '+' : ''}${val}人`}
            />
            <ComparisonItem
              title="セッション数"
              current={`${summaryComparison.sessions.current}回`}
              change={summaryComparison.sessions.change}
              changePercent={summaryComparison.sessions.changePercent}
              formatChange={(val) => `${val > 0 ? '+' : ''}${val}回`}
            />
          </div>
        </div>
      )}

      {/* クイックアクション */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">🔍 詳細分析</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionCard
            title="ランキング詳細"
            description="ユーザー別の詳細ランキングを確認"
            icon="🏆"
            actionText="ランキングを見る"
          />
          <ActionCard
            title="タイムライン詳細"
            description="セッションの詳細履歴を確認"
            icon="⏰"
            actionText="タイムラインを見る"
          />
        </div>
      </div>

      {/* デバッグ情報（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && currentSummary?.meta && (
        <div className="bg-gray-100 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">🔧 デバッグ情報</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <div>検索タイプ: {currentSummary.meta.searchType}</div>
            <div>サマリータイプ: {currentSummary.meta.summaryType}</div>
            <div>キャッシュキー: {currentSummary.meta.cacheKey}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// 統計カードコンポーネント
interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  comparison?: {
    current: number;
    previous: number;
    change: number;
    changePercent: number | null;
  };
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, comparison, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700'
  };

  return (
    <div className={`rounded-lg p-4 border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xl">{icon}</div>
        {comparison && comparison.changePercent !== null && (
          <div className={`text-xs font-medium ${
            comparison.change > 0 ? 'text-green-600' : 
            comparison.change < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {comparison.change > 0 ? '↗️' : comparison.change < 0 ? '↘️' : '➖'} 
            {Math.abs(comparison.changePercent)}%
          </div>
        )}
      </div>
      <div className="font-medium text-gray-600 text-sm mb-1">{title}</div>
      <div className="text-xl font-bold text-gray-800">{value}</div>
    </div>
  );
};

// 比較アイテムコンポーネント
interface ComparisonItemProps {
  title: string;
  current: string;
  change: number;
  changePercent: number | null;
  formatChange: (value: number) => string;
}

const ComparisonItem: React.FC<ComparisonItemProps> = ({ 
  title, current, change, changePercent, formatChange 
}) => {
  return (
    <div className="text-center">
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-lg font-semibold text-gray-800 mb-1">{current}</div>
      {changePercent !== null && (
        <div className={`text-sm font-medium ${
          change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
        }`}>
          {formatChange(change)} ({change > 0 ? '+' : ''}{changePercent}%)
        </div>
      )}
    </div>
  );
};

// アクションカードコンポーネント
interface ActionCardProps {
  title: string;
  description: string;
  icon: string;
  actionText: string;
}

const ActionCard: React.FC<ActionCardProps> = ({ title, description, icon, actionText }) => {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-800 mb-1">{title}</h4>
          <p className="text-sm text-gray-600 mb-3">{description}</p>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            {actionText} →
          </button>
        </div>
      </div>
    </div>
  );
};

// ユーティリティ関数
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  } else if (minutes > 0) {
    return `${minutes}分`;
  } else {
    return `${seconds}秒`;
  }
}

export default SummaryView;