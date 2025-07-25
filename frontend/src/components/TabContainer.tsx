import OverviewTab from './tabs/OverviewTabs'
import MessageTab from './tabs/MessageTab'
import ChannelTab from './tabs/ChannelTab'
import MembersTab from './tabs/MembersTab'
import VoiceTab from './tabs/VoiceTab'

const TAB_COMPONENTS = {
  overview: OverviewTab,
  messages: MessageTab,
  channels: ChannelTab,
  members: MembersTab,
  voice: VoiceTab
} as const

interface TabContainerProps {
  activeTab: string
  guilds: any[]
  selectedGuild: string
  selectedGuildData: any
  showResult: (message: string, type: 'success' | 'error') => void
  loadData: () => void
  stats: any
  setSelectedGuild: (guildId: string) => void
}

const TabContainer: React.FC<TabContainerProps> = ({ activeTab, ...tabProps }) => {
  const TabComponent = TAB_COMPONENTS[activeTab as keyof typeof TAB_COMPONENTS] || OverviewTab
  return <TabComponent {...tabProps} />
}

export default TabContainer