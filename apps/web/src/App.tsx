import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { usePolling } from './hooks/usePolling'
import { DashboardPage } from './pages/DashboardPage'
import { ScannerPage } from './pages/ScannerPage'
import { PredictionsPage } from './pages/PredictionsPage'
import { SlipsPage } from './pages/SlipsPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { BacktestingPage } from './pages/BacktestingPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { MfaPage } from './pages/MfaPage'
import { RequestAccessPage } from './pages/RequestAccessPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { AdminPage } from './pages/AdminPage'
import { SlipCartProvider, useSlipCart } from './services/slipCart'
import { AuthProvider, useAuth } from './services/auth'
import clsx from 'clsx'
import { LayoutDashboard, ScanSearch, Zap, Settings, ChevronLeft, ChevronRight, User, Trophy, Settings as SettingsIcon, BarChart3, History, ShoppingCart, Sparkles } from 'lucide-react'
import { Copilot } from './components/Copilot'
import { MobileShell } from './components/MobileShell'
import { pageFromPath, routes, type AppPage } from './config/routeConfig'

function RequireAuth({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      nav('/login', { replace: true, state: { from: loc.pathname } })
    } else if (!loading && adminOnly && !isAdmin) {
      nav('/app', { replace: true })
    }
  }, [loading, isAuthenticated, isAdmin, adminOnly, nav, loc.pathname])
  if (loading) return <div className="min-h-screen bg-[#070a0f] flex items-center justify-center text-xs text-gray-500">Loading…</div>
  if (!isAuthenticated) return null
  if (adminOnly && !isAdmin) return <div className="p-6 text-sm text-red-400">Admin access required — redirecting…</div>
  return <>{children}</>
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (!loading && isAuthenticated) return <Navigate to="/app" replace />
  return <>{children}</>
}

/* ── useIsMobile hook ── */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mobile
}

