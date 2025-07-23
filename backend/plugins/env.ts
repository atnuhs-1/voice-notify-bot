import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { config } from 'dotenv'

// 環境変数の型定義
interface Config {
  PORT: string
  NODE_ENV: string
  HOST: string
  LOG_LEVEL: string
  DISCORD_TOKEN?: string
  DISCORD_APPLICATION_ID?: string
  TURSO_DATABASE_URL?: string
  TURSO_AUTH_TOKEN?: string
}

// Fastifyインスタンスの拡張型定義
declare module 'fastify' {
  interface FastifyInstance {
    config: Config
  }
}

// 環境変数読み込みプラグイン
const envPlugin: FastifyPluginAsync = async function (fastify, opts) {
  // dotenv設定
  config()

  const appConfig: Config = {
    PORT: process.env.PORT || '3000',
    NODE_ENV: process.env.NODE_ENV || 'development',
    HOST: process.env.HOST || '0.0.0.0',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  }

  // Fastifyインスタンスに設定を追加
  fastify.decorate('config', appConfig)
  
  fastify.log.info('🔧 Environment configuration loaded')
  
  // Discord設定の確認
  if (appConfig.DISCORD_TOKEN) {
    fastify.log.info('🤖 Discord Token detected')
  } else {
    fastify.log.warn('⚠️ Discord Token not found in environment variables')
  }

  if (appConfig.DISCORD_APPLICATION_ID) {
    fastify.log.info('🆔 Discord Application ID detected')
  } else {
    fastify.log.warn('⚠️ Discord Application ID not found in environment variables')
  }
}

export default fp(envPlugin, {
  name: 'env'
})