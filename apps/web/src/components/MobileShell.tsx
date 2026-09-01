import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { useSlipCart } from '../services/slipCart'
import { useWebSocket } from '../hooks/useWebSocket'
import { usePolling } from '../hooks/usePolling'
import { pageFromPath, mobileNavRoutes, moreMenuRoutes, type AppPage } from '../config/routeConfig'
import clsx from 'clsx'
import { LayoutDashboard, ScanSearch, Trophy, ShoppingCart, MoreHorizontal, Plus, Minus } from 'lucide-react'
import { Copilot } from '../components/Copilot'
import { MobileMoreMenu } from './MobileMoreMenu'

const ICON_MAP: Record<string, any> = {
  dashboard: LayoutDashboard,
  scanner: ScanSearch,
  predictions: Trophy,
  slips: ShoppingCart,
}

export function MobileShell() {
  const [page, setPage] = useState<AppPage>('dashboard')
  const [moreOpen, setMoreOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const { count: slipCount } = useSlipCart()
  const { user, logout, isAdmin } = useAuth()
  const navHook = useNavigate()
  const loc = useLocation()
  const { connected: wsConnected } = useWebSocket()
  const { data: health } = usePolling(() => fetch('/health').then(r => r.json().catch(() => null)), 5000)
  const connected = wsConnected || !!health

  useEffect(() => {
    const p = pageFromPath(loc.pathname)
    setPage(p)
  }, [loc.pathname])

  useEffect(() => {
    const h = (e: any) => {
      const d = e.detail
      if (d === 'copilot') { setCopilotOpen(true); return }
      const p = pageFromPath(`/app/${d}`)
      navHook(`/app/${d}`)
      setPage(p)
    }
    document.addEventListener('apex:navigate' as any, h)
    return () => document.removeEventListener('apex:navigate' as any, h)
  }, [])

  const go = (pg: AppPage) => {
    if (pg === 'admin') navHook('/admin')
    else navHook(`/app/${pg}`)
    setPage(pg)
    setMoreOpen(false)
  }

  return (
    <div className="mobile-shell flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Status bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center">
            <Trophy size={11} className="text-emerald-400" />
          </div>
          <span className="text-xs font-bold tracking-wider text-white">APEXSPORT</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={clsx('w-1.5 h-1.5 rounded-full', connected ? 'bg-emerald-400' : 'bg-red-400')} />
          <span className="text-[9px] text-gray-500">{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Page content */}
      <main className="flex-1 overflow-auto min-h-0 pb-20">
        <Routes>
          <Route path="dashboard" element={<DashboardMobile />} />
          <Route path="scanner" element={<ScannerMobile />} />
          <Route path="predictions" element={<PredictionsMobile />} />
          <Route path="slips" element={<SlipsMobile />} />
          <Route path="analytics" element={<LazyLoadPage page="analytics" />} />
          <Route path="backtest" element={<LazyLoadPage page="backtest" />} />
          <Route path="settings/*" element={<LazyLoadPage page="settings" />} />
          <Route path="profile" element={<LazyLoadPage page="profile" />} />
          <Route path="" element={<DashboardMobile />} />
        </Routes>
      </main>

      {/* Floating bottom nav capsule */}
      <div className="mobile-nav-capsule">
        <div className="flex items-center justify-around px-2 py-1.5">
          {mobileNavRoutes.map(r => {
            const Icon = ICON_MAP[r.page] || r.icon
            const active = page === r.page
            const isSlip = r.page === 'slips'
            return (
              <button
                key={r.page}
                onClick={() => go(r.page)}
                className={clsx(
                  'mobile-nav-item relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all',
                  active
                    ? 'bg-emerald-600/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className={clsx('text-[9px] font-medium', active ? 'text-emerald-400' : 'text-gray-500')}>
                  {r.shortLabel}
                </span>
                {isSlip && slipCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center">
                    {slipCount}
                  </span>
                )}
              </button>
            )
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={clsx(
              'mobile-nav-item flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all',
              moreOpen ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            <MoreHorizontal size={20} strokeWidth={1.5} />
            <span className="text-[9px] font-medium">More</span>
          </button>
        </div>
      </div>

      {/* Copilot FAB — above nav */}
      <MobileCopilotFab isOpen={copilotOpen} onToggle={() => setCopilotOpen(!copilotOpen)} />

      {/* More menu overlay */}
      {moreOpen && (
        <MobileMoreMenu
          routes={moreMenuRoutes}
          isAdmin={isAdmin}
          onNavigate={go}
          onClose={() => setMoreOpen(false)}
          onCopilot={() => { setMoreOpen(false); setCopilotOpen(true) }}
          user={user}
          logout={logout}
        />
      )}

      {/* Copilot panel */}
      {copilotOpen && <Copilot mobileOverride />}
    </div>
  )
}

/* ── Lazy page loader for non-primary routes ── */
function LazyLoadPage({ page }: { page: string }) {
  const [Component, setComponent] = useState<any>(null)
  useEffect(() => {
    const loaders: Record<string, () => Promise<any>> = {
      analytics: () => import('../pages/AnalyticsPage'),
      backtest: () => import('../pages/BacktestingPage'),
      settings: () => import('../pages/Settings/SettingsPage'),
      profile: () => import('../pages/ProfilePage'),
    }
    loaders[page]?.().then(m => {
      const comp = m.default || m.AnalyticsPage || m.BacktestingPage || m.SettingsPage || m.ProfilePage
      if (comp) setComponent(() => comp)
    }).catch(() => {})
  }, [page])
  if (!Component) return <div className="p-6 text-xs text-gray-500 text-center">Loading…</div>
  return <Component />
}

/* ── Mobile Dashboard ── */
function DashboardMobile() {
  const [sport, setSport] = useState<'football' | 'basketball'>('football')
  const { data: scanner } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/scanner/state?sport=${sport}`).then(r => r.json().catch(() => null))), 3000)
  const { data: predsData } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/predictions?sport=${sport}&limit=10`).then(r => r.json().catch(() => null))), 4000)
  const { data: calib } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/analytics/calibration?sport=${sport}`).then(r => r.json().catch(() => null))), 6000)
  const { data: live } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/live?sport=${sport}`).then(r => r.json().catch(() => null))), 5000)

  const scannerState: any = scanner
  const predictions: any[] = predsData?.predictions || scannerState?.recent_predictions || []
  const liveFixtures: any[] = live?.live || []
  const isScanning = !!scannerState?.is_scanning

  const toggleScan = async () => {
    if (isScanning) return
    const { authFetch } = await import('../services/auth')
    await authFetch(`/api/scanner/scan-now?sport=${sport}`, { method: 'POST' })
  }

  return (
    <div className="p-4 space-y-4">
      {/* Sport selector */}
      <div className="flex items-center gap-2">
        {['football', 'basketball'].map(s => (
          <button
            key={s}
            onClick={() => setSport(s as any)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider transition',
              sport === s ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-gray-400'
            )}
          >
            {s === 'football' ? '⚽ Football' : '🏀 Basketball'}
          </button>
        ))}
        <button
          onClick={toggleScan}
          disabled={isScanning}
          className={clsx(
            'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold',
            isScanning ? 'bg-gray-800 text-gray-500' : 'bg-emerald-600 text-white'
          )}
        >
          {isScanning ? '● SCANNING' : '▶ SCAN'}
        </button>
      </div>

      {/* Horizontal scrolling metric cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        <MetricScrollCard label="PREDICTIONS" value={String(scannerState?.predictions_generated || 0)} color="text-emerald-400" />
        <MetricScrollCard label="LIVE" value={String(liveFixtures.length)} color={liveFixtures.length ? 'text-red-400' : 'text-gray-500'} />
        <MetricScrollCard label="VALUE" value={String(scannerState?.value_opportunities || 0)} color="text-emerald-400" />
        <MetricScrollCard label="CALIBRATION" value={calib?.brier_score != null ? calib.brier_score.toFixed(2) : '—'} />
        <MetricScrollCard label="STATUS" value={isScanning ? 'SCAN' : 'IDLE'} color={isScanning ? 'text-emerald-400' : 'text-gray-500'} />
      </div>

      {/* Recent predictions as cards */}
      <div>
        <h3 className="text-[10px] tracking-widest text-gray-500 font-bold mb-2">RECENT INTELLIGENCE</h3>
        {predictions.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="text-sm text-gray-500 mb-1">No predictions yet</div>
            <div className="text-[11px] text-gray-600">Tap <span className="text-emerald-400">SCAN</span> to generate intelligence</div>
          </div>
        ) : (
          <div className="space-y-2">
            {predictions.slice(0, 6).map((p: any) => (
              <MobilePredictionCard key={(p.id || p.fixture_id) + p.selection} pred={p} />
            ))}
          </div>
        )}
      </div>

      {/* Live fixtures */}
      {liveFixtures.length > 0 && (
        <div>
          <h3 className="text-[10px] tracking-widest text-gray-500 font-bold mb-2">LIVE NOW</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {liveFixtures.map((f: any) => (
              <div key={f.id} className="flex-shrink-0 w-48 p-2.5 rounded-xl border border-red-800/30 bg-red-950/20 snap-start">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-[9px] text-red-400 font-bold">LIVE</span>
                </div>
                <div className="text-xs font-bold text-white truncate">{f.label || f.home_team}</div>
                <div className="text-[10px] text-gray-500">{f.competition}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Mobile Scanner ── */
function ScannerMobile() {
  const [sport, setSport] = useState<'football' | 'basketball'>('football')
  const [league, setLeague] = useState('All Leagues')
  const [leagues, setLeagues] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<any>(null)

  useEffect(() => {
    import('../services/auth').then(m => m.authFetch(`/api/scanner/leagues?sport=${sport}`).then(r => r.json()).then(d => setLeagues(d.leagues || [])).catch(() => {}))
  }, [sport])

  useEffect(() => {
    const poll = async () => {
      const { authFetch } = await import('../services/auth')
      const r = await authFetch(`/api/scanner/state?sport=${sport}&league=${encodeURIComponent(league)}`).then(r => r.json().catch(() => null))
      if (r) {
        setScanning(r.is_scanning)
        if (r.state === 'COMPLETE') setResults(r)
      }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [sport, league])

  const handleScan = async () => {
    const { authFetch } = await import('../services/auth')
    const r = await authFetch(`/api/scanner/scan-now?sport=${sport}&league=${encodeURIComponent(league)}`, { method: 'POST' })
    const d = await r.json()
    if (d.status === 'started') { setScanning(true); setResults(null) }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-bold tracking-wider text-white">SCANNER</h2>

      {/* Step 1: Sport */}
      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-gray-500 font-bold">1. SELECT SPORT</label>
        <div className="flex gap-2">
          {['football', 'basketball'].map(s => (
            <button
              key={s}
              onClick={() => { setSport(s as any); setLeague('All Leagues') }}
              className={clsx(
                'flex-1 py-2.5 rounded-xl text-xs font-bold transition border',
                sport === s
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-[var(--bg-secondary)] border-[var(--border)] text-gray-400'
              )}
            >
              {s === 'football' ? '⚽ Football' : '🏀 Basketball'}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: League */}
      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-gray-500 font-bold">2. SELECT LEAGUE</label>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {['All Leagues', ...leagues].map(l => (
            <button
              key={l}
              onClick={() => setLeague(l)}
              className={clsx(
                'flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition border',
                league === l
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-[var(--bg-secondary)] border-[var(--border)] text-gray-400'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Scan */}
      <button
        onClick={handleScan}
        disabled={scanning}
        className={clsx(
          'w-full py-3 rounded-xl text-sm font-bold tracking-wider transition',
          scanning ? 'bg-gray-800 text-gray-500' : 'bg-emerald-600 text-white active:bg-emerald-500'
        )}
      >
        {scanning ? '● SCANNING…' : '▶ START SCAN'}
      </button>

      {/* Results */}
      {results && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-center">
              <div className="text-[9px] text-gray-500">FIXTURES</div>
              <div className="text-lg font-bold text-white">{results.fixtures_total || 0}</div>
            </div>
            <div className="p-2.5 rounded-xl border border-emerald-800/30 bg-emerald-900/10 text-center">
              <div className="text-[9px] text-gray-500">PREDICTIONS</div>
              <div className="text-lg font-bold text-emerald-400">{results.predictions_generated || 0}</div>
            </div>
            <div className="p-2.5 rounded-xl border border-red-800/30 bg-red-900/10 text-center">
              <div className="text-[9px] text-gray-500">REJECTED</div>
              <div className="text-lg font-bold text-red-400">{results.candidates_rejected || 0}</div>
            </div>
          </div>

          {/* Prediction cards */}
          {results.recent_predictions?.length > 0 && (
            <div>
              <h3 className="text-[10px] tracking-widest text-gray-500 font-bold mb-2">RESULTS</h3>
              <div className="space-y-2">
                {results.recent_predictions.map((p: any, i: number) => (
                  <MobilePredictionCard key={i} pred={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Mobile Predictions ── */
function PredictionsMobile() {
  const [sport, setSport] = useState<'football' | 'basketball' | ''>('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const { add: slipAdd, has: slipHas, remove: slipRemove } = useSlipCart()

  const { data: predsData } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/predictions?sport=${sport || ''}&limit=30`).then(r => r.json().catch(() => null))), 4000)
  const predictions: any[] = predsData?.predictions || []

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-white">PREDICTIONS</h2>
        <span className="text-[10px] text-gray-500">{predictions.length} total</span>
      </div>

      {/* Sport filter pills */}
      <div className="flex gap-2">
        {[
          { value: '', label: 'All' },
          { value: 'football', label: '⚽ Football' },
          { value: 'basketball', label: '🏀 Basketball' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setSport(f.value as any)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-[11px] font-bold transition border',
              sport === f.value
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-[var(--bg-secondary)] border-[var(--border)] text-gray-400'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Predictions list */}
      {predictions.length === 0 ? (
        <div className="p-6 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="text-sm text-gray-500">No predictions yet</div>
          <div className="text-[11px] text-gray-600 mt-1">Run a scan to generate intelligence</div>
        </div>
      ) : (
        <div className="space-y-2">
          {predictions.map((p: any) => {
            const pid = p.id || p.fixture_id
            const isExpanded = expanded === pid
            const inSlip = slipHas(pid)
            return (
              <div key={pid + p.selection} className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
                {/* Card header */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : pid)}
                  className="p-3 cursor-pointer active:bg-[var(--bg-tertiary)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{p.fixture_label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{p.competition}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={clsx(
                        'text-[10px] font-bold px-2 py-0.5 rounded-lg',
                        p.selection === 'HOME' ? 'bg-emerald-900/30 text-emerald-400' :
                        p.selection === 'AWAY' ? 'bg-red-900/30 text-red-400' :
                        'bg-yellow-900/30 text-yellow-400'
                      )}>{p.selection}</span>
                      <span className="text-sm font-bold text-white">{((p.calibrated_probability || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Compact metrics */}
                  <div className="flex items-center gap-3 mt-2 text-[10px]">
                    <span className="text-gray-500">Odds <span className="text-white font-mono">{p.market_odds?.toFixed(2)}</span></span>
                    <span className="text-gray-500">Edge <span className={clsx('font-mono', (p.edge || 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>{((p.edge || 0) * 100).toFixed(1)}%</span></span>
                    <span className={clsx(
                      'px-1.5 py-0.5 rounded text-[9px] font-bold',
                      p.risk_level === 'LOW' ? 'bg-emerald-900/20 text-emerald-400' : 'bg-yellow-900/20 text-yellow-400'
                    )}>{p.risk_level}</span>
                    {p.is_value && <span className="px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 text-[9px] font-bold">VALUE</span>}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-[var(--border)] pt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded-lg bg-[var(--bg-primary)]">
                        <div className="text-gray-500">PROBABILITY</div>
                        <div className="text-white font-mono mt-0.5">{(p.probability * 100).toFixed(1)}%</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--bg-primary)]">
                        <div className="text-gray-500">CALIBRATED</div>
                        <div className="text-emerald-400 font-mono mt-0.5">{(p.calibrated_probability * 100).toFixed(1)}%</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--bg-primary)]">
                        <div className="text-gray-500">EXPECTED VALUE</div>
                        <div className={clsx('font-mono mt-0.5', (p.expected_value || 0) > 0 ? 'text-emerald-400' : 'text-gray-400')}>{p.expected_value?.toFixed(3)}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--bg-primary)]">
                        <div className="text-gray-500">FAIR ODDS</div>
                        <div className="text-white font-mono mt-0.5">{p.fair_odds}</div>
                      </div>
                    </div>
                    {p.prompt_paths && (
                      <div className="text-[9px] font-mono text-gray-600 truncate">Prompt: {Object.values(p.prompt_paths).join(' • ').slice(0, 80)}</div>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (inSlip) { slipRemove(pid) } else { await slipAdd(p) }
                      }}
                      className={clsx(
                        'w-full py-2 rounded-xl text-xs font-bold transition',
                        inSlip ? 'bg-emerald-900/30 border border-emerald-800/30 text-emerald-400' : 'bg-emerald-600 text-white active:bg-emerald-500'
                      )}
                    >
                      {inSlip ? '✓ IN MY SLIP — TAP TO REMOVE' : '+ ADD TO MY SLIP'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Mobile Slips ── */
function SlipsMobile() {
  const { items, remove, clear } = useSlipCart()
  const [building, setBuilding] = useState(false)
  const [builtSlip, setBuiltSlip] = useState<any>(null)

  const handleBuild = async () => {
    setBuilding(true)
    const { authFetch } = await import('../services/auth')
    const r = await authFetch('/api/slips/current/build', { method: 'POST' })
    const j = await r.json()
    setBuilding(false)
    if (j.slip) setBuiltSlip(j.slip)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-white">MY SLIP</h2>
        <span className="text-[10px] text-gray-500">{items.length} selection{items.length !== 1 ? 's' : ''}</span>
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]">
          <ShoppingCart size={32} className="text-gray-600 mx-auto mb-2" />
          <div className="text-sm text-gray-500 mb-1">Your slip is empty</div>
          <div className="text-[11px] text-gray-600">Browse Predictions and tap <span className="text-emerald-400">ADD TO SLIP</span></div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.predictionId} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{item.predictionId.slice(0, 16)}…</div>
                    <div className="text-[10px] text-gray-500">{item.sport || 'football'} • added {new Date(item.addedAt).toLocaleTimeString()}</div>
                  </div>
                  <button
                    onClick={() => remove(item.predictionId)}
                    className="px-2 py-1 rounded-lg bg-red-900/20 border border-red-800/30 text-red-400 text-[10px] font-bold"
                  >
                    REMOVE
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleBuild}
              disabled={building}
              className={clsx(
                'flex-1 py-3 rounded-xl text-sm font-bold transition',
                building ? 'bg-gray-800 text-gray-500' : 'bg-emerald-600 text-white active:bg-emerald-500'
              )}
            >
              {building ? 'BUILDING…' : 'BUILD SLIP'}
            </button>
            <button
              onClick={clear}
              className="px-4 py-3 rounded-xl border border-red-900/50 text-red-400 text-sm font-bold"
            >
              CLEAR
            </button>
          </div>

          {builtSlip && (
            <div className="p-3 rounded-xl border border-emerald-800/30 bg-emerald-900/10 space-y-2">
              <div className="text-[10px] tracking-widest text-emerald-400 font-bold">SLIP BUILT</div>
              <div className="text-xs text-white">{builtSlip.selections?.length || 0} legs • Odds {builtSlip.total_odds?.toFixed(2)}</div>
              <div className="text-[10px] text-gray-500">Risk: {builtSlip.risk_level || '—'} • {builtSlip.id}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Shared Components ── */
function MetricScrollCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-shrink-0 w-28 snap-start p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="text-[9px] text-gray-500 tracking-wider">{label}</div>
      <div className={clsx('text-lg font-bold mt-0.5', color || 'text-white')}>{value}</div>
    </div>
  )
}

function MobilePredictionCard({ pred }: { pred: any }) {
  const { add: slipAdd, has: slipHas, remove: slipRemove } = useSlipCart()
  const pid = pred.id || pred.fixture_id
  const inSlip = slipHas(pid)

  return (
    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-white truncate">{pred.fixture_label}</div>
          <div className="text-[10px] text-gray-500">{pred.competition}</div>
        </div>
        <span className="text-sm font-bold text-white ml-2">{((pred.calibrated_probability || 0) * 100).toFixed(0)}%</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-[10px] font-bold px-2 py-0.5 rounded-lg',
            pred.selection === 'HOME' ? 'bg-emerald-900/30 text-emerald-400' :
            pred.selection === 'AWAY' ? 'bg-red-900/30 text-red-400' :
            'bg-yellow-900/30 text-yellow-400'
          )}>{pred.selection}</span>
          <span className="text-[10px] text-gray-500">Odds {pred.market_odds?.toFixed(2)}</span>
          <span className={clsx(
            'text-[9px] px-1.5 py-0.5 rounded',
            pred.risk_level === 'LOW' ? 'bg-emerald-900/20 text-emerald-400' : 'bg-yellow-900/20 text-yellow-400'
          )}>{pred.risk_level}</span>
        </div>
        <button
          onClick={async (e) => {
            e.stopPropagation()
            if (inSlip) { slipRemove(pid) } else { await slipAdd(pred) }
          }}
          className={clsx(
            'px-2.5 py-1 rounded-lg text-[10px] font-bold transition',
            inSlip ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-600 text-white'
          )}
        >
          {inSlip ? '✓' : '+'}
        </button>
      </div>
    </div>
  )
}

/* ── Mobile Copilot FAB ── */
function MobileCopilotFab({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  if (isOpen) return null
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-24 right-4 z-30 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center active:scale-95 transition-transform"
    >
      <span className="text-white text-sm font-bold">◆</span>
      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
    </button>
  )
}
