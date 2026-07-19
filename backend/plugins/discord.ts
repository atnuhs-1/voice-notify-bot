import fp from 'fastify-plugin';
import { Client, GatewayIntentBits, Events, VoiceState, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getCurrentPeriodKeys } from '../utils/period';
import { DatabaseHelpers } from './database';

// Discord クライアントの型定義
declare module 'fastify' {
  interface FastifyInstance {
    discord: Client;
    dbHelpers: DatabaseHelpers
  }
}

const discordPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
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

  // Fastifyインスタンスに登録（早期）
  fastify.decorate('discord', client);

  const LOGIN_TIMEOUT_MS = Number(process.env.DISCORD_LOGIN_TIMEOUT_MS || '15000');
  const READY_TIMEOUT_MS = Number(process.env.DISCORD_READY_TIMEOUT_MS || '5000');

  // READY を先に待機設定（login 前に listener を置く）
  const readyPromise = new Promise<void>((resolve, reject) => {
    client.once(Events.ClientReady, () => resolve());
    client.once('error', (err) => reject(err));
  });

  // login フェーズ (明示タイムアウト)
  fastify.log.info(`🔌 Discord login start (timeout=${LOGIN_TIMEOUT_MS}ms)`);
  try {
    await Promise.race([
      client.login(process.env.DISCORD_TOKEN),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Discord login timeout (${LOGIN_TIMEOUT_MS}ms)`)), LOGIN_TIMEOUT_MS)
      )
    ]);
    fastify.log.info(`✅ Discord login resolved: ${client.user?.tag}`);
  } catch (e) {
    fastify.log.error({ err: e }, '❌ Discord login phase failed');
    throw e;
  }

  // READY フェーズ (login 後追加の安全弁)
  fastify.log.info(`⏳ Waiting Discord READY (timeout=${READY_TIMEOUT_MS}ms)`);
  try {
    await Promise.race([
      readyPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Discord READY timeout (${READY_TIMEOUT_MS}ms)`)), READY_TIMEOUT_MS)
      )
    ]);
    fastify.log.info(`🚀 Discord READY (guilds=${client.guilds.cache.size})`);
  } catch (e) {
    fastify.log.error({ err: e }, '❌ Discord READY wait failed');
    throw e;
  }

  // ボイス状態変更イベント（データベース統合版）
  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    try {
      await handleVoiceStateUpdate(fastify, oldState, newState);
    } catch (error) {
      fastify.log.error('❌ Error handling voice state update:', error);
    }
  });

  // アプリケーション終了時のクリーンアップ
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing Discord client...');
    client.destroy();
  });
};

// ボイス状態変更ハンドラー（データベースと通知機能付き）
async function handleVoiceStateUpdate(fastify: FastifyInstance, oldState: VoiceState, newState: VoiceState) {
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
async function handleUserJoined(fastify: FastifyInstance, guildId: string, channelId: string, userId: string, userName: string) {
  const { discord, dbHelpers } = fastify;
  
  try {
    // チャンネル情報を取得
    const channel = await discord.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) return; // 通常のボイスチャンネル以外は無視

    // ユーザー情報を取得
    const user = await discord.users.fetch(userId);
    const userAvatarUrl = user.displayAvatarURL({ size: 128 });

    const channelName = channel.name;
    // Botは通話の開始・終了判定に含めず、人間ユーザーだけを数える
    const humanMemberCount = channel.members.filter(member => !member.user.bot).size;

    fastify.log.info(`👤 ${userName} joined voice channel: ${channelName} (${humanMemberCount} human members)`);

    // セッション管理: 通話開始 or 継続の判定
    let sessionId: number;
    let isSessionStarter = false;

    if (humanMemberCount === 1) {
      // 通話開始
      sessionId = await dbHelpers.startVoiceSession(guildId, channelId);
      isSessionStarter = true;
      fastify.log.info(`🔵 Call started in ${channelName} (Session ID: ${sessionId})`);
      
      await sendNotification(fastify, guildId, channelId, 'call_start', {
        channelName,
        userName,
        userId,
        userAvatarUrl,
      });
    } else {
      // 既存セッションに参加
      const activeSession = await dbHelpers.getActiveSession(guildId, channelId);
      if (!activeSession) {
        fastify.log.error(`❌ No active session found for ongoing call in channel ${channelId}`);
        return;
      }
      sessionId = activeSession.id;
      fastify.log.info(`🟢 ${userName} joined ongoing call in ${channelName}`);
      
      await sendNotification(fastify, guildId, channelId, 'member_join', {
        channelName,
        userName,
        userId,
        userAvatarUrl,
      });
    }

    // 新機能: 個人の入室記録を作成
    try {
      await dbHelpers.createUserActivity({
        guildId,
        userId,
        username: userName,
        channelId,
        sessionId,
        joinTime: new Date().toISOString(),
        isSessionStarter
      });

      fastify.log.info(`📊 User activity recorded: ${userName} joined ${channelName} (starter: ${isSessionStarter})`);
    } catch (activityError) {
      fastify.log.error(`❌ Failed to record user activity for ${userName}:`, activityError);
      // 統計記録の失敗は通知機能に影響しないため、処理を継続
    }

  } catch (error) {
    fastify.log.error(`❌ Error handling user joined (${userId} -> ${channelId}):`, error);
  }
}

