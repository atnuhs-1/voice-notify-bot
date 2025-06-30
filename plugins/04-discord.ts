import fp from 'fastify-plugin';
import { Client, GatewayIntentBits, Events, VoiceState, EmbedBuilder, TextChannel } from 'discord.js';
import type { FastifyPluginAsync } from 'fastify';

// デバッグ用のインスタンス識別子
const INSTANCE_ID = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

// Discord クライアントの型定義
declare module 'fastify' {
  interface FastifyInstance {
    discord: Client;
  }
}

const discordPlugin: FastifyPluginAsync = async (fastify) => {
  // 🔍 デバッグ: インスタンス起動ログ
  fastify.log.info(`🆔 [DEBUG] Discord plugin initializing - Instance ID: ${INSTANCE_ID}`);
  fastify.log.info(`🔍 [DEBUG] Process PID: ${process.pid}`);
  fastify.log.info(`🔍 [DEBUG] Environment: ${process.env.NODE_ENV || 'development'}`);

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

  // 🔍 デバッグ: Discord接続前
  fastify.log.info(`🔍 [DEBUG] Starting Discord login process (Instance: ${INSTANCE_ID})`);

  // Discord Bot のログイン
  try {
    await client.login(process.env.DISCORD_TOKEN);
    fastify.log.info(`✅ Discord Bot logged in as: ${client.user?.tag}`);
    fastify.log.info(`🔍 [DEBUG] Discord login successful (Instance: ${INSTANCE_ID})`);
  } catch (error) {
    fastify.log.error('❌ Failed to login to Discord:', error);
    fastify.log.error(`🔍 [DEBUG] Discord login failed (Instance: ${INSTANCE_ID}):`, error);
    throw error;
  }

  // Ready イベント
  client.once(Events.ClientReady, (readyClient) => {
    fastify.log.info(`🚀 Discord Bot ready! Logged in as ${readyClient.user.tag}`);
    fastify.log.info(`📊 Connected to ${readyClient.guilds.cache.size} servers`);
    fastify.log.info(`🔍 [DEBUG] Discord ready event fired (Instance: ${INSTANCE_ID})`);
    fastify.log.info(`🔍 [DEBUG] Current event listeners for voiceStateUpdate: ${client.listenerCount(Events.VoiceStateUpdate)}`);
  });

  // 🔍 デバッグ: イベントリスナー登録前
  fastify.log.info(`🔍 [DEBUG] Registering voiceStateUpdate listener (Instance: ${INSTANCE_ID})`);

  // ボイス状態変更イベント（データベース統合版）
  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    // 🔍 デバッグ: イベント受信ログ
    const eventId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const userId = newState.member?.user.id || oldState.member?.user.id;
    
    fastify.log.info(`🔍 [DEBUG] VoiceStateUpdate event received (Instance: ${INSTANCE_ID}, Event: ${eventId})`);
    fastify.log.info(`🔍 [DEBUG] Event details: User=${userId}, Old=${oldState.channelId}, New=${newState.channelId}`);
    
    try {
      await handleVoiceStateUpdate(fastify, oldState, newState, INSTANCE_ID, eventId);
    } catch (error) {
      fastify.log.error('❌ Error handling voice state update:', error);
      fastify.log.error(`🔍 [DEBUG] Error in event ${eventId} (Instance: ${INSTANCE_ID}):`, error);
    }
  });

  // 🔍 デバッグ: イベントリスナー登録後
  fastify.log.info(`🔍 [DEBUG] VoiceStateUpdate listener registered (Instance: ${INSTANCE_ID})`);
  fastify.log.info(`🔍 [DEBUG] Total event listeners for voiceStateUpdate: ${client.listenerCount(Events.VoiceStateUpdate)}`);

  // Fastifyインスタンスに登録
  fastify.decorate('discord', client);

  // アプリケーション終了時のクリーンアップ
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing Discord client...');
    fastify.log.info(`🔍 [DEBUG] Closing Discord client (Instance: ${INSTANCE_ID})`);
    client.destroy();
  });
};

