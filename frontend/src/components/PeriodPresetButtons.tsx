import React from 'react';
import type { BackendPeriodPreset } from '../types/statistics';

interface PeriodPresetButtonsProps {
  selectedPreset?: string;
  onPresetSelect: (preset: BackendPeriodPreset) => void;
  className?: string;
}

export const PeriodPresetButtons: React.FC<PeriodPresetButtonsProps> = ({ 
  selectedPreset, 
  onPresetSelect, 
  className = '' 
}) => {
  const presets = [
    { key: 'this_week', label: '今週', icon: '📅', description: '今週（月曜日〜日曜日）' },
    { key: 'last_week', label: '先週', icon: '📋', description: '先週（月曜日〜日曜日）' },
    { key: 'this_month', label: '今月', icon: '🗓️', description: '今月（1日〜月末）' },
    { key: 'last_month', label: '先月', icon: '📄', description: '先月（1日〜月末）' },
    { key: 'last_7_days', label: '過去7日', icon: '⏰', description: '過去7日間' },
    { key: 'last_30_days', label: '過去30日', icon: '📊', description: '過去30日間' },
    { key: 'this_year', label: '今年', icon: '📅', description: '今年（1月1日〜12月31日）' },
    { key: 'last_year', label: '昨年', icon: '📋', description: '昨年（1月1日〜12月31日）' }
  ] as const;
  
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {presets.map(preset => (
        <button
          key={preset.key}
          onClick={() => onPresetSelect(preset.key as BackendPeriodPreset)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            selectedPreset === preset.key
              ? 'bg-blue-500 text-white shadow-md scale-105'
              : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm'
          }`}
          title={preset.description}
        >
          <span className="text-base">{preset.icon}</span>
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
};

// より詳細なプリセット期間選択コンポーネント
interface DetailedPeriodPresetProps {
  selectedPreset?: string;
  onPresetSelect: (preset: BackendPeriodPreset) => void;
  className?: string;
}

export const DetailedPeriodPreset: React.FC<DetailedPeriodPresetProps> = ({
  selectedPreset,
  onPresetSelect,
  className = ''
}) => {
  const presetGroups = [
    {
      title: '週間',
      icon: '📅',
      presets: [
        { key: 'this_week', label: '今週', description: 'ISO週（月曜日〜日曜日）' },
        { key: 'last_week', label: '先週', description: 'ISO週（月曜日〜日曜日）' }
      ]
    },
    {
      title: '月間',
      icon: '🗓️',
      presets: [
        { key: 'this_month', label: '今月', description: '月初〜月末' },
        { key: 'last_month', label: '先月', description: '月初〜月末' }
      ]
    },
    {
      title: '相対期間',
      icon: '⏰',
      presets: [
        { key: 'last_7_days', label: '過去7日', description: '今日から過去7日間' },
        { key: 'last_30_days', label: '過去30日', description: '今日から過去30日間' }
      ]
    },
    {
      title: '年間',
      icon: '🎯',
      presets: [
        { key: 'this_year', label: '今年', description: '1月1日〜12月31日' },
        { key: 'last_year', label: '昨年', description: '1月1日〜12月31日' }
      ]
    }
  ] as const;

  return (
    <div className={`space-y-4 ${className}`}>
      {presetGroups.map(group => (
        <div key={group.title} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span>{group.icon}</span>
              {group.title}
            </h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.presets.map(preset => (
                <button
                  key={preset.key}
                  onClick={() => onPresetSelect(preset.key as BackendPeriodPreset)}
                  className={`p-3 rounded-lg text-left transition-all duration-200 ${
                    selectedPreset === preset.key
                      ? 'bg-blue-100 border-2 border-blue-300 text-blue-800'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-blue-50 hover:border-blue-200 text-gray-700'
                  }`}
                >
                  <div className="font-medium text-sm">{preset.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ハイブリッドAPI情報表示コンポーネント
interface HybridApiInfoProps {
  searchType?: 'preset' | 'custom';
  preset?: string;
  isOptimized?: boolean;
  className?: string;
}

export const HybridApiInfo: React.FC<HybridApiInfoProps> = ({
  searchType,
  preset,
  isOptimized,
  className = ''
}) => {
  if (!searchType) return null;

  return (
    <div className={`text-xs text-gray-500 bg-gray-50 rounded-lg p-2 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="font-medium">検索タイプ:</span>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          searchType === 'preset' 
            ? 'bg-green-100 text-green-700' 
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {searchType === 'preset' ? 'プリセット期間' : 'カスタム期間'}
        </span>
        {preset && (
          <>
            <span>({preset})</span>
          </>
        )}
        {isOptimized && (
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
            🚀 高速ルート
          </span>
        )}
      </div>
    </div>
  );
};

export default PeriodPresetButtons;