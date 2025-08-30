import React, { useState, Suspense } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { 
  selectedGuildAtom, 
  showResultActionAtom,
} from '../atoms/discord';
import {
  selectedPresetAtom,
  selectPresetActionAtom,
  refreshRankingActionAtom,
} from '../atoms/presets';
import { refreshSummariesActionAtom } from '../atoms/summaries';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import RankingView from '../components/statistics/RankingView';
import SummaryView from '../components/statistics/SummaryView';
import {
  BarChart3,
  Clock,
  Trophy,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import type { BackendPeriodPreset } from '../types/statistics';

const DashboardPage: React.FC = () => {
  const [activeView, setActiveView] = useState<'summary' | 'ranking' | 'timeline'>('summary');
  
  // Jotai atoms
  const selectedGuildData = useAtomValue(selectedGuildAtom);
  const selectedPreset = useAtomValue(selectedPresetAtom);
  
  // Actions
  const showResult = useSetAtom(showResultActionAtom);
  const selectPreset = useSetAtom(selectPresetActionAtom);
  const refreshStatistics = useSetAtom(refreshRankingActionAtom);
  const refreshSummaries = useSetAtom(refreshSummariesActionAtom);

  // 手動更新ハンドラー
  const handleRefresh = async () => {
    try {
      await Promise.all([
        refreshStatistics(),
        refreshSummaries()
      ]);
      showResult('統計データを更新しました', 'success');
    } catch (error) {
      console.error('統計データ更新エラー:', error);
      showResult(`統計データの更新に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  // プリセット変更ハンドラー
  const handlePresetChange = (preset: BackendPeriodPreset) => {
    selectPreset(preset);
  };

  // 期間オプション
  const periods = [
    { label: "今週", value: "this_week" as BackendPeriodPreset, icon: Calendar },
    { label: "先週", value: "last_week" as BackendPeriodPreset, icon: Calendar },
    { label: "今月", value: "this_month" as BackendPeriodPreset, icon: Calendar },
    { label: "先月", value: "last_month" as BackendPeriodPreset, icon: Calendar },
    { label: "過去7日", value: "last_7_days" as BackendPeriodPreset, icon: Clock },
    { label: "過去30日", value: "last_30_days" as BackendPeriodPreset, icon: BarChart3 },
  ];

  // タブオプション
  const tabs = [
    { label: "サマリー", value: "summary" as const, icon: BarChart3 },
    { label: "ランキング", value: "ranking" as const, icon: Trophy },
    { label: "タイムライン", value: "timeline" as const, icon: Clock },
  ];


  return (
    <>
      {/* Compact Header with Tab Navigation */}
      <Card className="p-3">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-bold text-foreground font-sans">統計ダッシュボード</h1>
              <p className="text-sm text-muted-foreground font-serif">
                {selectedGuildData?.name} のボイスチャンネル利用統計
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleRefresh} className="flex items-center gap-2 font-medium bg-blue-600">
            <RefreshCw className="w-4 h-4" />
            データ更新
          </Button>
        </div>

        {/* Compact Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveView(tab.value)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeView === tab.value
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="font-sans">{tab.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Compact Period Selection */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-foreground font-sans flex items-center gap-2">
            📅 期間選択
          </h3>
          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <button
                key={period.value}
                onClick={() => handlePresetChange(period.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                  selectedPreset === period.value
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <period.icon className="w-3 h-3" />
                <span className="font-serif">{period.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>


      {/* Main Content Area */}
      {activeView === 'summary' && (
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">🔄</div>
              <p className="text-muted-foreground">サマリーデータを読み込み中...</p>
            </div>
          </div>
        }>
          <SummaryView />
        </Suspense>
      )}

      {activeView === 'ranking' && (
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">🔄</div>
              <p className="text-muted-foreground">ランキングデータを読み込み中...</p>
            </div>
          </div>
        }>
          <RankingView />
        </Suspense>
      )}

      {activeView === 'timeline' && (
        <Card className="p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⏰</div>
            <h3 className="text-xl font-semibold text-foreground mb-2 font-sans">タイムライン表示</h3>
            <p className="text-muted-foreground mb-4 font-serif">
              タイムライン機能は現在開発中です
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 max-w-md mx-auto">
              <h4 className="font-medium text-purple-800 mb-2 font-sans">実装予定機能</h4>
              <ul className="text-sm text-purple-700 text-left space-y-1 font-serif">
                <li>• 詳細セッション履歴</li>
                <li>• ユーザー別参加時間帯</li>
                <li>• セッション開始者の識別</li>
                <li>• 進行中セッションの表示</li>
              </ul>
            </div>
          </div>
        </Card>
      )}
    </>
  );
};

export default DashboardPage;