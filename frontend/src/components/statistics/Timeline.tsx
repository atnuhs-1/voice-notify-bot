import React, { useState } from 'react';
import { formatTime, formatDuration, formatRelativeDate } from '../../utils/date';
import type { TimelineData, TimelineActivity, TimelineSession } from '../../types/statistics';

interface TimelineProps {
  data: TimelineData | null;
  loading: boolean;
  error: string | null;
  periodStart: string;
  periodEnd: string;
}

const Timeline: React.FC<TimelineProps> = ({
  data,
  loading,
  error,
  periodStart,
  periodEnd
}) => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">📈 活動タイムライン</h3>
        </div>
        <div className="p-10 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white/70">タイムラインを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">📈 活動タイムライン</h3>
        </div>
        <div className="p-10 text-center">
          <p className="text-red-400">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.activities || data.activities.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">📈 活動タイムライン</h3>
        </div>
        <div className="p-10 text-center">
          <p className="text-white/70">📊 この期間には活動がありません</p>
        </div>
      </div>
    );
  }

  // 期間の時間範囲を計算（表示用）
  const startTime = new Date(periodStart);
  const endTime = new Date(periodEnd);
  const totalDuration = endTime.getTime() - startTime.getTime();

  // セッション位置とサイズを計算
  const getSessionPosition = (session: TimelineSession) => {
    const sessionStart = new Date(session.joinTime);
    const sessionEnd = session.leaveTime ? new Date(session.leaveTime) : endTime;
    
    const startOffset = Math.max(0, sessionStart.getTime() - startTime.getTime());
    const sessionDuration = sessionEnd.getTime() - Math.max(sessionStart.getTime(), startTime.getTime());
    
    const left = (startOffset / totalDuration) * 100;
    const width = (sessionDuration / totalDuration) * 100;
    
    return { left: `${left}%`, width: `${Math.max(0.5, width)}%` };
  };

  // 時間軸のマーカーを生成
  const generateTimeMarkers = () => {
    const markers = [];
    const duration = totalDuration / (1000 * 60 * 60); // 時間単位
    const interval = duration <= 6 ? 1 : duration <= 12 ? 2 : duration <= 24 ? 4 : 6;
    
    for (let i = 0; i <= duration; i += interval) {
      const time = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      const position = (i / duration) * 100;
      
      markers.push({
        time: formatTime(time.toISOString()),
        position: `${position}%`
      });
    }
    
    return markers;
  };

  const timeMarkers = generateTimeMarkers();

  // セッション詳細のツールチップ
  const SessionTooltip = ({ session, user }: { session: TimelineSession; user: TimelineActivity }) => (
    <div className="absolute z-50 bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-white/20 min-w-[200px] -mt-2 pointer-events-none">
      <div className="font-semibold text-blue-400 mb-1">{user.username}</div>
      <div className="text-sm space-y-1">
        <div>📍 {session.channelName}</div>
        <div>⏰ {formatTime(session.joinTime)}</div>
        <div>⏱️ {formatDuration(session.duration)}</div>
        {session.isSessionStarter && (
          <div className="text-green-400 text-xs">🎮 通話開始者</div>
        )}
        {session.isActive && (
          <div className="text-blue-400 text-xs">🔴 接続中</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white mb-2">📈 活動タイムライン</h3>
        <div className="text-white/70 text-sm">
          {formatRelativeDate(periodStart)} 〜 {formatRelativeDate(periodEnd)}
        </div>
        
        {/* サマリー情報 */}
        {data.summary && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-blue-400 font-semibold">{formatDuration(data.summary.totalDuration)}</div>
              <div className="text-white/60">総活動時間</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-semibold">{data.summary.totalParticipants}人</div>
              <div className="text-white/60">参加者</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 font-semibold">{data.summary.totalSessions}回</div>
              <div className="text-white/60">セッション</div>
            </div>
            <div className="text-center">
              <div className="text-orange-400 font-semibold">{formatDuration(data.summary.longestSession)}</div>
              <div className="text-white/60">最長セッション</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {/* 時間軸 */}
        <div className="mb-6 relative">
          <div className="h-8 bg-white/5 rounded-lg relative overflow-hidden">
            {timeMarkers.map((marker, index) => (
              <div
                key={index}
                className="absolute top-0 bottom-0 border-l border-white/20"
                style={{ left: marker.position }}
              >
                <div className="absolute -top-6 left-0 transform -translate-x-1/2 text-xs text-white/60">
                  {marker.time}
                </div>
              </div>
            ))}
            <div className="absolute top-2 left-2 right-2 h-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded"></div>
          </div>
        </div>

        {/* タイムライン */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {data.activities.map((user) => (
            <div key={user.userId} className="relative">
              {/* ユーザー情報 */}
              <div 
                className={`flex items-center mb-2 cursor-pointer p-2 rounded-lg transition-colors ${
                  selectedUser === user.userId ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onClick={() => setSelectedUser(selectedUser === user.userId ? null : user.userId)}
              >
                <div className="mr-3">
                  {user.avatar ? (
                    <img 
                      src={`https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=32`}
                      alt={user.username}
                      className="w-8 h-8 rounded-full border border-white/20"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">{user.username}</div>
                  <div className="text-white/60 text-sm">
                    {user.sessions.length}セッション • 
                    総計{formatDuration(user.sessions.reduce((sum, s) => sum + s.duration, 0))}
                  </div>
                </div>
                <div className="text-white/40">
                  {selectedUser === user.userId ? '▼' : '▶'}
                </div>
              </div>

              {/* セッションバー */}
              <div className="relative h-8 bg-white/5 rounded-lg mb-3 overflow-hidden">
                {user.sessions.map((session, sessionIndex) => {
                  const position = getSessionPosition(session);
                  const sessionId = `${user.userId}-${sessionIndex}`;
                  
                  return (
                    <div
                      key={sessionIndex}
                      className={`absolute top-1 bottom-1 rounded transition-all duration-200 cursor-pointer ${
                        session.isActive 
                          ? 'bg-gradient-to-r from-green-500 to-green-600 shadow-lg' 
                          : session.isSessionStarter
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 shadow-md'
                          : 'bg-gradient-to-r from-gray-500 to-gray-600'
                      } ${hoveredSession === sessionId ? 'scale-y-125 shadow-xl' : ''}`}
                      style={position}
                      onMouseEnter={() => setHoveredSession(sessionId)}
                      onMouseLeave={() => setHoveredSession(null)}
                    >
                      {/* ツールチップ */}
                      {hoveredSession === sessionId && (
                        <SessionTooltip session={session} user={user} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 詳細セッション情報（展開時） */}
              {selectedUser === user.userId && (
                <div className="ml-11 mb-4 space-y-2">
                  {user.sessions.map((session, sessionIndex) => (
                    <div key={sessionIndex} className="bg-white/5 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400">#{session.channelName}</span>
                          {session.isSessionStarter && (
                            <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs">開始者</span>
                          )}
                          {session.isActive && (
                            <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">接続中</span>
                          )}
                        </div>
                        <div className="text-white/60">{formatDuration(session.duration)}</div>
                      </div>
                      <div className="text-white/60 text-xs">
                        {formatTime(session.joinTime)} 〜 {session.leaveTime ? formatTime(session.leaveTime) : '接続中'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 凡例 */}
      <div className="px-6 pb-6">
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-white/80 text-sm font-medium mb-2">凡例</div>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded"></div>
              <span className="text-white/70">通話開始者</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 bg-gradient-to-r from-gray-500 to-gray-600 rounded"></div>
              <span className="text-white/70">通常参加</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 bg-gradient-to-r from-green-500 to-green-600 rounded"></div>
              <span className="text-white/70">接続中</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;