import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from 'dotenv';

// 環境変数読み込み
config();

const commands = [
  new SlashCommandBuilder()
    .setName('notify')
    .setDescription('ボイスチャンネル通知設定')
    .addSubcommand(subcommand =>
      subcommand
        .setName('configure')
        .setDescription('通知設定を構成・変更します')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('現在のテキストチャンネルで監視中のボイスチャンネル一覧を表示')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('サーバー全体の通知設定を一覧表示')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('現在のテキストチャンネルの通知設定を削除')
    ),
].map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

async function deployCommands() {
  try {
    console.log('🔄 Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID!),
      { body: commands },
    );

    console.log('✅ Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

deployCommands();