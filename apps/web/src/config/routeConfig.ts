import { LayoutDashboard, ScanSearch, Trophy, ShoppingCart, BarChart3, History, Settings, Sparkles, User, Shield, LogOut, Activity } from 'lucide-react'

export type AppPage = 'dashboard' | 'scanner' | 'predictions' | 'slips' | 'analytics' | 'backtest' | 'settings' | 'profile' | 'admin'

export interface RouteDef {
  page: AppPage
  label: string
  shortLabel: string
  icon: any
  path: string
  group: 'primary' | 'intelligence' | 'account'
  mobileOrder?: number
}

export const routes: RouteDef[] = [
  { page: 'dashboard',    label: 'Dashboard',    shortLabel: 'Home',   icon: LayoutDashboard, path: '/app/dashboard',    group: 'primary',     mobileOrder: 0 },
  { page: 'scanner',      label: 'Scanner',      shortLabel: 'Scan',   icon: ScanSearch,     path: '/app/scanner',      group: 'primary',     mobileOrder: 1 },
  { page: 'predictions',  label: 'Predictions',  shortLabel: 'Picks',  icon: Trophy,         path: '/app/predictions',  group: 'primary',     mobileOrder: 2 },
  { page: 'slips',        label: 'My Slip',      shortLabel: 'Slip',   icon: ShoppingCart,   path: '/app/slips',        group: 'primary',     mobileOrder: 3 },
  { page: 'analytics',    label: 'Analytics',    shortLabel: 'Stats',  icon: BarChart3,      path: '/app/analytics',    group: 'intelligence' },
  { page: 'backtest',     label: 'Backtest',     shortLabel: 'Replay', icon: History,        path: '/app/backtest',     group: 'intelligence' },
  { page: 'settings',     label: 'Settings',     shortLabel: 'Config', icon: Settings,       path: '/app/settings',     group: 'account' },
  { page: 'profile',      label: 'Profile',      shortLabel: 'Me',     icon: User,           path: '/app/profile',      group: 'account' },
  { page: 'admin',        label: 'Admin',        shortLabel: 'Admin',  icon: Shield,         path: '/admin',            group: 'account' },
]

export const mobileNavRoutes = routes.filter(r => r.group === 'primary').sort((a, b) => (a.mobileOrder ?? 99) - (b.mobileOrder ?? 99))

export const moreMenuRoutes = routes.filter(r => r.group !== 'primary')

export function pageFromPath(pathname: string): AppPage {
  const clean = pathname.replace('/app', '').replace('/', '') || 'dashboard'
  if (routes.some(r => r.page === clean)) return clean as AppPage
  if (clean.startsWith('settings')) return 'settings'
  return 'dashboard'
}

export function pathFromPage(page: AppPage): string {
  const route = routes.find(r => r.page === page)
  return route?.path || '/app/dashboard'
}
