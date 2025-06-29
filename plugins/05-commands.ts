import fp from 'fastify-plugin';
import { 
  Events, 
  Interaction, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
  ChannelType
} from 'discord.js';
import type { FastifyPluginAsync } from 'fastify';

const commandsPlugin: FastifyPluginAsync = async (fastify) => {
  // スラッシュコマンドイベントハンドラーを登録
  fastify.discord.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'notify') {
      await handleNotifyCommand(fastify, interaction);
    }
  });

  fastify.log.info('✅ Slash commands handler registered');
};

// /notify コマンドのメインハンドラー
async function handleNotifyCommand(fastify: any, interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'configure':
        await handleConfigure(fastify, interaction);
        break;
      case 'status':
        await handleStatus(fastify, interaction);
        break;
      case 'list':
        await handleList(fastify, interaction);
        break;
      case 'delete':
        await handleDelete(fastify, interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ 不明なサブコマンドです。',
          ephemeral: true,
        });
    }
  } catch (error) {
    fastify.log.error('Error handling notify command:', error);
    
    const errorMessage = '❌ コマンドの実行中にエラーが発生しました。';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

// /notify configure - 通知設定
async function handleConfigure(fastify: any, interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true,
    });
    return;
  }

  // ボイスチャンネル一覧を取得
  const voiceChannels = interaction.guild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildVoice)
    .first(20); // 最大20個

  if (voiceChannels.length === 0) {
    await interaction.reply({
      content: '❌ このサーバーにはボイスチャンネルがありません。',
      ephemeral: true,
    });
    return;
  }

  // 現在の設定を取得
  const guildId = interaction.guild.id;
  const textChannelId = interaction.channel?.id!;
  const currentNotifications = await fastify.dbHelpers.getNotifications(guildId, textChannelId);
  const currentChannelIds = currentNotifications.map((n: any) => n.voiceChannelId);

  // チャンネル選択メニュー作成
  const selectMenu = new ChannelSelectMenuBuilder()
    .setCustomId('voice_channel_select')
    .setPlaceholder('監視するボイスチャンネルを選択してください（最大20個）')
    .setChannelTypes(ChannelType.GuildVoice)
    .setMinValues(0)
    .setMaxValues(Math.min(voiceChannels.length, 20))
    .setDefaultChannels(currentChannelIds);

  const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setTitle('🔧 ボイスチャンネル通知設定')
    .setDescription(
      '監視するボイスチャンネルを選択してください。\n' +
      '選択されたチャンネルでの入退室がこのテキストチャンネルに通知されます。'
    )
    .setColor(0x00bfff)
    .addFields(
      { 
        name: '現在の設定', 
        value: currentNotifications.length > 0 
          ? `${currentNotifications.length}個のチャンネルを監視中`
          : '未設定', 
        inline: true 
      },
      { 
        name: 'タイムアウト', 
        value: '30秒', 
        inline: true 
      }
    );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });

  // チャンネル選択の応答を待機
  try {
    const collector = interaction.channel?.createMessageComponentCollector({
      componentType: ComponentType.ChannelSelect,
      time: 30000, // 30秒
    });

    collector?.on('collect', async (selectInteraction) => {
      if (selectInteraction.user.id !== interaction.user.id) {
        await selectInteraction.reply({
          content: '❌ この設定は実行者のみが操作できます。',
          ephemeral: true,
        });
        return;
      }

      const selectedChannels = selectInteraction.values;
      
      try {
        // 設定を更新
        await fastify.dbHelpers.setNotifications(guildId, textChannelId, selectedChannels);

        const resultEmbed = new EmbedBuilder()
          .setTitle('✅ 通知設定が更新されました')
          .setDescription(
            selectedChannels.length > 0
              ? `${selectedChannels.length}個のボイスチャンネルの監視を開始しました。`
              : '全ての通知設定を削除しました。'
          )
          .setColor(0x5cb85c);

        if (selectedChannels.length > 0) {
          const channelNames = selectedChannels
            .map(id => interaction.guild?.channels.cache.get(id)?.name || 'Unknown')
            .join(', ');
          
          resultEmbed.addFields({
            name: '監視対象チャンネル',
            value: channelNames,
          });
        }

        await selectInteraction.update({
          embeds: [resultEmbed],
          components: [],
        });

        fastify.log.info(`✅ Notification settings updated for guild ${guildId}, channel ${textChannelId}: ${selectedChannels.length} voice channels`);

      } catch (error) {
        fastify.log.error('Error updating notification settings:', error);
        await selectInteraction.update({
          content: '❌ 設定の更新中にエラーが発生しました。',
          embeds: [],
          components: [],
        });
      }
    });

    collector?.on('end', async (collected) => {
      if (collected.size === 0) {
        try {
          await interaction.editReply({
            content: '⏰ タイムアウトしました。再度コマンドを実行してください。',
            embeds: [],
            components: [],
          });
        } catch (error) {
          // タイムアウト時のエラーは無視
        }
      }
    });

  } catch (error) {
    fastify.log.error('Error setting up collector:', error);
  }
}

