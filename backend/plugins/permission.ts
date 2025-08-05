/**
 * 権限チェックプラグイン
 * VIEW/MANAGE/EXECUTE権限レベルの実装
 */

import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { PermissionLevel } from '../types/api';

// Fastify型拡張
declare module 'fastify' {
  interface FastifyInstance {
    requirePermission: (level: PermissionLevel) => preHandlerHookHandler;
    checkUserPermission: (userId: string, guildId: string, level: PermissionLevel) => Promise<boolean>;
    getUserPermissionLevel: (userId: string, guildId: string) => Promise<PermissionLevel>;
  }

  // Fastify Reply型拡張
  interface FastifyReply {
    withPermissions: (data: any, guildId: string, userId: string) => Promise<FastifyReply>;
  }
}

const permissionPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ユーザーの権限レベルを判定
  const getUserPermissionLevel = async (userId: string, guildId: string): Promise<PermissionLevel> => {
    try {
      // Discord Botクライアントからギルド情報を取得
      const guild = fastify.discord.guilds.cache.get(guildId);
      if (!guild) {
        // Botがサーバーにいない場合は閲覧権限のみ
        return PermissionLevel.VIEW;
      }

      // メンバー情報を取得
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        // メンバーでない場合は権限なし（VIEWも不可）
        return PermissionLevel.VIEW; // 一般ユーザーとして扱う
      }

      // サーバーオーナーの場合
      if (guild.ownerId === userId) {
        return PermissionLevel.EXECUTE;
      }

      // 管理者権限を持つ場合
      if (member.permissions.has('Administrator')) {
        return PermissionLevel.EXECUTE;
      }

      // サーバー管理権限を持つ場合
      if (member.permissions.has('ManageGuild')) {
        return PermissionLevel.MANAGE;
      }

      // チャンネル管理権限を持つ場合
      if (member.permissions.has('ManageChannels')) {
        return PermissionLevel.MANAGE;
      }

      // メッセージ管理権限を持つ場合（モデレーター相当）
      if (member.permissions.has('ManageMessages')) {
        return PermissionLevel.VIEW;
      }

      // 一般メンバー
      return PermissionLevel.VIEW;

    } catch (error) {
      fastify.log.error(`Permission check failed for user ${userId} in guild ${guildId}:`, error);
      // エラー時は最低権限を返す
      return PermissionLevel.VIEW;
    }
  };

  // 特定の権限レベルをチェック
  const checkUserPermission = async (
    userId: string, 
    guildId: string, 
    requiredLevel: PermissionLevel
  ): Promise<boolean> => {
    const userLevel = await getUserPermissionLevel(userId, guildId);
    
    // 権限レベルの階層チェック
    const levels = [PermissionLevel.VIEW, PermissionLevel.MANAGE, PermissionLevel.EXECUTE];
    const userLevelIndex = levels.indexOf(userLevel);
    const requiredLevelIndex = levels.indexOf(requiredLevel);
    
    return userLevelIndex >= requiredLevelIndex;
  };

  // 権限チェックミドルウェア
  const requirePermission = (requiredLevel: PermissionLevel): preHandlerHookHandler => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // 認証チェック（authプラグインが既に実行されている前提）
      if (!request.user) {
        return reply.unauthorized('このAPIにアクセスするには認証が必要です');
      }

      // guildIdをパラメータから取得
      const params = request.params as { guildId?: string };
      const guildId = params.guildId;
      
      if (!guildId) {
        return reply.validationError(
          'guildIdパラメータが必要です',
          'guildId',
          undefined,
          'URLパラメータにguildIdを含めてください'
        );
      }

      // Guild ID の形式チェック（Discord Snowflake形式）
      if (!/^\d{17,19}$/.test(guildId)) {
        return reply.validationError(
          '無効なguildIDです',
          'guildId',
          guildId,
          'guildIDは17-19桁の数字である必要があります'
        );
      }

      // 権限チェック
      const hasPermission = await checkUserPermission(
        request.user.userId,
        guildId,
        requiredLevel
      );

      if (!hasPermission) {
        const userLevel = await getUserPermissionLevel(request.user.userId, guildId);
        
        return reply.forbidden(
          `この操作には${getPermissionLevelName(requiredLevel)}権限が必要です`,
          {
            required: requiredLevel,
            current: userLevel,
            guildId
          }
        );
      }

      // 権限チェック通過
      fastify.log.debug(`Permission granted: user ${request.user.userId} has ${requiredLevel} access to guild ${guildId}`);
    };
  };

  // Fastifyインスタンスにデコレート
  fastify.decorate('requirePermission', requirePermission);
  fastify.decorate('checkUserPermission', checkUserPermission);
  fastify.decorate('getUserPermissionLevel', getUserPermissionLevel);

  // レスポンスに権限情報を追加するヘルパー
  fastify.decorateReply('withPermissions', async function (
    this: FastifyReply,
    data: any,
    guildId: string,
    userId: string
  ) {
    const userLevel = await getUserPermissionLevel(userId, guildId);
    
    const permissions = {
      level: userLevel,
      canViewStatistics: userLevel === PermissionLevel.VIEW || 
                        userLevel === PermissionLevel.MANAGE || 
                        userLevel === PermissionLevel.EXECUTE,
      canManageSettings: userLevel === PermissionLevel.MANAGE || 
                        userLevel === PermissionLevel.EXECUTE,
      canExecuteActions: userLevel === PermissionLevel.EXECUTE
    };

    return this.success({
      ...data,
      permissions
    });
  });
};

// 権限レベル名を取得するヘルパー関数
function getPermissionLevelName(level: PermissionLevel): string {
  switch (level) {
    case PermissionLevel.VIEW:
      return '閲覧';
    case PermissionLevel.MANAGE:
      return '管理';
    case PermissionLevel.EXECUTE:
      return '実行';
    default:
      return '不明';
  }
}

export default fp(permissionPlugin, {
  name: 'permission',
  dependencies: ['auth', 'discord', 'response'] // auth, discord, responseプラグインに依存
});