// ボイス状態変更ハンドラー（データベースと通知機能付き）
async function handleVoiceStateUpdate(fastify: any, oldState: VoiceState, newState: VoiceState, instanceId: string, eventId: string) {
  const { dbHelpers } = fastify;
  
  fastify.log.info(`🔍 [DEBUG] Processing handleVoiceStateUpdate (Instance: ${instanceId}, Event: ${eventId})`);
  
  // ボット自身の状態変更は無視
  if (newState.member?.user.bot) {
    fastify.log.info(`🔍 [DEBUG] Ignoring bot event (Instance: ${instanceId}, Event: ${eventId})`);
    return;
  }

  const guildId = newState.guild.id;
  const userId = newState.member?.user.id;
  const userName = newState.member?.displayName || newState.member?.user.username || 'Unknown';

  fastify.log.info(`🔍 [DEBUG] Event processing: ${userName} | Guild: ${guildId} | Old: ${oldState.channelId} | New: ${newState.channelId} (Instance: ${instanceId}, Event: ${eventId})`);

  // 入室処理
  if (!oldState.channelId && newState.channelId) {
    fastify.log.info(`🔍 [DEBUG] User joined detected (Instance: ${instanceId}, Event: ${eventId})`);
    await handleUserJoined(fastify, guildId, newState.channelId, userId!, userName, instanceId, eventId);
  }
  // 退室処理
  else if (oldState.channelId && !newState.channelId) {
    fastify.log.info(`🔍 [DEBUG] User left detected (Instance: ${instanceId}, Event: ${eventId})`);
    await handleUserLeft(fastify, guildId, oldState.channelId, userId!, userName, instanceId, eventId);
  }
  // チャンネル移動処理
  else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    fastify.log.info(`🔍 [DEBUG] User moved detected (Instance: ${instanceId}, Event: ${eventId})`);
    // 旧チャンネルからの退室として処理
    await handleUserLeft(fastify, guildId, oldState.channelId, userId!, userName, instanceId, `${eventId}_move_left`);
    // 新チャンネルへの入室として処理
    await handleUserJoined(fastify, guildId, newState.channelId, userId!, userName, instanceId, `${eventId}_move_joined`);
  } else {
    fastify.log.info(`🔍 [DEBUG] No action needed for this event (Instance: ${instanceId}, Event: ${eventId})`);
  }
  
  fastify.log.info(`🔍 [DEBUG] Completed handleVoiceStateUpdate (Instance: ${instanceId}, Event: ${eventId})`);
}

// ユーザー入室処理
async function handleUserJoined(fastify: any, guildId: string, channelId: string, userId: string, userName: string, instanceId: string, eventId: string) {
  const { discord, dbHelpers } = fastify;
  
  fastify.log.info(`🔍 [DEBUG] handleUserJoined started (Instance: ${instanceId}, Event: ${eventId})`);
  
  try {
    // チャンネル情報を取得
    const channel = await discord.channels.fetch(channelId);
    if (!channel || channel.type !== 2) {
      fastify.log.info(`🔍 [DEBUG] Not a voice channel, skipping (Instance: ${instanceId}, Event: ${eventId})`);
      return; // ボイスチャンネル以外は無視
    }

    // ユーザー情報を取得
    const user = await discord.users.fetch(userId);
    const userAvatar = user.avatar;

    const channelName = channel.name;
    const memberCount = channel.members.size;

    fastify.log.info(`👤 ${userName} joined voice channel: ${channelName} (${memberCount} members)`);
    fastify.log.info(`🔍 [DEBUG] Channel member count: ${memberCount} (Instance: ${instanceId}, Event: ${eventId})`);

    // 通話開始 or メンバー参加の判定
    if (memberCount === 1) {
      // 通話開始
      fastify.log.info(`🔍 [DEBUG] Call start detected - creating session (Instance: ${instanceId}, Event: ${eventId})`);
      const sessionId = await dbHelpers.startVoiceSession(guildId, channelId);
      fastify.log.info(`🔵 Call started in ${channelName} (Session ID: ${sessionId})`);
      fastify.log.info(`🔍 [DEBUG] Session created with ID: ${sessionId} (Instance: ${instanceId}, Event: ${eventId})`);
      
      fastify.log.info(`🔍 [DEBUG] Sending call_start notification (Instance: ${instanceId}, Event: ${eventId})`);
      await sendNotification(fastify, guildId, channelId, 'call_start', {
        channelName,
        userName,
        userId,
        userAvatar,
      }, instanceId, eventId);
    } else {
      // メンバー参加
      fastify.log.info(`🟢 ${userName} joined ongoing call in ${channelName}`);
      fastify.log.info(`🔍 [DEBUG] Member join detected (Instance: ${instanceId}, Event: ${eventId})`);
      
      fastify.log.info(`🔍 [DEBUG] Sending member_join notification (Instance: ${instanceId}, Event: ${eventId})`);
      await sendNotification(fastify, guildId, channelId, 'member_join', {
        channelName,
        userName,
        userId,
        userAvatar,
      }, instanceId, eventId);
    }
  } catch (error) {
    fastify.log.error(`❌ Error handling user joined (${userId} -> ${channelId}):`, error);
    fastify.log.error(`🔍 [DEBUG] Error in handleUserJoined (Instance: ${instanceId}, Event: ${eventId}):`, error);
  }
  
  fastify.log.info(`🔍 [DEBUG] handleUserJoined completed (Instance: ${instanceId}, Event: ${eventId})`);
}

