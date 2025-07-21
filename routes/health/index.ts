import { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
  // シンプルなヘルスチェック
  fastify.get('/', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Kubernetesスタイルのヘルスチェック
  fastify.get('/healthz', async (request, reply) => {
    return { status: 'ok' };
  });

  // 詳細なレディネスチェック（依存関係の状態含む）
  fastify.get('/readiness', async (request, reply) => {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        discord: 'unknown',
        database: 'unknown',
      },
      details: {
        discord: {},
        database: {},
      },
    };

    // Discord Bot の状態チェック
    try {
      if (fastify.discord && fastify.discord.isReady()) {
        status.services.discord = 'healthy';
        status.details.discord = {
          user: fastify.discord.user?.tag,
          guilds: fastify.discord.guilds.cache.size,
          uptime: fastify.discord.uptime ? Math.floor(fastify.discord.uptime / 1000) : 0,
        };
      } else {
        status.services.discord = 'unhealthy';
        status.details.discord = { error: 'Discord client not ready' };
      }
    } catch (error) {
      status.services.discord = 'error';
      status.details.discord = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // データベースの状態チェック
    try {
      if (fastify.db) {
        // 簡単なクエリでデータベース接続をテスト
        await fastify.db.execute('SELECT 1');
        
        // テーブルの存在確認
        const tables = await fastify.db.execute(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name IN ('notifications', 'voice_sessions')
        `);
        
        status.services.database = 'healthy';
        status.details.database = {
          tables: tables.rows.map(row => row.name),
          tablesCount: tables.rows.length,
        };
      } else {
        status.services.database = 'unhealthy';
        status.details.database = { error: 'Database client not available' };
      }
    } catch (error) {
      status.services.database = 'error';
      status.details.database = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // 全体のステータス判定
    const hasUnhealthyServices = Object.values(status.services).some(
      service => service === 'unhealthy' || service === 'error'
    );

    if (hasUnhealthyServices) {
      status.status = 'degraded';
      reply.code(503); // Service Unavailable
    }

    return status;
  });

  // データベース統計情報
  fastify.get('/stats', async (request, reply) => {
    try {
      if (!fastify.db) {
        reply.code(503);
        return { error: 'Database not available' };
      }

      // 通知設定の統計
      const notificationsCount = await fastify.db.execute(
        'SELECT COUNT(*) as count FROM notifications'
      );
      
      const notificationsByGuild = await fastify.db.execute(`
        SELECT guildId, COUNT(*) as count 
        FROM notifications 
        GROUP BY guildId
      `);

      // ボイスセッションの統計
      const activeSessionsCount = await fastify.db.execute(
        'SELECT COUNT(*) as count FROM voice_sessions WHERE isActive = true'
      );
      
      const totalSessionsCount = await fastify.db.execute(
        'SELECT COUNT(*) as count FROM voice_sessions'
      );

      // 今日のセッション数
      const todaySessionsCount = await fastify.db.execute(`
        SELECT COUNT(*) as count 
        FROM voice_sessions 
        WHERE date(startTime) = date('now')
      `);

      return {
        timestamp: new Date().toISOString(),
        notifications: {
          total: notificationsCount.rows[0]?.count || 0,
          byGuild: notificationsByGuild.rows.map(row => ({
            guildId: row.guildId,
            count: row.count,
          })),
        },
        voiceSessions: {
          active: activeSessionsCount.rows[0]?.count || 0,
          total: totalSessionsCount.rows[0]?.count || 0,
          today: todaySessionsCount.rows[0]?.count || 0,
        },
      };
    } catch (error) {
      fastify.log.error('Error fetching stats:', error);
      reply.code(500);
      return { 
        error: 'Failed to fetch stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
};

export default healthRoutes;