import React from 'react';

const VoicePage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          🔊 ボイス設定
        </h1>
        <p className="text-gray-600 mt-2">
          ボイスチャンネルの設定と通知管理
        </p>
      </div>

      {/* ボイス設定コンテンツ */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔧</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">ボイス通知設定</h3>
          <p className="text-gray-500 mb-4">
            ボイス通知設定機能は現在開発中です
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-medium text-green-800 mb-2">実装予定機能</h4>
            <ul className="text-sm text-green-700 text-left space-y-1">
              <li>• ボイスチャンネル通知設定</li>
              <li>• 入退室通知のオン・オフ</li>
              <li>• 通知先チャンネル設定</li>
              <li>• セッション記録設定</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoicePage;