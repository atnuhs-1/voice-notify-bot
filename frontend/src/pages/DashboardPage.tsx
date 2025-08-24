import React, { useState, Suspense } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { 
  selectedGuildAtom, 
  showResultActionAtom,
  selectedGuildIdAtom
} from '../atoms/discord';
import {
  selectedMetricAtom,
  updateMetricActionAtom
} from '../atoms/statistics';
import {
  selectedPresetAtom,
  selectPresetActionAtom,
  formattedSelectedPeriodAtom,
  optimizationStatusAtom,
  refreshRankingActionAtom,
  currentRankingAtom
} from '../atoms/presets';
import { PeriodPresetButtons, HybridApiInfo } from '../components/PeriodPresetButtons';
import RankingTable from '../components/statistics/RankingTable';
import type { MetricType, BackendPeriodPreset } from '../types/statistics';

const DashboardPage: React.FC = () => {
  const [activeView, setActiveView] = useState<'summary' | 'ranking' | 'timeline'>('summary');
  
  // Jotai atoms
  const selectedGuildData = useAtomValue(selectedGuildAtom);
  const selectedPreset = useAtomValue(selectedPresetAtom);
  const selectedMetric = useAtomValue(selectedMetricAtom);
  const formattedPeriod = useAtomValue(formattedSelectedPeriodAtom);
  const optimizationStatus = useAtomValue(optimizationStatusAtom);
  
  // Actions
  const showResult = useSetAtom(showResultActionAtom);
  const updateMetric = useSetAtom(updateMetricActionAtom);
  const selectPreset = useSetAtom(selectPresetActionAtom);
  const refreshStatistics = useSetAtom(refreshRankingActionAtom);

  // 手動更新ハンドラー
  const handleRefresh = async () => {
    try {
      await refreshStatistics();
      showResult('統計データを更新しました', 'success');
    } catch (error) {
      console.error('統計データ更新エラー:', error);
      showResult(`統計データの更新に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  // プリセット変更ハンドラー
  const handlePresetChange = (preset: BackendPeriodPreset) => {
    selectPreset(preset);
    console.log(`🔄 プリセット変更: ${preset}`);
  };

  // メトリクス変更ハンドラー
  const handleMetricChange = (metric: MetricType) => {
    updateMetric(metric);
  };

  // ビューオプション
  const viewOptions = [
    { id: 'summary' as const, name: 'サマリー', icon: '📈', description: '全体的な統計概要' },
    { id: 'ranking' as const, name: 'ランキング', icon: '🏆', description: 'ユーザー別ランキング' },
    { id: 'timeline' as const, name: 'タイムライン', icon: '⏰', description: '詳細なセッション履歴' }
  ];

  // メトリクスオプション
  const metricOptions = [
    { value: 'duration' as MetricType, label: '滞在時間', icon: '⏱️', description: '総滞在時間でランキング' },
    { value: 'sessions' as MetricType, label: 'セッション数', icon: '🔢', description: '参加回数でランキング' },
    { value: 'started_sessions' as MetricType, label: '開始セッション', icon: '🚀', description: '通話開始回数でランキング' }
  ];

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              📊 統計ダッシュボード
            </h1>
            <p className="text-gray-600 mt-2">
              {selectedGuildData?.name} のボイスチャンネル利用統計
            </p>
          </div>
          
          <button
            onClick={handleRefresh}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            <span>🔄</span>
            データ更新
          </button>
        </div>
      </div>

      {/* ビュー選択タブ */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {viewOptions.map(option => (
            <button
              key={option.id}
              onClick={() => setActiveView(option.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeView === option.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-lg">{option.icon}</span>
              <div className="text-left">
                <div className="font-medium">{option.name}</div>
                <div className="text-xs opacity-75">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 期間選択とコントロール */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 期間選択 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">📅 期間選択</h3>
            <PeriodPresetButtons
              selectedPreset={selectedPreset}
              onPresetSelect={handlePresetChange}
              className="mb-4"
            />
            
            {/* 現在の期間表示 */}
            <div className="text-center px-4 py-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-800">
                {formattedPeriod}
              </div>
              <HybridApiInfo
                searchType={optimizationStatus.presetType !== 'custom' ? 'preset' : 'custom'}
                preset={optimizationStatus.presetType !== 'custom' ? optimizationStatus.presetType : undefined}
                isOptimized={optimizationStatus.isOptimized}
                className="mt-2"
              />
            </div>
          </div>

          {/* メトリクス選択（ランキング表示時のみ） */}
          {activeView === 'ranking' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📊 表示メトリクス</h3>
              <div className="space-y-2">
                {metricOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleMetricChange(option.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      selectedMetric === option.value
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <span className="text-xl">{option.icon}</span>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm opacity-75">{option.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* タイムライン説明（タイムライン表示時のみ） */}
          {activeView === 'timeline' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">⏰ タイムライン表示</h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">表示内容</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 選択期間内の全セッション履歴</li>
                  <li>• ユーザー別の参加時間帯</li>
                  <li>• セッション開始者の識別</li>
                  <li>• 現在進行中のセッション</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {activeView === 'summary' && (
          <div className="p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">統計サマリー</h3>
              <p className="text-gray-500 mb-4">
                統計サマリー機能は現在開発中です
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-medium text-blue-800 mb-2">実装予定機能</h4>
                <ul className="text-sm text-blue-700 text-left space-y-1">
                  <li>• 総活動時間・参加者数の統計</li>
                  <li>• 平均セッション時間</li>
                  <li>• MVP表示</li>
                  <li>• 前期間との比較</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeView === 'ranking' && (
          <div className="p-6">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin text-4xl mb-4">🔄</div>
                  <p className="text-gray-600">ランキングデータを読み込み中...</p>
                </div>
              </div>
            }>
              <RankingView />
            </Suspense>
          </div>
        )}

        {activeView === 'timeline' && (
          <div className="p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⏰</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">タイムライン表示</h3>
              <p className="text-gray-500 mb-4">
                タイムライン機能は現在開発中です
              </p>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-medium text-purple-800 mb-2">実装予定機能</h4>
                <ul className="text-sm text-purple-700 text-left space-y-1">
                  <li>• 詳細セッション履歴</li>
                  <li>• ユーザー別参加時間帯</li>
                  <li>• セッション開始者の識別</li>
                  <li>• 進行中セッションの表示</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* フッター情報 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>リアルタイム更新</span>
            </div>
            <div>
              最終更新: {new Date().toLocaleString('ja-JP')}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            💡 期間を変更してデータを比較したり、メトリクスを切り替えて異なる視点で分析できます
          </div>
        </div>
      </div>
    </div>
  );
};

// ハイブリッドAPI対応のランキング表示コンポーネント
const RankingView: React.FC = () => {
  const selectedGuildId = useAtomValue(selectedGuildIdAtom);
  const selectedMetric = useAtomValue(selectedMetricAtom);
  
  // 直接Jotaiでランキングデータを取得
  const rankingData = useAtomValue(currentRankingAtom);

  if (!selectedGuildId) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🤖</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">サーバーを選択してください</h3>
        <p className="text-gray-500">
          左のサイドバーからサーバーを選択して、統計データを表示しましょう
        </p>
      </div>
    );
  }

  // JotaiのSuspense機能を使用するため、ローディング・エラー処理はSuspense境界で管理

  return (
    <div>
      {/* 検索情報の表示（デバッグ用） */}
      {rankingData?.meta && (
        <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-50 rounded-lg">
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

export default DashboardPage;