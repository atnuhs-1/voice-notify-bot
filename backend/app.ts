import { join } from 'path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'

// プラグインを直接インポート（依存関係順）
import supportPlugin from './plugins/support'
import envPlugin from './plugins/env'
import databasePlugin from './plugins/database'
import discordPlugin from './plugins/discord'
import authPlugin from './plugins/auth'
import commandsPlugin from './plugins/commands'
import keepalivePlugin from './plugins/keepalive'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {
  // Discord Bot関連のオプションも追加可能
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // アプリケーション初期化ログ
  fastify.log.info('🔧 Initializing application...')

  // プラグインを依存関係順で手動登録
  fastify.log.info('📦 Loading plugins in dependency order...')
  
  await fastify.register(supportPlugin)
  fastify.log.info('✅ Support plugin loaded')
  
  await fastify.register(envPlugin)
  fastify.log.info('✅ Environment plugin loaded')
  
  await fastify.register(databasePlugin)
  fastify.log.info('✅ Database plugin loaded')
  
  await fastify.register(discordPlugin)
  fastify.log.info('✅ Discord plugin loaded')

  await fastify.register(authPlugin)           // 認証プラグイン追加
  fastify.log.info('✅ Authentication plugin loaded')
  
  await fastify.register(commandsPlugin)
  fastify.log.info('✅ Commands plugin loaded')
  
  await fastify.register(keepalivePlugin)
  fastify.log.info('✅ Keep-alive plugin loaded')

  // ルートの自動読み込み
  // API エンドポイント
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts
  })

  // CORS設定
  fastify.register(cors, {
    // 特定のオリジンからのリクエストのみを許可
    origin: ['http://localhost:5173', 'http://127.0.0.1','http://127.0.0.1:5173','https://your-production-domain.com'],
  })

  // ルート一覧を表示
  fastify.ready().then(() => {
    console.log('\n📋 Registered routes:')
    console.log(fastify.printRoutes())
    console.log('==================\n')
  })

  fastify.log.info('✅ Application initialized successfully')
}

export default app