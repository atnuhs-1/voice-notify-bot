import React, { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { authUserAtom } from '../../atoms/auth';
import { selectedGuildAtom, autoRefreshOnAuthAtom, guildsInitialLoadingAtom } from '../../atoms/discord';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const user = useAtomValue(authUserAtom);
  const selectedGuildData = useAtomValue(selectedGuildAtom);
  const initialLoading = useAtomValue(guildsInitialLoadingAtom);
  const autoRefresh = useSetAtom(autoRefreshOnAuthAtom);

  // 認証状態変更時にDiscordデータを自動更新
  useEffect(() => {
    autoRefresh();
  }, [autoRefresh]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* サイドバー（Props不要） */}
      <Sidebar />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col">
        {/* トップバー */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {initialLoading
                  ? 'ギルド読み込み中...'
                  : (selectedGuildData?.name || 'サーバー未選択')}
              </h1>
              <p className="text-gray-600 mt-1">
                Discord Bot管理パネル
              </p>
            </div>
            
            {/* ユーザー情報 */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                <p className="text-xs text-gray-500">管理者</p>
              </div>
              {user?.avatar && (
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`}
                  alt={user.tag}
                  className="w-10 h-10 rounded-full border-2 border-gray-200"
                />
              )}
            </div>
          </div>
        </header>

        {/* ページコンテンツ */}
        <main className="flex-1 p-6 overflow-auto">
          {initialLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center animate-pulse">
                <div className="text-5xl mb-4">⏳</div>
                <h2 className="text-lg font-semibold text-gray-700 mb-2">
                  ギルド情報を読み込み中...
                </h2>
                <p className="text-gray-500 text-sm">
                  少しお待ちください
                </p>
              </div>
            </div>
          ) : selectedGuildData ? (
            children
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🤖</div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  サーバーを選択してください
                </h2>
                <p className="text-gray-500">
                  左のサイドバーからサーバーを選択して、管理を開始しましょう
                </p>
              </div>
            </div>
          )}
        </main>

      </div>
    </div>
  );
};

export default Layout;