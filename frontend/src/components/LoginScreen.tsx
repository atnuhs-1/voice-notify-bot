import { useAuth } from '../hooks/useAuth'

export default function LoginScreen() {
  const { login, isLoading } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-md w-full text-center">
        {/* ロゴ・ヘッダー */}
        <div className="mb-8">
          <div className="text-6xl mb-4">🤖</div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Discord Bot Control Panel
          </h1>
          <p className="text-white/70 text-lg">
            ボイスチャンネル通知システム
          </p>
        </div>

        {/* 説明 */}
        <div className="mb-8">
          <div className="bg-white/5 rounded-lg p-4 mb-4">
            <h2 className="text-white font-semibold mb-2">🔐 ログインについて</h2>
            <p className="text-white/80 text-sm text-left">
              このダッシュボードを使用するには、Discordアカウントでのログインが必要です。
              管理者権限を持つサーバーのみ操作できます。
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center text-white/80">
              <span className="mr-2">✅</span>
              <span>安全なDiscord OAuth2認証</span>
            </div>
            <div className="flex items-center text-white/80">
              <span className="mr-2">🛡️</span>
              <span>管理者権限のサーバーのみアクセス</span>
            </div>
            <div className="flex items-center text-white/80">
              <span className="mr-2">🔒</span>
              <span>パスワード入力不要</span>
            </div>
          </div>
        </div>

        {/* ログインボタン */}
        <div className="space-y-4">
          <button
            onClick={login}
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center group"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                <span>処理中...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.195.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                  <path d="M8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.201 0 2.157 1.086 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.201 0 2.157 1.086 2.157 2.42c0 1.333-.956 2.418-2.157 2.418z"/>
                </svg>
                <span>Discordでログイン</span>
              </>
            )}
          </button>

          <p className="text-white/60 text-xs">
            ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます
          </p>
        </div>

        {/* フッター情報 */}
        <div className="mt-8 pt-6 border-t border-white/20">
          <div className="text-white/50 text-xs space-y-1">
            <p>🔧 Discord Bot Control Panel v1.0</p>
            <p>⚡ Powered by Discord.js & React</p>
          </div>
        </div>
      </div>
    </div>
  )
}