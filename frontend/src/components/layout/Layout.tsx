import React, { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { authUserAtom } from '../../atoms/auth';
import { selectedGuildAtom, autoRefreshOnAuthAtom, guildsInitialLoadingAtom } from '../../atoms/discord';
import Sidebar from './Sidebar';
import ErrorBoundary from '../ErrorBoundary';

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
            <ErrorBoundary
              fallback={(error, errorInfo, retry) => (
                <PageErrorFallback 
                  error={error} 
                  errorInfo={errorInfo}
                  onRetry={retry}
                  guildName={selectedGuildData.name}
                />
              )}
              onError={(error) => {
                console.error('Page-level error in Layout:', error);
                console.error('Error occurred in guild:', selectedGuildData.name);
              }}
            >
              {children}
            </ErrorBoundary>
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

// ページレベルのエラーフォールバックコンポーネント
interface PageErrorFallbackProps {
  error: Error;
  errorInfo: any;
  onRetry: () => void;
  guildName: string;
}

const PageErrorFallback: React.FC<PageErrorFallbackProps> = ({ 
  error, 
  onRetry, 
  guildName 
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // エラーの種類を判定
  const isNetworkError = error.message.includes('fetch') || 
                        error.message.includes('Network') ||
                        error.message.includes('Failed to');
  const isAPIError = error.message.includes('API') ||
                    error.message.includes('server') ||
                    error.message.includes('400') ||
                    error.message.includes('500');

  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <div className="text-center max-w-lg">
        <div className="text-6xl mb-4">
          {isNetworkError ? '🌐' : isAPIError ? '🔧' : '⚠️'}
        </div>
        
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          {isNetworkError ? 'ネットワークエラー' : 
           isAPIError ? 'サーバーエラー' : 
           '予期しないエラーが発生しました'}
        </h3>
        
        <p className="text-gray-500 mb-2">
          <strong>{guildName}</strong> の統計データの読み込み中にエラーが発生しました。
        </p>
        
        <p className="text-sm text-gray-400 mb-6">
          {isNetworkError ? 'インターネット接続を確認してください。' :
           isAPIError ? 'サーバーとの通信でエラーが発生しました。' :
           'しばらく待ってから再試行してください。'}
        </p>
        
        <div className="space-y-3">
          <div className="flex gap-3 justify-center">
            <button
              onClick={onRetry}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
            >
              🔄 再試行
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              ページ再読み込み
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-2">💡 復旧方法</h4>
          <ul className="text-sm text-blue-700 text-left space-y-1">
            <li>• 左のサイドバーから他のページに移動する</li>
            <li>• 別のサーバーを選択して再試行する</li>
            <li>• しばらく時間をおいてから再アクセスする</li>
            {isNetworkError && <li>• インターネット接続を確認する</li>}
          </ul>
        </div>

        {/* 開発環境でのエラー詳細表示 */}
        {isDevelopment && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              🔧 エラー詳細 (開発用)
            </summary>
            <div className="mt-3 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-auto">
              <div className="mb-2">
                <strong>Guild:</strong> {guildName}
              </div>
              <div className="mb-2">
                <strong>Error:</strong> {error.message}
              </div>
              {error.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="whitespace-pre-wrap font-mono text-xs mt-1">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default Layout;