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

Discord通知ボット + Webダッシュボードのモノレポ構成。

### 技術スタック
- **バックエンド**: Fastify + Discord.js + Turso (libSQL)
- **フロントエンド**: React + TypeScript + Jotai + Tailwind CSS
- **認証**: Discord OAuth2 + JWT
- **デプロイ**: Koyeb (Backend) + Vercel (Frontend)

### 現在の実装状況
**📋 詳細は [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) を参照**

- **Phase 1-2 (バックエンド)**: ✅ **完了** - API・統計・認証システム
- **Phase 3 (フロントエンド)**: ✅ **95%完了** - 統計ダッシュボード動作中
- **Phase 4 (通知システム)**: 🔄 **15%完了** - データベース準備完了

## アーキテクチャ詳細

**📖 詳細な設計情報:**
- **[開発ガイド](./docs/DEVELOPMENT.md)** - セットアップ・技術詳細・トラブルシューティング
- **[API設計仕様](./docs/API_SPECIFICATION.md)** - API仕様・エラーコード  
- **[データベース設計](./docs/DATABASE_DESIGN.md)** - テーブル構造・統計システム

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

### Discord Bot処理（✅ 実装済み）
- ボイス状態変更を監視し、リッチEmbedで通知を送信
- セッション管理とユーザー活動追跡（完全動作）
- 個人の入退室記録を `user_voice_activities` テーブルに記録（完全動作）
- 期間別統計を `period_user_stats` テーブルでリアルタイム更新（完全動作）
- 週次・月次・年次の統計自動計算システム（完全動作）

### 認証フロー
1. `/api/auth/discord` でDiscord OAuth2開始
2. `/api/auth/callback` でコールバック処理・JWT発行
3. 以降のAPIは Bearer Token で認証

### フロントエンド機能（✅ 実装済み）
- React Router SPA構成（適切なURL管理・ブラウザバック対応）
- Jotai状態管理（atom分離・中央集権型・デバッグ対応）
- 統計ダッシュボード（サマリー・ランキング・期間選択・完全動作）
- 認証状態管理（自動トークンリフレッシュ・Discord OAuth2）

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

## 実装済み機能

### ✅ Discord Bot機能
- ボイスチャンネル参加/退出通知（リッチEmbed）
- セッション追跡（通話開始/終了と継続時間）
- リアルタイム統計更新（user_voice_activities, period_user_stats）
- 設定用スラッシュコマンド
- マルチサーバー対応

### ✅ 統計ダッシュボード (Web UI)
- **認証**: Discord OAuth2 + JWT
- **サマリー表示**: MVP・総計・参加者数・前期間比較
- **ランキング表示**: 滞在時間・セッション数・開始セッション別
- **期間選択**: プリセット期間（今週・先週・過去7日等）
- **状態管理**: Jotai・React Router・リアルタイム更新

### 🔄 実装中・予定機能
- **通知システム** (Phase 4): 自動統計配信・スケジュール管理
- **タイムラインUI** (Phase 5): セッション履歴・参加時間帯可視化
- **PWA対応** (Phase 5): プッシュ通知・オフライン対応

## デプロイ設定

### Koyeb (バックエンド)
- Node.js環境での自動デプロイ
- 環境変数設定とヘルスチェック対応
- Tursoデータベースとの接続

### Vercel (フロントエンド)
- React SPAの静的デプロイ
- 環境変数でAPIベースURL設定
- React Routerのリライト設定

## コーディング規約

### TypeScript Import文の規則
**重要**: このプロジェクトはCommonJS設定 (`"module": "commonjs"`) のため、import文では以下を厳守：

```typescript
// ✅ 正しい書き方（拡張子なし）
import { getCurrentPeriodKeys } from '../utils/period';
import { DatabaseHelpers } from './database';
import { APIResponse } from '../types/api';

// ❌ 間違った書き方（.js拡張子）
import { getCurrentPeriodKeys } from '../utils/period.js';
import { DatabaseHelpers } from './database.js';
```

**理由**: 
- tsconfig.json で `"module": "commonjs"` を使用
- ts-node実行時は`.ts`ファイルを直接読み込む
- `.js`拡張子を指定するとモジュールが見つからないエラーが発生

### Fastify AutoLoadプラクティス
**重要**: このプロジェクトはFastify AutoLoadを使用しているため、以下のルールを厳守：

#### ✅ AutoLoad使用時のベストプラクティス
```typescript
// ❌ 悪い例: AutoLoadと手動登録の併用（重複エラーの原因）
// routes/api/index.ts
await fastify.register(import('./v1'), { prefix: '/v1' }); // AutoLoadと重複

// ✅ 良い例: AutoLoadに完全に依存
// routes/api/index.ts  
// AutoLoadが自動的にv1/ディレクトリを /v1 プレフィックスで読み込む
```

#### index.tsファイルの取り扱い
- **問題**: `index.ts`が存在すると、同ディレクトリの他のファイルが**無視される**
- **対策**: 単純な再エクスポートの場合は`index.ts`を作成しない

```bash
# ❌ 問題のある構成
routes/api/v1/guilds/
├── index.ts          # これが存在すると
├── rankings.ts       # これらが無視される
├── timeline.ts
└── summaries.ts

# ✅ 正しい構成  
routes/api/v1/guilds/
├── rankings.ts       # AutoLoadが直接読み込む
├── timeline.ts       # AutoLoadが直接読み込む
└── summaries.ts      # AutoLoadが直接読み込む
```

#### ルート重複エラーの回避
```typescript
// 共通エラー: FST_ERR_DUPLICATED_ROUTE
// 原因: 同じルートが複数回登録される

// デバッグ方法: サーバー起動時にルート一覧を確認
fastify.ready().then(() => {
  console.log('\n📋 Registered routes:')
  console.log(fastify.printRoutes())
})
```

### その他のコーディング規則
- プラグインでの`dependencies`配列は不要（app.tsで明示的に順序管理）
- 型安全性を重視し、`| null`型の適切なnullチェック
- 統一APIレスポンス形式 `{data, meta, error?}` の使用

## トラブルシューティング

### メモリ

#### APIルートのロード失敗トラブルシューティング
- パスの設定を再確認する
- プラグインの読み込み順序を見直す
- ルートファイルのパスが正しいか検証する
- Fastifyのルート読み込みメカニズムを確認する
- 環境変数やパスの絶対パス/相対パスの設定を確認する