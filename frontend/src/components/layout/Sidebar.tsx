import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { 
  guildsAtom, 
  selectedGuildIdAtom, 
  selectedGuildAtom, 
  selectGuildActionAtom, 
  guildsInitialLoadingAtom
} from '../../atoms/discord';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BarChart3,
  Users,
  Mic,
  MessageSquare,
  Hash,
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const guilds = useAtomValue(guildsAtom);
  const selectedGuild = useAtomValue(selectedGuildIdAtom);
  const selectedGuildData = useAtomValue(selectedGuildAtom);
  const setSelectedGuild = useSetAtom(selectGuildActionAtom);
  const initialLoading = useAtomValue(guildsInitialLoadingAtom)

  const navigation = [
    { 
      name: 'ダッシュボード', 
      href: '/', 
      icon: BarChart3,
      description: '統計とサーバー概要'
    },
    { 
      name: 'チャンネル管理', 
      href: '/channels', 
      icon: Hash,
      description: 'チャンネル設定と管理'
    },
    { 
      name: 'メンバー管理', 
      href: '/members', 
      icon: Users,
      description: 'メンバー一覧と権限'
    },
    { 
      name: 'ボイス設定', 
      href: '/voice', 
      icon: Mic,
      description: 'ボイスチャンネル設定'
    },
    { 
      name: 'メッセージ管理', 
      href: '/messages', 
      icon: MessageSquare,
      description: 'メッセージ送信と管理'
    }
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-72 bg-card border-r border-border flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
            🤖
          </div>
          <div>
            <h1 className="text-xl font-bold font-sans text-foreground">Discord Bot</h1>
            <p className="text-sm text-muted-foreground font-serif">管理パネル</p>
          </div>
        </div>
      </div>

      {/* Server Selection */}
      <div className="p-4 border-b border-border">
        <label className="block text-sm font-medium text-foreground mb-2 font-serif">サーバー選択</label>
        <div className="space-y-3">
          {initialLoading ? (
            <select
              disabled
              value=""
              className="w-full p-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-background cursor-wait"
            >
              <option>読み込み中...</option>
            </select>
          ) : (
            <select
              value={selectedGuild || ''}
              onChange={(e) => setSelectedGuild(e.target.value)}
              className="w-full p-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-background"
            >
              <option value="">{guilds.length ? 'サーバーを選択...' : '利用可能なサーバー無し'}</option>
              {guilds.map(guild => (
                <option key={guild.id} value={guild.id}>
                  {guild.name} ({guild.memberCount}人)
                </option>
              ))}
            </select>
          )}

          {selectedGuildData && (
            <Card className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage 
                    src={selectedGuildData.icon ? (() => {
                      const desiredSize = 128
                      let src = selectedGuildData.icon
                      if (/^https?:\/\//.test(src)) {
                        try {
                          const u = new URL(src)
                          u.searchParams.set('size', String(desiredSize))
                          src = u.toString()
                        } catch { /* そのまま */ }
                      } else {
                        const isAnimated = src.startsWith('a_')
                        const ext = isAnimated ? 'gif' : 'webp'
                        src = `https://cdn.discordapp.com/icons/${selectedGuildData.id}/${src}.${ext}?size=${desiredSize}`
                      }
                      return src
                    })() : undefined}
                    alt={selectedGuildData.name}
                  />
                  <AvatarFallback>{selectedGuildData.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate font-sans">{selectedGuildData.name}</p>
                  <p className="text-xs text-muted-foreground font-serif">{selectedGuildData.memberCount}人のメンバー</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const IconComponent = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`w-full group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <IconComponent className="w-5 h-5" />
                <div className="flex-1 text-left">
                  <div className="font-medium font-sans">{item.name}</div>
                  <div className="text-xs opacity-75 font-serif">{item.description}</div>
                </div>
                {isActive && <div className="w-2 h-2 bg-white rounded-full" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground space-y-1 font-serif">
          <div>バージョン: v2.3.0</div>
          <div>最終更新: {new Date().toLocaleString('ja-JP')}</div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;