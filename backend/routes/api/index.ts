import { FastifyPluginAsync } from 'fastify'

const apiRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // NOTE: AutoLoadが有効なため、v1ディレクトリは自動的に /v1 プレフィックスで読み込まれます
  // 手動でregisterする必要はありません
  
  // 統計情報API（認証必須）
  fastify.get('/stats', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    const discordBot = fastify.discord
    const user = request.user!

    if (!discordBot || !discordBot.isReady()) {
      return reply.code(503).send({
        error: 'Discord bot is not ready',
        status: 'offline'
      })
    }

    try {
      // ユーザーが管理権限を持つサーバーIDの配列
      const userAdminGuildIds = user.guilds.map(g => g.id)

      // ユーザーの管理サーバーのみでフィルタリング
      const userGuilds = discordBot.guilds.cache.filter(guild => 
        userAdminGuildIds.includes(guild.id)
      )

      // Bot基本統計（ユーザーの管理サーバーのみ）
      const totalMembers = userGuilds.reduce((acc, guild) => acc + guild.memberCount, 0)
      const totalChannels = userGuilds.reduce((acc, guild) => acc + guild.channels.cache.size, 0)
      const totalVoiceChannels = userGuilds.reduce((acc, guild) => 
        acc + guild.channels.cache.filter(ch => ch.type === 2).size, 0)

      // アクティブなボイスチャンネル（誰かが入室中）
      const activeVoiceChannels = userGuilds.reduce((acc, guild) => {
        const activeInGuild = guild.voiceStates.cache
          .filter(vs => vs.channelId)
          .map(vs => vs.channelId)
        return acc + new Set(activeInGuild).size
      }, 0)

      // 現在ボイスチャンネルにいるユーザー数
      const usersInVoice = userGuilds.reduce((acc, guild) => 
        acc + guild.voiceStates.cache.filter(vs => vs.channelId).size, 0)

      // データベース統計（ユーザーの管理サーバーのみ）
      let dbStats = {}
      if (fastify.db) {
        try {
          // ユーザーの管理サーバーのみの通知設定数
          const notificationsQuery = userAdminGuildIds.length > 0 
            ? `SELECT COUNT(*) as count FROM notifications WHERE guildId IN (${userAdminGuildIds.map(() => '?').join(',')})`
            : 'SELECT 0 as count'
          
          const notificationsResult = await fastify.db.execute({
            sql: notificationsQuery,
            args: userAdminGuildIds
          })

          // アクティブセッション数（ユーザーの管理サーバーのみ）
          const activeSessionsQuery = userAdminGuildIds.length > 0
            ? `SELECT COUNT(*) as count FROM voice_sessions WHERE isActive = true AND guildId IN (${userAdminGuildIds.map(() => '?').join(',')})`
            : 'SELECT 0 as count'
          
          const activeSessionsResult = await fastify.db.execute({
            sql: activeSessionsQuery,
            args: userAdminGuildIds
          })

          // 総セッション数（ユーザーの管理サーバーのみ）
          const totalSessionsQuery = userAdminGuildIds.length > 0
            ? `SELECT COUNT(*) as count FROM voice_sessions WHERE guildId IN (${userAdminGuildIds.map(() => '?').join(',')})`
            : 'SELECT 0 as count'
          
          const totalSessionsResult = await fastify.db.execute({
            sql: totalSessionsQuery,
            args: userAdminGuildIds
          })
          
          dbStats = {
            notifications: notificationsResult.rows[0]?.count as number || 0,
            activeSessions: activeSessionsResult.rows[0]?.count as number || 0,
            totalSessions: totalSessionsResult.rows[0]?.count as number || 0
          }
        } catch (dbError) {
          fastify.log.error('Database stats error:', dbError)
          dbStats = { error: 'Database error' }
        }
      }

      const stats = {
        bot: {
          tag: discordBot.user?.tag,
          id: discordBot.user?.id,
          avatar: discordBot.user?.avatarURL({ size: 128 }),
          status: 'online'
        },
        servers: {
          total: userGuilds.size,
          totalMembers,
          totalChannels,
          totalVoiceChannels,
          activeVoiceChannels
        },
        activity: {
          usersInVoice,
          uptime: discordBot.uptime
        },
        database: dbStats,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        user: {
          id: user.userId,
          username: `${user.username}#${user.discriminator}`,
          adminGuilds: user.guilds.length
        },
        timestamp: new Date().toISOString()
      }

      return reply.send(stats)

    } catch (error) {
      fastify.log.error('Error getting bot stats:', error)
      return reply.code(500).send({
        error: 'Failed to get bot statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // サーバー一覧API（認証必須、ユーザーの管理サーバーのみ）
  fastify.get('/guilds', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    const discordBot = fastify.discord
    const user = request.user!
    const { includeChannels } = request.query as { includeChannels?: string }

    if (!discordBot || !discordBot.isReady()) {
      return reply.code(503).send({
        error: 'Discord bot is not ready'
      })
    }

    try {
      // ユーザーが管理権限を持つサーバーIDの配列
      const userAdminGuildIds = user.guilds.map(g => g.id)

      // ユーザーの管理サーバーのみでフィルタリング
      const userGuilds = discordBot.guilds.cache
        .filter(guild => userAdminGuildIds.includes(guild.id))
        .map(guild => {
          const userGuildInfo = user.guilds.find(ug => ug.id === guild.id)
          
          const baseGuildInfo = {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount,
            channels: guild.channels.cache.size,
            voiceChannels: guild.channels.cache.filter(ch => ch.type === 2).size,
            owner: guild.ownerId,
            icon: guild.iconURL({ size: 64 }),
            joinedAt: guild.joinedAt?.toISOString(),
            userPermissions: {
              isOwner: userGuildInfo?.owner || false,
              permissions: userGuildInfo?.permissions || '0'
            }
          }

          // includeChannels=true の場合、チャンネル詳細情報も含める
          if (includeChannels === 'true') {
            const textChannels = guild.channels.cache
              .filter(ch => ch.type === 0) // GUILD_TEXT
              .map(channel => ({
                id: channel.id,
                name: channel.name,
                type: 'GUILD_TEXT'
              }))

            const voiceChannels = guild.channels.cache
              .filter(ch => ch.type === 2) // GUILD_VOICE
              .map(channel => ({
                id: channel.id,
                name: channel.name,
                type: 'GUILD_VOICE'
              }))

            return {
              ...baseGuildInfo,
              textChannels,
              voiceChannels: voiceChannels
            }
          }

          return baseGuildInfo
        })

      return reply.send({
        guilds: userGuilds,
        total: userGuilds.length,
        user: {
          id: user.userId,
          username: `${user.username}#${user.discriminator}`,
          totalAdminGuilds: user.guilds.length
        },
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      fastify.log.error('Error getting guild list:', error)
      return reply.code(500).send({
        error: 'Failed to get guild list',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 通知設定一覧API（認証必須、ユーザーの管理サーバーのみ）
  fastify.get('/notifications', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    const user = request.user!
    const { guildId } = request.query as { guildId?: string }

    if (!fastify.db) {
      return reply.code(503).send({
        error: 'Database not available'
      })
    }

    try {
      // ユーザーが管理権限を持つサーバーIDの配列
      const userAdminGuildIds = user.guilds.map(g => g.id)

      // 特定のguildIdが指定されている場合、ユーザーの管理権限をチェック
      if (guildId && !userAdminGuildIds.includes(guildId)) {
        return reply.code(403).send({
          error: 'Access denied: No administrative permissions for this server'
        })
      }

      let query = 'SELECT * FROM notifications'
      let args: any[] = []

      if (guildId) {
        query += ' WHERE guildId = ?'
        args.push(guildId)
      } else if (userAdminGuildIds.length > 0) {
        query += ` WHERE guildId IN (${userAdminGuildIds.map(() => '?').join(',')})`
        args.push(...userAdminGuildIds)
      } else {
        // ユーザーが管理権限を持つサーバーがない場合
        return reply.send({
          notifications: [],
          total: 0,
          guildId: guildId || null,
          message: 'No administrative permissions found',
          timestamp: new Date().toISOString()
        })
      }

      query += ' ORDER BY createdAt DESC'

      const result = await fastify.db.execute({
        sql: query,
        args: args
      })

      const notifications = result.rows.map(row => ({
        id: row.id,
        guildId: row.guildId,
        voiceChannelId: row.voiceChannelId,
        textChannelId: row.textChannelId,
        createdAt: row.createdAt
      }))

      return reply.send({
        notifications,
        total: notifications.length,
        guildId: guildId || null,
        user: {
          id: user.userId,
          adminGuilds: user.guilds.length
        },
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      fastify.log.error('Error getting notifications:', error)
      return reply.code(500).send({
        error: 'Failed to get notifications',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // セッション履歴API（認証必須、ユーザーの管理サーバーのみ）
  fastify.get('/sessions', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    const user = request.user!
    const { guildId, limit = '50', active } = request.query as { 
      guildId?: string, 
      limit?: string, 
      active?: string 
    }

    if (!fastify.db) {
      return reply.code(503).send({
        error: 'Database not available'
      })
    }

    try {
      // ユーザーが管理権限を持つサーバーIDの配列
      const userAdminGuildIds = user.guilds.map(g => g.id)

      // 特定のguildIdが指定されている場合、ユーザーの管理権限をチェック
      if (guildId && !userAdminGuildIds.includes(guildId)) {
        return reply.code(403).send({
          error: 'Access denied: No administrative permissions for this server'
        })
      }

      let query = 'SELECT * FROM voice_sessions'
      let conditions: string[] = []
      let args: any[] = []

      // ユーザーの管理サーバーのみに制限
      if (guildId) {
        conditions.push('guildId = ?')
        args.push(guildId)
      } else if (userAdminGuildIds.length > 0) {
        conditions.push(`guildId IN (${userAdminGuildIds.map(() => '?').join(',')})`)
        args.push(...userAdminGuildIds)
      } else {
        // ユーザーが管理権限を持つサーバーがない場合
        return reply.send({
          sessions: [],
          total: 0,
          filters: {
            guildId: guildId || null,
            active: active || null,
            limit: parseInt(limit, 10)
          },
          message: 'No administrative permissions found',
          timestamp: new Date().toISOString()
        })
      }

      if (active !== undefined) {
        conditions.push('isActive = ?')
        args.push(active === 'true')
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ')
      }

      query += ' ORDER BY startTime DESC LIMIT ?'
      args.push(parseInt(limit, 10))

      const result = await fastify.db.execute({
        sql: query,
        args: args
      })

      const sessions = result.rows.map(row => ({
        id: row.id,
        guildId: row.guildId,
        channelId: row.channelId,
        startTime: row.startTime,
        endTime: row.endTime,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt
      }))

      return reply.send({
        sessions,
        total: sessions.length,
        filters: {
          guildId: guildId || null,
          active: active || null,
          limit: parseInt(limit, 10)
        },
        user: {
          id: user.userId,
          adminGuilds: user.guilds.length
        },
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      fastify.log.error('Error getting sessions:', error)
      return reply.code(500).send({
        error: 'Failed to get sessions',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 特定サーバーのボイスチャンネル情報（認証必須）
  fastify.get('/guild/:guildId/voice', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    const discordBot = fastify.discord
    const user = request.user!
    const { guildId } = request.params as { guildId: string }

    // ユーザーの管理権限をチェック
    const userAdminGuildIds = user.guilds.map(g => g.id)
    if (!userAdminGuildIds.includes(guildId)) {
      return reply.code(403).send({
        error: 'Access denied: No administrative permissions for this server'
      })
    }

    if (!discordBot || !discordBot.isReady()) {
      return reply.code(503).send({
        error: 'Discord bot is not ready'
      })
    }

    try {
      const guild = discordBot.guilds.cache.get(guildId)
      
      if (!guild) {
        return reply.code(404).send({
          error: 'Guild not found'
        })
      }

      const voiceChannels = guild.channels.cache
        .filter(ch => ch.type === 2)
        .map(channel => {
          const voiceChannel = channel as any // Voice channel type
          const members = guild.voiceStates.cache
            .filter(vs => vs.channelId === channel.id)
            .map(vs => ({
              id: vs.member?.id,
              displayName: vs.member?.displayName,
              avatar: vs.member?.user.avatarURL({ size: 32 })
            }))

          return {
            id: channel.id,
            name: channel.name,
            userLimit: voiceChannel.userLimit,
            bitrate: voiceChannel.bitrate,
            members,
            memberCount: members.length,
            isActive: members.length > 0
          }
        })

      // このサーバーの通知設定も取得
      let notifications: Array<{voiceChannelId: string; textChannelId: string}> = []
      if (fastify.db) {
        try {
          const result = await fastify.db.execute({
            sql: 'SELECT * FROM notifications WHERE guildId = ?',
            args: [guildId]
          })
          
          notifications = result.rows.map(row => ({
            voiceChannelId: row.voiceChannelId as string,
            textChannelId: row.textChannelId as string
          }))
        } catch (dbError) {
          fastify.log.error('Database error getting notifications:', dbError)
        }
      }

      return reply.send({
        guild: {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount
        },
        voiceChannels,
        notifications,
        stats: {
          totalChannels: voiceChannels.length,
          activeChannels: voiceChannels.filter(ch => ch.isActive).length,
          totalUsersInVoice: voiceChannels.reduce((acc, ch) => acc + ch.memberCount, 0)
        },
        user: {
          id: user.userId,
          permissions: user.guilds.find(g => g.id === guildId)?.permissions || '0'
        },
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      fastify.log.error('Error getting voice channel info:', error)
      return reply.code(500).send({
        error: 'Failed to get voice channel information',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}

export default apiRoutes