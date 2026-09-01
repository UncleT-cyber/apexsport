import { useState } from 'react'
import { SettingsSidebar } from './SettingsSidebar'
import { AccountSettings } from './AccountSettings'
import { ProfileSettings } from './ProfileSettings'
import { StrategySettings } from './StrategySettings'
import { RiskSettings } from './RiskSettings'
import { MarketDataSettings } from './MarketDataSettings'
import { AISettings } from './AISettings'
import { SportsbooksSettings } from './SportsbooksSettings'
import { NotificationSettings } from './NotificationSettings'
import { DistributionSettings } from './DistributionSettings'
import { IntegrationSettings } from './IntegrationSettings'
import { SubscriptionSettings } from './SubscriptionSettings'
import { SecuritySettings } from './SecuritySettings'
import { SessionSettings } from './SessionSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { AdvancedSettings } from './AdvancedSettings'

export type SettingsSection =
  | 'account' | 'profile' | 'strategy' | 'risk' | 'market-data'
  | 'ai' | 'sportsbooks' | 'notifications' | 'distribution' | 'integrations'
  | 'subscription' | 'security' | 'session' | 'appearance' | 'advanced'

const SECTIONS: Record<SettingsSection, React.ComponentType> = {
  account: AccountSettings,
  profile: ProfileSettings,
  strategy: StrategySettings,
  risk: RiskSettings,
  'market-data': MarketDataSettings,
  ai: AISettings,
  sportsbooks: SportsbooksSettings,
  notifications: NotificationSettings,
  distribution: DistributionSettings,
  integrations: IntegrationSettings,
  subscription: SubscriptionSettings,
  security: SecuritySettings,
  session: SessionSettings,
  appearance: AppearanceSettings,
  advanced: AdvancedSettings,
}

export function SettingsLayout() {
  const [active, setActive] = useState<SettingsSection>('account')
  const Content = SECTIONS[active]
  return (
    <div className="flex h-full">
      <SettingsSidebar active={active} onSelect={setActive} />
      <div className="flex-1 overflow-auto p-6">
        <Content />
      </div>
    </div>
  )
}
