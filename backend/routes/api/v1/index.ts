// Phase 2.4: v1 API ルート統合
// 新統一API設計でのv1エンドポイント

import { FastifyPluginAsync } from 'fastify';

const v1Routes: FastifyPluginAsync = async (fastify) => {
  // NOTE: AutoLoadが有効なため、guildsディレクトリは自動的に /guilds プレフィックスで読み込まれます
  // 手動でregisterする必要はありません
  
  // 将来のAPIエンドポイント追加用
  // await fastify.register(import('./users'), { prefix: '/users' });
  // await fastify.register(import('./health'), { prefix: '/health' });
  
  // API情報エンドポイント
  fastify.get('/info', async (request, reply) => {
    return {
      version: '1.0.0',
      name: 'Discord Voice Notify Bot API',
      description: '統計・通知機能API',
      endpoints: {
        statistics: {
          rankings: 'GET /guilds/{guildId}/statistics/rankings',
          timeline: 'GET /guilds/{guildId}/statistics/timeline',
          summaries: 'GET /guilds/{guildId}/statistics/summaries'
        },
        // notifications: {
        //   schedules: 'GET/PUT /guilds/{guildId}/notifications/schedules',
        //   test: 'POST /guilds/{guildId}/notifications/test'
        // }
      },
      authentication: 'Bearer JWT Token',
      permissions: ['view', 'manage', 'execute']
    };
  });
};

export default v1Routes;