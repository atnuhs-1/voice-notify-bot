import { config } from 'dotenv'
import Fastify, { FastifyInstance } from 'fastify'
import app from './app'

// 環境変数読み込み
config()

// Fastifyインスタンス作成
const server: FastifyInstance = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  }
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