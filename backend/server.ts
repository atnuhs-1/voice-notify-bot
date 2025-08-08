import { config } from 'dotenv'
import Fastify, { FastifyInstance } from 'fastify'
import app from './app'

// 環境変数読み込み
config()

let reqSeq = 0
const SLOW_WARN_MS = Number(process.env.SLOW_WARN_MS || 2000)

// プラグインタイムアウト（ms）
const pluginTimeout = Number(process.env.PLUGIN_TIMEOUT_MS || '30000')

// Fastifyインスタンス作成
const server: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    },
    redact: ['req.headers.authorization'],
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url }
      },
      res(res) {
        return { statusCode: res.statusCode }
      }
    }
  },
  disableRequestLogging: true, // 標準の "incoming request"/"request completed" を無効化
  genReqId() {
    return `req-${(++reqSeq).toString(36)}`
  },
  pluginTimeout,
})
server.log.info({ pluginTimeout }, 'Plugin timeout configured')

// 1行サマリ用フック
server.addHook('onResponse', (req, reply, done) => {
  if (req.method === 'OPTIONS') return done()
  const ms = reply.elapsedTime ?? 0
  let level: 'info' | 'warn' | 'error' = 'info'
  if (reply.statusCode >= 500) level = 'error'
  else if (ms > SLOW_WARN_MS) level = 'warn'
  ;(req.log as any)[level](
    {
      reqId: req.id,
      method: req.method,
      url: req.url,
      status: reply.statusCode,
      ms: +ms.toFixed(1),
    },
    `${req.method} ${req.url} ${reply.statusCode} ${ms.toFixed(1)}ms`
  )
  done()
})

// 詳細なエラー情報を表示する関数
const logDetailedError = (error: any, context: string) => {
  console.error(`\n=== ${context} ===`)
  console.error('Error:', error)
  console.error('Error message:', error?.message)
  console.error('Error stack:', error?.stack)
  console.error('Error cause:', error?.cause)
  console.error('========================\n')
}

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  server.log.info(`Received ${signal}, shutting down gracefully...`)
  
  try {
    await server.close()
    server.log.info('Server closed successfully')
    process.exit(0)
  } catch (err) {
    server.log.error('Error during shutdown:', err)
    process.exit(1)
  }
}

// シグナルハンドリング
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// サーバー起動
const start = async (): Promise<void> => {
  try {
    // プラグイン登録
    await server.register(app)
    
    const port = Number(process.env.PORT) || 3000
    const host = process.env.HOST || '0.0.0.0'

    await server.listen({ port, host })
    
    server.log.info(`🚀 Server ready at http://${host}:${port}`)
    server.log.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`)
    
  } catch (err) {
    logDetailedError(err, 'Server Start Error')
    server.log.error('❌ Server failed to start:', err)
    process.exit(1)
  }
}

// 未処理エラーのハンドリング
process.on('unhandledRejection', (reason, promise) => {
  logDetailedError(reason, 'Unhandled Rejection')
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  logDetailedError(error, 'Uncaught Exception')
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

start()