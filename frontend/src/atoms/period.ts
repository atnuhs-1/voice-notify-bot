import { atom } from 'jotai'
import { selectedPeriodAtom, updatePeriodActionAtom } from './statistics'
import type { PeriodSelection } from '../types/statistics'

// 拡張された期間プリセット型
interface ExtendedPeriodPreset {
  key: string;
  label: string;
  description: string;
  period: PeriodSelection;
}

// === 期間プリセット定義 ===

export const periodPresetsAtom = atom<ExtendedPeriodPreset[]>(() => [
  {
    key: 'this_week',
    label: '今週',
    description: '今週（月曜日〜日曜日）',
    period: getCurrentWeek()
  },
  {
    key: 'last_week', 
    label: '先週',
    description: '先週（月曜日〜日曜日）',
    period: getLastWeek()
  },
  {
    key: 'this_month',
    label: '今月',
    description: '今月（1日〜月末）',
    period: getCurrentMonth()
  },
  {
    key: 'last_month',
    label: '先月', 
    description: '先月（1日〜月末）',
    period: getLastMonth()
  },
  {
    key: 'last_7_days',
    label: '過去7日',
    description: '過去7日間',
    period: getLast7Days()
  },
  {
    key: 'last_30_days',
    label: '過去30日',
    description: '過去30日間',
    period: getLast30Days()
  }
])

// === 期間フォーマット atoms ===

// 選択中の期間の表示用フォーマット
export const formattedPeriodAtom = atom((get) => {
  const period = get(selectedPeriodAtom)
  
  const startDate = new Date(period.from)
  const endDate = new Date(period.to)
  
  // 日本語での期間表示
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
  
  const startStr = formatter.format(startDate)
  const endStr = formatter.format(endDate)
  
  // 同じ月の場合は月を省略
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    const dayFormatter = new Intl.DateTimeFormat('ja-JP', {
      day: 'numeric',
      weekday: 'short'
    })
    return `${startStr} 〜 ${dayFormatter.format(endDate)}`
  }
  
  return `${startStr} 〜 ${endStr}`
})

// === アクションatoms ===

// プリセット選択
export const selectPresetActionAtom = atom(
  null,
  (get, set, presetKey: string) => {
    const presets = get(periodPresetsAtom)
    const preset = presets.find(p => p.key === presetKey)
    
    if (preset) {
      set(updatePeriodActionAtom, preset.period)
      console.log(`🔄 プリセット「${preset.label}」を選択`)
    }
  }
)

// 期間ナビゲーション（前へ）
export const navigatePreviousActionAtom = atom(
  null,
  (get, set) => {
    const currentPeriod = get(selectedPeriodAtom)
    const previousPeriod = getPreviousPeriod(currentPeriod)
    set(updatePeriodActionAtom, previousPeriod)
    console.log('🔄 前の期間へ移動')
  }
)

// 期間ナビゲーション（次へ）
export const navigateNextActionAtom = atom(
  null,
  (get, set) => {
    const currentPeriod = get(selectedPeriodAtom)
    const nextPeriod = getNextPeriod(currentPeriod)
    set(updatePeriodActionAtom, nextPeriod)
    console.log('🔄 次の期間へ移動')
  }
)

// カスタム期間設定
export const setCustomPeriodActionAtom = atom(
  null,
  (_get, set, from: string, to: string) => {
    const customPeriod: PeriodSelection = {
      type: 'custom',
      from,
      to
    }
    set(updatePeriodActionAtom, customPeriod)
    console.log('🔄 カスタム期間を設定:', customPeriod)
  }
)

// === ユーティリティ関数 ===

function getCurrentWeek(): PeriodSelection {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  
  // 月曜日にセット
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  monday.setDate(now.getDate() - daysToSubtract)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  return {
    type: 'week',
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0]
  }
}

function getLastWeek(): PeriodSelection {
  const thisWeek = getCurrentWeek()
  const lastWeekStart = new Date(thisWeek.from)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  
  const lastWeekEnd = new Date(thisWeek.to)
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7)
  
  return {
    type: 'week',
    from: lastWeekStart.toISOString().split('T')[0],
    to: lastWeekEnd.toISOString().split('T')[0]
  }
}

function getCurrentMonth(): PeriodSelection {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  return {
    type: 'month',
    from: monthStart.toISOString().split('T')[0],
    to: monthEnd.toISOString().split('T')[0]
  }
}

function getLastMonth(): PeriodSelection {
  const now = new Date()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  
  return {
    type: 'month',
    from: lastMonthStart.toISOString().split('T')[0],
    to: lastMonthEnd.toISOString().split('T')[0]
  }
}

function getLast7Days(): PeriodSelection {
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 6) // 今日を含めて7日
  
  return {
    type: 'custom',
    from: weekAgo.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0]
  }
}

function getLast30Days(): PeriodSelection {
  const now = new Date()
  const monthAgo = new Date(now)
  monthAgo.setDate(now.getDate() - 29) // 今日を含めて30日
  
  return {
    type: 'custom',
    from: monthAgo.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0]
  }
}

function getPreviousPeriod(current: PeriodSelection): PeriodSelection {
  const startDate = new Date(current.from)
  const endDate = new Date(current.to)
  const duration = endDate.getTime() - startDate.getTime()
  
  const previousStart = new Date(startDate.getTime() - duration - 24 * 60 * 60 * 1000)
  const previousEnd = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
  
  return {
    type: current.type,
    from: previousStart.toISOString().split('T')[0],
    to: previousEnd.toISOString().split('T')[0]
  }
}

function getNextPeriod(current: PeriodSelection): PeriodSelection {
  const startDate = new Date(current.from)
  const endDate = new Date(current.to)
  const duration = endDate.getTime() - startDate.getTime()
  
  const nextStart = new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
  const nextEnd = new Date(nextStart.getTime() + duration)
  
  return {
    type: current.type,
    from: nextStart.toISOString().split('T')[0],
    to: nextEnd.toISOString().split('T')[0]
  }
}