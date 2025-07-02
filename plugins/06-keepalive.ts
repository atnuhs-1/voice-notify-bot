import fp from 'fastify-plugin'
import cron from 'node-cron'
import type { FastifyPluginAsync } from 'fastify'

const simpleKeepAlivePlugin: FastifyPluginAsync = async (fastify) => {
  const HEALTH_CHECK_URL = process.env.KOYEB_PUBLIC_DOMAIN 
    ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}/health`
    : `http://localhost:${process.env.PORT || 8000}/health`

  // 10分ごとにヘルスチェックを実行
  const startHealthCheckCron = () => {
    cron.schedule("* * * * *", async () => {
      try {
        const now = new Date().toLocaleString('ja-JP')
        fastify.log.info(`🔍 [${now}] ヘルスチェック実行中... (${HEALTH_CHECK_URL})`)
        
        const response = await fetch(HEALTH_CHECK_URL, {
          headers: { 'X-Keep-Alive': 'true' }
        })

        if (response.ok) {
          fastify.log.info(`✅ [${now}] ヘルスチェック成功: ${response.status}`)
        } else {
          fastify.log.warn(`⚠️ [${now}] ヘルスチェック失敗: ${response.status}`)
        }
      } catch (error: any) {
        const now = new Date().toLocaleString('ja-JP')
        fastify.log.error(`❌ [${now}] ヘルスチェックエラー:`, error?.message || error)
      }
    })

    fastify.log.info("🕐 ヘルスチェックの定期実行を開始しました (10分間隔)")
    fastify.log.info(`🎯 対象URL: ${HEALTH_CHECK_URL}`)
  }

  // 本番環境でのみ実行
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_KEEP_ALIVE !== 'false') {
    fastify.addHook('onReady', async () => {
      // 30秒後に開始（アプリ安定化のため）
      setTimeout(() => {
        startHealthCheckCron()
      }, 30000)
    })
  } else {
    fastify.log.info('🔄 ヘルスチェック無効（開発環境）')
  }
}

export default fp(simpleKeepAlivePlugin, {
  name: 'simpleKeepAlive'
})