/* ── Desktop Shell ── */
function DesktopShell() {
  const [page, setPage] = useState<AppPage>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const { connected: wsConnected } = useWebSocket()
  const { data: health } = usePolling(() => authFetch('/health').then(r=>r.json().catch(()=>null)), 5000)
  const connected = wsConnected || !!health
  const { count: slipCount } = useSlipCart()
  const { user, logout, isAdmin } = useAuth()
  const navHook = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    setPage(pageFromPath(loc.pathname))
  }, [loc.pathname])

  const go = (pg: AppPage) => {
    const route = routes.find(r => r.page === pg)
    if (route) navHook(route.path)
    setPage(pg)
  }

  useEffect(() => {
    const h = (e: any) => {
      const d = e.detail
      if (d === 'copilot') {
        document.dispatchEvent(new CustomEvent('apex:open-copilot' as any, { detail: { type: 'general' } }))
        return
      }
      if (routes.some(r => r.page === d)) go(d as AppPage)
    }
    document.addEventListener('apex:navigate' as any, h)
    return () => document.removeEventListener('apex:navigate' as any, h)
  }, [])

  const primaryNav = routes.filter(r => r.group === 'primary')
  const intelNav = [
    { label: 'Apex Copilot', action: () => document.dispatchEvent(new CustomEvent('apex:open-copilot' as any, { detail: { type: 'general' } })), icon: <Sparkles size={18} className="text-emerald-400 animate-pulse" /> },
  ]

  return (
    <div className="app-root">
      <aside className={clsx('desktop-sidebar sidebar bg-[var(--bg-secondary)] border-r border-[var(--border)]', collapsed && 'collapsed')}>
        <div className="p-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center flex-shrink-0"><Trophy size={11} className="text-emerald-400"/></div>
              <div className="sidebar-logo-text"><div className="text-sm font-bold tracking-wider text-white">APEXSPORT</div><div className="text-[9px] text-gray-500 tracking-widest">INTELLIGENCE PLATFORM</div></div>
            </div>
            <button onClick={()=>setCollapsed(!collapsed)} className="text-gray-500 hover:text-white p-1"><span>{collapsed?<ChevronRight size={14}/>:<ChevronLeft size={14}/>}</span></button>
          </div>
          <div className="flex flex-col gap-1.5 mt-2 sidebar-status-text">
            <div className="flex items-center gap-1.5"><div className={clsx('w-1.5 h-1.5 rounded-full', connected?'bg-emerald-400':'bg-red-400')}/><span className="text-[10px] text-gray-500">{connected?'CONNECTED':'DISCONNECTED'}</span></div>
            <span className="text-[9px] text-gray-600">FOOTBALL • BASKETBALL • SPORT-AGNOSTIC CORE</span>
          </div>
        </div>
        <nav className="flex-1 overflow-auto py-2">
          <div className="nav-group-label sidebar-status-text">INTEL</div>
          {primaryNav.map(r => {
            const Icon = r.icon
            return (
              <div key={r.page} onClick={()=>go(r.page)} className={clsx('nav-item mx-1.5 relative', page===r.page && 'active')}>
                <span className="flex-shrink-0"><Icon size={18}/></span><span className="nav-label">{r.label}</span>
                {r.page === 'slips' && slipCount > 0 && <span className="ml-auto bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{slipCount}</span>}
              </div>
            )
          })}
          <div className="nav-group-label sidebar-status-text mt-2">INTELLIGENCE</div>
          {intelNav.map(i=>(
            <div key={i.label} onClick={i.action} className="nav-item mx-1.5 border border-emerald-800/20 bg-emerald-900/10 hover:bg-emerald-900/20">
              <span className="flex-shrink-0">{i.icon}</span><span className="nav-label text-emerald-400">{i.label}</span><span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          ))}
          {slipCount > 0 && (
            <div className="mx-2 mt-2 p-2 rounded bg-emerald-900/20 border border-emerald-800/30 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold"><ShoppingCart size={12}/> MY SLIP • {slipCount} selection{slipCount!==1?'s':''}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Prediction → SlipSelection → Slip</div>
              <button onClick={() => go('slips')} className="mt-1.5 w-full py-1 rounded bg-emerald-600 text-white text-[10px] font-bold">VIEW MY SLIP →</button>
            </div>
          )}
        </nav>
        <div className="border-t border-[var(--border)] flex-shrink-0">
          <div className="p-1.5"><div onClick={()=>go('settings')} className={clsx('nav-item mx-1', page==='settings'&&'active')}><Settings size={18}/><span className="nav-label">Settings</span></div></div>
          {isAdmin && <div className="p-1.5 pt-0"><div onClick={()=>go('admin')} className={clsx('nav-item mx-1', page==='admin'&&'active')}><SettingsIcon size={18}/><span className="nav-label">Admin</span></div></div>}
          <div className="border-t border-[var(--border)] p-2 flex items-center justify-between">
            <div onClick={()=>go('profile')} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-tertiary)] rounded p-1.5 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-600/40 to-blue-600/40 border border-emerald-600/50 flex items-center justify-center flex-shrink-0 relative"><User size={14} className="text-emerald-200"/><div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[var(--bg-secondary)]"/></div>
              <div className="sidebar-profile-info min-w-0"><div className="text-[11px] text-white font-medium truncate">{user?.email || 'Apex User'}</div><div className="text-[9px] text-gray-500">{user?.role || 'USER'} • {user?.status}</div></div>
            </div>
            <button onClick={()=> { logout(); window.location.href='/login' }} className="text-[10px] text-gray-500 hover:text-red-400 px-1" title="Logout">↪</button>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        <Routes>
          <Route path="dashboard" element={<DashboardPage/>} />
          <Route path="scanner" element={<ScannerPage/>} />
          <Route path="predictions" element={<PredictionsPage/>} />
          <Route path="slips" element={<SlipsPage/>} />
          <Route path="analytics" element={<AnalyticsPage/>} />
          <Route path="backtest" element={<BacktestingPage/>} />
          <Route path="settings/*" element={<SettingsPage/>} />
          <Route path="profile" element={<ProfilePage/>} />
          <Route path="admin" element={<AdminPage/>} />
          <Route path="" element={<DashboardPage/>} />
        </Routes>
      </main>
      <Copilot />
    </div>
  )
}

/* ── Responsive App Shell ── */
function AppShell() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileShell />
  return <DesktopShell />
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SlipCartProvider>
          <Routes>
            <Route path="/" element={<LandingPage/>} />
            <Route path="/login" element={<PublicOnly><LoginPage/></PublicOnly>} />
            <Route path="/mfa" element={<PublicOnly><MfaPage/></PublicOnly>} />
            <Route path="/request-access" element={<RequestAccessPage/>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage/>} />
            <Route path="/reset-password" element={<ResetPasswordPage/>} />
            <Route path="/app/*" element={<RequireAuth><AppShell/></RequireAuth>} />
            <Route path="/app" element={<RequireAuth><AppShell/></RequireAuth>} />
            <Route path="/admin/*" element={<RequireAuth adminOnly><AdminPage/></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth adminOnly><AdminPage/></RequireAuth>} />
            {/* Legacy protected routes redirect to /app */}
            <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/scanner" element={<Navigate to="/app/scanner" replace />} />
            <Route path="/predictions" element={<Navigate to="/app/predictions" replace />} />
            <Route path="/slips" element={<Navigate to="/app/slips" replace />} />
            <Route path="/analytics" element={<Navigate to="/app/analytics" replace />} />
            <Route path="/backtest" element={<Navigate to="/app/backtest" replace />} />
            <Route path="/settings/*" element={<Navigate to="/app/settings" replace />} />
            <Route path="*" element={<LandingPage/>} />
          </Routes>
        </SlipCartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
