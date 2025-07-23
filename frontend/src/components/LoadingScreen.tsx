import React from 'react';

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  showProgress?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "読み込み中...",
  submessage,
  showProgress = false
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-center max-w-md w-full">
        {/* メインローディングアニメーション */}
        <div className="relative mb-6">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-white mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
        </div>

        {/* メインメッセージ */}
        <h2 className="text-2xl font-bold text-white mb-2">{message}</h2>

        {/* サブメッセージ */}
        {submessage && (
          <p className="text-white/70 mb-6">{submessage}</p>
        )}

        {/* プログレスバー（オプション） */}
        {showProgress && (
          <div className="w-full bg-white/20 rounded-full h-2 mb-4">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
          </div>
        )}

        {/* 装飾的な要素 */}
        <div className="flex justify-center space-x-1 mt-6">
          <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
          <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
          <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;