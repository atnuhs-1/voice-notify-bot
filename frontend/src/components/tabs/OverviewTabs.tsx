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
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            {selectedGuildData.icon ? (
              <img
                src={selectedGuildData.icon}
                alt={selectedGuildData.name}
                className="w-16 h-16 rounded-full border-2 border-white/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                <span className="text-2xl font-bold ">
                  {selectedGuildData.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold ">{selectedGuildData.name}</h2>
              <p className="">
                👥 {selectedGuildData.memberCount}人
                {liveStatus && (
                  <span className="ml-2">
                    • 🟢 {liveStatus.guild.onlineCount}人オンライン
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white shadow-sm rounded-lg p-4 text-center">
            <div className="text-2xl font-bold mb-1">
              {selectedGuildData.textChannels?.length || 0}
            </div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <span>📄</span>
              テキストチャンネル
            </div>
          </div>
          <div className="bg-white shadow-sm rounded-lg p-4 text-center">
            <div className="text-2xl font-bold mb-1">
              {selectedGuildData.voiceChannels?.length || 0}
            </div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <span>🔊</span>
              ボイスチャンネル
            </div>
          </div>
          <div className="bg-white shadow-sm rounded-lg p-4 text-center">
            <div className="text-2xl font-bold mb-1">
              {liveStatus?.stats.activeVoiceChannels || 0}
            </div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <span>📄</span>
              アクティブ
            </div>
          </div>
          <div className="bg-white shadow-sm rounded-lg p-4 text-center">
            <div className="text-2xl font-bold mb-1">
              {liveStatus?.stats.totalUsersInVoice || 0}
            </div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <span>📄</span>
              わからぬ
            </div>
          </div>
        </div>

        {/* 最近の通話履歴 */}
        <div className="bg-white rounded-lg shadow-sm ">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-base font-semibold  text-gray-800 flex items-center gap-2">
              <span>📊</span>
              最近の通話履歴
            </h3>
          </div>

          {recentSessions.length > 0 ? (
            <div className="max-h-96 overflow-y-auto thin-scrollbar">
              {recentSessions.map((session) => {
                const channel = selectedGuildData.voiceChannels?.find(
                  (ch) => ch.id === session.channelId
                );

                return (
                  <div
                    key={session.id}
                    className="flex justify-between items-center px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <h4 className="text-base font-medium mb-0.5 text-gray-800">
                        {channel?.name || "Unknown Channel"}
                      </h4>
                      <div className="text-sm text-gray-500">
                        {formatDate(session.startTime) +
                          " - " +
                          (session.endTime ? formatDate(session.endTime) : "-")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-gray-800 mb-0.5">
                        {" "}
                        {calculateDuration(session.startTime, session.endTime)}
                      </div>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide">
                        {session.isActive ? "進行中" : "終了"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-2xl text-gray-500">通話履歴がありません</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* アクティブな通話 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-base font-semibold  text-gray-800 flex items-center gap-1.5">
              <span>🔊</span>
              アクティブな通話
            </h3>
          </div>

          {liveStatus &&
          liveStatus.voiceChannels.filter((ch) => ch.isActive).length > 0 ? (
            <div className="space-y-3">
              {liveStatus.voiceChannels
                .filter((ch) => ch.isActive)
                .map((channel) => (
                  <div key={channel.id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold ">{channel.name}</h4>
                      <span className="text-green-400 text-sm">
                        {channel.memberCount}人参加中
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {channel.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-/10 rounded-full px-3 py-1"
                        >
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt={member.displayName}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                              <span className="text-xs ">
                                {member.displayName.charAt(0)}
                              </span>
                            </div>
                          )}
                          <span className=" text-sm">{member.displayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="p-4">
              <div className="text-center py-5 text-gray-500">
                <div className="text-2xl mb-2 opacity-50">🔇</div>
                <div className="text-sm">アクティブな通話はありません</div>
              </div>
            </div>
          )}
        </div>

        {/* 通知設定 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-base font-semibold  text-gray-800 flex items-center gap-1.5">
              <span>🔔</span>
              通知設定
            </h3>
          </div>

          {notifications.length > 0 ? (
            <div className="p-4">
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
                    className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded mb-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-discord-green flex-shrink-0"></div>
                    <div className="flex-1">
                      <h5 className="text-sm font-medium mb-0.5 text-gray-800">
                        {voiceChannel?.name || "Unknown"}
                      </h5>
                      <div className="text-xs text-gray-500">{textChannel?.name || "Unknown"}</div>
                    </div>
                  </div>
                );
              })}
              {notifications.length > 5 && (
                <p className=" text-sm">
                  他 {notifications.length - 5}件の設定
                </p>
              )}
            </div>
          ) : (
            <p className="">通知設定がありません</p>
          )}
        </div>

        {/* オンラインメンバー */}
        {liveStatus && liveStatus.onlineMembers.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                    <div className="w-10 h-10 rounded-full flex items-center justify-center">
                      <span className=" font-bold">
                        {member.displayName.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {member.displayName}
                    </div>
                    <div className="text-xs">
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
                  <span className="">
                    他 {liveStatus.onlineMembers.length - 12}人
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
