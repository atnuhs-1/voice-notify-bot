# フロントエンドハイブリッドAPI対応移行タスク

## 背景・完了済み作業

### 解決された問題
- **根本原因**: 期間計算のクライアント・サーバー不一致（ISO週境界の問題）
- **症状**: `from=2025-08-10&to=2025-08-16` でランキングAPI呼び出し時に空のデータが返される
- **根本解決**: ハイブリッドAPI設計でプリセット期間使用時にISO境界を保証

### ✅ バックエンド実装完了（2025-08-18セッション）

#### 1. プリセット期間計算システム (`/backend/utils/presets.ts`)
```typescript
export type PeriodPreset = 
  | 'this_week' | 'last_week' 
  | 'this_month' | 'last_month' 
  | 'last_7_days' | 'last_30_days' 
  | 'this_year' | 'last_year';

export function calculatePresetPeriod(preset: PeriodPreset): PeriodResult {
  // ISO境界を確実に計算するバックエンド実装
  // this_week, last_week: ISO週境界（月曜〜日曜）
  // this_month, last_month: 月境界（1日〜月末）
  // last_7_days, last_30_days: 相対期間（今日から過去N日）
  // this_year, last_year: 年境界（1月1日〜12月31日）
}
```

#### 2. ハイブリッドランキングAPI (`/backend/routes/api/v1/guilds/rankings.ts`)
```typescript
// プリセット期間（推奨・高速ルート・ISO境界保証）
GET /api/v1/guilds/{guildId}/statistics/rankings?metric=duration&period=this_week

// カスタム期間（従来通り・柔軟性重視）
GET /api/v1/guilds/{guildId}/statistics/rankings?metric=duration&from=2025-08-10&to=2025-08-16

// デフォルト期間（プリセット'this_week'）
GET /api/v1/guilds/{guildId}/statistics/rankings?metric=duration
```

#### 3. 型定義更新 (`/backend/types/api.ts`)
```typescript
export interface RankingQuery {
  metric: 'duration' | 'sessions' | 'started_sessions';
  // ハイブリッド期間指定
  period?: 'this_week' | 'last_week' | 'this_month' | 'last_month' | 
           'last_7_days' | 'last_30_days' | 'this_year' | 'last_year';
  from?: string; // 'YYYY-MM-DD'
  to?: string;   // 'YYYY-MM-DD'
  // ...
}

export interface RankingResponseMeta extends APIResponseMeta {
  searchType: 'preset' | 'custom'; // ハイブリッド検索タイプ
  preset?: string; // プリセット期間名（preset時のみ）
  isOptimized?: boolean; // 高速ルート使用フラグ
  // ...
}
```

## 🔄 フロントエンド移行タスク

### Priority: HIGH - 必須対応

#### Task 1: APIクライアント更新
**ファイル**: `frontend/src/utils/api.ts`

```typescript
// 現在のgetRanking関数を拡張
interface GetRankingParams {
  guildId: string;
  metric: 'duration' | 'sessions' | 'started_sessions';
  // ハイブリッド対応
  period?: 'this_week' | 'last_week' | 'this_month' | 'last_month' | 
           'last_7_days' | 'last_30_days' | 'this_year' | 'last_year';
  from?: string;
  to?: string;
  limit?: number;
  compare?: boolean;
}

export async function getRanking(params: GetRankingParams) {
  const queryParams = new URLSearchParams();
  
  queryParams.append('metric', params.metric);
  
  // プリセット期間優先
  if (params.period) {
    queryParams.append('period', params.period);
    console.log(`📅 Using preset period: ${params.period}`);
  } else if (params.from && params.to) {
    queryParams.append('from', params.from);
    queryParams.append('to', params.to);
    console.log(`📅 Using custom period: ${params.from} - ${params.to}`);
  }
  
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.compare !== undefined) queryParams.append('compare', params.compare.toString());
  
  const response = await fetch(`/api/v1/guilds/${params.guildId}/statistics/rankings?${queryParams}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  
  return handleApiResponse<RankingResponse>(response);
}
```

#### Task 2: 統計フック更新
**ファイル**: `frontend/src/hooks/useStatistics.ts`

```typescript
// 現在のuseRankingフックを拡張
interface UseRankingOptions {
  guildId: string;
  metric: MetricType;
  // ハイブリッド対応
  period?: PeriodPreset;
  customPeriod?: { from: string; to: string };
  limit?: number;
  compare?: boolean;
  autoRefresh?: boolean;
}

