import { FastifyPluginAsync } from 'fastify'
import { TextChannel, NewsChannel, ThreadChannel, VoiceChannel, ChannelType } from 'discord.js'

const controlRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {

  // サーバー管理者権限チェックのミドルウェア
  const checkServerAdmin = async (request: any, reply: any, guildId: string) => {
    const user = request.user!
    
    // ユーザーが管理権限を持つサーバーかチェック
    const hasAdminAccess = user.guilds.some((guild: any) => guild.id === guildId)
    
    if (!hasAdminAccess) {
      return reply.code(403).send({
        success: false,
        error: 'このサーバーに対する管理者権限がありません',
        code: 'INSUFFICIENT_PERMISSIONS'
      })
    }

    return true
  }

  // メッセージ送信可能なチャンネルかどうかをチェックする型ガード
  const isTextBasedChannel = (channel: any): channel is TextChannel | NewsChannel | ThreadChannel => {
    return channel && typeof channel.send === 'function';
  };

  // ボイスチャンネルかどうかをチェックする型ガード
  const isVoiceChannel = (channel: any): channel is VoiceChannel => {
    return channel && channel.type === ChannelType.GuildVoice;
  };

  // メッセージ送信API（認証必須）
  fastify.post('/send-message', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    try {
      const { channelId, content, embedTitle, embedDescription, embedColor } = request.body as {
        channelId: string;
        content?: string;
        embedTitle?: string;
        embedDescription?: string;
        embedColor?: string;
      };

      if (!fastify.discord || !fastify.discord.isReady()) {
        return reply.code(503).send({ 
          success: false, 
          error: 'Discord Botが接続されていません' 
        });
      }

      const channel = fastify.discord.channels.cache.get(channelId);
      if (!channel) {
        return reply.code(404).send({ 
          success: false, 
          error: 'チャンネルが見つかりません' 
        });
      }

      // サーバー管理者権限チェック
      const guildId = (channel as any).guildId || (channel as any).guild?.id;
      if (!guildId) {
        return reply.code(400).send({
          success: false,
          error: 'サーバーチャンネルではありません'
        });
      }

      const adminCheck = await checkServerAdmin(request, reply, guildId);
      if (adminCheck !== true) return adminCheck;

      // テキストベースのチャンネルかチェック
      if (!isTextBasedChannel(channel)) {
        return reply.code(400).send({ 
          success: false, 
          error: 'このチャンネルにはメッセージを送信できません' 
        });
      }

      const messageOptions: any = {};

      // 通常メッセージがある場合
      if (content) {
        messageOptions.content = content;
      }

      // 埋め込みがある場合
      if (embedTitle || embedDescription) {
        messageOptions.embeds = [{
          title: embedTitle || undefined,
          description: embedDescription || undefined,
          color: embedColor ? parseInt(embedColor.replace('#', '0x')) : 0x5865F2,
          timestamp: new Date().toISOString()
        }];
      }

      const sentMessage = await channel.send(messageOptions);

      fastify.log.info(`Message sent by ${request.user!.username}#${request.user!.discriminator} to #${channel.name}`);

      return { 
        success: true, 
        messageId: sentMessage.id,
        message: 'メッセージを送信しました' 
      };
    } catch (error) {
      fastify.log.error('メッセージ送信エラー:', error);
      return reply.code(500).send({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // チャンネル作成API（認証必須）
  fastify.post('/create-channel', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    try {
      const { guildId, name, type, topic, slowmode } = request.body as {
        guildId: string;
        name: string;
        type: 'text' | 'voice';
        topic?: string;
        slowmode?: number;
      };

      // サーバー管理者権限チェック
      const adminCheck = await checkServerAdmin(request, reply, guildId);
      if (adminCheck !== true) return adminCheck;

      if (!fastify.discord || !fastify.discord.isReady()) {
        return reply.code(503).send({ 
          success: false, 
          error: 'Discord Botが接続されていません' 
        });
      }

      const guild = fastify.discord.guilds.cache.get(guildId);
      if (!guild) {
        return reply.code(404).send({ 
          success: false, 
          error: 'サーバーが見つかりません' 
        });
      }

      const channelOptions: any = {
        name: name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        type: type === 'text' ? ChannelType.GuildText : ChannelType.GuildVoice,
      };

      if (type === 'text') {
        if (topic) channelOptions.topic = topic;
        if (slowmode) channelOptions.rateLimitPerUser = slowmode;
      }

      const createdChannel = await guild.channels.create(channelOptions);

      fastify.log.info(`Channel created by ${request.user!.username}#${request.user!.discriminator}: ${createdChannel.name} in ${guild.name}`);

      return { 
        success: true, 
        channelId: createdChannel.id,
        channelName: createdChannel.name,
        message: `${type === 'text' ? 'テキスト' : 'ボイス'}チャンネルを作成しました`
      };
    } catch (error) {
      fastify.log.error('チャンネル作成エラー:', error);
      return reply.code(500).send({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // チャンネル削除API（認証必須）
  fastify.delete('/delete-channel/:channelId', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    try {
      const { channelId } = request.params as { channelId: string };

      if (!fastify.discord || !fastify.discord.isReady()) {
        return reply.code(503).send({ 
          success: false, 
          error: 'Discord Botが接続されていません' 
        });
      }

      const channel = fastify.discord.channels.cache.get(channelId);
      if (!channel) {
        return reply.code(404).send({ 
          success: false, 
          error: 'チャンネルが見つかりません' 
        });
      }

      // サーバー管理者権限チェック
      const guildId = (channel as any).guildId || (channel as any).guild?.id;
      if (!guildId) {
        return reply.code(400).send({
          success: false,
          error: 'サーバーチャンネルではありません'
        });
      }

      const adminCheck = await checkServerAdmin(request, reply, guildId);
      if (adminCheck !== true) return adminCheck;

      const channelName = 'name' in channel ? channel.name : 'Unknown Channel';
      const guildName = 'guild' in channel ? (channel as any).guild?.name : 'Unknown Guild';

      await channel.delete();

      fastify.log.info(`Channel deleted by ${request.user!.username}#${request.user!.discriminator}: ${channelName} in ${guildName}`);

      return { 
        success: true, 
        message: 'チャンネルを削除しました'
      };
    } catch (error) {
      fastify.log.error('チャンネル削除エラー:', error);
      return reply.code(500).send({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // メンバー操作API（認証必須）
  fastify.post('/member-action', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    try {
      const { guildId, userId, action, value } = request.body as {
        guildId: string;
        userId: string;
        action: 'nickname' | 'move' | 'mute' | 'unmute' | 'kick';
        value?: string;
      };

      // サーバー管理者権限チェック
      const adminCheck = await checkServerAdmin(request, reply, guildId);
      if (adminCheck !== true) return adminCheck;

      if (!fastify.discord || !fastify.discord.isReady()) {
        return reply.code(503).send({ 
          success: false, 
          error: 'Discord Botが接続されていません' 
        });
      }

      const guild = fastify.discord.guilds.cache.get(guildId);
      if (!guild) {
        return reply.code(404).send({ 
          success: false, 
          error: 'サーバーが見つかりません' 
        });
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return reply.code(404).send({ 
          success: false, 
          error: 'メンバーが見つかりません' 
        });
      }

      let message = '';

      switch (action) {
        case 'nickname':
          await member.setNickname(value || null);
          message = 'ニックネームを変更しました';
          break;

        case 'move':
          if (!value) {
            return reply.code(400).send({ 
              success: false, 
              error: '移動先チャンネルIDが必要です' 
            });
          }
          const voiceChannel = guild.channels.cache.get(value);
          if (!voiceChannel || !isVoiceChannel(voiceChannel)) {
            return reply.code(404).send({ 
              success: false, 
              error: 'ボイスチャンネルが見つかりません' 
            });
          }
          await member.voice.setChannel(voiceChannel);
          message = 'メンバーを移動しました';
          break;

        case 'mute':
          await member.voice.setMute(true);
          message = 'メンバーをミュートしました';
          break;

        case 'unmute':
          await member.voice.setMute(false);
          message = 'メンバーのミュートを解除しました';
          break;

        case 'kick':
          await member.kick('管理者による操作');
          message = 'メンバーをキックしました';
          break;

        default:
          return reply.code(400).send({ 
            success: false, 
            error: '無効な操作です' 
          });
      }

      fastify.log.info(`Member action by ${request.user!.username}#${request.user!.discriminator}: ${action} on ${member.displayName} in ${guild.name}`);

      return { success: true, message };
    } catch (error) {
      fastify.log.error('メンバー操作エラー:', error);
      return reply.code(500).send({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // 一括操作API（認証必須）
  fastify.post('/bulk-action', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    try {
      const { guildId, action, targetChannelId, sourceChannelId } = request.body as {
        guildId: string;
        action: 'move-all' | 'shuffle' | 'mute-all' | 'unmute-all';
        targetChannelId?: string;
        sourceChannelId?: string;
      };

      // サーバー管理者権限チェック
      const adminCheck = await checkServerAdmin(request, reply, guildId);
      if (adminCheck !== true) return adminCheck;

      if (!fastify.discord || !fastify.discord.isReady()) {
        return reply.code(503).send({ 
          success: false, 
          error: 'Discord Botが接続されていません' 
        });
      }

      const guild = fastify.discord.guilds.cache.get(guildId);
      if (!guild) {
        return reply.code(404).send({ 
          success: false, 
          error: 'サーバーが見つかりません' 
        });
      }

      let message = '';
      let affectedCount = 0;

      switch (action) {
        case 'move-all':
          if (!targetChannelId) {
            return reply.code(400).send({ 
              success: false, 
              error: '移動先チャンネルIDが必要です' 
            });
          }
          
          const targetChannel = guild.channels.cache.get(targetChannelId);
          if (!targetChannel || !isVoiceChannel(targetChannel)) {
            return reply.code(404).send({ 
              success: false, 
              error: 'ボイスチャンネルが見つかりません' 
            });
          }

          // ボイスチャンネルにいる全メンバーを移動
          const voiceMembers = guild.voiceStates.cache
            .filter(vs => vs.channelId && (!sourceChannelId || vs.channelId === sourceChannelId))
            .map(vs => vs.member)
            .filter((member): member is NonNullable<typeof member> => member !== null);

          for (const member of voiceMembers) {
            try {
              await member.voice.setChannel(targetChannel);
              affectedCount++;
            } catch (error) {
              fastify.log.warn(`メンバー移動失敗 ${member.id}:`, error);
            }
          }
          message = `${affectedCount}人のメンバーを移動しました`;
          break;

        case 'shuffle':
          // ボイスチャンネル一覧を取得
          const voiceChannels = Array.from(
            guild.channels.cache
              .filter(ch => ch.type === ChannelType.GuildVoice && ch.id !== targetChannelId)
              .values()
          ).filter(isVoiceChannel); // 型ガードでVoiceChannel[]を保証
          
          if (voiceChannels.length < 2) {
            return reply.code(400).send({ 
              success: false, 
              error: 'シャッフル用のボイスチャンネルが不足しています' 
            });
          }

          const membersToShuffle = guild.voiceStates.cache
            .filter(vs => vs.channelId)
            .map(vs => vs.member)
            .filter((member): member is NonNullable<typeof member> => member !== null);

          // メンバーをランダムにシャッフル
          for (const member of membersToShuffle) {
            const randomChannel = voiceChannels[Math.floor(Math.random() * voiceChannels.length)];
            try {
              await member.voice.setChannel(randomChannel);
              affectedCount++;
            } catch (error) {
              fastify.log.warn(`メンバーシャッフル失敗 ${member.id}:`, error);
            }
          }
          message = `${affectedCount}人のメンバーをシャッフルしました`;
          break;

        case 'mute-all':
          const membersToMute = guild.voiceStates.cache
            .filter(vs => vs.channelId && !vs.serverMute)
            .map(vs => vs.member)
            .filter((member): member is NonNullable<typeof member> => member !== null);

          for (const member of membersToMute) {
            try {
              await member.voice.setMute(true);
              affectedCount++;
            } catch (error) {
              fastify.log.warn(`ミュート失敗 ${member.id}:`, error);
            }
          }
          message = `${affectedCount}人のメンバーをミュートしました`;
          break;

        case 'unmute-all':
          const membersToUnmute = guild.voiceStates.cache
            .filter(vs => vs.channelId && vs.serverMute)
            .map(vs => vs.member)
            .filter((member): member is NonNullable<typeof member> => member !== null);

          for (const member of membersToUnmute) {
            try {
              await member.voice.setMute(false);
              affectedCount++;
            } catch (error) {
              fastify.log.warn(`ミュート解除失敗 ${member.id}:`, error);
            }
          }
          message = `${affectedCount}人のメンバーのミュートを解除しました`;
          break;

        default:
          return reply.code(400).send({ 
            success: false, 
            error: '無効な操作です' 
          });
      }

      fastify.log.info(`Bulk action by ${request.user!.username}#${request.user!.discriminator}: ${action} (${affectedCount} affected) in ${guild.name}`);

      return { success: true, message, affectedCount };
    } catch (error) {
      fastify.log.error('一括操作エラー:', error);
      return reply.code(500).send({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // サーバー詳細情報API（認証必須、リアルタイムボイス状態含む）
  fastify.get('/live-status/:guildId', { preHandler: [fastify.authenticate] }, async function (request, reply) {
    try {
      const { guildId } = request.params as { guildId: string };

      // サーバー管理者権限チェック
      const adminCheck = await checkServerAdmin(request, reply, guildId);
      if (adminCheck !== true) return adminCheck;

      if (!fastify.discord || !fastify.discord.isReady()) {
        return reply.code(503).send({
          error: 'Discord bot is not ready'
        });
      }

      const guild = fastify.discord.guilds.cache.get(guildId);
      if (!guild) {
        return reply.code(404).send({
          error: 'Guild not found'
        });
      }

      // ボイスチャンネルの詳細状態
      const voiceChannels = guild.channels.cache
        .filter(ch => ch.type === ChannelType.GuildVoice)
        .map(channel => {
          const voiceChannel = channel as VoiceChannel; // 型アサーション
          const members = guild.voiceStates.cache
            .filter(vs => vs.channelId === channel.id)
            .map(vs => ({
              id: vs.member?.id,
              username: vs.member?.user.username,
              displayName: vs.member?.displayName,
              avatar: vs.member?.user.avatarURL({ size: 32 }),
              muted: vs.serverMute || vs.selfMute,
              deafened: vs.serverDeaf || vs.selfDeaf
            }));

          return {
            id: channel.id,
            name: channel.name,
            position: voiceChannel.position,
            userLimit: voiceChannel.userLimit,
            members,
            memberCount: members.length
          };
        })
        .sort((a, b) => a.position - b.position);

      // オンラインメンバー（簡易版）
      const onlineMembers = guild.members.cache
        .filter(member => member.presence?.status !== 'offline')
        .map(member => ({
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
          avatar: member.user.avatarURL({ size: 32 }),
          status: member.presence?.status || 'offline',
          activity: member.presence?.activities[0]?.name || null
        }))
        .slice(0, 50); // 最大50人まで

      return {
        guild: {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
          onlineCount: onlineMembers.length
        },
        voiceChannels,
        onlineMembers,
        stats: {
          totalVoiceChannels: voiceChannels.length,
          activeVoiceChannels: voiceChannels.filter(ch => ch.memberCount > 0).length,
          totalUsersInVoice: voiceChannels.reduce((acc, ch) => acc + ch.memberCount, 0)
        },
        user: {
          id: request.user!.userId,
          permissions: request.user!.guilds.find(g => g.id === guildId)?.permissions || '0'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('ライブステータス取得エラー:', error);
      return reply.code(500).send({
        error: 'Failed to get live status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

export default controlRoutes;