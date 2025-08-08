import React from 'react';

const MembersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          👥 メンバー管理
        </h1>
        <p className="text-gray-600 mt-2">
          サーバーメンバーの一覧と権限管理
        </p>
      </div>

      {/* メンバー管理コンテンツ */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🚧</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">メンバー管理機能</h3>
          <p className="text-gray-500 mb-4">
            メンバー管理機能は現在開発中です
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-medium text-blue-800 mb-2">実装予定機能</h4>
            <ul className="text-sm text-blue-700 text-left space-y-1">
              <li>• オンラインメンバー一覧</li>
              <li>• メンバー権限管理</li>
              <li>• ニックネーム変更</li>
              <li>• ボイスチャンネル移動</li>
              <li>• ミュート・キック機能</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembersPage;