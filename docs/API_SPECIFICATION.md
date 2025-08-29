# 技術仕様書

## システム概要

### アーキテクチャ
- **バックエンド**: Fastify + Discord.js + Turso (libSQL)
- **フロントエンド**: React + TypeScript + Tailwind CSS + Vite
- **認証**: Discord OAuth2 + JWT
- **デプロイ**: Koyeb (Backend) + Vercel (Frontend)
- **データベース**: Turso (分散SQLite)

### 技術スタック詳細

#### バックエンド
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

#### フロントエンド
```json
{
  "framework": "React 18+",
  "language": "TypeScript",
  "bundler": "Vite",
  "styling": "Tailwind CSS",
  "charts": "recharts",
  "icons": "lucide-react",
  "routing": "React Router",
  "state-management": "Jotai (本格導入済み)"
}
```

## 実装状況

**📋 詳細な実装状況は [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) を参照してください。**

### 概要
- **Phase 1-2 (バックエンド基盤)**: ✅ **完了** (100%)
- **Phase 3 (フロントエンド統計)**: ✅ **完了** (95% - タイムラインUI未実装)  
- **Phase 4 (通知システム)**: 🔄 **実装中** (15% - データベース準備完了)
- **Phase 5 (拡張・最適化)**: 📅 **未着手** (0%)

## API設計

### 認証システム

#### 既存認証フロー
```
1. /api/auth/discord → Discord OAuth2開始
2. /api/auth/callback → コールバック処理・JWT発行
3. Bearer Token で以降のAPI認証
```

#### 認証済みAPIの保護
```typescript
// 全APIで認証必須（fastify.authenticate preHandler）
// サーバー管理者権限チェック（ユーザーが管理するサーバーのみアクセス可能）
```

### 新統一API設計

#### 基本設計原則
- **RESTful設計**: リソース指向のURL構造
- **統一レスポンス形式**: `{ data, meta, error? }` 形式
- **構造化エラー**: エラーコード・メッセージ・詳細情報
- **柔軟な期間指定**: from/to パラメータでの範囲指定
- **権限レベル細分化**: 閲覧・設定変更・実行の3段階

#### 権限レベル定義
```typescript
// 権限レベル
enum PermissionLevel {
  VIEW = 'view',       // 統計データの閲覧（一般ユーザー）
  MANAGE = 'manage',   // 設定変更（管理者）
  EXECUTE = 'execute'  // 通知送信・テスト実行（管理者）
}

// 権限チェック例
@RequirePermission(PermissionLevel.VIEW)    // 一般ユーザーでも可
@RequirePermission(PermissionLevel.MANAGE)  // 管理者のみ
@RequirePermission(PermissionLevel.EXECUTE) // 管理者のみ
```

#### 統一レスポンス形式
```typescript
interface APIResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    [key: string]: any;
  };
  error?: APIError;
}

interface APIError {
  code: string;           // エラーコード（例: INVALID_GUILD_ID）
  message: string;        // ユーザー向けメッセージ
  details?: {             // 詳細情報
    field?: string;
    value?: any;
    validation?: string;
  };
}
```

#### 1. 統計API (Statistics)

##### ランキング取得
```typescript
GET /api/v1/guilds/{guildId}/statistics/rankings
Authorization: Bearer <jwt_token>
Permission: VIEW

Query Parameters:
- metric: 'duration' | 'sessions' | 'started_sessions' (必須)
- from: '2025-01-13' (必須) 
- to: '2025-01-19' (必須)
- limit: number = 10
- compare: boolean = true (前期間との比較)

Response: APIResponse<{
  rankings: Array<{
    rank: number;
    userId: string;
    username: string;
    avatar?: string;
    value: number;           // メトリクスの値
    sessionCount: number;
    longestSession: number;
    comparison?: {
      previousValue: number;
      change: number;
      changePercentage: number;
      rankChange: number | null;
      isNew: boolean;
    };
  }>;
  period: {
    from: string;
    to: string;
    previous?: {
      from: string;
      to: string;
    };
  };
}>

Meta: {
  totalParticipants: number;
  serverTotalDuration: number;
  metric: string;
  hasComparison: boolean;
}
```

