import fp from 'fastify-plugin';
import { Client, GatewayIntentBits, Events, VoiceState, EmbedBuilder, TextChannel } from 'discord.js';
import type { FastifyPluginAsync } from 'fastify';

// Discord クライアントの型定義
declare module 'fastify' {
  interface FastifyInstance {
    discord: Client;
  }
}

const discordPlugin: FastifyPluginAsync = async (fastify) => {
  // 環境変数のチェック
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN environment variable is required');
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  // Discord Bot のログイン
  try {
    await client.login(process.env.DISCORD_TOKEN);
    fastify.log.info(`✅ Discord Bot logged in as: ${client.user?.tag}`);
  } catch (error) {
    fastify.log.error('❌ Failed to login to Discord:', error);
    throw error;
  }

  // Ready イベント
  client.once(Events.ClientReady, (readyClient) => {
    fastify.log.info(`🚀 Discord Bot ready! Logged in as ${readyClient.user.tag}`);
    fastify.log.info(`📊 Connected to ${readyClient.guilds.cache.size} servers`);
  });

  // ボイス状態変更イベント（データベース統合版）
  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    try {
      await handleVoiceStateUpdate(fastify, oldState, newState);
    } catch (error) {
      fastify.log.error('❌ Error handling voice state update:', error);
    }
  });

  // Fastifyインスタンスに登録
  fastify.decorate('discord', client);

  // アプリケーション終了時のクリーンアップ
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing Discord client...');
    client.destroy();
  });
};

// ボイス状態変更ハンドラー（データベースと通知機能付き）
async function handleVoiceStateUpdate(fastify: any, oldState: VoiceState, newState: VoiceState) {
  const { dbHelpers } = fastify;
  
  // ボット自身の状態変更は無視
  if (newState.member?.user.bot) return;

  const guildId = newState.guild.id;
  const userId = newState.member?.user.id;
  const userName = newState.member?.displayName || newState.member?.user.username || 'Unknown';

  // 入室処理
  if (!oldState.channelId && newState.channelId) {
    await handleUserJoined(fastify, guildId, newState.channelId, userId!, userName);
  }
  // 退室処理
  else if (oldState.channelId && !newState.channelId) {
    await handleUserLeft(fastify, guildId, oldState.channelId, userId!, userName);
  }
  // チャンネル移動処理
  else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    // 旧チャンネルからの退室として処理
    await handleUserLeft(fastify, guildId, oldState.channelId, userId!, userName);
    // 新チャンネルへの入室として処理
    await handleUserJoined(fastify, guildId, newState.channelId, userId!, userName);
  }
}

// ユーザー入室処理
async function handleUserJoined(fastify: any, guildId: string, channelId: string, userId: string, userName: string) {
  const { discord, dbHelpers } = fastify;
  
  try {
    // チャンネル情報を取得
    const channel = await discord.channels.fetch(channelId);
    if (!channel || channel.type !== 2) return; // ボイスチャンネル以外は無視

    // ユーザー情報を取得
    const user = await discord.users.fetch(userId);
    const userAvatar = user.avatar;

    const channelName = channel.name;
    const memberCount = channel.members.size;

    fastify.log.info(`👤 ${userName} joined voice channel: ${channelName} (${memberCount} members)`);

    // 通話開始 or メンバー参加の判定
    if (memberCount === 1) {
      // 通話開始
      const sessionId = await dbHelpers.startVoiceSession(guildId, channelId);
      fastify.log.info(`🔵 Call started in ${channelName} (Session ID: ${sessionId})`);
      
      await sendNotification(fastify, guildId, channelId, 'call_start', {
        channelName,
        userName,
        userId,
        userAvatar,
      });
    } else {
      // メンバー参加
      fastify.log.info(`🟢 ${userName} joined ongoing call in ${channelName}`);
      
      await sendNotification(fastify, guildId, channelId, 'member_join', {
        channelName,
        userName,
        userId,
        userAvatar,
      });
    }
  } catch (error) {
    fastify.log.error(`❌ Error handling user joined (${userId} -> ${channelId}):`, error);
  }
}

