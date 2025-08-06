# Zustand 状態管理ライブラリ導入計画

## 現状分析

### 実装で発見された問題点

Phase 3 実装完了により、カスタムフックでの状態管理の限界が明確になった：

#### 1. useDiscordData重複問題
```typescript
// 問題：Layout と App.tsx で別々にuseDiscordDataを呼び出し
function App() {
  const { guilds, selectedGuild, setSelectedGuild } = useDiscordData() // インスタンス1
  return <Layout /> // Layout内でもuseDiscordDataを呼び出し（インスタンス2）
}
```
**結果**: データ分離・同期問題・デバッグ困難

#### 2. Props Drilling地獄
```typescript
// App.tsx → Layout → DashboardPage → useStatistics の複雑な連携
function App() {
  return (
    <Layout guilds={guilds} selectedGuild={selectedGuild} setSelectedGuild={setSelectedGuild}>
      <Routes>
        <Route path="/" element={
          <DashboardPage 
            selectedGuild={selectedGuild}
            selectedGuildData={selectedGuildData}
            showResult={showResult}
          />
        } />
      </Routes>
    </Layout>
  )
}
```
**結果**: 冗長なprops渡し・メンテナンス性低下・型定義複雑化

#### 3. 状態の分散・デバッグ困難
- `useAuth`: 認証状態
- `useDiscordData`: サーバー管理・選択状態
- `useStatistics`: 統計データ・期間設定
- `usePeriodSelector`: 期間選択状態

**結果**: 状態変更の追跡困難・デバッグ時の大量ログ必要

## Zustand導入による解決策

### 理想的な状態管理構造

```typescript
// stores/appStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AppState {
  // 認証状態
  auth: {
    isAuthenticated: boolean
    user: User | null
    loading: boolean
  }
  
  // サーバー管理
  guilds: Guild[]
  selectedGuild: string
  
  // 統計データ
  statistics: {
    rankings: RankingData | null
    timeline: TimelineData | null
    summaries: SummariesData | null
    loading: boolean
    error: string | null
  }
  
  // 期間選択
  period: {
    selectedPeriod: PeriodSelection
    presets: PeriodPreset[]
    currentPresetIndex: number
  }
  
  // 通知設定（Phase 4準備）
  notifications: {
    schedules: NotificationSchedule[]
    settings: NotificationSettings
    loading: boolean
  }
  
  // アクション
  actions: {
    // 認証
    setAuth: (auth: AuthState) => void
    logout: () => void
    
    // サーバー管理
    setGuilds: (guilds: Guild[]) => void
    setSelectedGuild: (guildId: string) => void
    fetchGuilds: () => Promise<void>
    
    // 統計データ
    fetchStatistics: () => Promise<void>
    setStatisticsLoading: (loading: boolean) => void
    setStatisticsError: (error: string | null) => void
    
    // 期間選択
    updatePeriod: (period: PeriodSelection) => void
    selectPreset: (presetIndex: number) => void
    navigatePeriod: (direction: 'previous' | 'next') => void
    
    // 通知（Phase 4準備）
    fetchNotificationSchedules: () => Promise<void>
    updateNotificationSchedule: (schedule: NotificationSchedule) => Promise<void>
  }
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // 初期状態
      auth: {
        isAuthenticated: false,
        user: null,
        loading: false
      },
      guilds: [],
      selectedGuild: '',
      statistics: {
        rankings: null,
        timeline: null,
        summaries: null,
        loading: false,
        error: null
      },
      period: {
        selectedPeriod: getDefaultWeekPeriod(),
        presets: generatePeriodPresets(),
        currentPresetIndex: 0
      },
      notifications: {
        schedules: [],
        settings: getDefaultNotificationSettings(),
        loading: false
      },
      
      // アクション実装
      actions: {
        setAuth: (auth) => set({ auth }),
        logout: () => set({ 
          auth: { isAuthenticated: false, user: null, loading: false },
          guilds: [],
          selectedGuild: '',
          statistics: {
            rankings: null,
            timeline: null, 
            summaries: null,
            loading: false,
            error: null
          }
        }),
        
        setSelectedGuild: (guildId) => {
          set({ selectedGuild: guildId })
          // 自動的に統計データを再取得
          get().actions.fetchStatistics()
        },
        
        fetchStatistics: async () => {
          const { selectedGuild, period } = get()
          if (!selectedGuild) return
          
          set(state => ({ 
            statistics: { ...state.statistics, loading: true, error: null }
          }))
          
          try {
            const [rankings, timeline, summaries] = await Promise.all([
              fetchRankings(selectedGuild, {
                metric: 'duration',
                from: period.selectedPeriod.from,
                to: period.selectedPeriod.to,
                limit: 10,
                compare: true
              }),
              fetchTimeline(selectedGuild, {
                from: period.selectedPeriod.from + 'T18:00:00Z',
                to: period.selectedPeriod.to + 'T10:00:00Z'
              }),
              fetchSummaries(selectedGuild, {
                type: 'daily',
                from: period.selectedPeriod.from,
                to: period.selectedPeriod.to,
                limit: 30
              })
            ])
            
            set(state => ({
              statistics: {
                rankings: rankings.data,
                timeline: timeline.data,
                summaries: summaries.data,
                loading: false,
                error: null
              }
            }))
          } catch (error) {
            set(state => ({
              statistics: {
                ...state.statistics,
                loading: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            }))
          }
        }
      }
    }),
    { name: 'discord-bot-store' } // Redux DevTools用
  )
)
```