// ユーザー退室処理
async function handleUserLeft(fastify: any, guildId: string, channelId: string, userId: string, userName: string, instanceId: string, eventId: string) {
  const { discord, dbHelpers } = fastify;
  
  fastify.log.info(`🔍 [DEBUG] handleUserLeft started (Instance: ${instanceId}, Event: ${eventId})`);
  
  try {
    // チャンネル情報を取得
    const channel = await discord.channels.fetch(channelId);
    if (!channel || channel.type !== 2) {
      fastify.log.info(`🔍 [DEBUG] Not a voice channel, skipping (Instance: ${instanceId}, Event: ${eventId})`);
      return;
    }

    const channelName = channel.name;
    const memberCount = channel.members.size;

    fastify.log.info(`👤 ${userName} left voice channel: ${channelName} (${memberCount} members remaining)`);
    fastify.log.info(`🔍 [DEBUG] Channel member count after leave: ${memberCount} (Instance: ${instanceId}, Event: ${eventId})`);

    // 通話終了の判定
    if (memberCount === 0) {
      // 通話終了
      fastify.log.info(`🔍 [DEBUG] Call end detected - ending session (Instance: ${instanceId}, Event: ${eventId})`);
      const endedSession = await dbHelpers.endVoiceSession(guildId, channelId);
      
      if (endedSession) {
        const duration = calculateDuration(endedSession.startTime, endedSession.endTime!);
        fastify.log.info(`🔴 Call ended in ${channelName} (Duration: ${duration})`);
        fastify.log.info(`🔍 [DEBUG] Session ended, duration: ${duration} (Instance: ${instanceId}, Event: ${eventId})`);
        
        fastify.log.info(`🔍 [DEBUG] Sending call_end notification (Instance: ${instanceId}, Event: ${eventId})`);
        await sendNotification(fastify, guildId, channelId, 'call_end', {
          channelName,
          duration,
        }, instanceId, eventId);
      } else {
        fastify.log.warn(`🔍 [DEBUG] No active session found to end (Instance: ${instanceId}, Event: ${eventId})`);
      }
    } else {
      fastify.log.info(`👋 ${userName} left ongoing call in ${channelName}`);
      fastify.log.info(`🔍 [DEBUG] User left ongoing call - no action needed (Instance: ${instanceId}, Event: ${eventId})`);
    }
  } catch (error) {
    fastify.log.error(`❌ Error handling user left (${userId} <- ${channelId}):`, error);
    fastify.log.error(`🔍 [DEBUG] Error in handleUserLeft (Instance: ${instanceId}, Event: ${eventId}):`, error);
  }
  
  fastify.log.info(`🔍 [DEBUG] handleUserLeft completed (Instance: ${instanceId}, Event: ${eventId})`);
}

