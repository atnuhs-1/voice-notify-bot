import { useState, useEffect } from 'react';
import { fetchGuilds, fetchStats } from '../utils/api';
import type { Guild, BotStats, ResultMessage } from '../types/discord';

export const useDiscordData = () => {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [stats, setStats] = useState<BotStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ResultMessage | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [guildsData, statsData] = await Promise.all([
        fetchGuilds(),
        fetchStats()
      ]);
      
      setGuilds(guildsData.guilds || []);
      setStats(statsData);
      
      if (guildsData.guilds?.length > 0) {
        setSelectedGuild(guildsData.guilds[0].id);
      }
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
    loading,
    result,
    loadData,
    showResult
  };
};