import React, { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  guilds: any[];
  selectedGuild: string;
  setSelectedGuild: (guildId: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, guilds, selectedGuild, setSelectedGuild }) => {
  const { user } = useAuth();

  const selectedGuildData = guilds.find(g => g.id === selectedGuild);

  // selectedGuild変更時の処理
  useEffect(() => {
    // Layout内でのselectedGuild変更処理
    // console.log('Layout: selectedGuild changed to', selectedGuild);
  }, [selectedGuild, selectedGuildData, guilds]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* サイドバー */}
      <Sidebar
        guilds={guilds}
        selectedGuild={selectedGuild}
        setSelectedGuild={setSelectedGuild}
        selectedGuildData={selectedGuildData}
      />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col">
        {/* トップバー */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedGuildData?.name || 'サーバーを選択してください'}
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
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=64`}
                  alt={user.tag}
                  className="w-10 h-10 rounded-full border-2 border-gray-200"
                />
              )}
            </div>
          </div>
        </header>

        {/* ページコンテンツ */}
        <main className="flex-1 p-6 overflow-auto">
          {selectedGuild ? (
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