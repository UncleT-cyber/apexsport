import clsx from 'clsx'
import type { SettingsSection } from './SettingsLayout'
import {
  User, Shield, Trophy, Brain, Building2,
  Bell, Send, Puzzle, CreditCard, Lock, Palette,
  Sliders, Target, Settings, LogOut,
} from 'lucide-react'

interface NavItem {
  id: SettingsSection
  label: string
  icon: React.ReactNode
  group: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'account', label: 'Account', icon: <User size={16} />, group: 'ACCOUNT' },
  { id: 'profile', label: 'Profile', icon: <User size={16} />, group: 'ACCOUNT' },
  { id: 'strategy', label: 'Strategy', icon: <Target size={16} />, group: 'INTELLIGENCE' },
  { id: 'risk', label: 'Risk', icon: <Shield size={16} />, group: 'INTELLIGENCE' },
  { id: 'market-data', label: 'Market Data', icon: <Trophy size={16} />, group: 'DATA & AI' },
  { id: 'ai', label: 'AI & Models', icon: <Brain size={16} />, group: 'DATA & AI' },
  { id: 'sportsbooks', label: 'Sportsbooks', icon: <Building2 size={16} />, group: 'CONNECTIONS' },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} />, group: 'CONNECTIONS' },
  { id: 'distribution', label: 'Distribution', icon: <Send size={16} />, group: 'CONNECTIONS' },
  { id: 'integrations', label: 'Integrations', icon: <Puzzle size={16} />, group: 'CONNECTIONS' },
  { id: 'subscription', label: 'Subscription', icon: <CreditCard size={16} />, group: 'SYSTEM' },
  { id: 'security', label: 'Security', icon: <Lock size={16} />, group: 'SYSTEM' },
  { id: 'session', label: 'Session', icon: <LogOut size={16} />, group: 'SYSTEM' },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} />, group: 'SYSTEM' },
  { id: 'advanced', label: 'Advanced', icon: <Sliders size={16} />, group: 'SYSTEM' },
]

export function SettingsSidebar({ active, onSelect }: { active: SettingsSection; onSelect: (id: SettingsSection) => void }) {
  const groups = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ||= []).push(item)
    return acc
  }, {})
  return (
    <div className="w-48 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex-shrink-0 overflow-auto">
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-gray-500" />
          <span className="text-xs font-bold tracking-wider text-gray-400">SETTINGS</span>
        </div>
      </div>
      <nav className="py-2">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="px-3 py-1 text-[9px] font-bold tracking-wider text-gray-600 uppercase">{group}</div>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                  active === item.id
                    ? 'bg-[var(--bg-tertiary)] text-white border-l-2 border-emerald-500'
                    : 'text-gray-400 hover:text-white hover:bg-[var(--bg-tertiary)] border-l-2 border-transparent'
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </div>
  )
}
