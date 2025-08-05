# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## 開発コマンド

### モノレポ開発フロー
```bash
# 両方のアプリケーションの依存関係をインストール
cd backend && npm install
cd ../frontend && npm install

# 開発時は別々のターミナルで実行
cd backend && npm run dev    # バックエンド (ポート3000)
cd frontend && npm run dev   # フロントエンド (ポート5173)
```

### バックエンド (Node.js/TypeScript + Fastify)
```bash
cd backend
npm run dev          # 開発サーバー（ホットリロード付き）
npm run build        # TypeScriptをdist/にコンパイル
npm run start        # コンパイル済みJavaScriptをdist/から実行
npm run typecheck    # 型チェック（出力なし）
npm test             # tapでテスト実行
npm run deploy-commands  # Discordスラッシュコマンドをデプロイ
npm run clean        # dist/ディレクトリを削除
```

### フロントエンド (React + Vite)
```bash
cd frontend
npm run dev          # 開発サーバー
npm run build        # 本番用ビルド（TypeScriptコンパイル含む）
npm run lint         # ESLintチェック
npm run preview      # 本番ビルドのプレビュー
```

## システム概要

Discord通知ボット + Webダッシュボードのモノレポ構成。バックエンドとフロントエンドが分離されたアプリケーションです。

### 技術スタック
- **バックエンド**: Fastify + Discord.js + Turso (libSQL)
- **フロントエンド**: React + TypeScript + Tailwind CSS + Vite
- **認証**: Discord OAuth2 + JWT
- **デプロイ**: Koyeb (Backend) + Vercel (Frontend)
- **データベース**: Turso (分散SQLite)

## アーキテクチャ構造

@docs/API_SPECIFICATION.md を参照してください

### バックエンド構造 (Fastify API + Discord Bot)
- **server.ts**: サーバーエントリーポイント（グレースフルシャットダウン対応）
- **app.ts**: Fastifyアプリケーションセットアップ（依存関係順でプラグイン読み込み）
- **plugins/**: Fastifyプラグイン（以下の順序で読み込み）:
  1. `support` - ユーティリティ関数
  2. `env` - 環境変数バリデーション
  3. `database` - Turso SQLiteデータベース接続とヘルパー
  4. `discord` - Discord.jsクライアントとボイス状態イベント処理
  5. `auth` - JWTベース認証
  6. `commands` - Discordスラッシュコマンド
  7. `keepalive` - ヘルスチェックエンドポイント
- **routes/**: APIエンドポイント（Fastifyによる自動読み込み）
  - `api/auth/` - Discord OAuth認証
  - `api/control/` - Bot制御エンドポイント
  - `health/` - ヘルスチェックエンドポイント

### フロントエンド構造 (React SPA)
- **src/App.tsx**: テーマ切替機能付きメインアプリケーション（Normal/Neonモード）
- **components/**: ダッシュボードタブを含むReactコンポーネント
- **hooks/**: 認証(`useAuth`) とDiscordデータ(`useDiscordData`) 用カスタムフック
- **types/discord.ts**: Discord APIデータ用TypeScriptインターフェース
- **utils/**: APIクライアントとユーティリティ関数

### データベース設計

@docs/DATABASE_DESIGN.md を参照してください

Turso (SQLite) を使用し、以下のテーブル構成：

#### 既存テーブル
- `notifications`: ボイスチャンネルとテキストチャンネルのマッピング
- `voice_sessions`: ボイスチャンネル活動セッション追跡

#### 統計・通知機能用テーブル（実装予定）
- `user_voice_activities`: 個人の入退室詳細ログ
- `period_user_stats`: 期間別集計統計（週/月/年）
- `notification_schedules`: 通知スケジュール設定
- `daily_activity_summaries`: 日次活動サマリー
- `weekly_activity_summaries`: 週次活動サマリー
- `monthly_activity_summaries`: 月次活動サマリー

### Discord Bot機能
- ボイスチャンネル参加/退出通知（リッチEmbed）
- セッション追跡（通話開始/終了と継続時間）
- 設定用スラッシュコマンド
- マルチサーバー対応（サーバー別設定）

## 環境変数

### 必須環境変数（バックエンド）
```bash
# Discord Bot設定
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_id  
DISCORD_CLIENT_SECRET=your_discord_client_secret

# データベース設定
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token  # パブリックDBの場合はオプション

# 認証設定
JWT_SECRET=your_jwt_secret_key

# サーバー設定
PORT=3000  # デフォルト: 3000
HOST=0.0.0.0  # デフォルト: 0.0.0.0

# CORS設定
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
```

### オプション環境変数
```bash
# 開発環境設定
NODE_ENV=production
LOG_LEVEL=info

# 通知設定（将来実装）
DEFAULT_NOTIFICATION_TIMEZONE=Asia/Tokyo

# PWA Push通知（将来実装）
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@example.com
```

## 主要な技術詳細

### プラグイン読み込み順序
- バックエンドは依存関係の順序を保証するために手動プラグイン登録を使用（自動読み込みではない）
- 各プラグインは前のプラグインに依存する可能性があるため、厳密な順序が必要

### Discord Bot処理
- ボイス状態変更を監視し、リッチEmbedで通知を送信
- セッション管理とユーザー活動追跡
- 個人の入退室記録を `user_voice_activities` テーブルに記録
- 期間別統計を `period_user_stats` テーブルでリアルタイム更新

### 認証フロー
1. `/api/auth/discord` でDiscord OAuth2開始
2. `/api/auth/callback` でコールバック処理・JWT発行
3. 以降のAPIは Bearer Token で認証

### フロントエンド機能
- デュアルテーマサポート（React Routerでテーマ切替）
- 認証状態管理と自動トークンリフレッシュ
- ダッシュボードでの統計表示とサーバー管理

### データベース操作
- ヘルパー関数による適切なトランザクション処理
- UPSERT操作による効率的な統計更新
- 外部キー制約によるデータ整合性保証

### 型安全性
- TypeScript strict mode有効
- 包括的な型定義
- Discord APIレスポンス用のインターフェース定義

### エラーハンドリング
- 詳細なログ記録とグレースフルシャットダウン手順
- Discord API エラーの適切な処理（レート制限、権限エラー等）
- 統一されたAPIエラーレスポンス形式

## 実装予定機能

@docs/IMPLEMENTATION.md を参照してください

### 統計機能
- ボイスチャンネル滞在時間ランキング
- セッション開始者の追跡
- 期間別比較機能（週間、月間）
- タイムライン表示

### 通知システム
- 日次/週次/月次の自動サマリー通知
- Discord Embed形式での統計配信
- カスタム通知時間設定
- PWAプッシュ通知（将来）

### その他
- 参加アンケート機能（定期実行または手動）
- 合成音声対応

## デプロイ設定

### Koyeb (バックエンド)
- Node.js環境での自動デプロイ
- 環境変数設定とヘルスチェック対応
- Tursoデータベースとの接続

### Vercel (フロントエンド)
- React SPAの静的デプロイ
- 環境変数でAPIベースURL設定
- React Routerのリライト設定