export function useRanking(options: UseRankingOptions) {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchRanking = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // プリセット期間優先の呼び出し
      const result = await getRanking({
        guildId: options.guildId,
        metric: options.metric,
        period: options.period,
        from: options.customPeriod?.from,
        to: options.customPeriod?.to,
        limit: options.limit,
        compare: options.compare
      });
      
      setData(result);
      
      // ハイブリッド検索情報をログ出力
      console.log(`📊 Ranking fetched:`, {
        searchType: result.meta.searchType,
        preset: result.meta.preset,
        isOptimized: result.meta.isOptimized,
        totalParticipants: result.meta.totalParticipants
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
      console.error('🚨 Ranking fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [options]);
  
  return { data, loading, error, refresh: fetchRanking };
}
```

#### Task 3: Jotai期間管理atoms更新
**ファイル**: `frontend/src/atoms/period.ts`

```typescript
// バックエンドプリセットとの統合
export type BackendPeriodPreset = 
  | 'this_week' | 'last_week' 
  | 'this_month' | 'last_month' 
  | 'last_7_days' | 'last_30_days' 
  | 'this_year' | 'last_year';

// プリセット期間マッピング関数
export function mapToBackendPreset(key: string): BackendPeriodPreset | null {
  const mapping: Record<string, BackendPeriodPreset> = {
    'this_week': 'this_week',
    'last_week': 'last_week', 
    'this_month': 'this_month',
    'last_month': 'last_month',
    'last_7_days': 'last_7_days',
    'last_30_days': 'last_30_days'
  };
  
  return mapping[key] || null;
}

// 統計取得用のハイブリッドパラメータ生成
export const statisticsParamsAtom = atom((get) => {
  const period = get(selectedPeriodAtom);
  const metric = get(selectedMetricAtom);
  const guildId = get(selectedGuildIdAtom);
  
  // プリセット期間の識別試行
  const presets = get(periodPresetsAtom);
  const matchingPreset = presets.find(p => 
    p.period.from === period.from && p.period.to === period.to
  );
  
  if (matchingPreset) {
    const backendPreset = mapToBackendPreset(matchingPreset.key);
    if (backendPreset) {
      return {
        guildId,
        metric,
        period: backendPreset, // プリセット期間使用
        compare: true
      };
    }
  }
  
  // フォールバック: カスタム期間
  return {
    guildId,
    metric,
    customPeriod: { from: period.from, to: period.to }, // カスタム期間使用
    compare: true
  };
});
```

#### Task 4: 統計ダッシュボード更新
**ファイル**: `frontend/src/pages/DashboardPage.tsx`

```typescript
// useStatisticsフックの呼び出し更新
export function DashboardPage() {
  const statisticsParams = useAtomValue(statisticsParamsAtom);
  
  // ハイブリッドAPI対応
  const ranking = useRanking({
    guildId: statisticsParams.guildId,
    metric: statisticsParams.metric,
    period: statisticsParams.period, // プリセット期間（優先）
    customPeriod: statisticsParams.customPeriod, // カスタム期間（フォールバック）
    compare: statisticsParams.compare,
    autoRefresh: false
  });
  
  return (
    <div>
      {/* 検索情報の表示（デバッグ用） */}
      {ranking.data?.meta && (
        <div className="text-xs text-gray-500 mb-2">
          検索タイプ: {ranking.data.meta.searchType} 
          {ranking.data.meta.preset && ` (${ranking.data.meta.preset})`}
          {ranking.data.meta.isOptimized && ' 🚀 高速ルート'}
        </div>
      )}
      
      {/* 既存のランキング表示 */}
      <RankingTableNormal rankings={ranking.data?.rankings || []} />
    </div>
  );
}
```

### Priority: MEDIUM - UI改善

#### Task 5: プリセット期間選択UI
**新規ファイル**: `frontend/src/components/PeriodPresetButtons.tsx`

```typescript
interface PeriodPresetButtonsProps {
  selectedPreset?: string;
  onPresetSelect: (preset: BackendPeriodPreset) => void;
}

export function PeriodPresetButtons({ selectedPreset, onPresetSelect }: PeriodPresetButtonsProps) {
  const presets = [
    { key: 'this_week', label: '今週', icon: '📅' },
    { key: 'last_week', label: '先週', icon: '📋' },
    { key: 'this_month', label: '今月', icon: '🗓️' },
    { key: 'last_month', label: '先月', icon: '📄' },
    { key: 'last_7_days', label: '過去7日', icon: '⏰' },
    { key: 'last_30_days', label: '過去30日', icon: '📊' }
  ] as const;
  
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {presets.map(preset => (
        <button
          key={preset.key}
          onClick={() => onPresetSelect(preset.key)}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            selectedPreset === preset.key
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {preset.icon} {preset.label}
        </button>
      ))}
    </div>
  );
}
```

### Priority: LOW - 最適化

#### Task 6: レスポンス情報表示
- 検索タイプ（preset/custom）の表示
- 高速ルート使用状況の表示
- プリセット期間の説明文表示

#### Task 7: エラーハンドリング強化
- プリセット期間選択失敗時の処理
- カスタム期間フォールバック時の通知

## テスト計画

### 1. プリセット期間テスト
```bash
# 今週のランキング（高速ルート・ISO境界保証）
curl "http://localhost:3000/api/v1/guilds/{guildId}/statistics/rankings?metric=duration&period=this_week" \
  -H "Authorization: Bearer {token}"

# 先週のランキング（高速ルート・ISO境界保証）  
curl "http://localhost:3000/api/v1/guilds/{guildId}/statistics/rankings?metric=duration&period=last_week" \
  -H "Authorization: Bearer {token}"

# 過去7日間のランキング（カスタムルート）
curl "http://localhost:3000/api/v1/guilds/{guildId}/statistics/rankings?metric=duration&period=last_7_days" \
  -H "Authorization: Bearer {token}"
```

### 2. フォールバックテスト
```bash
# カスタム期間（従来通り）
curl "http://localhost:3000/api/v1/guilds/{guildId}/statistics/rankings?metric=duration&from=2025-08-10&to=2025-08-16" \
  -H "Authorization: Bearer {token}"
```

### 3. レスポンス検証項目
- `meta.searchType`: 'preset' または 'custom'
- `meta.preset`: プリセット期間名（preset使用時のみ）
- `meta.isOptimized`: 高速ルート使用フラグ
- `data.rankings`: 期待されるランキングデータ

## 期待される効果

### 解決される問題
1. **ISO週境界不一致**: プリセット期間使用時は確実にISO境界でデータ取得
2. **期間計算のズレ**: サーバー側で統一された期間計算
3. **パフォーマンス**: プリセット期間使用時は高速ルート（period_user_stats）を活用

### UX向上
1. **確実性**: 「今週」「先週」ボタンで確実にデータ表示
2. **柔軟性**: カスタム期間選択も従来通り利用可能
3. **透明性**: 検索タイプと最適化状況をユーザーに表示

## 注意事項

### 互換性維持
- 既存のカスタム期間機能は完全に保持
- URLパラメータの後方互換性は維持
- エラーハンドリングは既存の仕組みを拡張

### デバッグ支援
- ハイブリッド検索情報をコンソールログに出力
- レスポンスメタデータで検索タイプを確認可能
- プリセット期間マッピングの透明性

## 完了判定基準

### 必須要件
- [ ] プリセット期間でのランキング取得成功
- [ ] カスタム期間での従来通りの動作維持
- [ ] ISO週境界問題の完全解決確認
- [ ] TypeScriptコンパイルエラーなし

### 推奨要件  
- [ ] プリセット期間選択UIの実装
- [ ] 検索情報の表示機能
- [ ] デバッグログの充実
- [ ] テストケースの実行

---

**セッション引き継ぎ者へ**: この文書は2025-08-18セッションでバックエンドハイブリッドAPI実装完了後に作成されました。バックエンド側の実装（`/backend/utils/presets.ts`, `/backend/routes/api/v1/guilds/rankings.ts`, `/backend/types/api.ts`）は完全に動作する状態です。フロントエンド側の上記タスクを順次実装してください。