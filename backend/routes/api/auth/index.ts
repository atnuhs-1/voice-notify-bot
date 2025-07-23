import { FastifyPluginAsync } from 'fastify'

// Discord OAuth2 の型定義
interface DiscordTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
}

interface DiscordUser {
  id: string
  username: string
  discriminator: string
  avatar: string | null
  bot?: boolean
  system?: boolean
  mfa_enabled?: boolean
  banner?: string | null
  accent_color?: number | null
  locale?: string
  verified?: boolean
  email?: string | null
  flags?: number
  premium_type?: number
  public_flags?: number
}

interface DiscordGuild {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
  features: string[]
}

const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {

  // Discord OAuth2 認証開始エンドポイント
  fastify.get('/discord', async function (request, reply) {
    try {
      const CLIENT_ID = process.env.DISCORD_CLIENT_ID!
      const REDIRECT_URI = encodeURIComponent(process.env.DISCORD_REDIRECT_URI!)
      const SCOPES = 'identify+guilds'

      // Discord OAuth2 認証URLを生成
      const authUrl = `https://discord.com/api/oauth2/authorize?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${REDIRECT_URI}&` +
        `response_type=code&` +
        `scope=${SCOPES}&` +
        `prompt=consent` // 毎回確認画面を表示

      fastify.log.info(`Discord OAuth2 redirect to: ${authUrl}`)

      // Discord認証画面にリダイレクト
      return reply.redirect(authUrl)

    } catch (error) {
      fastify.log.error('Discord OAuth2 start error:', error)
      return reply.code(500).send({
        error: 'Failed to start Discord authentication',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Discord OAuth2 コールバックエンドポイント
  fastify.get('/callback', async function (request, reply) {
    try {
      const { code, error: authError } = request.query as { 
        code?: string
        error?: string 
      }

      // 認証エラーのチェック
      if (authError) {
        fastify.log.warn(`Discord OAuth2 error: ${authError}`)
        return reply.code(400).send({
          error: 'Discord authentication failed',
          details: authError
        })
      }

      if (!code) {
        return reply.code(400).send({
          error: 'Authorization code is required'
        })
      }

      fastify.log.info('Discord OAuth2 callback received, exchanging code for token...')

      // 1. 認証コードをアクセストークンに交換
      const tokenData = await exchangeCodeForToken(code)
      
      // 2. ユーザー情報を取得
      const userData = await fetchDiscordUser(tokenData.access_token)
      
      // 3. ユーザーが参加しているサーバー一覧を取得
      const userGuilds = await fetchUserGuilds(tokenData.access_token)
      
      // 4. Botが参加しているサーバーと照合
      const availableGuilds = await filterAvailableGuilds(userGuilds)
      
      // 5. 管理者権限があるサーバーのみに絞り込み
      const adminGuilds = filterAdminGuilds(availableGuilds)

      if (adminGuilds.length === 0) {
        return reply.code(403).send({
          error: 'No administrative permissions found',
          message: 'このBotが参加しているサーバーで管理者権限を持っていません。'
        })
      }

      // 6. JWTトークンを生成
      const jwtPayload = {
        userId: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar,
        guilds: adminGuilds
      }

      const jwtToken = fastify.generateJWT(jwtPayload)

      fastify.log.info(`User authenticated: ${userData.username}#${userData.discriminator} (${adminGuilds.length} admin guilds)`)

      // 7. フロントエンドにリダイレクト（トークンをクエリパラメータで渡す）
      const frontendUrl = process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL || 'https://your-production-domain.com'
        : 'http://localhost:5173'
      
      return reply.redirect(`${frontendUrl}?token=${jwtToken}`)

    } catch (error) {
      fastify.log.error('Discord OAuth2 callback error:', error)
      return reply.code(500).send({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 現在のユーザー情報を取得
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    try {
      const user = request.user!

      return {
        user: {
          id: user.userId,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar,
          tag: `${user.username}#${user.discriminator}`
        },
        guilds: user.guilds,
        permissions: {
          adminGuilds: user.guilds.length
        },
        tokenInfo: {
          issuedAt: new Date(user.iat! * 1000).toISOString(),
          expiresAt: new Date(user.exp! * 1000).toISOString()
        }
      }
    } catch (error) {
      fastify.log.error('Get user info error:', error)
      return reply.code(500).send({
        error: 'Failed to get user information'
      })
    }
  })

  // ログアウト
  fastify.post('/logout', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    try {
      const user = request.user!
      fastify.log.info(`User logout: ${user.username}#${user.discriminator}`)

      return {
        message: 'Logout successful'
      }
    } catch (error) {
      fastify.log.error('Logout error:', error)
      return reply.code(500).send({
        error: 'Logout failed'
      })
    }
  })

  // トークンリフレッシュ（将来的な実装用）
  fastify.post('/refresh', async function (request, reply) {
    return reply.code(501).send({
      error: 'Token refresh not implemented yet',
      message: 'Please login again to get a new token'
    })
  })

  // ヘルパー関数：認証コードをアクセストークンに交換
  async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
    const tokenUrl = 'https://discord.com/api/oauth2/token'
    
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
    }

    return response.json() as Promise<DiscordTokenResponse>
  }

  // ヘルパー関数：Discordユーザー情報を取得
  async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user data: ${response.status}`)
    }

    return response.json() as Promise<DiscordUser>
  }

  // ヘルパー関数：ユーザーが参加しているサーバー一覧を取得
  async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user guilds: ${response.status}`)
    }

    return response.json() as Promise<DiscordGuild[]>
  }

  // ヘルパー関数：Botが参加しているサーバーと照合
  async function filterAvailableGuilds(userGuilds: DiscordGuild[]): Promise<DiscordGuild[]> {
    const botGuilds = fastify.discord.guilds.cache

    return userGuilds.filter(userGuild => {
      const botGuild = botGuilds.get(userGuild.id)
      return botGuild !== undefined
    })
  }

  // ヘルパー関数：管理者権限があるサーバーのみに絞り込み
  function filterAdminGuilds(guilds: DiscordGuild[]): DiscordGuild[] {
    const ADMINISTRATOR_PERMISSION = 0x8

    return guilds.filter(guild => {
      // サーバーオーナーまたは管理者権限を持っている
      if (guild.owner) {
        return true
      }

      const permissions = parseInt(guild.permissions)
      return (permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION
    })
  }
}

export default authRoutes