##### タイムライン取得
```typescript
GET /api/v1/guilds/{guildId}/statistics/timeline
Authorization: Bearer <jwt_token>
Permission: VIEW

Query Parameters:
- from: '2025-01-18T18:00:00Z' (必須)
- to: '2025-01-19T10:00:00Z' (必須)

Response: APIResponse<{
  activities: Array<{
    userId: string;
    username: string;
    avatar?: string;
    sessions: Array<{
      joinTime: string;
      leaveTime: string | null;
      duration: number;
      channelId: string;
      channelName: string;
      isSessionStarter: boolean;
      isActive: boolean;
    }>;
  }>;
  summary: {
    totalDuration: number;
    totalParticipants: number;
    totalSessions: number;
    longestSession: number;
    mostActiveUser: {
      userId: string;
      username: string;
      duration: number;
    } | null;
  };
}>

Meta: {
  period: { from: string; to: string };
}
```

##### サマリー履歴取得
```typescript
GET /api/v1/guilds/{guildId}/statistics/summaries
Authorization: Bearer <jwt_token>
Permission: VIEW

Query Parameters:
- type: 'daily' | 'weekly' | 'monthly' (必須)
- from?: '2025-01-01' (省略時は直近30件)
- to?: '2025-01-31'
- limit: number = 30
- offset: number = 0

Response: APIResponse<{
  summaries: Array<{
    id: string;
    period: {
      key: string;        // '2025-01-19', '2025-W03', '2025-01'
      start: string;
      end: string;
    };
    metrics: {
      totalDuration: number;
      totalParticipants: number;
      totalSessions: number;
      longestSession: number;
    };
    topUser: {
      userId: string;
      username: string;
      duration: number;
    } | null;
    notifications: {
      isNotified: boolean;
      notifiedAt: string | null;
    };
  }>;
}>

Meta: {
  total: number;
  hasMore: boolean;
  summaryType: string;
}
```

#### 2. 通知API (Notifications)

##### スケジュール設定取得
```typescript
GET /api/v1/guilds/{guildId}/notifications/schedules
Authorization: Bearer <jwt_token>
Permission: VIEW

Response: APIResponse<{
  schedules: Array<{
    id: string;
    type: 'daily' | 'weekly' | 'monthly';
    isEnabled: boolean;
    settings: {
      notificationTime: string;    // 'HH:mm'
      activityPeriodStart?: string; // 日次のみ
      activityPeriodEnd?: string;   // 日次のみ
      notificationDay?: number;     // 週次・月次
    };
    target: {
      channelId: string;
      channelName: string;
    };
    timezone: string;
    updatedAt: string;
  }>;
}>
```

##### スケジュール設定更新
```typescript
PUT /api/v1/guilds/{guildId}/notifications/schedules/{scheduleType}
Authorization: Bearer <jwt_token>
Permission: MANAGE

Request: {
  isEnabled: boolean;
  settings: {
    notificationTime: string;
    activityPeriodStart?: string;
    activityPeriodEnd?: string;
    notificationDay?: number;
  };
  targetChannelId: string;
  timezone?: string;
}

Response: APIResponse<{
  schedule: {
    id: string;
    type: string;
    isEnabled: boolean;
    settings: object;
    target: object;
    updatedAt: string;
  };
}>
```

##### テスト通知送信
```typescript
POST /api/v1/guilds/{guildId}/notifications/test
Authorization: Bearer <jwt_token>
Permission: EXECUTE

Request: {
  scheduleType: 'daily' | 'weekly' | 'monthly';
  targetChannelId: string;
  testData?: {
    period?: { from: string; to: string };
    mockUsers?: Array<{ userId: string; duration: number }>;
  };
}

Response: APIResponse<{
  result: {
    sent: boolean;
    messageId: string | null;
    timestamp: string;
  };
}>
```

#### 3. 設定API (Settings)

##### サーバー設定取得
```typescript
GET /api/v1/guilds/{guildId}/settings
Authorization: Bearer <jwt_token>
Permission: VIEW

Response: APIResponse<{
  guild: {
    id: string;
    name: string;
    icon: string | null;
  };
  permissions: {
    level: 'view' | 'manage' | 'execute';
    canViewStatistics: boolean;
    canManageSettings: boolean;
    canExecuteActions: boolean;
  };
  features: {
    statisticsEnabled: boolean;
    notificationsEnabled: boolean;
    timelineEnabled: boolean;
  };
}>
```

##### 機能設定更新
```typescript
PUT /api/v1/guilds/{guildId}/settings/features
Authorization: Bearer <jwt_token>
Permission: MANAGE

Request: {
  statisticsEnabled?: boolean;
  notificationsEnabled?: boolean;
  timelineEnabled?: boolean;
}

Response: APIResponse<{
  features: {
    statisticsEnabled: boolean;
    notificationsEnabled: boolean;
    timelineEnabled: boolean;
  };
}>
```

#### エラーレスポンス例
```typescript
// バリデーションエラー
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "リクエストパラメータが無効です",
    "details": {
      "field": "from",
      "value": "invalid-date",
      "validation": "日付は YYYY-MM-DD 形式で入力してください"
    }
  },
  "meta": {
    "timestamp": "2025-01-19T10:00:00Z",
    "requestId": "req_123456"
  }
}

// 権限エラー
{
  "error": {
    "code": "INSUFFICIENT_PERMISSION",
    "message": "この操作を実行する権限がありません",
    "details": {
      "required": "manage",
      "current": "view"
    }
  },
  "meta": {
    "timestamp": "2025-01-19T10:00:00Z",
    "requestId": "req_123457"
  }
}

// リソース不存在エラー
{
  "error": {
    "code": "GUILD_NOT_FOUND",
    "message": "指定されたサーバーが見つかりません",
    "details": {
      "guildId": "123456789"
    }
  },
  "meta": {
    "timestamp": "2025-01-19T10:00:00Z",
    "requestId": "req_123458"
  }
}
```

#### 4. ユーザー管理API (Users)

##### ユーザー詳細統計取得
```typescript
GET /api/v1/guilds/{guildId}/users/{userId}/statistics
Authorization: Bearer <jwt_token>
Permission: VIEW

Query Parameters:
- from?: '2025-01-01'
- to?: '2025-01-31'
- granularity: 'daily' | 'weekly' | 'monthly' = 'daily'

Response: APIResponse<{
  user: {
    userId: string;
    username: string;
    avatar?: string;
  };
  statistics: {
    totalDuration: number;
    totalSessions: number;
    startedSessions: number;
    averageSessionDuration: number;
    longestSession: number;
    activeDays: number;
  };
  trends: Array<{
    date: string;           // 'YYYY-MM-DD'
    duration: number;
    sessions: number;
  }>;
}>
```

#### 5. サーバー情報API (Guilds)

##### サーバー一覧取得（ユーザーが管理権限を持つサーバー）
```typescript
GET /api/v1/guilds
Authorization: Bearer <jwt_token>
Permission: VIEW

Response: APIResponse<{
  guilds: Array<{
    id: string;
    name: string;
    icon: string | null;
    memberCount: number;
    permissions: {
      level: 'view' | 'manage' | 'execute';
    };
    features: {
      statisticsEnabled: boolean;
      notificationsEnabled: boolean;
    };
    stats: {
      totalVoiceChannels: number;
      activeVoiceChannels: number;
      currentUsersInVoice: number;
    };
  }>;
}>
```

#### 6. システム情報API (System)

##### ヘルスチェック
```typescript
GET /api/v1/health
No Authorization Required

Response: APIResponse<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    discord: {
      status: 'healthy' | 'unhealthy';
      details: {
        connected: boolean;
        guilds: number;
        uptime: number;
      };
    };
    database: {
      status: 'healthy' | 'unhealthy';
      details: {
        connected: boolean;
        responseTime: number;
      };
    };
  };
}>
```

#### エラーコード一覧
```typescript
// 認証・認可関連
'AUTH_REQUIRED'           // 認証が必要
'INVALID_TOKEN'           // 無効なトークン
'TOKEN_EXPIRED'           // トークンの有効期限切れ
'INSUFFICIENT_PERMISSION' // 権限不足

// バリデーション関連
'VALIDATION_ERROR'        // バリデーションエラー
'INVALID_GUILD_ID'        // 無効なサーバーID
'INVALID_USER_ID'         // 無効なユーザーID
'INVALID_DATE_RANGE'      // 無効な日付範囲
'INVALID_PARAMETERS'      // 無効なパラメータ

// リソース関連
'GUILD_NOT_FOUND'         // サーバーが見つからない
'USER_NOT_FOUND'          // ユーザーが見つからない
'CHANNEL_NOT_FOUND'       // チャンネルが見つからない
'SCHEDULE_NOT_FOUND'      // スケジュールが見つからない

// Discord関連
'DISCORD_API_ERROR'       // Discord API エラー
'DISCORD_PERMISSION_ERROR' // Discord権限エラー
'DISCORD_RATE_LIMIT'      // レート制限
'BOT_NOT_IN_GUILD'        // Botがサーバーにいない

// システム関連
'INTERNAL_SERVER_ERROR'   // 内部サーバーエラー
'DATABASE_ERROR'          // データベースエラー
'SERVICE_UNAVAILABLE'     // サービス利用不可
'FEATURE_DISABLED'        // 機能が無効
```

