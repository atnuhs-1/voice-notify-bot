import React from 'react';

const ChannelsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          🏷️ チャンネル管理
        </h1>
        <p className="text-gray-600 mt-2">
          チャンネルの設定と管理を行います
        </p>
      </div>

      {/* チャンネル管理コンテンツ */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🚧</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">チャンネル管理機能</h3>
          <p className="text-gray-500 mb-4">
            チャンネル管理機能は現在開発中です
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-medium text-yellow-800 mb-2">実装予定機能</h4>
            <ul className="text-sm text-yellow-700 text-left space-y-1">
              <li>• テキストチャンネルの作成・削除</li>
              <li>• ボイスチャンネルの作成・削除</li>
              <li>• チャンネル権限の設定</li>
              <li>• スローモード設定</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelsPage;