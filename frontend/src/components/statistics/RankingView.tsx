import React from 'react';
import { useAtomValue } from 'jotai';
import { selectedGuildIdAtom } from '../../atoms/discord';
import { selectedMetricAtom } from '../../atoms/statistics';
import { currentRankingAtom } from '../../atoms/presets';
import RankingTable from './RankingTable';

const RankingView: React.FC = () => {
  const selectedGuildId = useAtomValue(selectedGuildIdAtom);
  const selectedMetric = useAtomValue(selectedMetricAtom);
  
  // 直接Jotaiでランキングデータを取得
  const rankingData = useAtomValue(currentRankingAtom);

  if (!selectedGuildId) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🤖</div>
        <h3 className="text-xl font-semibold text-foreground mb-2">サーバーを選択してください</h3>
        <p className="text-muted-foreground">
          左のサイドバーからサーバーを選択して、統計データを表示しましょう
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 検索情報の表示（デバッグ用） */}
      {rankingData?.meta && (
        <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted rounded-lg">
          検索タイプ: {rankingData.meta.searchType} 
          {rankingData.meta.preset && ` (${rankingData.meta.preset})`}
          {rankingData.meta.isOptimized && ' 🚀 高速ルート'}
          {rankingData.meta.totalParticipants && ` | 参加者: ${rankingData.meta.totalParticipants}人`}
        </div>
      )}
      
      {/* ランキング表示 */}
      {rankingData?.data?.rankings && (
        <RankingTable
          data={rankingData.data}
          metric={{ 
            type: selectedMetric, 
            label: selectedMetric === 'duration' ? '滞在時間' : selectedMetric === 'sessions' ? 'セッション数' : '開始セッション', 
            unit: selectedMetric === 'duration' ? '時間' : '回' 
          }}
          loading={false}  // JotaiのSuspenseで管理
          error={null}     // JotaiのSuspenseで管理
          showComparison={true}
        />
      )}
    </div>
  );
};

export default RankingView;