#### 権限チェック実装例
```typescript
// Fastify デコレーター
interface PermissionContext {
  userId: string;
  guildId: string;
  requiredLevel: PermissionLevel;
}

async function checkPermission(context: PermissionContext): Promise<boolean> {
  const { userId, guildId, requiredLevel } = context;
  
  switch (requiredLevel) {
    case PermissionLevel.VIEW:
      // ユーザーがサーバーに参加していればOK
      return await isUserInGuild(userId, guildId);
      
    case PermissionLevel.MANAGE:
    case PermissionLevel.EXECUTE:
      // 管理者権限が必要
      return await isUserGuildAdmin(userId, guildId);
      
    default:
      return false;
  }
}

// プリハンドラー例
const requirePermission = (level: PermissionLevel) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { guildId } = request.params as { guildId: string };
    const user = request.user!;
    
    const hasPermission = await checkPermission({
      userId: user.userId,
      guildId,
      requiredLevel: level
    });
    
    if (!hasPermission) {
      return reply.code(403).send({
        error: {
          code: 'INSUFFICIENT_PERMISSION',
          message: 'この操作を実行する権限がありません',
          details: {
            required: level,
            guildId
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: generateRequestId()
        }
      });
    }
  };
};
```

#### リアルタイム更新の代替案
```typescript
// 手動更新機能の実装
// フロントエンド側でリフレッシュボタン実装

// 1. 個別データの更新
POST /api/v1/guilds/{guildId}/statistics/refresh
Authorization: Bearer <jwt_token>
Permission: VIEW

Response: APIResponse<{
  refreshed: {
    rankings: boolean;
    timeline: boolean;
    summaries: boolean;
  };
  lastUpdate: string;
}>

// 2. 差分取得（効率化）
GET /api/v1/guilds/{guildId}/statistics/changes
Authorization: Bearer <jwt_token>
Permission: VIEW

Query Parameters:
- since: '2025-01-19T10:00:00Z' (前回取得時刻)

Response: APIResponse<{
  hasChanges: boolean;
  changes: {
    newSessions: number;
    updatedRankings: boolean;
    newSummaries: number;
  };
  latestTimestamp: string;
}>
```

#### Discord イベントハンドラー拡張（実装済み）
```typescript
// 実装済み: handleVoiceStateUpdate を拡張
async function handleVoiceStateUpdate(oldState, newState) {
  // 既存のセッション管理ロジック
  
  // 実装済み：個人の入退室記録
  if (ユーザー入室) {
    await dbHelpers.createUserActivity({
      guildId,
      userId,
      username,
      channelId,
      sessionId,
      isSessionStarter,
      joinTime: new Date().toISOString()
    });
  }
  
  if (ユーザー退室) {
    const userActivity = await dbHelpers.endUserActivity(guildId, userId, channelId);
    if (userActivity && userActivity.duration !== null) {
      const periods = getCurrentPeriodKeys(new Date(userActivity.joinTime));
      await dbHelpers.updatePeriodStats(guildId, userId, userName, 'week', periods.currentWeek, userActivity);
      await dbHelpers.updatePeriodStats(guildId, userId, userName, 'month', periods.currentMonth, userActivity);
      await dbHelpers.updatePeriodStats(guildId, userId, userName, 'year', periods.currentYear, userActivity);
    }
  }
}
```

#### 実装済みプラグイン構成
```typescript
// app.ts でのプラグイン読み込み順序（実装済み）
await fastify.register(supportPlugin)     // 基本ユーティリティ
await fastify.register(envPlugin)         // 環境変数管理
await fastify.register(databasePlugin)    // Turso接続 + DatabaseHelpers
await fastify.register(discordPlugin)     // Discord.js + イベントハンドラー
await fastify.register(authPlugin)        // JWT認証システム
await fastify.register(responsePlugin)    // 統一APIレスポンス ✅ 実装完了
await fastify.register(permissionPlugin)  // 権限チェックシステム ✅ 実装完了
await fastify.register(commandsPlugin)    // Discord スラッシュコマンド
await fastify.register(keepalivePlugin)   // ヘルスチェック
```

## 環境変数

### 必須環境変数
```bash
# Discord Bot設定
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_id  
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://your-backend.com/api/auth/callback

# データベース設定
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token

# 認証設定
JWT_SECRET=your_jwt_secret_key

# サーバー設定
PORT=3000
HOST=0.0.0.0

# CORS設定
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173

# 開発環境設定
NODE_ENV=production
```

### オプション環境変数
```bash
# ログレベル
LOG_LEVEL=info

# 通知設定
DEFAULT_NOTIFICATION_TIMEZONE=Asia/Tokyo

# PWA Push通知（将来実装）
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@example.com
```

## データベース接続

### Turso設定
```typescript
// 現在の database.ts の設定
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
```

### 接続プール設定
```typescript
// 推奨設定
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
  syncUrl: process.env.TURSO_SYNC_URL, // レプリケーション用（オプション）
});
```

## スケジューラー設定

### Cron ジョブ設定
```typescript
// 新規追加予定：plugins/scheduler.ts
import cron from 'node-cron';

// 毎分実行：通知スケジュールチェック
cron.schedule('* * * * *', async () => {
  await checkNotificationSchedules();
});

// 毎時実行：統計データ整合性チェック
cron.schedule('0 * * * *', async () => {
  await validateStatisticsData();
});

// 毎日4:00実行：古いデータのクリーンアップ
cron.schedule('0 4 * * *', async () => {
  await cleanupOldData();
});
```

## セキュリティ設定

### JWT設定
```typescript
// 現在の auth.ts の設定
const JWT_OPTIONS = {
  expiresIn: '7d', // 7日間有効
  issuer: 'discord-voice-bot',
  audience: 'discord-voice-dashboard'
};
```

### レート制限（推奨追加）
```typescript
// @fastify/rate-limit プラグインの追加推奨
await fastify.register(rateLimit, {
  max: 100, // 100リクエスト/分
  timeWindow: '1 minute',
  skipOnError: true,
});
```

### CORS設定
```typescript
// 現在の app.ts の設定
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];

await fastify.register(cors, {
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});
```

## パフォーマンス要件

### レスポンス時間目標
- **認証API**: < 500ms
- **統計API**: < 1000ms
- **ランキング取得**: < 500ms
- **タイムライン取得**: < 1000ms
- **通知送信**: < 2000ms

### 同時接続対応
- **想定ユーザー数**: 50人同時接続
- **想定サーバー数**: 10サーバー
- **API リクエスト**: 1000req/min

### データベース最適化
```sql
-- 重要なインデックス
CREATE INDEX idx_user_activities_ranking ON user_voice_activities(guildId, userId, joinTime);
CREATE INDEX idx_period_stats_ranking ON period_user_stats(guildId, periodType, periodKey, totalDuration DESC);
CREATE INDEX idx_notification_schedules_check ON notification_schedules(scheduleType, isEnabled, dailyNotificationTime);
```

## エラーハンドリング

### 標準エラーレスポンス
```typescript
interface APIError {
  error: string;           // エラータイプ
  message: string;         // ユーザー向けメッセージ
  code?: string;           // エラーコード
  details?: any;           // 詳細情報（開発時のみ）
}

// 例
{
  "error": "Authentication required",
  "message": "このAPIにアクセスするには認証が必要です",
  "code": "AUTH_REQUIRED"
}
```

### Discord API エラー対応
```typescript
// レート制限対応
if (discordError.code === 429) {
  await waitForRateLimit(discordError.retry_after);
  return retryRequest();
}

// 権限エラー対応
if (discordError.code === 403) {
  return reply.code(403).send({
    error: "Insufficient permissions",
    message: "Botがこの操作を実行する権限がありません"
  });
}
```

## ログ設定

### ログレベル
```typescript
// Fastify ログ設定
const logger = {
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  }
};
```

### 重要ログ項目
- 認証成功/失敗
- Discord API エラー
- データベース接続エラー
- 通知送信結果
- パフォーマンス警告

## デプロイ設定

### Koyeb (Backend)
```yaml
# koyeb.yaml (推奨)
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
    healthcheck:
      path: /health
```

### Vercel (Frontend)
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

## 開発・テスト環境

### ローカル開発
```bash
# Backend
cd backend
npm install
npm run dev  # nodemon で自動再起動

# Frontend  
cd frontend
npm install
npm run dev  # Vite 開発サーバー
```

