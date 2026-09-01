import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { type AppPage, type RouteDef } from '../config/routeConfig'
import { X, Sparkles, BarChart3, History, Settings, User, Shield, LogOut, ChevronRight, Activity } from 'lucide-react'

interface MobileMoreMenuProps {
  routes: RouteDef[]
  isAdmin: boolean
  onNavigate: (page: AppPage) => void
  onClose: () => void
  onCopilot: () => void
  user: any
  logout: () => void
}

const EXTRA_ITEMS = [
  { id: 'copilot', label: 'Apex Copilot', sublabel: 'AI intelligence assistant', icon: Sparkles, color: 'text-emerald-400', glow: true },
]

export function MobileMoreMenu({ routes, isAdmin, onNavigate, onClose, onCopilot, user, logout }: MobileMoreMenuProps) {
  const navHook = useNavigate()

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Menu sheet */}
      <div className="relative w-full bg-[var(--bg-secondary)] rounded-t-2xl border-t border-[var(--border)] max-h-[80vh] overflow-auto animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div>
            <div className="text-sm font-bold tracking-wider text-white">MENU</div>
            <div className="text-[10px] text-gray-500">Intelligence & settings</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Copilot — hero item */}
        <div className="px-4 pb-3">
          <button
            onClick={() => { onClose(); onCopilot() }}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-emerald-900/30 to-blue-900/20 border border-emerald-800/30 flex items-center gap-3 active:bg-emerald-900/40 transition"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center flex-shrink-0 animate-pulse">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-xs font-bold text-emerald-400">APEX COPILOT</div>
              <div className="text-[10px] text-gray-500">AI intelligence assistant • ask anything</div>
            </div>
            <ChevronRight size={14} className="text-gray-500 ml-auto flex-shrink-0" />
          </button>
        </div>

        {/* Account section */}
        <div className="px-4 pb-2">
          <div className="text-[9px] tracking-widest text-gray-500 font-bold mb-2">ACCOUNT</div>
          {/* User card */}
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600/40 to-blue-600/40 border border-emerald-600/50 flex items-center justify-center flex-shrink-0 relative">
                <span className="text-emerald-200 text-sm font-bold">{user?.email?.[0]?.toUpperCase() || 'A'}</span>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-primary)]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{user?.email || 'Apex User'}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-800/40 text-emerald-300 font-mono">{user?.role || 'USER'}</span>
                  <span className="text-[9px] text-gray-500">•</span>
                  <span className="text-[9px] text-gray-500">{user?.status || 'ACTIVE'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation items */}
        <div className="px-4 pb-2">
          <div className="text-[9px] tracking-widest text-gray-500 font-bold mb-2">NAVIGATION</div>
          <div className="space-y-1">
            {routes.filter(r => r.page !== 'admin' || isAdmin).map(r => {
              const Icon = r.icon
              return (
                <button
                  key={r.page}
                  onClick={() => onNavigate(r.page)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white">{r.label}</div>
                    <div className="text-[10px] text-gray-500">{r.page === 'analytics' ? 'Performance metrics & calibration' : r.page === 'backtest' ? 'Historical replay engine' : r.page === 'settings' ? 'Platform configuration' : r.page === 'profile' ? 'Your account identity' : 'System administration'}</div>
                  </div>
                  <ChevronRight size={14} className="text-gray-600 ml-auto flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Logout */}
        <div className="px-4 pb-6 pt-2">
          <button
            onClick={() => { logout(); navHook('/login') }}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-red-900/50 bg-red-900/10 text-red-400 text-xs font-bold active:bg-red-900/20 transition"
          >
            <LogOut size={14} />
            LOGOUT
          </button>
        </div>

        {/* Safe area bottom */}
        <div className="h-safe-bottom" />
      </div>
    </div>
  )
}
