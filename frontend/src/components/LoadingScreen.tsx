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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md w-full px-6">
        {/* メインローディングアニメーション */}
        <div className="relative mb-6">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-border border-t-blue-600 mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
        </div>

        {/* メインメッセージ */}
        <h2 className="text-2xl font-bold text-foreground mb-2 font-sans">{message}</h2>

        {/* サブメッセージ */}
        {submessage && (
          <p className="text-muted-foreground mb-6 font-serif">{submessage}</p>
        )}

        {/* プログレスバー（オプション） */}
        {showProgress && (
          <div className="w-full bg-border rounded-full h-2 mb-4">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
          </div>
        )}

        {/* 装飾的な要素 */}
        <div className="flex justify-center space-x-1 mt-6">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;