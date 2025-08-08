import React from 'react';
import { type AuthError } from '../atoms/auth';

interface ErrorDisplayProps {
  error: AuthError;
  onRetry?: () => void;
  onDismiss?: () => void;
  onLogin?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  onLogin
}) => {
  // エラータイプに応じたアイコンと色
  const getErrorStyle = () => {
    switch (error.type) {
      case 'network':
        return {
          icon: '🌐',
          bgColor: 'from-orange-500/20 to-yellow-500/20',
          borderColor: 'border-orange-400/30',
          textColor: 'text-orange-300'
        };
      case 'auth':
        return {
          icon: '🔐',
          bgColor: 'from-red-500/20 to-pink-500/20',
          borderColor: 'border-red-400/30',
          textColor: 'text-red-300'
        };
      case 'permission':
        return {
          icon: '🚫',
          bgColor: 'from-purple-500/20 to-indigo-500/20',
          borderColor: 'border-purple-400/30',
          textColor: 'text-purple-300'
        };
      default:
        return {
          icon: '⚠️',
          bgColor: 'from-gray-500/20 to-slate-500/20',
          borderColor: 'border-gray-400/30',
          textColor: 'text-gray-300'
        };
    }
  };

  const style = getErrorStyle();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-md w-full text-center">
        {/* エラーアイコン */}
        <div className="text-6xl mb-4">{style.icon}</div>
        
        {/* エラータイトル */}
        <h2 className="text-2xl font-bold text-white mb-4">
          {error.type === 'network' && 'ネットワークエラー'}
          {error.type === 'auth' && '認証エラー'}
          {error.type === 'permission' && 'アクセス権限エラー'}
          {error.type === 'unknown' && 'エラーが発生しました'}
        </h2>

        {/* エラーメッセージ */}
        <div className={`bg-gradient-to-r ${style.bgColor} rounded-lg p-4 mb-6 border ${style.borderColor}`}>
          <p className={`${style.textColor} text-sm leading-relaxed`}>
            {error.message}
          </p>
        </div>

        {/* アクションボタン */}
        <div className="space-y-3">
          {/* リトライボタン（リトライ可能な場合） */}
          {error.canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              再試行
            </button>
          )}

          {/* ログインボタン（認証エラーの場合） */}
          {error.type === 'auth' && onLogin && (
            <button
              onClick={onLogin}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.195.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Discordで再ログイン
            </button>
          )}

          {/* 閉じるボタン */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              閉じる
            </button>
          )}
        </div>

        {/* 権限エラーの場合の追加情報 */}
        {error.type === 'permission' && (
          <div className="mt-6 bg-white/5 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2 text-sm">必要な条件:</h3>
            <ul className="text-white/70 text-xs text-left space-y-1">
              <li>• Botが参加しているサーバー</li>
              <li>• ユーザーも参加しているサーバー</li>  
              <li>• ユーザーが管理者権限を持っているサーバー</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;