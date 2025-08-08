import { useState, useEffect, useCallback } from 'react';
import { 
  fetchRankings, 
  fetchTimeline, 
  fetchSummaries,
  // refreshStatistics,
  checkStatisticsChanges,
  APIException
} from '../utils/api';
import { useAuth } from './useAuth';
import { getDefaultWeekStart, getDefaultWeekEnd } from '../utils/period';
import type {
  APIResponse,
  RankingData,
  TimelineData,
  SummariesData,
  RankingQuery,
  TimelineQuery,
  SummariesQuery,
  StatisticsState
} from '../types/statistics';

interface UseStatisticsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

export const useStatistics = (guildId: string, options: UseStatisticsOptions = {}) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  
  // guildId変更時の処理
  useEffect(() => {
    // console.log('useStatistics: guildId changed to', guildId);
  }, [guildId, isAuthenticated, authLoading]);

  const [state, setState] = useState<StatisticsState>({
    loading: false,
    error: null,
    data: {
      rankings: null,
      timeline: null,
      summaries: null,
    },
    settings: {
      selectedPeriod: {
        type: 'week',
        from: getDefaultWeekStart(),
        to: getDefaultWeekEnd(),
      },
      selectedMetric: {
        type: 'duration',
        label: '滞在時間',
        unit: '時間',
      },
      autoRefresh: autoRefresh,
      refreshInterval: refreshInterval,
    },
  });

  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  // エラー処理とローディング状態の更新
  const updateState = useCallback((updates: Partial<StatisticsState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    updateState({ loading });
  }, [updateState]);

  const setError = useCallback((error: string | null) => {
    updateState({ error });
  }, [updateState]);

  // ランキングデータ取得
  const fetchRankingData = useCallback(async (query: RankingQuery): Promise<RankingData | null> => {
    if (!isAuthenticated || !guildId) return null;

    try {
      setError(null);
      const response: APIResponse<RankingData> = await fetchRankings(guildId, query);
      return response.data;
    } catch (error) {
      if (error instanceof APIException) {
        setError(`ランキング取得エラー: ${error.message}`);
      } else {
        setError('ランキングデータの取得に失敗しました');
      }
      console.error('Rankings fetch error:', error);
      return null;
    }
  }, [guildId, isAuthenticated, setError]);

  // タイムラインデータ取得
  const fetchTimelineData = useCallback(async (query: TimelineQuery): Promise<TimelineData | null> => {
    if (!isAuthenticated || !guildId) return null;

    try {
      setError(null);
      const response: APIResponse<TimelineData> = await fetchTimeline(guildId, query);
      return response.data;
    } catch (error) {
      if (error instanceof APIException) {
        setError(`タイムライン取得エラー: ${error.message}`);
      } else {
        setError('タイムラインデータの取得に失敗しました');
      }
      console.error('Timeline fetch error:', error);
      return null;
    }
  }, [guildId, isAuthenticated, setError]);

  // サマリーデータ取得
  const fetchSummariesData = useCallback(async (query: SummariesQuery): Promise<SummariesData | null> => {
    if (!isAuthenticated || !guildId) return null;

    try {
      setError(null);
      const response: APIResponse<SummariesData> = await fetchSummaries(guildId, query);
      return response.data;
    } catch (error) {
      if (error instanceof APIException) {
        setError(`サマリー取得エラー: ${error.message}`);
      } else {
        setError('サマリーデータの取得に失敗しました');
      }
      console.error('Summaries fetch error:', error);
      return null;
    }
  }, [guildId, isAuthenticated, setError]);

  // ランキング取得（現在の設定を使用）
  const loadRankings = useCallback(async () => {
    if (!isAuthenticated || !guildId) return;

    setLoading(true);
    const query: RankingQuery = {
      metric: state.settings.selectedMetric.type,
      from: state.settings.selectedPeriod.from,
      to: state.settings.selectedPeriod.to,
      limit: 10,
      compare: true,
    };

    const rankings = await fetchRankingData(query);
    if (rankings) {
      // console.log('ランキングデータ取得完了:', rankings.rankings?.length || 0, '件');
      
      updateState({
        data: { ...state.data, rankings },
      });
    }
    setLoading(false);
  }, [isAuthenticated, guildId, state.settings, state.data, fetchRankingData, setLoading, updateState]);

  // タイムライン取得（現在の設定を使用）
  const loadTimeline = useCallback(async () => {
    if (!isAuthenticated || !guildId) return;

    setLoading(true);
    const query: TimelineQuery = {
      from: new Date(`${state.settings.selectedPeriod.from}T18:00:00Z`).toISOString(),
      to: new Date(`${state.settings.selectedPeriod.to}T10:00:00Z`).toISOString(),
    };

    const timeline = await fetchTimelineData(query);
    if (timeline) {
      updateState({
        data: { ...state.data, timeline },
      });
    }
    setLoading(false);
  }, [isAuthenticated, guildId, state.settings, state.data, fetchTimelineData, setLoading, updateState]);

  // サマリー取得（現在の設定を使用）
  const loadSummaries = useCallback(async (type: 'daily' | 'weekly' | 'monthly' = 'daily') => {
    if (!isAuthenticated || !guildId) return;

    setLoading(true);
    const query: SummariesQuery = {
      type,
      from: state.settings.selectedPeriod.from,
      to: state.settings.selectedPeriod.to,
      limit: 30,
      offset: 0,
    };

    const summaries = await fetchSummariesData(query);
    if (summaries) {
      updateState({
        data: { ...state.data, summaries },
      });
    }
    setLoading(false);
  }, [isAuthenticated, guildId, state.settings, state.data, fetchSummariesData, setLoading, updateState]);

  // 全データの再読み込み
  const refreshAllData = useCallback(async () => {
    if (!isAuthenticated || !guildId) {
      // console.log('API呼び出し条件不足:', { isAuthenticated, guildId });
      return;
    }

    try {
      setError(null);
      setLoading(true);
      
      // console.log('refreshAllData開始:', guildId);
      
      // 実装済みのAPIを個別に実行
      await Promise.all([
        loadRankings(),
        loadTimeline(),
        loadSummaries(),
      ]);

      setLastUpdate(new Date().toISOString());
      // console.log('refreshAllData完了');
    } catch (error) {
      console.error('統計データ更新エラー:', error);
      
      if (error instanceof APIException) {
        setError(`データ更新エラー: ${error.message}`);
      } else {
        setError('データの更新に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, guildId, setError, setLoading]);

  // 変更検出と差分更新
  const checkForUpdates = useCallback(async () => {
    if (!isAuthenticated || !guildId || !lastUpdate) return;

    try {
      const response = await checkStatisticsChanges(guildId, lastUpdate);
      if (response.data.hasChanges) {
        console.log('統計データに変更を検出、更新中...');
        await refreshAllData();
      }
    } catch (error) {
      console.error('Change detection error:', error);
      // 変更検出エラーは静黙に処理（重要でない）
    }
  }, [isAuthenticated, guildId, lastUpdate, refreshAllData]);

  // 期間選択の更新
  const updatePeriod = useCallback((period: StatisticsState['settings']['selectedPeriod']) => {
    updateState({
      settings: { ...state.settings, selectedPeriod: period },
    });
  }, [state.settings, updateState]);

  // メトリクス選択の更新
  const updateMetric = useCallback((metric: StatisticsState['settings']['selectedMetric']) => {
    updateState({
      settings: { ...state.settings, selectedMetric: metric },
    });
  }, [state.settings, updateState]);

  // 自動更新設定の更新
  const updateAutoRefresh = useCallback((enabled: boolean, interval?: number) => {
    updateState({
      settings: {
        ...state.settings,
        autoRefresh: enabled,
        refreshInterval: interval || state.settings.refreshInterval,
      },
    });
  }, [state.settings, updateState]);

  // 自動更新タイマーの設定
  useEffect(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      setRefreshTimer(null);
    }

    if (state.settings.autoRefresh && isAuthenticated && guildId) {
      const timer = setInterval(() => {
        checkForUpdates();
      }, state.settings.refreshInterval);
      
      setRefreshTimer(timer);
    }

    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [state.settings.autoRefresh, state.settings.refreshInterval, isAuthenticated, guildId, checkForUpdates, refreshTimer]);

  // 認証状態変更時の初期データ読み込み
  useEffect(() => {
    if (!isAuthenticated) {
      // 認証切れ時のデータクリア
      updateState({
        data: {
          rankings: null,
          timeline: null,
          summaries: null,
        },
        error: null,
      });
    }
    if (isAuthenticated && !authLoading && guildId) {
      refreshAllData();
    }
  }, [isAuthenticated, authLoading, guildId, updateState, refreshAllData]);

  // 期間・メトリクス変更時の自動再読み込み
  useEffect(() => {
    if (isAuthenticated && guildId) {
      refreshAllData();
    }
  }, [state.settings.selectedPeriod, state.settings.selectedMetric, isAuthenticated, guildId, refreshAllData]);

  return {
    // データ
    rankings: state.data.rankings,
    timeline: state.data.timeline,
    summaries: state.data.summaries,
    
    // 状態
    loading: state.loading || authLoading,
    error: state.error,
    lastUpdate,
    
    // 設定
    selectedPeriod: state.settings.selectedPeriod,
    selectedMetric: state.settings.selectedMetric,
    autoRefresh: state.settings.autoRefresh,
    
    // アクション
    loadRankings,
    loadTimeline,
    loadSummaries,
    refreshAllData,
    updatePeriod,
    updateMetric,
    updateAutoRefresh,
    
    // 個別データ取得（カスタムクエリ用）
    fetchRankingData,
    fetchTimelineData,
    fetchSummariesData,
  };
};