### テスト実行
```bash
# ユニットテスト（追加予定）
npm run test

# 統合テスト （追加予定）
npm run test:integration

# 型チェック
npm run type-check
```

## フロントエンド実装状況

### ✅ Phase 3 完全実装済み

#### Phase 3.1: API通信基盤（✅ 完了）
- **統一APIクライアント**: `frontend/src/utils/api.ts`
  - 新API設計（v1エンドポイント）対応完了
  - 統一レスポンス形式 `APIResponse<T>` 処理
  - 構造化エラーハンドリング（`APIException`クラス）
  - 全統計API関数群実装済み

- **統計データフック**: `frontend/src/hooks/useStatistics.ts`
  - ランキング・タイムライン・サマリー取得機能
  - 自動更新・手動更新・差分更新対応
  - エラーハンドリング・ローディング状態管理
  - 期間・メトリクス設定の動的管理

- **期間選択フック**: `frontend/src/hooks/usePeriodSelector.ts`
  - 週・月・年・カスタム期間の管理
  - 豊富なプリセット（今週・先週・今月・過去7日等）
  - 期間ナビゲーション・バリデーション・フォーマット

- **ユーティリティ関数**: `frontend/src/utils/period.ts`, `frontend/src/utils/date.ts`
  - 期間計算・日付処理・フォーマット機能
  - TypeScript型定義による完全な型安全性

#### Phase 3.2: 統計表示コンポーネント（✅ 完了）
- **ランキング表示**: `frontend/src/components/statistics/RankingTableNormal.tsx`
  - Normalテーマ対応・前期間比較機能
  - レスポンシブ対応・Discord アバター表示
  - 実データでの動作確認済み

- **統計コンポーネント**: `frontend/src/components/statistics/`
  - RankingTable.tsx（Neonテーマ）
  - Timeline.tsx（インタラクティブタイムライン）
  - StatsSummary.tsx（統計サマリーカード）

#### Phase 3.3: 統計ダッシュボード画面（✅ 完了）
- **React Router SPA構造**: `frontend/src/App.tsx`, `frontend/src/components/layout/`
  - TabNavigation廃止→React Router移行
  - URL反映・ブラウザバック対応・適切なSEO
  - Layout コンポーネント・Sidebar ナビゲーション

- **統計ダッシュボード**: `frontend/src/pages/DashboardPage.tsx`
  - ビュー切替（サマリー・ランキング・タイムライン）
  - 期間選択・メトリクス選択・手動データ更新
  - 実データでの完全動作確認済み

- **データフロー問題解決**: useDiscordData重複呼び出し問題の完全修正
  - サーバー選択→統計データ更新の完全な連携確認

#### Phase 3.4: コードクリーンアップ（✅ 完了）
- **自動更新機能有効化**: コメントアウトされた機能の実装
- **デバッグログ整理**: プロダクション品質のログレベル調整
- **Normalテーマ統合**: 白背景・グレー系の統一されたデザイン

### 🔄 次期実装予定

#### 状態管理ライブラリ導入（推奨）
- **Zustand導入**: カスタムフック複雑化・Props drilling解消
- **中央集権化**: 認証・サーバー管理・統計・期間選択の統一管理
- **開発効率向上**: Redux DevTools・デバッグ容易性・保守性向上

### 現在のアーキテクチャ課題

#### カスタムフック分散による問題
- **状態分離**: useDiscordData重複インスタンス問題
- **Props drilling**: App.tsx → Layout → DashboardPage の複雑な連携
- **デバッグ困難**: 状態管理の分散による問題特定の困難さ

#### Jotai導入による解決期待効果
1. **Atomic State Management**: 細粒度な状態管理・デバッグ容易
2. **Prop Drilling解消**: Layoutへのprops渡しが不要
3. **パフォーマンス向上**: 必要なatomのみ再レンダリング
4. **型安全性**: TypeScriptとの統合・完全な型推論
5. **Phase 4準備**: 通知システム実装時の基盤安定化

### 実装成果まとめ

**Phase 3 完全達成**:
- React Router による適切なSPA構造実現
- 統計ダッシュボードの完全動作（実データ表示確認済み）
- データフロー問題の根本修正・状態管理の統一
- プロダクション品質のコードベース確立
- 次フェーズ（通知システム・状態管理改善）への基盤完了