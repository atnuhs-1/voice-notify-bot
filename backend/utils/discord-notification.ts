// Phase 4: Discord通知送信システム
// 統計サマリーのリッチEmbed通知送信

import { EmbedBuilder, TextChannel, Guild } from 'discord.js';

// 通知送信結果の型定義
interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

// サマリーデータの型定義
interface SummaryData {
  totalDuration: number;
  totalParticipants: number;
  totalSessions: number;
  averageSessionDuration?: number;
  longestSession?: number;
  topUserId?: string | null;
  topUsername?: string | null;
  topUserDuration?: number;
  mostActiveDayDate?: string | null;
  mostActiveDayDuration?: number;
}

// 時間フォーマット関数
const formatDuration = (seconds: number): string => {
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes}分`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
};

// 日付フォーマット関数
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  });
};

// 期間フォーマット関数
const formatPeriod = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric'
  };
  
  return `${start.toLocaleDateString('ja-JP', formatOptions)} - ${end.toLocaleDateString('ja-JP', formatOptions)}`;
};

// 日次通知Embed作成
export const createDailyNotificationEmbed = (
  summary: SummaryData,
  periodStart: string,
  periodEnd: string,
  guildName: string
): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setTitle('📊 日次活動サマリー')
    .setDescription(`**${guildName}** の昨日の通話活動をお知らせします`)
    .setColor(0x00D4AA) // Discord緑
    .setTimestamp();

  // 基本統計
  embed.addFields([
    {
      name: '🕐 活動期間',
      value: formatPeriod(periodStart, periodEnd),
      inline: false
    },
    {
      name: '⏱️ 総通話時間',
      value: `**${formatDuration(summary.totalDuration)}**`,
      inline: true
    },
    {
      name: '👥 参加者数',
      value: `**${summary.totalParticipants}人**`,
      inline: true
    },
    {
      name: '📞 セッション数',
      value: `**${summary.totalSessions}回**`,
      inline: true
    }
  ]);

  // 最長セッション（データがある場合）
  if (summary.longestSession && summary.longestSession > 0) {
    embed.addFields({
      name: '🏆 最長セッション',
      value: formatDuration(summary.longestSession),
      inline: true
    });
  }

  // MVP（最も活動的なユーザー）
  if (summary.topUsername && summary.topUserDuration && summary.topUserDuration > 0) {
    embed.addFields({
      name: '👑 MVP',
      value: `**${summary.topUsername}**\n${formatDuration(summary.topUserDuration)}`,
      inline: true
    });
  }

  // フッター
  embed.setFooter({
    text: '毎日の活動をお疲れ様でした！ • Discord Voice Notify Bot',
    iconURL: 'https://cdn.discordapp.com/emojis/847852227467395072.png'
  });

  return embed;
};

// 週次通知Embed作成
export const createWeeklyNotificationEmbed = (
  summary: SummaryData,
  weekKey: string,
  guildName: string
): EmbedBuilder => {
  // 週キーから期間を計算（簡易版）
  const [year, week] = weekKey.split('-W');
  const weekNum = parseInt(week);
  
  const embed = new EmbedBuilder()
    .setTitle('📈 週次活動サマリー')
    .setDescription(`**${guildName}** の先週の通話活動をお知らせします`)
    .setColor(0x5865F2) // Discord紫
    .setTimestamp();

  // 基本統計
  embed.addFields([
    {
      name: '📅 対象期間',
      value: `${year}年 第${weekNum}週`,
      inline: false
    },
    {
      name: '⏱️ 総通話時間',
      value: `**${formatDuration(summary.totalDuration)}**`,
      inline: true
    },
    {
      name: '👥 参加者数',
      value: `**${summary.totalParticipants}人**`,
      inline: true
    },
    {
      name: '📞 セッション数',
      value: `**${summary.totalSessions}回**`,
      inline: true
    }
  ]);

  // 平均セッション時間
  if (summary.averageSessionDuration && summary.averageSessionDuration > 0) {
    embed.addFields({
      name: '📊 平均セッション時間',
      value: formatDuration(summary.averageSessionDuration),
      inline: true
    });
  }

  // MVP
  if (summary.topUsername && summary.topUserDuration && summary.topUserDuration > 0) {
    embed.addFields({
      name: '👑 週間MVP',
      value: `**${summary.topUsername}**\n${formatDuration(summary.topUserDuration)}`,
      inline: true
    });
  }

  // 統計の比較（将来実装予定）
  embed.addFields({
    name: '📈 成長記録',
    value: '前週比データは今後実装予定です',
    inline: false
  });

  embed.setFooter({
    text: '1週間お疲れ様でした！ • Discord Voice Notify Bot',
    iconURL: 'https://cdn.discordapp.com/emojis/847852227467395072.png'
  });

  return embed;
};

// 月次通知Embed作成
export const createMonthlyNotificationEmbed = (
  summary: SummaryData,
  monthKey: string,
  guildName: string
): EmbedBuilder => {
  // 月キーから期間を計算
  const [year, month] = monthKey.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long'
  });
  
  const embed = new EmbedBuilder()
    .setTitle('🎊 月次活動サマリー')
    .setDescription(`**${guildName}** の${monthName}の通話活動をお知らせします`)
    .setColor(0xFEE75C) // Discord黄
    .setTimestamp();

  // 基本統計
  embed.addFields([
    {
      name: '📅 対象期間',
      value: monthName,
      inline: false
    },
    {
      name: '⏱️ 総通話時間',
      value: `**${formatDuration(summary.totalDuration)}**`,
      inline: true
    },
    {
      name: '👥 参加者数',
      value: `**${summary.totalParticipants}人**`,
      inline: true
    },
    {
      name: '📞 セッション数',
      value: `**${summary.totalSessions}回**`,
      inline: true
    }
  ]);

  // 平均セッション時間
  if (summary.averageSessionDuration && summary.averageSessionDuration > 0) {
    embed.addFields({
      name: '📊 平均セッション時間',
      value: formatDuration(summary.averageSessionDuration),
      inline: true
    });
  }

  // 日平均通話時間
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const dailyAverage = Math.round(summary.totalDuration / daysInMonth);
  embed.addFields({
    name: '📅 1日平均通話時間',
    value: formatDuration(dailyAverage),
    inline: true
  });

  // MVP
  if (summary.topUsername && summary.topUserDuration && summary.topUserDuration > 0) {
    embed.addFields({
      name: '👑 月間MVP',
      value: `**${summary.topUsername}**\n${formatDuration(summary.topUserDuration)}`,
      inline: true
    });
  }

  // 最も活動的な日（データがある場合）
  if (summary.mostActiveDayDate && summary.mostActiveDayDuration && summary.mostActiveDayDuration > 0) {
    embed.addFields({
      name: '🔥 最も盛り上がった日',
      value: `${formatDate(summary.mostActiveDayDate)}\n${formatDuration(summary.mostActiveDayDuration)}`,
      inline: true
    });
  }

  embed.setFooter({
    text: '1ヶ月間お疲れ様でした！ • Discord Voice Notify Bot',
    iconURL: 'https://cdn.discordapp.com/emojis/847852227467395072.png'
  });

  return embed;
};

// Discord通知送信クラス
export class DiscordNotificationSender {
  constructor(private discordClient: any, private logger: any) {}

  // 通知送信の共通処理
  async sendNotification(
    guildId: string,
    channelId: string,
    embed: EmbedBuilder
  ): Promise<NotificationResult> {
    try {
      // ギルドの取得
      const guild: Guild | undefined = this.discordClient.guilds.cache.get(guildId);
      if (!guild) {
        return {
          success: false,
          error: 'Bot がサーバーに参加していません',
          details: { guildId }
        };
      }

      // チャンネルの取得
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) {
        return {
          success: false,
          error: 'チャンネルが見つからないか、テキストチャンネルではありません',
          details: { guildId, channelId }
        };
      }

      // 権限チェック
      const textChannel = channel as TextChannel;
      const permissions = textChannel.permissionsFor(this.discordClient.user);
      if (!permissions?.has(['SendMessages', 'EmbedLinks'])) {
        return {
          success: false,
          error: 'メッセージ送信またはEmbed埋め込み権限がありません',
          details: { guildId, channelId }
        };
      }

      // メッセージ送信
      const message = await textChannel.send({ embeds: [embed] });
      
      this.logger.info(`✅ Discord通知送信成功: ${guild.name}/#${textChannel.name} (${message.id})`);
      
      return {
        success: true,
        messageId: message.id,
        details: {
          guildId,
          guildName: guild.name,
          channelId,
          channelName: textChannel.name
        }
      };

    } catch (error) {
      this.logger.error('Discord通知送信エラー:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー',
        details: { guildId, channelId, error }
      };
    }
  }

  // 日次通知送信
  async sendDailyNotification(
    guildId: string,
    channelId: string,
    summary: SummaryData,
    periodStart: string,
    periodEnd: string
  ): Promise<NotificationResult> {
    try {
      const guild = this.discordClient.guilds.cache.get(guildId);
      const guildName = guild?.name || 'Unknown Server';
      
      const embed = createDailyNotificationEmbed(summary, periodStart, periodEnd, guildName);
      return await this.sendNotification(guildId, channelId, embed);
      
    } catch (error) {
      this.logger.error('日次通知生成エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '日次通知の生成に失敗しました',
        details: { guildId, channelId, summary }
      };
    }
  }

  // 週次通知送信
  async sendWeeklyNotification(
    guildId: string,
    channelId: string,
    summary: SummaryData,
    weekKey: string
  ): Promise<NotificationResult> {
    try {
      const guild = this.discordClient.guilds.cache.get(guildId);
      const guildName = guild?.name || 'Unknown Server';
      
      const embed = createWeeklyNotificationEmbed(summary, weekKey, guildName);
      return await this.sendNotification(guildId, channelId, embed);
      
    } catch (error) {
      this.logger.error('週次通知生成エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '週次通知の生成に失敗しました',
        details: { guildId, channelId, summary, weekKey }
      };
    }
  }

  // 月次通知送信
  async sendMonthlyNotification(
    guildId: string,
    channelId: string,
    summary: SummaryData,
    monthKey: string
  ): Promise<NotificationResult> {
    try {
      const guild = this.discordClient.guilds.cache.get(guildId);
      const guildName = guild?.name || 'Unknown Server';
      
      const embed = createMonthlyNotificationEmbed(summary, monthKey, guildName);
      return await this.sendNotification(guildId, channelId, embed);
      
    } catch (error) {
      this.logger.error('月次通知生成エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '月次通知の生成に失敗しました',
        details: { guildId, channelId, summary, monthKey }
      };
    }
  }

  // テスト通知送信
  async sendTestNotification(
    guildId: string,
    channelId: string,
    type: 'daily' | 'weekly' | 'monthly'
  ): Promise<NotificationResult> {
    try {
      const guild = this.discordClient.guilds.cache.get(guildId);
      const guildName = guild?.name || 'Unknown Server';
      
      // テスト用のサンプルデータ
      const sampleSummary: SummaryData = {
        totalDuration: 7200, // 2時間
        totalParticipants: 5,
        totalSessions: 3,
        averageSessionDuration: 2400, // 40分
        longestSession: 3600, // 1時間
        topUserId: 'test-user-id',
        topUsername: 'テストユーザー',
        topUserDuration: 3600,
        mostActiveDayDate: new Date().toISOString(),
        mostActiveDayDuration: 7200
      };

      let embed: EmbedBuilder;
      
      switch (type) {
        case 'daily':
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          embed = createDailyNotificationEmbed(sampleSummary, yesterday, new Date().toISOString(), guildName);
          embed.setTitle('🧪 テスト通知 - 日次サマリー');
          break;
          
        case 'weekly':
          embed = createWeeklyNotificationEmbed(sampleSummary, '2024-W03', guildName);
          embed.setTitle('🧪 テスト通知 - 週次サマリー');
          break;
          
        case 'monthly':
          embed = createMonthlyNotificationEmbed(sampleSummary, '2024-01', guildName);
          embed.setTitle('🧪 テスト通知 - 月次サマリー');
          break;
      }

      // テスト通知であることを明記
      embed.setDescription(embed.data.description + '\n\n⚠️ **これはテスト通知です**');
      
      return await this.sendNotification(guildId, channelId, embed);
      
    } catch (error) {
      this.logger.error('テスト通知生成エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'テスト通知の生成に失敗しました',
        details: { guildId, channelId, type }
      };
    }
  }
}