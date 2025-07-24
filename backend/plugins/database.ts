import fp from 'fastify-plugin';
import { createClient, Client } from '@libsql/client';
import type { FastifyPluginAsync } from 'fastify';

// データベースクライアントの型定義
declare module 'fastify' {
  interface FastifyInstance {
    db: Client;
    dbHelpers: DatabaseHelpers;
  }
}

// データベースヘルパー関数の型定義
interface DatabaseHelpers {
  // Notifications テーブル操作
  getNotifications(guildId: string, textChannelId?: string): Promise<Notification[]>;
  setNotifications(guildId: string, textChannelId: string, voiceChannelIds: string[]): Promise<void>;
  deleteNotifications(guildId: string, textChannelId: string): Promise<void>;
  
  // VoiceSessions テーブル操作
  startVoiceSession(guildId: string, channelId: string): Promise<number>;
  endVoiceSession(guildId: string, channelId: string): Promise<VoiceSession | null>;
  getActiveSession(guildId: string, channelId: string): Promise<VoiceSession | null>;
}

// データモデルの型定義
interface Notification {
  id: number;
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  createdAt: string;
}

interface VoiceSession {
  id: number;
  guildId: string;
  channelId: string;
  startTime: string;
  endTime: string | null;
  isActive: boolean;
  createdAt: string;
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  // 環境変数のチェック
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL environment variable is required');
  }

  // Tursoクライアントの作成
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN, // オプション：プライベートDBの場合
  });

  fastify.log.info('Connecting to Turso database...');

  try {
    // 接続テスト
    await client.execute('SELECT 1');
    fastify.log.info('✅ Turso database connected successfully');

    // テーブル作成
    await initializeTables(client, fastify.log);
    fastify.log.info('✅ Database tables initialized');

  } catch (error) {
    fastify.log.error('❌ Failed to connect to Turso database:', error);
    throw error;
  }

  // データベースヘルパー関数
  const dbHelpers: DatabaseHelpers = {
    // Notifications テーブル操作
    async getNotifications(guildId: string, textChannelId?: string) {
      let query = 'SELECT * FROM notifications WHERE guildId = ?';
      let params: any[] = [guildId];

      if (textChannelId) {
        query += ' AND textChannelId = ?';
        params.push(textChannelId);
      }

      const result = await client.execute({
        sql: query,
        args: params,
      });

      return result.rows.map(row => ({
        id: row.id as number,
        guildId: row.guildId as string,
        voiceChannelId: row.voiceChannelId as string,
        textChannelId: row.textChannelId as string,
        createdAt: row.createdAt as string,
      }));
    },

    async setNotifications(guildId: string, textChannelId: string, voiceChannelIds: string[]) {
      const now = new Date().toISOString(); // ISO形式で統一
      
      // トランザクション：既存設定を削除して新規作成
      await client.batch([
        // 既存設定を削除
        {
          sql: 'DELETE FROM notifications WHERE guildId = ? AND textChannelId = ?',
          args: [guildId, textChannelId],
        },
        // 新規設定を作成（createdAtも明示的に設定）
        ...voiceChannelIds.map(voiceChannelId => ({
          sql: 'INSERT INTO notifications (guildId, voiceChannelId, textChannelId, createdAt) VALUES (?, ?, ?, ?)',
          args: [guildId, voiceChannelId, textChannelId, now],
        })),
      ]);
    },

    async deleteNotifications(guildId: string, textChannelId: string) {
      await client.execute({
        sql: 'DELETE FROM notifications WHERE guildId = ? AND textChannelId = ?',
        args: [guildId, textChannelId],
      });
    },

    // 修正: JavaScript でISO形式の時刻を生成
    async startVoiceSession(guildId: string, channelId: string) {
      const now = new Date().toISOString(); // "2025-07-23T13:35:01.000Z"
      
      const result = await client.execute({
        sql: 'INSERT INTO voice_sessions (guildId, channelId, startTime, isActive) VALUES (?, ?, ?, true)',
        args: [guildId, channelId, now], // ISO形式で保存
      });

      return Number(result.lastInsertRowid);
    },

    // 修正: endTime もISO形式で保存
    async endVoiceSession(guildId: string, channelId: string) {
      // アクティブなセッションを取得
      const activeSession = await this.getActiveSession(guildId, channelId);
      if (!activeSession) return null;

      const now = new Date().toISOString(); // "2025-07-23T13:35:01.000Z"

      // セッションを終了
      await client.execute({
        sql: 'UPDATE voice_sessions SET endTime = ?, isActive = false WHERE id = ?',
        args: [now, activeSession.id], // ISO形式で保存
      });

      // 更新されたセッションを返す
      const result = await client.execute({
        sql: 'SELECT * FROM voice_sessions WHERE id = ?',
        args: [activeSession.id],
      });

      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id as number,
        guildId: row.guildId as string,
        channelId: row.channelId as string,
        startTime: row.startTime as string,
        endTime: row.endTime as string,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt as string,
      };
    },

    async getActiveSession(guildId: string, channelId: string) {
      const result = await client.execute({
        sql: 'SELECT * FROM voice_sessions WHERE guildId = ? AND channelId = ? AND isActive = true ORDER BY startTime DESC LIMIT 1',
        args: [guildId, channelId],
      });

      const row = result.rows[0];
      if (!row) return null;

      return {
        id: row.id as number,
        guildId: row.guildId as string,
        channelId: row.channelId as string,
        startTime: row.startTime as string,
        endTime: row.endTime as string | null,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt as string,
      };
    },
  };

  // Fastifyインスタンスに登録
  fastify.decorate('db', client);
  fastify.decorate('dbHelpers', dbHelpers);

  // アプリケーション終了時のクリーンアップ
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing Turso database connection...');
    client.close();
  });
};

// テーブル初期化関数
async function initializeTables(client: Client, logger: any) {
  // Notifications テーブル
  await client.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      voiceChannelId TEXT NOT NULL,
      textChannelId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // VoiceSessions テーブル
  await client.execute(`
    CREATE TABLE IF NOT EXISTS voice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId TEXT NOT NULL,
      channelId TEXT NOT NULL,
      startTime DATETIME NOT NULL,
      endTime DATETIME,
      isActive BOOLEAN DEFAULT true,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // インデックス作成（パフォーマンス向上）
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_notifications_guild_text 
    ON notifications(guildId, textChannelId)
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_voice_sessions_active 
    ON voice_sessions(guildId, channelId, isActive)
  `);

  logger.info('✅ Database tables and indexes created/verified');
}

export default fp(databasePlugin, {
  name: 'database',
  dependencies: ['env'], // env プラグインに依存
});