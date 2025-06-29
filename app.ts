import { join } from 'path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {
  // Discord Bot関連のオプションも追加可能
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // アプリケーション初期化ログ
  fastify.log.info('🔧 Initializing application...')

  // プラグインの自動読み込み
  // 共通機能（DB接続、Discord Bot、認証など）
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts
  })

  // ルートの自動読み込み
  // API エンドポイント
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts
  })

  fastify.log.info('✅ Application initialized successfully')
}

export default app