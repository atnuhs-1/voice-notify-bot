import React, { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { 
  authInitActionAtom,
  authLoadingAtom, 
  // authErrorAtom,
  isAuthenticatedAtom
} from '../atoms/auth';
import { refreshDiscordDataActionAtom } from '../atoms/discord';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const initAuth = useSetAtom(authInitActionAtom);
  const refreshDiscordData = useSetAtom(refreshDiscordDataActionAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const isLoading = useAtomValue(authLoadingAtom);
  // const error = useAtomValue(authErrorAtom);

  // アプリケーション起動時の認証初期化
  useEffect(() => {
    const initialize = async () => {
      console.log('🔄 AuthProvider: 認証初期化開始');
      await initAuth();
    };

    initialize();
  }, [initAuth]);

  // 認証成功時のDiscordデータ取得
  useEffect(() => {
    const fetchDiscordData = async () => {
      if (isAuthenticated) {
        console.log('🔄 AuthProvider: 認証成功後のDiscordデータ取得');
        try {
          await refreshDiscordData();
          console.log('✅ AuthProvider: Discordデータ取得完了');
        } catch (error) {
          console.error('❌ AuthProvider: Discordデータ取得失敗:', error);
        }
      }
    };

    fetchDiscordData();
  }, [isAuthenticated, refreshDiscordData]);

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md w-full px-6">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-border border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2 font-sans">
            認証・データを確認中...
          </h2>
          <p className="text-muted-foreground mb-6 font-serif">
            しばらくお待ちください
          </p>
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
          </div>
        </div>
      </div>
    );
  }

  // エラーがある場合はそのまま通す（App.tsxでErrorDisplayを表示）
  return <>{children}</>;
};

export default AuthProvider;