import React, { useState, useEffect } from "react";
import {
  fetchNotifications,
  fetchSessions,
  fetchLiveStatus,
} from "../../utils/api";
import { calculateDuration, formatDate } from "../../utils/datetime";
import type {
  Guild,
  NotificationSetting,
  VoiceSession,
  LiveStatus,
} from "../../types/discord";

// このコンポーネント専用のProps型
interface OverviewTabProps {
  guilds: Guild[];
  selectedGuild: string;
  selectedGuildData?: Guild;
  showResult: (message: string, type: "success" | "error") => void;
  loadData: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  selectedGuild,
  selectedGuildData,
  showResult,
}) => {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationSetting[]>([]);
  const [recentSessions, setRecentSessions] = useState<VoiceSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<VoiceSession[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);

  console.log(activeSessions);

  // データ取得
  useEffect(() => {
    if (selectedGuild) {
      loadOverviewData();
    }
  }, [selectedGuild]);

  const loadOverviewData = async () => {
    if (!selectedGuild) return;

    try {
      setLoading(true);

      // 並行してデータを取得
      const [
        notificationsData,
        recentSessionsData,
        activeSessionsData,
        liveStatusData,
      ] = await Promise.all([
        fetchNotifications(selectedGuild),
        fetchSessions({ guildId: selectedGuild, limit: 30 }),
        fetchSessions({ guildId: selectedGuild, active: true }),
        fetchLiveStatus(selectedGuild),
      ]);

      setNotifications(notificationsData.notifications || []);
      setRecentSessions(recentSessionsData.sessions || []);
      setActiveSessions(activeSessionsData.sessions || []);
      setLiveStatus(liveStatusData);
    } catch (error) {
      console.error("概要データの取得に失敗:", error);
      showResult("概要データの取得に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white/70">サーバー概要を読み込み中...</p>
      </div>
    );
  }

  if (!selectedGuildData) {
    return (
      <div className="text-center py-12">
        <p className="text-white/70">サーバーが選択されていません</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* サーバー基本情報 */}
      <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-6 border border-blue-400/30">
        <div className="flex items-center gap-4 mb-4">
          {selectedGuildData.icon ? (
            <img
              src={selectedGuildData.icon}
              alt={selectedGuildData.name}
              className="w-16 h-16 rounded-full border-2 border-white/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
              <span className="text-2xl font-bold text-white">
                {selectedGuildData.name.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-white">
              {selectedGuildData.name}
            </h2>
            <p className="text-white/70">
              👥 {selectedGuildData.memberCount}人
              {liveStatus && (
                <span className="ml-2">
                  • 🟢 {liveStatus.guild.onlineCount}人オンライン
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {selectedGuildData.textChannels?.length || 0}
            </div>
            <div className="text-white/70 text-sm">テキストチャンネル</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {selectedGuildData.voiceChannels?.length || 0}
            </div>
            <div className="text-white/70 text-sm">ボイスチャンネル</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {liveStatus?.stats.activeVoiceChannels || 0}
            </div>
            <div className="text-white/70 text-sm">アクティブ通話</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {liveStatus?.stats.totalUsersInVoice || 0}
            </div>
            <div className="text-white/70 text-sm">通話参加中</div>
          </div>
        </div>
      </div>

      {/* 最近の通話履歴 */}
      <div className="bg-white/10 rounded-xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          📊 最近の通話履歴
        </h3>

        {recentSessions.length > 0 ? (
          <div>
            {/* 固定ヘッダー */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left text-white/70 py-2">チャンネル</th>
                    <th className="text-left text-white/70 py-2">開始時刻</th>
                    <th className="text-left text-white/70 py-2">終了時刻</th>
                    <th className="text-left text-white/70 py-2">通話時間</th>
                    <th className="text-left text-white/70 py-2">状態</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* スクロール可能ボディ */}
            <div className="max-h-80 overflow-y-auto thin-scrollbar">
              <table className="w-full">
                <tbody>
                  {recentSessions.map((session) => {
                    const channel = selectedGuildData.voiceChannels?.find(
                      (ch) => ch.id === session.channelId
                    );

                    return (
                      <tr key={session.id} className="border-b border-white/10">
                        <td className="py-3 text-white">
                          {channel?.name || "Unknown Channel"}
                        </td>
                        <td className="py-3 text-white/70 text-sm">
                          {formatDate(session.startTime)}
                        </td>
                        <td className="py-3 text-white/70 text-sm">
                          {session.endTime ? formatDate(session.endTime) : "-"}
                        </td>
                        <td className="py-3 text-white/70 text-sm">
                          {calculateDuration(
                            session.startTime,
                            session.endTime
                          )}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              session.isActive
                                ? "bg-green-500/20 text-green-400"
                                : "bg-gray-500/20 text-gray-400"
                            }`}
                          >
                            {session.isActive ? "進行中" : "終了"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-white/50">通話履歴がありません</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* アクティブな通話 */}
        <div className="bg-white/10 rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🔊 アクティブな通話
          </h3>

          {liveStatus &&
          liveStatus.voiceChannels.filter((ch) => ch.isActive).length > 0 ? (
            <div className="space-y-3">
              {liveStatus.voiceChannels
                .filter((ch) => ch.isActive)
                .map((channel) => (
                  <div key={channel.id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-white">
                        {channel.name}
                      </h4>
                      <span className="text-green-400 text-sm">
                        {channel.memberCount}人参加中
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {channel.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1"
                        >
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt={member.displayName}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                              <span className="text-xs text-white">
                                {member.displayName.charAt(0)}
                              </span>
                            </div>
                          )}
                          <span className="text-white/80 text-sm">
                            {member.displayName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-white/50">現在アクティブな通話はありません</p>
          )}
        </div>

        {/* 通知設定 */}
        <div className="bg-white/10 rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🔔 通知設定
          </h3>

          {notifications.length > 0 ? (
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notification) => {
                const voiceChannel = selectedGuildData.voiceChannels?.find(
                  (ch) => ch.id === notification.voiceChannelId
                );
                const textChannel = selectedGuildData.textChannels?.find(
                  (ch) => ch.id === notification.textChannelId
                );

                return (
                  <div
                    key={notification.id}
                    className="bg-white/5 rounded-lg p-3"
                  >
                    <div className="text-white/80 text-sm">
                      🎤{" "}
                      <span className="font-medium">
                        {voiceChannel?.name || "Unknown"}
                      </span>
                      <br />
                      💬{" "}
                      <span className="text-white/60">
                        {textChannel?.name || "Unknown"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {notifications.length > 5 && (
                <p className="text-white/50 text-sm">
                  他 {notifications.length - 5}件の設定
                </p>
              )}
            </div>
          ) : (
            <p className="text-white/50">通知設定がありません</p>
          )}
        </div>
      </div>

      {/* オンラインメンバー */}
      {liveStatus && liveStatus.onlineMembers.length > 0 && (
        <div className="bg-white/10 rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🟢 オンラインメンバー
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveStatus.onlineMembers.slice(0, 12).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 bg-white/5 rounded-lg p-3"
              >
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.displayName}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                    <span className="text-white font-bold">
                      {member.displayName.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {member.displayName}
                  </div>
                  <div className="text-white/50 text-xs">
                    {member.activity || member.status}
                  </div>
                </div>
                <div
                  className={`w-3 h-3 rounded-full ${
                    member.status === "online"
                      ? "bg-green-500"
                      : member.status === "idle"
                      ? "bg-yellow-500"
                      : member.status === "dnd"
                      ? "bg-red-500"
                      : "bg-gray-500"
                  }`}
                ></div>
              </div>
            ))}
            {liveStatus.onlineMembers.length > 12 && (
              <div className="flex items-center justify-center bg-white/5 rounded-lg p-3">
                <span className="text-white/70">
                  他 {liveStatus.onlineMembers.length - 12}人
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* リフレッシュボタン */}
      <div className="text-center">
        <button
          onClick={loadOverviewData}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg transition-colors"
        >
          {loading ? "更新中..." : "🔄 最新情報に更新"}
        </button>
      </div>
    </div>
  );
};

export default OverviewTab;
