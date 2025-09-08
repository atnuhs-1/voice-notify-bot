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
import responsePlugin from './plugins/response'
import permissionPlugin from './plugins/permission'
import commandsPlugin from './plugins/commands'
import schedulerPlugin from './plugins/scheduler'
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

  await fastify.register(authPlugin)
  fastify.log.info('✅ Authentication plugin loaded')
  
  await fastify.register(responsePlugin)
  fastify.log.info('✅ Response plugin loaded')
  
  await fastify.register(permissionPlugin)
  fastify.log.info('✅ Permission plugin loaded')
  
  await fastify.register(commandsPlugin)
  fastify.log.info('✅ Commands plugin loaded')
  
  await fastify.register(schedulerPlugin)
  fastify.log.info('✅ Scheduler plugin loaded')
  
  await fastify.register(keepalivePlugin)
  fastify.log.info('✅ Keep-alive plugin loaded')

  // ルートの自動読み込み
  // API エンドポイント
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts
  })

  // CORS設定を環境変数から取得
  const getCorsOrigins = (): string[] => {
    const corsOrigins = process.env.CORS_ORIGINS;
    if (corsOrigins) {
      return corsOrigins.split(',').map(origin => origin.trim());
    }
    return ['']; 
  };

  // CORS設定
  fastify.register(cors, {
    origin: getCorsOrigins(),
    credentials: true, // 認証情報を含むリクエストを許可
  });

  // ルート一覧を表示
  fastify.ready().then(() => {
    console.log('\n📋 Registered routes:')
    console.log(fastify.printRoutes())
    console.log('==================\n')
  })

  fastify.log.info('✅ Application initialized successfully')
}

export default app