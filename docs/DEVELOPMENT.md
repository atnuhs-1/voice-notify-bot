# 開発ガイド

Discord Voice Notify Bot + Web Dashboard の開発・運用ガイドです。

## 📋 目次
- [開発環境セットアップ](#開発環境セットアップ)
- [技術スタック](#技術スタック)
- [アーキテクチャ概要](#アーキテクチャ概要)
- [開発フロー](#開発フロー)
- [デプロイ・運用](#デプロイ運用)
- [技術詳細](#技術詳細)

---

## 🚀 開発環境セットアップ

### 前提条件
- **Node.js**: 18+ 
- **npm**: 9+
- **Git**: 最新版
- **Discord Developer Portal**: Bot・OAuth2アプリケーション設定
- **Turso Account**: データベース（無料プラン可）

### モノレポ開発フロー
```bash
# 1. リポジトリクローン
git clone https://github.com/your-org/discord-voice-notify-bot.git
cd discord-voice-notify-bot

# 2. 両方のアプリケーションの依存関係をインストール
cd backend && npm install
cd ../frontend && npm install

# 3. 環境変数設定（後述の環境変数セクション参照）
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# .envファイルを編集して必要な値を設定

# 4. 開発時は別々のターミナルで実行
# ターミナル1: バックエンド (ポート3000)
cd backend && npm run dev    

# ターミナル2: フロントエンド (ポート5173)  
cd frontend && npm run dev   
```

### 環境変数設定

#### バックエンド (.env)
```bash
# Discord Bot設定（必須）
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_id  
DISCORD_CLIENT_SECRET=your_discord_client_secret

# データベース設定（必須）
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token

# 認証設定（必須）
JWT_SECRET=your_jwt_secret_key

# サーバー設定
PORT=3000
HOST=0.0.0.0

# CORS設定
CORS_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app

# 開発環境設定
NODE_ENV=development
LOG_LEVEL=debug
```

#### フロントエンド (.env)
```bash
# API設定
VITE_API_BASE_URL=http://localhost:3000

# 開発環境設定
NODE_ENV=development
```

---

## 🛠️ 技術スタック

### バックエンド
```json
{
  "runtime": "Node.js 18+",
  "framework": "Fastify",
  "discord": "discord.js@^14.14.1",
  "database": "@libsql/client",
  "auth": "jsonwebtoken",
  "cors": "@fastify/cors",
  "scheduler": "node-cron"
}
```

### フロントエンド
```json
{
  "framework": "React 18+",
  "language": "TypeScript",
  "bundler": "Vite",
  "styling": "Tailwind CSS",
  "charts": "recharts",
  "icons": "lucide-react",
  "routing": "React Router",
  "state-management": "Jotai"
}
```

---

## 🏗️ アーキテクチャ概要

### システム構成
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │    Discord      │
│   (React SPA)   │◄──►│  (Fastify API)  │◄──►│   Bot Client    │
│   Port: 5173    │    │   Port: 3000    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │  Turso Database │    │ Discord Servers │
         │              │    (SQLite)     │    │  Voice Channels │
         │              └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Vercel/Static  │
│   Deployment    │
└─────────────────┘
```

### バックエンド構造
```
backend/
├── server.ts                 # エントリーポイント・グレースフルシャットダウン
├── app.ts                   # Fastify設定・プラグイン読み込み
├── plugins/                 # 依存関係順で読み込み
│   ├── support.ts           # ユーティリティ関数
│   ├── env.ts               # 環境変数バリデーション
│   ├── database.ts          # Turso接続・ヘルパー
│   ├── discord.ts           # Discord.js・イベント処理
│   ├── auth.ts              # JWT認証
│   ├── response.ts          # 統一APIレスポンス
│   ├── permission.ts        # 権限チェック
│   ├── commands.ts          # スラッシュコマンド
│   └── keepalive.ts         # ヘルスチェック
├── routes/                  # API エンドポイント
│   ├── api/auth/            # Discord OAuth認証
│   ├── api/v1/guilds/       # 統計API（実装済み）
│   └── health/              # ヘルスチェック
├── utils/                   # ユーティリティ
│   ├── statistics.ts        # 統計計算・ランキング
│   ├── period.ts            # 期間計算・キー生成
│   └── validation.ts        # バリデーション
└── types/                   # TypeScript型定義
    ├── api.ts               # APIレスポンス・エラー
    ├── database.ts          # DBテーブル型
    └── shared.ts            # 共通型
```

### フロントエンド構造
```
frontend/src/
├── App.tsx                  # React Router・テーマ設定
├── pages/                   # ページコンポーネント
│   └── DashboardPage.tsx    # メイン統計ダッシュボード
├── components/              # UIコンポーネント
│   ├── layout/              # レイアウト
│   └── statistics/          # 統計表示
│       ├── RankingView.tsx  # ランキング表示
│       ├── SummaryView.tsx  # サマリー表示
│       └── RankingTable.tsx # ランキングテーブル
├── atoms/                   # Jotai状態管理
│   ├── discord.ts           # サーバー・認証
│   ├── statistics.ts        # 統計データ・メトリクス
│   ├── presets.ts           # 期間選択・最適化
│   └── summaries.ts         # サマリー・比較
├── utils/                   # ユーティリティ
│   ├── api.ts               # APIクライアント
│   ├── period.ts            # 期間計算
│   └── date.ts              # 日付処理
└── types/                   # TypeScript型定義
    ├── discord.ts           # Discord API型
    └── statistics.ts        # 統計API型
```

---

## 🔄 開発フロー

### バックエンド開発
```bash
cd backend

# 開発サーバー（ホットリロード）
npm run dev

# ビルド・実行
npm run build        # TypeScript → dist/
npm run start        # dist/から実行

# 開発ツール
npm run typecheck    # 型チェック
npm test             # テスト実行
npm run deploy-commands  # Discordコマンドデプロイ
npm run clean        # dist/削除
```

### フロントエンド開発
```bash
cd frontend

# 開発サーバー
npm run dev          # Vite開発サーバー (ポート5173)

# ビルド・プレビュー
npm run build        # 本番ビルド
npm run preview      # 本番ビルドプレビュー

# 開発ツール
npm run lint         # ESLint チェック
npm run type-check   # TypeScript型チェック
```

### Git フロー
```bash
# 機能開発
git checkout -b feature/notification-system
git add .
git commit -m "feat: 通知システムのAPI実装"

# コミット時の自動実行
# - TypeScript型チェック
# - ESLint チェック  
# - 自動フォーマット

git push origin feature/notification-system
# → Pull Request作成
```

---

## 🚀 デプロイ・運用

### 本番環境

#### バックエンド (Koyeb)
```yaml
# koyeb.yaml
services:
  - name: discord-voice-bot-backend
    type: web
    git:
      branch: main
      build_command: npm run build
      run_command: npm start
    instance_type: nano
    env:
      - NODE_ENV=production
      - LOG_LEVEL=info
    healthcheck:
      path: /health
```

#### フロントエンド (Vercel)
```json
// vercel.json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "env": {
    "VITE_API_BASE_URL": "https://your-backend.koyeb.app"
  }
}
```

### 監視・ログ
- **ヘルスチェック**: `/health` エンドポイント
- **アプリケーションログ**: Fastify logger (pino)
- **エラートラッキング**: 統一エラーレスポンス
- **パフォーマンス監視**: レスポンス時間・エラー率

---

## 🔧 技術詳細

### 重要な設計パターン

#### 1. プラグイン読み込み順序（重要）
```typescript
// app.ts - 依存関係の順序を厳守
await fastify.register(supportPlugin)     // 基本ユーティリティ
await fastify.register(envPlugin)         // 環境変数バリデーション  
await fastify.register(databasePlugin)    // データベース接続
await fastify.register(discordPlugin)     // Discord.js クライアント
await fastify.register(authPlugin)        // JWT認証
await fastify.register(responsePlugin)    // 統一レスポンス
await fastify.register(permissionPlugin)  // 権限チェック
await fastify.register(commandsPlugin)    // スラッシュコマンド
await fastify.register(keepalivePlugin)   // ヘルスチェック
```

#### 2. TypeScript Import規則（重要）
```typescript
// ✅ 正しい（拡張子なし・CommonJS設定）
import { getCurrentPeriodKeys } from '../utils/period';
import { DatabaseHelpers } from './database';

// ❌ 間違い（.js拡張子は使用禁止）
import { getCurrentPeriodKeys } from '../utils/period.js';
```

#### 3. Discord Bot イベント処理
```typescript
// plugins/discord.ts - ボイス状態変更の処理
client.on('voiceStateUpdate', async (oldState, newState) => {
  // 1. セッション管理（通話開始・終了）
  // 2. 個人活動記録（user_voice_activities）
  // 3. 期間統計更新（period_user_stats）
  // 4. 通知送信（リッチEmbed）
});
```

#### 4. 統計計算の最適化
```typescript
// 高速ルート: プリセット期間（週・月境界）
// → period_user_stats テーブルから集計データ取得

// カスタムルート: 任意期間
// → user_voice_activities テーブルから動的計算
```

### データベース設計のポイント

#### リアルタイム統計更新
```typescript
// 退室時に即座に期間統計を更新
async function onUserLeave(activity) {
  // 1. 個人記録終了
  await endUserActivity(activity);
  
  // 2. 期間統計更新（週・月・年）
  const periods = getCurrentPeriodKeys(activity.joinTime);
  await updatePeriodStats('week', periods.currentWeek, activity);
  await updatePeriodStats('month', periods.currentMonth, activity);
  await updatePeriodStats('year', periods.currentYear, activity);
}
```

#### インデックス戦略
```sql
-- ランキング取得高速化
CREATE INDEX idx_period_stats_ranking 
ON period_user_stats(guildId, periodType, periodKey, totalDuration DESC);

-- タイムライン取得高速化  
CREATE INDEX idx_user_activities_timeline 
ON user_voice_activities(guildId, joinTime, leaveTime);
```

### Jotai 状態管理パターン

#### Atomic Design
```typescript
// 基本atom（データ保持）
export const selectedGuildIdAtom = atom<string | null>(null);

// 計算atom（派生データ）  
export const currentRankingAtom = atom(async (get) => {
  const params = get(optimizedRankingParamsAtom);
  return fetchRanking(params);
});

// アクションatom（状態変更）
export const selectGuildActionAtom = atom(
  null,
  (get, set, guildId: string) => {
    set(selectedGuildIdAtom, guildId);
  }
);
```

---

## 🐛 トラブルシューティング

### よくある問題

#### 1. APIルート読み込み失敗
```bash
# 問題: Fastify AutoLoad でルートが読み込まれない
# 解決: プラグイン読み込み順序・ルートファイル構造を確認

# デバッグ: 登録ルート一覧表示
fastify.ready().then(() => {
  console.log(fastify.printRoutes());
});
```

#### 2. モジュール解決エラー
```bash
# 問題: Cannot find module '../utils/period.js'
# 解決: .js拡張子を削除（CommonJS設定のため）

# ✅ 正しい
import { getCurrentPeriodKeys } from '../utils/period';
```

#### 3. Discord権限エラー
```bash
# 問題: ボイス状態の取得失敗
# 解決: Discord Bot の Intent設定確認
# - GUILD_VOICE_STATES
# - GUILD_MEMBERS  
```

#### 4. データベース接続エラー
```bash
# 問題: Turso接続タイムアウト
# 解決: TURSO_DATABASE_URL・TURSO_AUTH_TOKEN確認
# パブリックDBの場合はAUTH_TOKEN不要
```

### デバッグ手順
1. **ログレベル確認**: `LOG_LEVEL=debug` で詳細ログ
2. **環境変数確認**: `.env` ファイルの設定値
3. **Discord権限確認**: Bot・OAuth2アプリケーション設定
4. **データベース確認**: Turso ダッシュボードでクエリ実行
5. **ネットワーク確認**: CORS設定・ファイアウォール

---

## 📚 関連ドキュメント

- **[実装状況管理](./IMPLEMENTATION_STATUS.md)** - 現在の実装進捗・次期優先順位
- **[API設計仕様](./API_SPECIFICATION.md)** - 詳細なAPI仕様・エラーコード  
- **[データベース設計](./DATABASE_DESIGN.md)** - テーブル構造・リレーション
- **[Claude Code ガイド](../CLAUDE.md)** - Claude Code用の簡潔なガイド

---

*開発・運用に関する質問や改善提案があれば、Issue・Discussion で気軽にお知らせください。*