// ユーザー退室処理
async function handleUserLeft(fastify: any, guildId: string, channelId: string, userId: string, userName: string) {
  const { discord, dbHelpers } = fastify;
  
  try {
    // チャンネル情報を取得
    const channel = await discord.channels.fetch(channelId);
    if (!channel || channel.type !== 2) return;

    const channelName = channel.name;
    const memberCount = channel.members.size;

    fastify.log.info(`👤 ${userName} left voice channel: ${channelName} (${memberCount} members remaining)`);

    // 通話終了の判定
    if (memberCount === 0) {
      // 通話終了
      const endedSession = await dbHelpers.endVoiceSession(guildId, channelId);
      
      if (endedSession) {
        const duration = calculateDuration(endedSession.startTime, endedSession.endTime!);
        fastify.log.info(`🔴 Call ended in ${channelName} (Duration: ${duration})`);
        
        await sendNotification(fastify, guildId, channelId, 'call_end', {
          channelName,
          duration,
        });
      }
    } else {
      fastify.log.info(`👋 ${userName} left ongoing call in ${channelName}`);
    }
  } catch (error) {
    fastify.log.error(`❌ Error handling user left (${userId} <- ${channelId}):`, error);
  }
}

// 通知送信処理
async function sendNotification(fastify: any, guildId: string, voiceChannelId: string, type: string, data: any) {
  const { discord, dbHelpers } = fastify;
  
  try {
    // 通知設定を取得
    const notifications = await dbHelpers.getNotifications(guildId);
    const relevantNotifications = notifications.filter((n: any) => n.voiceChannelId === voiceChannelId);
    
    if (relevantNotifications.length === 0) {
      fastify.log.debug(`📭 No notification settings found for voice channel ${voiceChannelId}`);
      return;
    }

    // 通知メッセージの作成
    const embed = createNotificationEmbed(type, data);
    
    // 各設定されたテキストチャンネルに通知送信
    for (const notification of relevantNotifications) {
      try {
        const textChannel = await discord.channels.fetch(notification.textChannelId) as TextChannel;
        if (textChannel && textChannel.isTextBased()) {
          await textChannel.send({ embeds: [embed] });
          fastify.log.info(`📨 Notification sent to #${textChannel.name} for ${type}`);
        }
      } catch (error) {
        fastify.log.error(`❌ Failed to send notification to channel ${notification.textChannelId}:`, error);
      }
    }
  } catch (error) {
    fastify.log.error(`❌ Error sending notification for ${type}:`, error);
  }
}

// 通知埋め込みメッセージの作成
function createNotificationEmbed(type: string, data: any): EmbedBuilder {
  const now = new Date();
  const timeStr = formatJapaneseTime(now);

  switch (type) {
    case 'call_start':
      return new EmbedBuilder()
        .setTitle(`通話開始`)
        .setColor(0x00ffff) // 青色
        .addFields(
          { name: 'チャンネル', value: data.channelName, inline: true },
          { name: '開始者', value: data.userName, inline: true },
        )
        .setTimestamp()
        .setDescription(`${data.userName}`)
        .setThumbnail(`https://cdn.discordapp.com/avatars/${data.userId}/${data.userAvatar}.png`)

    case 'member_join':
      return new EmbedBuilder()
        .setTitle(`${data.userName} が参戦`)
        .setColor(0x39ff14) // 緑色
        .addFields(
          { name: 'チャンネル', value: data.channelName, inline: true },
          { name: '参加者', value: data.userName, inline: true }
        )
        .setThumbnail(`https://cdn.discordapp.com/avatars/${data.userId}/${data.userAvatar}.png`)
        .setTimestamp();

    case 'call_end':
      return new EmbedBuilder()
        .setTitle('通話終了...')
        .setColor(0xff006e) // 赤色
        .addFields(
          { name: 'チャンネル', value: data.channelName, inline: true },
          { name: '通話時間', value: data.duration, inline: true }
        )
        .setTimestamp()
        .setThumbnail(`https://cataas.com/cat?width=128&height=128&${Date.now()}`)

    default:
      return new EmbedBuilder()
        .setTitle('Unknown Event')
        .setColor(0x6c757d)
        .setTimestamp();
  }
}

// 日本時間フォーマット (MM/dd HH:mm)
function formatJapaneseTime(date: Date): string {
  const jst = new Date(date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
  const month = String(jst.getMonth() + 1).padStart(2, '0');
  const day = String(jst.getDate()).padStart(2, '0');
  const hours = String(jst.getHours()).padStart(2, '0');
  const minutes = String(jst.getMinutes()).padStart(2, '0');
  
  return `${month}/${day} ${hours}:${minutes}`;
}

// 通話時間計算
function calculateDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const remainingSeconds = seconds % 60;
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}時間${remainingMinutes}分${remainingSeconds}秒`;
  } else if (minutes > 0) {
    return `${remainingMinutes}分${remainingSeconds}秒`;
  } else {
    return `${remainingSeconds}秒`;
  }
}

export default fp(discordPlugin, {
  name: 'discord',
  dependencies: ['env', 'database'], // database プラグインに依存
});