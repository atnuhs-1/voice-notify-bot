import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'

// JWT ペイロードの型定義
interface JWTPayload {
  userId: string
  username: string
  discriminator: string
  avatar: string | null
  guilds: Array<{
    id: string
    name: string
    permissions: string
    owner: boolean
    icon: string | null
  }>
  iat?: number
  exp?: number
}

// Discord OAuth2 レスポンスの型定義
interface DiscordUser {
  id: string
  username: string
  discriminator: string
  avatar: string | null
}

interface DiscordGuild {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
  features: string[]
}

// Fastify インスタンスの拡張
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    generateJWT: (payload: Omit<JWTPayload, 'iat' | 'exp'>) => string
    verifyJWT: (token: string) => JWTPayload | null
    checkServerAdmin: (userId: string, guildId: string) => Promise<boolean>
  }
  
  interface FastifyRequest {
    user?: JWTPayload
  }
}

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 環境変数のチェック
  const requiredEnvVars = [
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET', 
    'DISCORD_REDIRECT_URI',
    'JWT_SECRET'
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`${envVar} environment variable is required for authentication`)
    }
  }

  fastify.log.info('🔐 Authentication environment variables validated')

  // JWT トークン生成
  const generateJWT = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: '24h',
      issuer: 'discord-bot-dashboard'
    })
  }

  // JWT トークン検証
  const verifyJWT = (token: string): JWTPayload | null => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
      return decoded
    } catch (error) {
      fastify.log.debug('JWT verification failed:', error)
      return null
    }
  }

  // 認証ミドルウェア
  const authenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Authorization ヘッダーからトークンを取得
      const authHeader = request.headers.authorization
      if (!authHeader) {
        return reply.code(401).send({ 
          error: 'Authorization header is required',
          code: 'MISSING_AUTH'
        })
      }

      // Bearer トークンの形式チェック
      const token = authHeader.replace('Bearer ', '')
      if (!token || token === authHeader) {
        return reply.code(401).send({ 
          error: 'Invalid authorization format. Use: Bearer <token>',
          code: 'INVALID_AUTH_FORMAT'
        })
      }

      // JWT トークンを検証
      const decoded = verifyJWT(token)
      if (!decoded) {
        return reply.code(401).send({ 
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        })
      }

      // リクエストにユーザー情報を添付
      request.user = decoded
      fastify.log.debug(`Authenticated user: ${decoded.username}#${decoded.discriminator}`)
      
    } catch (error) {
      fastify.log.error('Authentication error:', error)
      return reply.code(500).send({ 
        error: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR'
      })
    }
  }

  // サーバー管理者権限チェック
  const checkServerAdmin = async (userId: string, guildId: string): Promise<boolean> => {
    try {
      // Discord Bot経由でサーバー情報を取得
      const guild = fastify.discord.guilds.cache.get(guildId)
      if (!guild) {
        return false
      }

      // メンバー情報を取得
      const member = await guild.members.fetch(userId).catch(() => null)
      if (!member) {
        return false
      }

      // 管理者権限チェック
      const ADMINISTRATOR_PERMISSION = 0x8n // BigInt形式
      const hasAdminPermission = member.permissions.has('Administrator')
      const isOwner = guild.ownerId === userId

      return hasAdminPermission || isOwner
    } catch (error) {
      fastify.log.error(`Server admin check failed for user ${userId} in guild ${guildId}:`, error)
      return false
    }
  }

  // Discord API との通信用ヘルパー関数
  const fetchDiscordAPI = async (endpoint: string, token: string) => {
    const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Fastify インスタンスにデコレート
  fastify.decorate('authenticate', authenticate)
  fastify.decorate('generateJWT', generateJWT)
  fastify.decorate('verifyJWT', verifyJWT)
  fastify.decorate('checkServerAdmin', checkServerAdmin)

  // Discord API ヘルパーもデコレート
  fastify.decorate('fetchDiscordAPI', fetchDiscordAPI)
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['env', 'database', 'discord'], // Discord クライアントに依存
})