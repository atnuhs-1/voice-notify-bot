import { FastifyPluginAsync } from 'fastify'

const apiRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // 統計情報API
  fastify.get('/stats', async function (request, reply) {
    const discordBot = fastify.discord

    if (!discordBot || !discordBot.isReady()) {
      return reply.code(503).send({
        error: 'Discord bot is not ready',
        status: 'offline'
      })
    }

    try {
      // Bot基本統計
      const guilds = discordBot.guilds.cache
      const totalMembers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0)
      const totalChannels = guilds.reduce((acc, guild) => acc + guild.channels.cache.size, 0)
      const totalVoiceChannels = guilds.reduce((acc, guild) => 
        acc + guild.channels.cache.filter(ch => ch.type === 2).size, 0)

      // アクティブなボイスチャンネル（誰かが入室中）
      const activeVoiceChannels = guilds.reduce((acc, guild) => {
        const activeInGuild = guild.voiceStates.cache
          .filter(vs => vs.channelId)
          .map(vs => vs.channelId)
        return acc + new Set(activeInGuild).size
      }, 0)

      // 現在ボイスチャンネルにいるユーザー数
      const usersInVoice = guilds.reduce((acc, guild) => 
        acc + guild.voiceStates.cache.filter(vs => vs.channelId).size, 0)

      // データベース統計
      let dbStats = {}
      if (fastify.db) {
        try {
          const notificationsResult = await fastify.db.execute('SELECT COUNT(*) as count FROM notifications')
          const activeSessionsResult = await fastify.db.execute('SELECT COUNT(*) as count FROM voice_sessions WHERE isActive = true')
          const totalSessionsResult = await fastify.db.execute('SELECT COUNT(*) as count FROM voice_sessions')
          
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
          total: guilds.size,
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

  // サーバー一覧API（チャンネル情報を含む）
  fastify.get('/guilds', async function (request, reply) {
    const discordBot = fastify.discord
    const { includeChannels } = request.query as { includeChannels?: string }

    if (!discordBot || !discordBot.isReady()) {
      return reply.code(503).send({
        error: 'Discord bot is not ready'
      })
    }

    try {
      const guilds = discordBot.guilds.cache.map(guild => {
        const baseGuildInfo = {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
          channels: guild.channels.cache.size,
          voiceChannels: guild.channels.cache.filter(ch => ch.type === 2).size,
          owner: guild.ownerId,
          icon: guild.iconURL({ size: 64 }),
          joinedAt: guild.joinedAt?.toISOString()
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
        guilds,
        total: guilds.length,
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

  // 通知設定一覧API
  fastify.get('/notifications', async function (request, reply) {
    const { guildId } = request.query as { guildId?: string }

    if (!fastify.db) {
      return reply.code(503).send({
        error: 'Database not available'
      })
    }

    try {
      let query = 'SELECT * FROM notifications'
      let args: any[] = []

      if (guildId) {
        query += ' WHERE guildId = ?'
        args.push(guildId)
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

  // セッション履歴API
  fastify.get('/sessions', async function (request, reply) {
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
      let query = 'SELECT * FROM voice_sessions'
      let conditions: string[] = []
      let args: any[] = []

      if (guildId) {
        conditions.push('guildId = ?')
        args.push(guildId)
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

  // 特定サーバーのボイスチャンネル情報
  fastify.get('/guild/:guildId/voice', async function (request, reply) {
    const discordBot = fastify.discord
    const { guildId } = request.params as { guildId: string }

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