import React from 'react';

const MessagesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          💬 メッセージ管理
        </h1>
        <p className="text-gray-600 mt-2">
          メッセージの送信と管理機能
        </p>
      </div>

      {/* メッセージ管理コンテンツ */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">メッセージ管理機能</h3>
          <p className="text-gray-500 mb-4">
            メッセージ管理機能は現在開発中です
          </p>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-medium text-purple-800 mb-2">実装予定機能</h4>
            <ul className="text-sm text-purple-700 text-left space-y-1">
              <li>• チャンネルへのメッセージ送信</li>
              <li>• 一括メッセージ送信</li>
              <li>• Embed形式メッセージ</li>
              <li>• 定期メッセージ送信</li>
              <li>• メッセージテンプレート</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;