### 導入後のコンポーネント例

#### App.tsx（大幅簡素化）
```typescript
function App() {
  const isAuthenticated = useAppStore(state => state.auth.isAuthenticated)
  
  return (
    <AuthProvider>
      {isAuthenticated ? (
        <Router>
          <ThemeToggle />
          <Routes>
            <Route path="/neon" element={<NeonDashboardWrapper />} />
            <Route path="/*" element={<NormalDashboard />} />
          </Routes>
        </Router>
      ) : (
        <LoginScreen />
      )}
    </AuthProvider>
  )
}

function NormalDashboard() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/voice" element={<VoicePage />} />
        <Route path="/messages" element={<MessagesPage />} />
      </Routes>
    </Layout>
  )
}
```

#### Layout.tsx（Props不要）
```typescript
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAppStore(state => state.auth)
  const { guilds, selectedGuild } = useAppStore(state => ({ 
    guilds: state.guilds, 
    selectedGuild: state.selectedGuild 
  }))
  const selectedGuildData = guilds.find(g => g.id === selectedGuild)
  
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedGuildData?.name || 'サーバーを選択してください'}
          </h1>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {selectedGuild ? children : <ServerSelectPrompt />}
        </main>
      </div>
    </div>
  )
}
```

#### Sidebar.tsx（直接ストア操作）
```typescript
const Sidebar: React.FC = () => {
  const { guilds, selectedGuild } = useAppStore(state => ({
    guilds: state.guilds,
    selectedGuild: state.selectedGuild
  }))
  const setSelectedGuild = useAppStore(state => state.actions.setSelectedGuild)
  
  return (
    <div className="w-64 bg-white shadow-lg h-screen">
      <select
        value={selectedGuild || ''}
        onChange={(e) => setSelectedGuild(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-lg"
      >
        <option value="">サーバーを選択...</option>
        {guilds.map(guild => (
          <option key={guild.id} value={guild.id}>
            {guild.name} ({guild.memberCount}人)
          </option>
        ))}
      </select>
    </div>
  )
}
```

#### DashboardPage.tsx（Props不要・自動更新）
```typescript
const DashboardPage: React.FC = () => {
  const { rankings, timeline, loading, error } = useAppStore(state => state.statistics)
  const { selectedPeriod } = useAppStore(state => state.period)
  const { updatePeriod, fetchStatistics } = useAppStore(state => state.actions)
  
  const [activeView, setActiveView] = useState<'summary' | 'ranking' | 'timeline'>('summary')
  
  // 期間変更時に自動でデータ取得（ストアのアクション内で処理）
  
  return (
    <div className="space-y-6">
      {/* ビュー選択・期間選択UI */}
      
      {activeView === 'ranking' && (
        <RankingTableNormal
          data={rankings}
          loading={loading}
          error={error}
        />
      )}
    </div>
  )
}
```

## 段階的移行計画

### Phase 3.5: Zustand移行（推奨実装）

#### Week 1: 基盤構築・useDiscordData移行
- **目標**: 最も痛い部分（useDiscordData重複問題）の解決
- **作業内容**:
  1. Zustand基本ストア作成（認証・サーバー管理部分）
  2. useDiscordData → Zustand移行
  3. App.tsx, Layout.tsx のProps削除
  4. 動作確認・テスト

#### Week 2: 認証状態移行
- **目標**: useAuth → Zustand移行
- **作業内容**:
  1. 認証状態をストアに統合
  2. ログイン・ログアウト処理の移行
  3. 認証状態変更時の自動処理設定
  4. 認証フロー全体のテスト

#### Week 3: 統計データ移行
- **目標**: useStatistics → Zustand移行
- **作業内容**:
  1. 統計データ状態をストアに統合
  2. 自動更新・手動更新ロジックの移行
  3. エラーハンドリング・ローディング状態の統合
  4. DashboardPage の大幅簡素化

#### Week 4: 期間選択・最終統合
- **目標**: usePeriodSelector → Zustand移行・全体最適化
- **作業内容**:
  1. 期間選択状態をストアに統合
  2. 期間変更時の自動統計更新設定
  3. 不要な既存カスタムフック削除
  4. TypeScript型定義整理
  5. Redux DevTools設定・デバッグ環境構築
  6. パフォーマンステスト・最適化

## 導入効果予測

### 開発効率向上
- **Props drilling解消**: 複雑なprops渡しが不要
- **デバッグ容易**: Redux DevToolsでの状態可視化
- **コード簡素化**: 各コンポーネントが必要な状態のみを購読

### 保守性向上
- **中央集権化**: 全状態がストアで管理・変更追跡容易
- **型安全性**: TypeScriptとの完全統合
- **テスト容易**: 状態ロジックの単体テスト簡単

### Phase 4準備
- **通知システム**: 通知状態管理がストアに統合済み
- **複雑性対応**: 状態増加に対する基盤準備完了
- **スケーラビリティ**: 機能追加時の状態管理設計確立

## リスク・検討事項

### 技術的リスク
- **学習コスト**: Zustand習得（ただし軽量・React Hooksに近い）
- **移行時間**: 既存コード修正（段階的なので低リスク）
- **Bundle size**: +2.9KB gzipped（軽微）

### プロジェクトリスク
- **デグレ**: 既存機能の動作確認必要（段階的移行で軽減）
- **チーム習得**: 開発チーム全体でのZustand理解必要
- **過度設計**: 小規模アプリでのオーバーエンジニアリング懸念

### 対策
1. **段階的移行**: 1週間ずつの小さなステップで安全に移行
2. **十分なテスト**: 各段階での動作確認・回帰テスト実施
3. **ドキュメント**: Zustand使用パターンの社内ドキュメント作成

## 結論・推奨事項

### 強い推奨理由
1. **現実的な痛み**: useDiscordData重複・Props drilling は実際の開発阻害要因
2. **明確なROI**: 学習・移行コストに対する開発効率向上が大きい
3. **Phase 4準備**: 通知システム実装前の基盤安定化が必須
4. **技術的妥当性**: Zustandは軽量・React生態系との親和性高い

### 実装タイミング
**即座実装を推奨** - Phase 4開始前に状態管理基盤を安定化し、通知システム実装時の複雑性を回避する。

### 代替案
- **延期**: Phase 4完了後に実装 → Phase 4実装時に状態管理がさらに複雑化するリスク
- **Redux Toolkit**: より本格的な状態管理 → 学習・移行コストが高い・オーバーエンジニアリングの懸念
- **現状維持**: カスタムフック継続 → Props drilling・デバッグ困難の継続

**結論**: Zustand導入が現在のプロジェクト状況に最適解