// 通知送信処理
async function sendNotification(fastify: any, guildId: string, voiceChannelId: string, type: string, data: any, instanceId: string, eventId: string) {
  const { discord, dbHelpers } = fastify;
  
  const notificationId = `${instanceId}_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  
  fastify.log.info(`🔍 [DEBUG] sendNotification started (Instance: ${instanceId}, Event: ${eventId}, NotificationID: ${notificationId})`);
  fastify.log.info(`🔍 [DEBUG] Notification type: ${type}, Guild: ${guildId}, VoiceChannel: ${voiceChannelId}`);
  
  try {
    // 通知設定を取得
    fastify.log.info(`🔍 [DEBUG] Fetching notification settings (Instance: ${instanceId}, Event: ${eventId})`);
    const notifications = await dbHelpers.getNotifications(guildId);
    const relevantNotifications = notifications.filter((n: any) => n.voiceChannelId === voiceChannelId);
    
    fastify.log.info(`🔍 [DEBUG] Found ${notifications.length} total notifications, ${relevantNotifications.length} relevant (Instance: ${instanceId}, Event: ${eventId})`);
    
    if (relevantNotifications.length === 0) {
      fastify.log.debug(`📭 No notification settings found for voice channel ${voiceChannelId}`);
      fastify.log.info(`🔍 [DEBUG] No relevant notifications, skipping (Instance: ${instanceId}, Event: ${eventId})`);
      return;
    }

    // 通知メッセージの作成
    fastify.log.info(`🔍 [DEBUG] Creating notification embed (Instance: ${instanceId}, Event: ${eventId})`);
    const embed = createNotificationEmbed(type, data);
    
    // 各設定されたテキストチャンネルに通知送信
    fastify.log.info(`🔍 [DEBUG] Sending to ${relevantNotifications.length} text channels (Instance: ${instanceId}, Event: ${eventId})`);
    for (const notification of relevantNotifications) {
      try {
        fastify.log.info(`🔍 [DEBUG] Sending to text channel: ${notification.textChannelId} (Instance: ${instanceId}, Event: ${eventId})`);
        const textChannel = await discord.channels.fetch(notification.textChannelId) as TextChannel;
        if (textChannel && textChannel.isTextBased()) {
          await textChannel.send({ embeds: [embed] });
          fastify.log.info(`📨 Notification sent to #${textChannel.name} for ${type}`);
          fastify.log.info(`🔍 [DEBUG] Successfully sent to #${textChannel.name} (Instance: ${instanceId}, Event: ${eventId}, NotificationID: ${notificationId})`);
        } else {
          fastify.log.warn(`🔍 [DEBUG] Invalid text channel: ${notification.textChannelId} (Instance: ${instanceId}, Event: ${eventId})`);
        }
      } catch (error) {
        fastify.log.error(`❌ Failed to send notification to channel ${notification.textChannelId}:`, error);
        fastify.log.error(`🔍 [DEBUG] Send error for channel ${notification.textChannelId} (Instance: ${instanceId}, Event: ${eventId}):`, error);
      }
    }
  } catch (error) {
    fastify.log.error(`❌ Error sending notification for ${type}:`, error);
    fastify.log.error(`🔍 [DEBUG] Error in sendNotification (Instance: ${instanceId}, Event: ${eventId}, NotificationID: ${notificationId}):`, error);
  }
  
  fastify.log.info(`🔍 [DEBUG] sendNotification completed (Instance: ${instanceId}, Event: ${eventId}, NotificationID: ${notificationId})`);
}

// 通知埋め込みメッセージの作成
function createNotificationEmbed(type: string, data: any): EmbedBuilder {
  const now = new Date();
  const timeStr = formatJapaneseTime(now);

  switch (type) {
    case 'call_start':
      return new EmbedBuilder()
        .setTitle(`通話開始`)
        .setColor(0x00bfff) // 青色
        .setDescription(`${data.userName}`)
        .addFields(
          { name: '`チャンネル`', value: data.channelName, inline: true },
          { name: '`始めた人`', value: data.userName, inline: true },
          { name: '`開始時刻`', value: timeStr, inline: true }
        )
        .setThumbnail(`https://cdn.discordapp.com/avatars/${data.userId}/${data.userAvatar}.png`)
        // .setTimestamp()

    case 'member_join':
      return new EmbedBuilder()
        .setTitle(`${data.userName} が参戦`)
        .setColor(0x5cb85c) // 緑色
        .addFields(
          { name: '`チャンネル`', value: data.channelName, inline: true },
          { name: '`参加した人`', value: data.userName, inline: true },
          { name: '`参戦時間`', value: timeStr, inline: true }
        )
        .setThumbnail(`https://cdn.discordapp.com/avatars/${data.userId}/${data.userAvatar}.png`)
        // .setTimestamp();

    case 'call_end':
      return new EmbedBuilder()
        .setTitle('通話終了...')
        .setColor(0xd9534f) // 赤色
        .addFields(
          { name: '`チャンネル`', value: data.channelName, inline: true },
          { name: '`終了時刻`', value: timeStr, inline: true },
          { name: '`通話時間`', value: data.duration, inline: true }
        )
        .setThumbnail(`https://cataas.com/cat?width=128&height=128&${Date.now()}`)
        // .setTimestamp()

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