import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: any, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({
      error,
      errorInfo
    });

    // エラーログ出力
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);

    // 親コンポーネントにエラー通知
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.state.errorInfo, this.retry);
      }

      // デフォルトのエラー表示
      return (
        <DefaultErrorFallback
          error={this.state.error!}
          errorInfo={this.state.errorInfo}
          onRetry={this.retry}
        />
      );
    }

    return this.props.children;
  }
}

// デフォルトのエラーフォールバックコンポーネント
interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: any;
  onRetry: () => void;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ 
  error, 
  errorInfo, 
  onRetry 
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          予期しないエラーが発生しました
        </h3>
        <p className="text-gray-500 mb-6">
          ページの読み込み中にエラーが発生しました。
          再読み込みを試すか、左のサイドバーから他のページに移動してください。
        </p>
        
        <div className="space-y-3">
          <button
            onClick={onRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            🔄 再試行
          </button>
          
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              ページ再読み込み
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              ホームに戻る
            </button>
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          💡 問題が続く場合は、別のサーバーを選択してみてください
        </div>

        {/* 開発環境でのエラー詳細表示 */}
        {isDevelopment && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              🔧 エラー詳細 (開発用)
            </summary>
            <div className="mt-3 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-auto">
              <div className="mb-2">
                <strong>Error:</strong> {error.message}
              </div>
              {error.stack && (
                <div className="mb-2">
                  <strong>Stack:</strong>
                  <pre className="whitespace-pre-wrap font-mono text-xs mt-1">
                    {error.stack}
                  </pre>
                </div>
              )}
              {errorInfo && errorInfo.componentStack && (
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="whitespace-pre-wrap font-mono text-xs mt-1">
                    {errorInfo.componentStack}
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

export default ErrorBoundary;