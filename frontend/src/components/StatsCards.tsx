import React from 'react';
import type { BotStats } from '../types/discord';

interface StatsCardsProps {
  stats: BotStats | null;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  if (!stats) return null;

  const statsData = [
    {
      value: stats.servers?.total || 0,
      label: '参加サーバー',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-400/30',
      textColor: 'text-blue-200'
    },
    {
      value: stats.activity?.usersInVoice || 0,
      label: 'ボイス参加中',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-400/30',
      textColor: 'text-green-200'
    },
    {
      value: stats.database?.notifications || 0,
      label: '通知設定',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-400/30',
      textColor: 'text-purple-200'
    },
    {
      value: `${stats.memory?.used || 0}MB`,
      label: 'メモリ使用量',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-400/30',
      textColor: 'text-yellow-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {statsData.map((stat, index) => (
        <div 
          key={index}
          className={`${stat.bgColor} backdrop-blur-md rounded-lg p-4 border ${stat.borderColor}`}
        >
          <div className="text-2xl font-bold text-white">{stat.value}</div>
          <div className={stat.textColor}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;