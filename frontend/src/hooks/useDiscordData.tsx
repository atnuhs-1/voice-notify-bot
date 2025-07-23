import { useState, useEffect } from 'react';
import { fetchGuilds, fetchStats } from '../utils/api';
import { useAuth } from './useAuth'; // 認証フックをインポート
import type { Guild, BotStats, ResultMessage } from '../types/discord';

export const useDiscordData = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth(); // 認証状態を取得
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [stats, setStats] = useState<BotStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ResultMessage | null>(null);

  // 認証状態が変わったらデータを読み込み
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadData();
    } else if (!authLoading) {
      // 未認証の場合はデータをクリア
      setGuilds([]);
      setSelectedGuild('');
      setStats(null);
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  const loadData = async () => {
    // 認証されていない場合は何もしない
    if (!isAuthenticated) {
      return;
    }

    try {
      setLoading(true);
      const [guildsData, statsData] = await Promise.all([
        fetchGuilds(),
        fetchStats()
      ]);
      
      setGuilds(guildsData.guilds || []);
      setStats(statsData);
      
      // 最初のサーバーを選択（ユーザーの管理サーバーのみ）
      if (guildsData.guilds?.length > 0) {
        setSelectedGuild(guildsData.guilds[0].id);
      }
      
      console.log(`✅ データ取得完了: ${guildsData.guilds?.length || 0}サーバー`);
    } catch (error) {
      console.error('データの取得に失敗:', error);
      showResult('データの取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showResult = (message: string, type: 'success' | 'error') => {
    setResult({ message, type });
    setTimeout(() => setResult(null), 5000);
  };

  return {
    guilds,
    selectedGuild,
    setSelectedGuild,
    stats,
    loading: loading || authLoading, // 認証ローディングも含める
    result,
    loadData,
    showResult
  };
};