// ユーザー退室処理
async function handleUserLeft(fastify: FastifyInstance, guildId: string, channelId: string, userId: string, userName: string) {
  const { discord, dbHelpers } = fastify;
  
  try {
    // チャンネル情報を取得
    const channel = await discord.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) return;

    const channelName = channel.name;
    // Botだけが残っている場合も通話終了として扱う
    const memberCount = channel.members.filter(member => !member.user.bot).size;

    fastify.log.info(`👤 ${userName} left voice channel: ${channelName} (${memberCount} members remaining)`);

    // 新機能: 個人の退室記録を終了し、期間別統計を更新
    try {
      const userActivity = await dbHelpers.endUserActivity(guildId, userId, channelId);
      
      if (userActivity && userActivity.duration !== null) {
        const duration = userActivity.duration;
        fastify.log.info(`📊 User activity ended: ${userName} left ${channelName} (Duration: ${Math.floor(duration / 60)}m ${duration % 60}s)`);
        
        // 期間別統計を即座に更新
        try {
          const periods = getCurrentPeriodKeys(new Date(userActivity.joinTime));
          
          // 週間、月間、年間統計を更新
          await dbHelpers.updatePeriodStats(guildId, userId, userName, 'week', periods.currentWeek, userActivity);
          await dbHelpers.updatePeriodStats(guildId, userId, userName, 'month', periods.currentMonth, userActivity);
          await dbHelpers.updatePeriodStats(guildId, userId, userName, 'year', periods.currentYear, userActivity);
          
          fastify.log.info(`📈 Period statistics updated for ${userName}`);
        } catch (statsError) {
          fastify.log.error(`❌ Failed to update period statistics for ${userName}:`, statsError);
          // 統計更新の失敗は他の処理に影響しないため、処理を継続
        }
      } else {
        fastify.log.warn(`⚠️ No active user activity found for ${userName} in ${channelName}`);
      }
    } catch (activityError) {
      fastify.log.error(`❌ Failed to end user activity for ${userName}:`, activityError);
    }

    // セッション管理: 通話終了の判定
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
async function sendNotification(fastify: FastifyInstance, guildId: string, voiceChannelId: string, type: string, data: any) {
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
        .setColor(0x00bfff) // 青色
        .setDescription(`${data.userName}`)
        .addFields(
          { name: '`チャンネル`', value: data.channelName, inline: true },
          { name: '`始めた人`', value: data.userName, inline: true },
          { name: '`開始時刻`', value: timeStr, inline: true }
        )
        .setThumbnail(data.userAvatarUrl)
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
        .setThumbnail(data.userAvatarUrl)
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