// /notify status - 現在の設定確認
async function handleStatus(fastify: any, interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guild.id;
  const textChannelId = interaction.channel?.id!;
  
  const notifications = await fastify.dbHelpers.getNotifications(guildId, textChannelId);

  const embed = new EmbedBuilder()
    .setTitle('📊 現在の通知設定')
    .setColor(0x00bfff);

  if (notifications.length === 0) {
    embed.setDescription('このテキストチャンネルには通知設定がありません。');
  } else {
    const channelList = notifications
      .map((n: any) => {
        const channel = interaction.guild?.channels.cache.get(n.voiceChannelId);
        return channel ? `• ${channel.name}` : `• 不明なチャンネル (${n.voiceChannelId})`;
      })
      .join('\n');

    embed
      .setDescription(`${notifications.length}個のボイスチャンネルを監視中`)
      .addFields({
        name: '監視対象チャンネル',
        value: channelList,
      });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// /notify list - サーバー全体の設定一覧
async function handleList(fastify: any, interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guild.id;
  const allNotifications = await fastify.dbHelpers.getNotifications(guildId);

  const embed = new EmbedBuilder()
    .setTitle('📋 サーバー全体の通知設定')
    .setColor(0x00bfff);

  if (allNotifications.length === 0) {
    embed.setDescription('このサーバーには通知設定がありません。');
  } else {
    // テキストチャンネル別にグループ化
    const grouped = allNotifications.reduce((acc: any, notification: any) => {
      if (!acc[notification.textChannelId]) {
        acc[notification.textChannelId] = [];
      }
      acc[notification.textChannelId].push(notification);
      return acc;
    }, {});

    const fieldsList = Object.entries(grouped).map(([textChannelId, notifications]: [string, any]) => {
      const textChannel = interaction.guild?.channels.cache.get(textChannelId);
      const textChannelName = textChannel ? `#${textChannel.name}` : `不明なチャンネル (${textChannelId})`;
      
      const voiceChannelNames = notifications
        .map((n: any) => {
          const voiceChannel = interaction.guild?.channels.cache.get(n.voiceChannelId);
          return voiceChannel ? voiceChannel.name : `不明 (${n.voiceChannelId})`;
        })
        .join(', ');

      return {
        name: textChannelName,
        value: `${notifications.length}個: ${voiceChannelNames}`,
        inline: false,
      };
    });

    embed
      .setDescription(`${Object.keys(grouped).length}個のテキストチャンネルで通知設定あり`)
      .addFields(fieldsList);
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// /notify delete - 設定削除
async function handleDelete(fastify: any, interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guild.id;
  const textChannelId = interaction.channel?.id!;
  
  const notifications = await fastify.dbHelpers.getNotifications(guildId, textChannelId);

  if (notifications.length === 0) {
    await interaction.reply({
      content: '❌ このテキストチャンネルには削除する通知設定がありません。',
      ephemeral: true,
    });
    return;
  }

  await fastify.dbHelpers.deleteNotifications(guildId, textChannelId);

  const embed = new EmbedBuilder()
    .setTitle('🗑️ 通知設定を削除しました')
    .setDescription(`${notifications.length}個のボイスチャンネルの監視を停止しました。`)
    .setColor(0xd9534f);

  await interaction.reply({ embeds: [embed], ephemeral: true });

  fastify.log.info(`🗑️ Notification settings deleted for guild ${guildId}, channel ${textChannelId}`);
}

export default fp(commandsPlugin, {
  name: 'commands',
  dependencies: ['env', 'database', 'discord'],
});