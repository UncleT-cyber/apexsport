import { useState, useEffect, useCallback, useRef } from 'react'
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
  const { data: health } = usePolling(() => import('../services/auth').then(m => m.authFetch('/health').then(r => r.json().catch(() => null))), 5000)
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

/* ── Mobile Dashboard — full feature parity ── */
function DashboardMobile() {
  const [sport, setSport] = useState<'football' | 'basketball'>('football')
  const [activeFixtureId, setActiveFixtureId] = useState('')
  const [selectedPred, setSelectedPred] = useState<any>(null)
  const [inspectorId, setInspectorId] = useState<string | null>(null)
  const [fixtureSheetOpen, setFixtureSheetOpen] = useState(false)
  const [predDetailOpen, setPredDetailOpen] = useState(false)
  const [telemetryOpen, setTelemetryOpen] = useState(false)
  const { add: slipAdd, has: slipHas, remove: slipRemove } = useSlipCart()

  const { data: scanner } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/scanner/state?sport=${sport}`).then(r => r.json().catch(() => null))), 3000)
  const { data: predsData } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/predictions?sport=${sport}&limit=50`).then(r => r.json().catch(() => null))), 4000)
  const { data: calib } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/analytics/calibration?sport=${sport}`).then(r => r.json().catch(() => null))), 6000)
  const { data: live } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/live?sport=${sport}`).then(r => r.json().catch(() => null))), 5000)
  const { data: fixturesData } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/fixtures?sport=${sport}`).then(r => r.json().catch(() => null))), 10000)
  const { data: slipsOdds } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/slips/odds?sport=${sport}`).then(r => r.json().catch(() => null))), 10000)
  const { data: brain } = usePolling(() => import('../services/auth').then(m => m.authFetch('/api/brain/status').then(r => r.json().catch(() => null))), 5000)
  const { data: providers } = usePolling(() => import('../services/auth').then(m => m.authFetch('/api/providers/health').then(r => r.json().catch(() => null))), 8000)

  const scannerState: any = scanner
  const fixtures: any[] = fixturesData?.fixtures || []
  const predictions: any[] = (predsData?.predictions && predsData.predictions.length > 0 ? predsData.predictions : (scannerState?.recent_predictions || []))
  const liveFixtures: any[] = live?.live || []
  const isScanning = !!scannerState?.is_scanning
  const activePred = selectedPred || predictions[0] || null
  const activeFixtureObj = fixtures.find((f: any) => f.id === activeFixtureId) || fixtures[0]

  const toggleScan = async () => {
    if (isScanning) return
    const { authFetch } = await import('../services/auth')
    await authFetch(`/api/scanner/scan-now?sport=${sport}`, { method: 'POST' })
  }

  const handleEvent = useCallback((e: any) => {
    const t = e.event_type || e.event || ''
    if (t === 'PREDICTION_CREATED' || t === 'SCANNER_PREDICTION_GENERATED') {
      setSelectedPred(e.data)
    }
  }, [])
  useWebSocket(handleEvent)

  return (
    <div className="p-4 space-y-4">
      {/* ── Status bar: connection + scanner ── */}
      <div className="flex items-center gap-2 text-[10px]">
        <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full border', isScanning ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400 animate-pulse' : 'bg-[var(--bg-secondary)] border-[var(--border)] text-gray-500')}>
          {isScanning ? '● SCANNING' : 'IDLE'}
        </span>
        {scannerState?.predictions_generated > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-gray-500">
            {scannerState.predictions_generated} predictions
          </span>
        )}
        {liveFixtures.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-900/20 border border-red-800/30 text-red-400">
            {liveFixtures.length} live
          </span>
        )}
      </div>

      {/* ── Sport selector + Scan ── */}
      <div className="flex items-center gap-2">
        {['football', 'basketball'].map(s => (
          <button
            key={s}
            onClick={() => { setSport(s as any); setSelectedPred(null); setActiveFixtureId('') }}
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
            isScanning ? 'bg-gray-800 text-gray-500' : 'bg-emerald-600 text-white active:bg-emerald-500'
          )}
        >
          {isScanning ? '● SCANNING' : '▶ SCAN'}
        </button>
      </div>

      {/* ── Horizontal metric cards ── */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        <MetricScrollCard label="UNIVERSE" value={`${scannerState?.fixtures_total || fixtures.length}`} sub={`${fixtures.length} fixtures`} />
        <MetricScrollCard label="PREDICTIONS" value={`${scannerState?.predictions_generated || 0}`} color="text-emerald-400" />
        <MetricScrollCard label="VALUE" value={`${scannerState?.value_opportunities || 0}`} color="text-emerald-400" />
        <MetricScrollCard label="CALIBRATION" value={calib?.brier_score != null ? calib.brier_score.toFixed(3) : '—'} />
        <MetricScrollCard label="LIVE / ODDS" value={`${liveFixtures.length} / ${slipsOdds?.count || 0}`} color={liveFixtures.length ? 'text-emerald-400' : 'text-gray-500'} />
      </div>

      {/* ── Fixture selector (tap to open bottom sheet) ── */}
      <button
        onClick={() => setFixtureSheetOpen(true)}
        className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] active:bg-[var(--bg-tertiary)]"
      >
        <div className="min-w-0 text-left">
          <div className="text-[10px] text-gray-500">FIXTURE</div>
          <div className="text-xs font-bold text-white truncate">{activeFixtureObj ? activeFixtureObj.label : 'Select fixture'}</div>
        </div>
        <span className="text-gray-500 text-xs">›</span>
      </button>

      {/* ── Active fixture card ── */}
      {activeFixtureObj && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-white truncate">{activeFixtureObj.label}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-gray-500 flex-shrink-0">{activeFixtureObj.competition}</span>
              {liveFixtures.find((l: any) => l.id === activeFixtureObj.id) && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/30 border border-red-800/30 text-red-400 animate-pulse flex-shrink-0">LIVE</span>
              )}
            </div>
            <span className="text-[9px] text-gray-500 flex-shrink-0">{activeFixtureObj.kickoff_at ? new Date(activeFixtureObj.kickoff_at).toLocaleDateString() : ''}</span>
          </div>

          {(() => {
            const pred = predictions.find((p: any) => p.fixture_id === activeFixtureObj.id) || activePred
            const odds = slipsOdds?.odds?.filter((o: any) => o.event_id === activeFixtureObj.id) || []
            if (!pred && odds.length === 0) {
              return <div className="text-[11px] text-gray-600">No prediction — tap <span className="text-emerald-400">SCAN</span></div>
            }
            return (
              <div className="space-y-2">
                {pred && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-[var(--bg-primary)]">
                      <div className="text-[9px] text-gray-500">MODEL vs MARKET</div>
                      <div className="space-y-1 mt-1 text-[11px]">
                        <div className="flex justify-between"><span className="text-gray-500">Market</span><span className="font-mono text-white">{pred.market_odds?.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Calibrated</span><span className="font-mono text-emerald-400">{(pred.calibrated_probability * 100).toFixed(1)}%</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Edge</span><span className={clsx('font-mono', (pred.edge || 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>{((pred.edge || 0) * 100).toFixed(1)}%</span></div>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--bg-primary)]">
                      <div className="text-[9px] text-gray-500">CANONICAL ODDS</div>
                      <div className="space-y-1 mt-1 text-[11px]">
                        {odds.length > 0 ? odds.slice(0, 3).map((o: any) => (
                          <div key={o.id} className="flex justify-between"><span className="text-gray-500 truncate">{o.selection}</span><span className="font-mono text-white">{o.price_decimal.toFixed(2)}</span></div>
                        )) : <div className="text-gray-600">No odds</div>}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { import('../services/auth').then(m => m.authFetch(`/api/scanner/scan-now?sport=${sport}`, { method: 'POST' })) }} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold active:bg-emerald-500">SCAN FIXTURE</button>
                  <button onClick={() => document.dispatchEvent(new CustomEvent('apex:navigate', { detail: 'slips' }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-[11px] text-gray-400">SLIP →</button>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Selected prediction detail ── */}
      {activePred && (
        <div className="rounded-xl border border-emerald-800/20 bg-emerald-950/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-white truncate">{activePred.fixture_label}</span>
              <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', activePred.selection === 'HOME' ? 'bg-emerald-900/30 text-emerald-400' : activePred.selection === 'AWAY' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400')}>{activePred.selection}</span>
              {activePred.is_value && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-800/30 text-emerald-400">VALUE</span>}
            </div>
            <span className="text-lg font-bold text-white">{((activePred.calibrated_probability || 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div><span className="text-gray-500">MARKET</span><div className="text-white">{activePred.market}</div></div>
            <div><span className="text-gray-500">EDGE</span><div className={clsx((activePred.edge || 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>{((activePred.edge || 0) * 100).toFixed(1)}%</div></div>
            <div><span className="text-gray-500">RISK</span><div className={clsx(activePred.risk_level === 'LOW' ? 'text-emerald-400' : 'text-yellow-400')}>{activePred.risk_level}</div></div>
          </div>
          <div className="text-[10px] text-gray-500">Confidence {(activePred.confidence * 100).toFixed(0)}% • {activePred.competition} • {activePred.sport}</div>
          <div className="flex gap-2">
            <button
              onClick={() => { setInspectorId(activePred.id || activePred.fixture_id) }}
              className="flex-1 py-2 rounded-lg border border-[var(--border)] text-[11px] text-gray-400 active:bg-[var(--bg-tertiary)]"
            >
              INSPECT WHY
            </button>
            {(() => {
              const pid = activePred.id || activePred.fixture_id
              const inSlip = slipHas(pid)
              return (
                <button
                  onClick={async () => { if (inSlip) { slipRemove(pid) } else { await slipAdd(activePred) } }}
                  className={clsx('flex-1 py-2 rounded-lg text-[11px] font-bold active:opacity-80', inSlip ? 'bg-emerald-900/30 border border-emerald-800/30 text-emerald-400' : 'bg-emerald-600 text-white')}
                >
                  {inSlip ? '✓ IN SLIP' : '+ ADD TO SLIP'}
                </button>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Recent predictions ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] tracking-widest text-gray-500 font-bold">RECENT INTELLIGENCE</h3>
          <span className="text-[10px] text-gray-600">{predictions.length}</span>
        </div>
        {predictions.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="text-sm text-gray-500 mb-1">No predictions yet</div>
            <div className="text-[11px] text-gray-600">Tap <span className="text-emerald-400">SCAN</span> to generate intelligence</div>
          </div>
        ) : (
          <div className="space-y-2">
            {predictions.slice(0, 8).map((p: any) => (
              <MobilePredictionCard
                key={(p.id || p.fixture_id) + p.selection}
                pred={p}
                selected={activePred?.fixture_id === p.fixture_id}
                onSelect={() => { setSelectedPred(p); setPredDetailOpen(true) }}
                onInspect={() => setInspectorId(p.id || p.fixture_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Live fixtures ── */}
      {liveFixtures.length > 0 && (
        <div>
          <h3 className="text-[10px] tracking-widest text-gray-500 font-bold mb-2">LIVE NOW</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {liveFixtures.map((f: any) => (
              <div key={f.id} className="flex-shrink-0 w-44 p-2.5 rounded-xl border border-red-800/30 bg-red-950/20 snap-start">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-[9px] text-red-400 font-bold">LIVE</span>
                </div>
                <div className="text-[11px] font-bold text-white truncate">{f.label || f.home_team}</div>
                <div className="text-[9px] text-gray-500">{f.competition}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pipeline hint ── */}
      <div className="flex items-center gap-1 text-[9px] font-mono text-gray-600 overflow-x-auto pb-1 scrollbar-hide">
        {['DATA', 'FEATURES', '6× SPECIALISTS', 'ENSEMBLE', 'CALIBRATION', 'VALUE', 'RISK', 'PREDICTION'].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1 flex-shrink-0">
            <span className={clsx('px-1.5 py-0.5 rounded', s === 'PREDICTION' ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-secondary)]')}>{s}</span>
            {i < arr.length - 1 && <span className="text-emerald-600">→</span>}
          </span>
        ))}
      </div>

      {/* ── Collapsible telemetry sections ── */}
      <div className="space-y-2">
        <button onClick={() => setTelemetryOpen(!telemetryOpen)} className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] active:bg-[var(--bg-tertiary)]">
          <span className="text-[10px] tracking-widest text-gray-500 font-bold">ENGINE STATUS</span>
          <span className="text-gray-500 text-xs">{telemetryOpen ? '−' : '+'}</span>
        </button>
        {telemetryOpen && (
          <div className="space-y-2">
            {/* Provider health */}
            {providers && (
              <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                <div className="text-[9px] tracking-wider text-gray-500 mb-1.5">PROVIDERS</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(providers).map(([name, v]: any) => (
                    <span key={name} className={clsx('text-[9px] px-1.5 py-0.5 rounded border', v.configured ? (v.is_healthy ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-yellow-900/20 border-yellow-800/30 text-yellow-400') : 'bg-[var(--bg-primary)] border-[var(--border)] text-gray-500')}>
                      {name} {v.configured ? '●' : '○'}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Brain / AI model */}
            {brain && (
              <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                <div className="text-[9px] tracking-wider text-gray-500 mb-1.5">AI BRAIN</div>
                <div className="text-[11px]">
                  <span className={clsx(brain.is_configured ? 'text-emerald-400' : 'text-yellow-400')}>{brain.enabled_count}/{brain.total_agents} agents</span>
                  <span className="text-gray-500 ml-2">{brain.is_configured ? `${brain.active_llm.provider}:${brain.active_llm.model?.slice(0, 20)}` : 'No model'}</span>
                </div>
              </div>
            )}
            {/* Scanner pipeline */}
            {scannerState?.pipeline_stages?.length > 0 && (
              <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                <div className="text-[9px] tracking-wider text-gray-500 mb-1.5">PIPELINE</div>
                <div className="space-y-1">
                  {scannerState.pipeline_stages.slice(-4).map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className={clsx(s.status === 'COMPLETE' ? 'text-emerald-400' : s.status === 'ACTIVE' ? 'text-yellow-400 animate-pulse' : 'text-gray-600')}>{s.status === 'COMPLETE' ? '✓' : s.status === 'ACTIVE' ? '●' : '○'}</span>
                      <span className="text-gray-300">{s.stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Calibration detail */}
            {calib && (
              <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                <div className="text-[9px] tracking-wider text-gray-500 mb-1.5">CALIBRATION</div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-gray-500">Brier <span className="text-white font-mono">{calib.brier_score ?? '—'}</span></span>
                  <span className="text-gray-500">Resolved <span className="text-white">{calib.resolved}/{calib.total_predictions}</span></span>
                </div>
                <div className="w-full bg-[var(--bg-primary)] rounded h-1.5 mt-1.5">
                  <div className="bg-emerald-600 h-1.5 rounded" style={{ width: `${Math.min(100, (calib.resolved / Math.max(1, calib.total_predictions)) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fixture selector bottom sheet ── */}
      {fixtureSheetOpen && (
        <FixtureSelectorSheet
          sport={sport}
          fixtures={fixtures}
          activeId={activeFixtureId}
          onSelect={(id) => { setActiveFixtureId(id); setFixtureSheetOpen(false) }}
          onClose={() => setFixtureSheetOpen(false)}
        />
      )}

      {/* ── Prediction detail sheet ── */}
      {predDetailOpen && activePred && (
        <PredictionDetailSheet
          pred={activePred}
          onClose={() => setPredDetailOpen(false)}
          onInspect={() => { setInspectorId(activePred.id || activePred.fixture_id); setPredDetailOpen(false) }}
          onAddSlip={async () => {
            const pid = activePred.id || activePred.fixture_id
            if (slipHas(pid)) { slipRemove(pid) } else { await slipAdd(activePred) }
          }}
          inSlip={slipHas(activePred.id || activePred.fixture_id)}
        />
      )}

      {/* ── Prediction inspector ── */}
      {inspectorId && (
        <MobileInspectorSheet predId={inspectorId} onClose={() => setInspectorId(null)} />
      )}
    </div>
  )
}

/* ── Fixture selector bottom sheet ── */
function FixtureSelectorSheet({ sport, fixtures, activeId, onSelect, onClose }: { sport: string; fixtures: any[]; activeId: string; onSelect: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const filtered = fixtures.filter(f => !query || f.label?.toLowerCase().includes(query.toLowerCase()) || f.competition?.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-[var(--bg-secondary)] rounded-t-2xl border-t border-[var(--border)] max-h-[70vh] flex flex-col animate-slide-up">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-600" /></div>
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="text-xs font-bold tracking-wider text-white">SELECT FIXTURE</div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>
        <div className="px-4 pb-2">
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search fixtures…" className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600" />
        </div>
        <div className="flex-1 overflow-auto px-4 pb-4 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-xs text-gray-600 text-center py-6">No fixtures</div>
          ) : filtered.map(f => (
            <button key={f.id} onClick={() => onSelect(f.id)} className={clsx('w-full text-left p-2.5 rounded-lg flex items-center justify-between active:bg-[var(--bg-tertiary)]', activeId === f.id && 'bg-[var(--bg-tertiary)]')}>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{f.label}</div>
                <div className="text-[10px] text-gray-500">{f.competition} • {f.kickoff_at ? new Date(f.kickoff_at).toLocaleDateString() : ''}</div>
              </div>
              {activeId === f.id && <span className="text-emerald-400 text-xs">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Prediction detail bottom sheet ── */
function PredictionDetailSheet({ pred, onClose, onInspect, onAddSlip, inSlip }: { pred: any; onClose: () => void; onInspect: () => void; onAddSlip: () => void; inSlip: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-[var(--bg-secondary)] rounded-t-2xl border-t border-[var(--border)] max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-600" /></div>
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="text-xs font-bold tracking-wider text-white">PREDICTION DETAIL</div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>
        <div className="flex-1 overflow-auto px-4 pb-6 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-white truncate">{pred.fixture_label}</span>
              <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', pred.selection === 'HOME' ? 'bg-emerald-900/30 text-emerald-400' : pred.selection === 'AWAY' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400')}>{pred.selection}</span>
            </div>
            <span className="text-xl font-bold text-white">{((pred.calibrated_probability || 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="text-[10px] text-gray-500">{pred.competition} • {pred.sport} • {pred.market}</div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'MARKET ODDS', value: pred.market_odds?.toFixed(2) },
              { label: 'IMPLIED PROB', value: `${(pred.implied_probability * 100).toFixed(1)}%` },
              { label: 'MODEL PROB', value: `${(pred.probability * 100).toFixed(1)}%` },
              { label: 'CALIBRATED', value: `${(pred.calibrated_probability * 100).toFixed(1)}%`, color: 'text-emerald-400' },
              { label: 'EDGE', value: `${((pred.edge || 0) * 100).toFixed(1)}%`, color: (pred.edge || 0) > 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'EXPECTED VALUE', value: pred.expected_value?.toFixed(3), color: (pred.expected_value || 0) > 0 ? 'text-emerald-400' : 'text-gray-400' },
              { label: 'FAIR ODDS', value: pred.fair_odds },
              { label: 'CONFIDENCE', value: `${(pred.confidence * 100).toFixed(0)}%` },
            ].map(m => (
              <div key={m.label} className="p-2 rounded-lg bg-[var(--bg-primary)]">
                <div className="text-[9px] text-gray-500">{m.label}</div>
                <div className={clsx('text-xs font-mono mt-0.5', m.color || 'text-white')}>{m.value || '—'}</div>
              </div>
            ))}
          </div>

          {/* Risk */}
          <div className="p-2.5 rounded-lg bg-[var(--bg-primary)] flex items-center justify-between">
            <span className="text-[10px] text-gray-500">RISK LEVEL</span>
            <span className={clsx('text-xs font-bold', pred.risk_level === 'LOW' ? 'text-emerald-400' : pred.risk_level === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400')}>{pred.risk_level}</span>
          </div>

          {/* Provenance */}
          {pred.prompt_paths && (
            <div className="p-2.5 rounded-lg bg-[var(--bg-primary)]">
              <div className="text-[9px] text-gray-500 mb-1">PROVENANCE</div>
              <div className="text-[9px] font-mono text-gray-600 truncate">{Object.values(pred.prompt_paths).join(' • ').slice(0, 80)}</div>
              {pred.model_used && <div className="text-[9px] font-mono text-gray-600 mt-0.5">Model: {pred.model_used}</div>}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={onInspect} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-xs text-gray-400 active:bg-[var(--bg-tertiary)]">INSPECT WHY</button>
            <button onClick={onAddSlip} className={clsx('flex-1 py-2.5 rounded-xl text-xs font-bold active:opacity-80', inSlip ? 'bg-emerald-900/30 border border-emerald-800/30 text-emerald-400' : 'bg-emerald-600 text-white')}>
              {inSlip ? '✓ IN SLIP — REMOVE' : '+ ADD TO SLIP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Mobile inspector sheet (simplified) ── */
function MobileInspectorSheet({ predId, onClose }: { predId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    import('../services/auth').then(m => m.authFetch(`/api/predictions/${predId}/trace`).then(r => r.json()).then(setData).catch(() => {}))
  }, [predId])

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-[var(--bg-secondary)] rounded-t-2xl border-t border-[var(--border)] max-h-[80vh] flex flex-col animate-slide-up">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-600" /></div>
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="text-xs font-bold tracking-wider text-white">INTELLIGENCE TRACE</div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>
        <div className="flex-1 overflow-auto px-4 pb-6">
          {!data ? (
            <div className="text-xs text-gray-500 text-center py-8">Loading trace…</div>
          ) : data.error ? (
            <div className="text-xs text-red-400 text-center py-8">{data.error}</div>
          ) : (
            <div className="space-y-2 text-[11px]">
              {data.specialists?.map((s: any, i: number) => (
                <div key={i} className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{s.name}</span>
                    <span className={clsx('text-[9px] px-1.5 py-0.5 rounded', s.status === 'COMPLETE' ? 'bg-emerald-900/20 text-emerald-400' : 'bg-red-900/20 text-red-400')}>{s.status}</span>
                  </div>
                  {s.output && <div className="text-[10px] text-gray-400 mt-1 truncate">{typeof s.output === 'string' ? s.output : JSON.stringify(s.output).slice(0, 100)}</div>}
                </div>
              ))}
              {data.ensemble && (
                <div className="p-2.5 rounded-lg bg-emerald-900/10 border border-emerald-800/20">
                  <div className="text-[9px] text-emerald-400 font-bold">ENSEMBLE</div>
                  <div className="text-[11px] text-white mt-0.5">{typeof data.ensemble === 'string' ? data.ensemble : JSON.stringify(data.ensemble).slice(0, 150)}</div>
                </div>
              )}
              {data.provenance && (
                <div className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[9px] text-gray-500 font-bold">PROVENANCE</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{JSON.stringify(data.provenance).slice(0, 200)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Mobile Scanner (full desktop parity) ── */
const PIPELINE = ['DATA','FEATURES','MATCH_CONTEXT','FORM','TEAM_STRENGTH','AVAILABILITY','MATCHUP','AI_BRAIN','ENSEMBLE','CALIBRATION','VALUE','RISK','PREDICTION']
const CATEGORY_ICONS: Record<string,string> = { DATA:'📡', FEATURES:'📊', CONTEXT:'🌍', FORM:'📈', STRENGTH:'💪', AVAILABILITY:'🏥', MATCHUP:'⚔️', AI_BRAIN:'🧠', ENSEMBLE:'🔗', CALIBRATION:'🎯', VALUE:'💎', RISK:'⚖️', PREDICTION:'⚡', SCANNER:'🔍' }

function ScannerMobile() {
  const [sport, setSport] = useState<'football' | 'basketball'>('football')
  const [league, setLeague] = useState('All Leagues')
  const [leagues, setLeagues] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [state, setState] = useState<any>(null)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const pulseRef = useRef(0)
  const [showRejection, setShowRejection] = useState(false)
  const [selectedRejection, setSelectedRejection] = useState<any>(null)
  const [rejectionData, setRejectionData] = useState<any>(null)
  const [expandedPipeline, setExpandedPipeline] = useState(false)
  const [expandedEvents, setExpandedEvents] = useState(false)

  useEffect(() => {
    import('../services/auth').then(m => m.authFetch(`/api/scanner/leagues?sport=${sport}`).then(r => r.json()).then(d => setLeagues(d.leagues || [])).catch(() => {}))
  }, [sport])

  const { data: stateData } = usePolling(() => import('../services/auth').then(m => m.authFetch(`/api/scanner/state?sport=${sport}&league=${encodeURIComponent(league)}`).then(r => r.json())), 1500)
  useEffect(() => { if (stateData) { setState(stateData); setScanning((stateData as any).is_scanning) } }, [stateData])

  useEffect(() => {
    if (showRejection && state?.scan_run_id) {
      import('../services/auth').then(m => m.authFetch(`/api/scanner/rejections?scan_run_id=${state.scan_run_id}`).then(r => r.json()).then(setRejectionData).catch(() => {}))
    } else if (showRejection) {
      import('../services/auth').then(m => m.authFetch('/api/scanner/rejections').then(r => r.json()).then(setRejectionData).catch(() => {}))
    }
  }, [showRejection, state?.scan_run_id])

  const handleEvent = useCallback((e: any) => {
    const t = e.event_type || e.event || ''
    if (t === 'SCAN_STARTED') { setScanning(true); startRef.current = Date.now() }
    if (t === 'SCAN_COMPLETED' || t === 'SCAN_FAILED') { setScanning(false); startRef.current = null }
    if (String(t).startsWith('SCAN')) {
      import('../services/auth').then(m => m.authFetch(`/api/scanner/state?sport=${sport}&league=${encodeURIComponent(league)}`).then(r => r.json()).then(d => { setState(d); setScanning(d.is_scanning) }).catch(() => {}))
    }
  }, [sport, league])
  useWebSocket(handleEvent)

  useEffect(() => {
    if (!scanning) { setElapsed(0); return }
    const start = startRef.current || Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [scanning])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const size = 280; canvas.width = size * 2; canvas.height = size * 2; ctx.scale(2, 2)
    const cx = size / 2, cy = size / 2, maxR = size / 2 - 10
    let sweep = 0, frame = 0
    const draw = () => {
      ctx.clearRect(0, 0, size, size); frame++; const active = scanning
      for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(88,166,255,0.08)'; ctx.lineWidth = 1; ctx.stroke() }
      ctx.strokeStyle = 'rgba(88,166,255,0.06)'; ctx.lineWidth = 1
      for (let a = 0; a < 8; a++) { const ang = (a * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * maxR, cy + Math.sin(ang) * maxR); ctx.stroke() }
      if (active) {
        sweep += 0.03; const g = ctx.createConicGradient(sweep, cx, cy); g.addColorStop(0, 'rgba(34,197,94,0.3)'); g.addColorStop(0.15, 'rgba(34,197,94,0.05)'); g.addColorStop(0.3, 'transparent'); g.addColorStop(1, 'transparent'); ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
      }
      if (active) {
        pulseRef.current = (pulseRef.current + 1) % 60
        for (let i = 0; i < 3; i++) { const prog = ((pulseRef.current + i * 20) % 60) / 60; const r = prog * maxR; const alpha = 0.4 * (1 - prog); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = `rgba(34,197,94,${alpha})`; ctx.lineWidth = 1.5; ctx.stroke() }
      }
      const breathe = Math.sin(frame * 0.03) * 0.3 + 0.7; const core = active ? 8 : 5
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 3); glow.addColorStop(0, active ? `rgba(34,197,94,${0.6 * breathe})` : `rgba(88,166,255,${0.2 * breathe})`); glow.addColorStop(1, 'transparent'); ctx.beginPath(); ctx.arc(cx, cy, core * 3, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill()
      ctx.beginPath(); ctx.arc(cx, cy, core, 0, Math.PI * 2); ctx.fillStyle = active ? '#22c55e' : 'rgba(88,166,255,0.4)'; ctx.fill()
      ctx.beginPath(); ctx.arc(cx, cy, core + 3, 0, Math.PI * 2); ctx.strokeStyle = active ? `rgba(34,197,94,${0.5 * breathe})` : 'rgba(88,166,255,0.15)'; ctx.lineWidth = 1.5; ctx.stroke()
      if (active && state?.fixtures) {
        state.fixtures.forEach((fx: any, i: number) => { const ang = (i / state.fixtures.length) * Math.PI * 2 - Math.PI / 2; const sx = cx + Math.cos(ang) * maxR * 0.6; const sy = cy + Math.sin(ang) * maxR * 0.6; let color = 'rgba(110,118,129,0.4)'; if (fx.status === 'COMPLETE') color = '#3fb950'; else if (fx.status === 'FETCHING') color = '#58a6ff'; else if (fx.status === 'ANALYZING') color = '#d29922'; else if (fx.status === 'FAILED') color = '#f85149'; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill() })
      }
      animRef.current = requestAnimationFrame(draw)
    }
    draw(); return () => cancelAnimationFrame(animRef.current)
  }, [scanning, state])

  const handleScan = async () => {
    const { authFetch } = await import('../services/auth')
    const r = await authFetch(`/api/scanner/scan-now?sport=${sport}&league=${encodeURIComponent(league)}`, { method: 'POST' })
    const d = await r.json()
    if (d.status === 'started') { setScanning(true); startRef.current = Date.now() }
  }

  const currentState = state?.state || 'IDLE'
  const isActive = scanning || state?.is_scanning

  return (
    <div className="p-4 space-y-4">
      {/* Radar + Status */}
      <div className="flex flex-col items-center gap-2">
        <canvas ref={canvasRef} className="w-[280px] h-[280px]" />
        <div className="text-center">
          <div className={clsx('text-xs font-bold tracking-wider', isActive ? 'text-emerald-400' : currentState === 'COMPLETE' ? 'text-emerald-400' : currentState === 'ERROR' ? 'text-red-400' : 'text-gray-500')}>
            {isActive ? 'SCANNING FIXTURES' : currentState === 'COMPLETE' ? 'SCAN COMPLETE' : currentState === 'ERROR' ? 'ERROR' : 'APEX READY'}
          </div>
          {isActive && state?.current_fixture && <div className="text-[10px] text-gray-500 mt-1">Processing: {state.current_fixture}</div>}
        </div>
      </div>

      {/* Sport selector */}
      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-gray-500 font-bold">1. SELECT SPORT</label>
        <div className="flex gap-2">
          {['football', 'basketball'].map(s => (
            <button key={s} onClick={() => { setSport(s as any); setLeague('All Leagues') }} className={clsx('flex-1 py-2.5 rounded-xl text-xs font-bold transition border', sport === s ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-[var(--bg-secondary)] border-[var(--border)] text-gray-400')}>
              {s === 'football' ? '⚽ Football' : '🏀 Basketball'}
            </button>
          ))}
        </div>
      </div>

      {/* League selector */}
      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-gray-500 font-bold">2. SELECT LEAGUE</label>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {['All Leagues', ...leagues].map(l => (
            <button key={l} onClick={() => setLeague(l)} className={clsx('flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition border', league === l ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-[var(--bg-secondary)] border-[var(--border)] text-gray-400')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2">
        <MobileStat label="FIXTURES" value={`${state?.fixtures_completed || 0}/${state?.fixtures_total || state?.instrument_universe?.scanner_universe_size || 0}`} />
        <MobileStat label="PREDICTIONS" value={String(state?.predictions_generated || 0)} color="text-emerald-400" />
        <MobileStat label="REJECTED" value={String(state?.candidates_rejected || 0)} color="text-red-400" />
        <MobileStat label="DURATION" value={isActive ? `${elapsed}s` : state?.scan_duration_ms ? `${(state.scan_duration_ms / 1000).toFixed(1)}s` : '—'} />
      </div>

      {/* Universe/Value/Total */}
      <div className="flex items-center gap-3 text-[10px] flex-wrap">
        <span className="text-gray-500">UNIVERSE: <span className="text-gray-300">{(state?.instrument_universe?.scanner_universe_size ?? state?.available_universe ?? state?.fixtures_total ?? 0)}</span></span>
        <span className="text-gray-500">VALUE: <span className="text-emerald-400">{state?.value_opportunities || 0}</span></span>
        <span className="text-gray-500">SCANS: <span className="text-gray-300">{state?.total_scans || 0}</span></span>
      </div>

      {/* Scan button */}
      <button onClick={handleScan} disabled={!!isActive} className={clsx('w-full py-3 rounded-xl text-sm font-bold tracking-wider transition', isActive ? 'bg-gray-800 text-gray-500' : 'bg-emerald-600 text-white active:bg-emerald-500')}>
        {isActive ? `● SCANNING… ${elapsed}s` : '▶ START SCAN'}
      </button>

      {/* Rejection Analysis toggle */}
      {state && !isActive && (state.candidates_rejected > 0 || state.predictions_generated > 0) && (
        <button onClick={() => setShowRejection(v => !v)} className="w-full py-2 rounded-xl border border-yellow-800/30 bg-yellow-900/10 text-yellow-400 text-xs font-bold">
          {showRejection ? 'HIDE REJECTION ANALYSIS' : `VIEW REJECTION — ${state.candidates_rejected} rejected`}
        </button>
      )}

      {/* Scan summary */}
      {state && state.state === 'COMPLETE' && (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-center">
            <div className="text-gray-500 tracking-wider">FIXTURES</div>
            <div className="text-white font-bold text-sm mt-0.5">{state.stage_counts?.discovered ?? state.available_universe ?? state.fixtures_total}</div>
            <div className="text-gray-600">Eligible {state.stage_counts?.eligible ?? state.eligible_count ?? 0}</div>
          </div>
          <div className="p-2 rounded-xl border border-emerald-800/20 bg-emerald-900/10 text-center">
            <div className="text-gray-500 tracking-wider">PREDICTIONS</div>
            <div className="text-emerald-400 font-bold text-sm mt-0.5">{state.predictions_generated}</div>
            <div className="text-gray-600">Value {state.value_opportunities}</div>
          </div>
          <div className="p-2 rounded-xl border border-red-800/20 bg-red-900/10 text-center">
            <div className="text-gray-500 tracking-wider">REJECTED</div>
            <div className="text-red-400 font-bold text-sm mt-0.5">{state.candidates_rejected}</div>
          </div>
        </div>
      )}

      {/* Rejection Analysis Panel */}
      {showRejection && (
        <div className="rounded-xl border border-yellow-800/30 bg-[#0d1117] p-3 space-y-3">
          <div className="text-[11px] font-bold tracking-widest text-yellow-400">REJECTION ANALYSIS — {rejectionData?.aggregate?.total ?? state.candidates_rejected}</div>
          {/* Aggregate */}
          <div className="grid grid-cols-2 gap-2">
            {rejectionData?.aggregate ? Object.entries(rejectionData.aggregate.by_code || {}).map(([code, cnt]: any) => (
              <div key={code} className={clsx('p-2 rounded-xl border text-center', code === 'TECHNICAL_FAILURE' ? 'bg-red-900/10 border-red-800/30' : code === 'LOW_VALUE' ? 'bg-yellow-900/10 border-yellow-800/30' : 'bg-[var(--bg-secondary)] border-[var(--border)]')}>
                <div className="text-[9px] font-bold tracking-wider" style={{ color: code === 'TECHNICAL_FAILURE' ? '#f85149' : code === 'LOW_VALUE' ? '#d29922' : '#e3b341' }}>{code}</div>
                <div className="text-white font-bold text-sm mt-0.5">{cnt as number}</div>
              </div>
            )) : <div className="text-[11px] text-gray-500 col-span-2">Loading…</div>}
          </div>
          {/* Individual */}
          <div className="space-y-1 max-h-[200px] overflow-auto">
            {(rejectionData?.rejections || state?.last_rejections || []).slice(0, 20).map((r: any) => (
              <div key={r.fixture_id + r.timestamp} onClick={() => setSelectedRejection(r)} className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] active:bg-[var(--bg-tertiary)] cursor-pointer">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white font-bold truncate">{r.fixture_label}</span>
                  <span className={clsx('text-[9px] px-1 py-0.5 rounded-lg border font-bold', r.rejection_code === 'TECHNICAL_FAILURE' ? 'bg-red-900/20 border-red-800/30 text-red-400' : 'bg-yellow-900/20 border-yellow-800/30 text-yellow-400')}>{r.rejection_code}</span>
                </div>
                <div className="text-[10px] text-gray-500 truncate mt-0.5">{r.rejection_reason?.slice(0, 80)}</div>
                <div className="text-[9px] text-gray-600 font-mono mt-0.5">{r.sport} • {new Date(r.timestamp * 1000).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
          {selectedRejection && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white truncate">{selectedRejection.fixture_label}</div>
                <button onClick={() => setSelectedRejection(null)} className="text-[10px] text-gray-500">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                <div><span className="text-gray-500">STATUS</span><div className="text-red-400 font-bold">{selectedRejection.rejection_code}</div></div>
                <div><span className="text-gray-500">STAGE</span><div className="text-white">{selectedRejection.rejection_stage}</div></div>
              </div>
              <div className="mt-2 text-[11px] text-gray-300">{selectedRejection.rejection_reason}</div>
              {selectedRejection.pipeline_trace?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedRejection.pipeline_trace.map((s: any, i: number) => (
                    <span key={i} className={clsx('text-[9px] px-1.5 py-0.5 rounded-lg border', s.status === 'COMPLETE' ? 'bg-emerald-900/10 border-emerald-800/20 text-emerald-400' : s.status === 'FAILED' ? 'bg-red-900/10 border-red-800/30 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-500')}>{s.stage}:{s.status}</span>
                  ))}
                </div>
              )}
              <div className="text-[9px] text-gray-600 font-mono mt-2">Model: {selectedRejection.model || '—'} • Prompt: {selectedRejection.prompt_version || '—'}</div>
            </div>
          )}
        </div>
      )}

      {/* Fixture status grid */}
      {state?.fixtures && state.fixtures.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] tracking-widest text-gray-500 font-bold">FIXTURES ({state.fixtures.length})</div>
          <div className="grid grid-cols-2 gap-1">
            {state.fixtures.map((fx: any) => (
              <div key={fx.fixture_id} className="flex items-center justify-between text-[10px] p-1.5 rounded bg-[var(--bg-secondary)]">
                <span className="text-gray-400 truncate">{fx.label}</span>
                <span className={clsx('font-medium ml-1 flex-shrink-0', fx.status === 'COMPLETE' ? 'text-emerald-400' : fx.status === 'FETCHING' ? 'text-blue-400' : fx.status === 'ANALYZING' ? 'text-yellow-400' : fx.status === 'FAILED' ? 'text-red-400' : 'text-gray-600')}>
                  {fx.status === 'COMPLETE' ? '✓' : fx.status === 'FETCHING' ? '●' : fx.status === 'ANALYZING' ? '◉' : fx.status === 'FAILED' ? '✗' : '○'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div>
        <button onClick={() => setExpandedPipeline(v => !v)} className="w-full flex items-center justify-between py-2 text-[10px] tracking-widest text-gray-500 font-bold">
          <span>LIVE PIPELINE</span>
          <span className="text-gray-600">{expandedPipeline ? '▲' : '▼'}</span>
        </button>
        {expandedPipeline && (
          <div className="space-y-1 mt-1">
            {PIPELINE.map(stage => {
              const target = state?.current_fixture || state?.pipeline_stages?.[state.pipeline_stages.length - 1]?.fixture_id || ''
              const info = state?.pipeline_stages?.find((s: any) => s.stage === stage && s.fixture_id === target) || state?.pipeline_stages?.find((s: any) => s.stage === stage)
              const st = info?.status || 'WAITING'
              return (
                <div key={stage} className={clsx('flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px]', st === 'ACTIVE' && 'bg-emerald-900/20 border border-emerald-800/30', st === 'COMPLETE' && 'bg-emerald-900/10', st === 'FAILED' && 'bg-red-900/10')}>
                  <span className={clsx('w-4 text-center font-mono', st === 'ACTIVE' ? 'text-emerald-400 animate-pulse' : st === 'COMPLETE' ? 'text-emerald-400' : st === 'FAILED' ? 'text-red-400' : 'text-gray-600')}>{st === 'COMPLETE' ? '✓' : st === 'ACTIVE' ? '●' : st === 'FAILED' ? '✗' : '○'}</span>
                  <span className={clsx('font-medium', st === 'ACTIVE' ? 'text-emerald-300' : st === 'COMPLETE' ? 'text-emerald-300' : st === 'FAILED' ? 'text-red-300' : 'text-gray-500')}>{stage.replace('_', ' ')}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Events */}
      <div>
        <button onClick={() => setExpandedEvents(v => !v)} className="w-full flex items-center justify-between py-2 text-[10px] tracking-widest text-gray-500 font-bold">
          <span>EVENT STREAM ({state?.events?.length || 0})</span>
          <span className="text-gray-600">{expandedEvents ? '▲' : '▼'}</span>
        </button>
        {expandedEvents && (
          <div className="space-y-1 mt-1 max-h-[200px] overflow-auto">
            {(!state?.events || state.events.length === 0) ? <div className="text-[10px] text-gray-600 text-center py-4">No events yet</div> : [...state.events].reverse().map((evt: any, i: number) => (
              <div key={i} className={clsx('text-[10px] px-2 py-1.5 rounded-lg border', evt.status === 'SUCCESS' ? 'bg-emerald-900/10 border-emerald-800/20' : evt.status === 'ERROR' ? 'bg-red-900/10 border-red-800/20' : evt.status === 'WARNING' ? 'bg-yellow-900/10 border-yellow-800/20' : 'bg-[var(--bg-primary)] border-[var(--border)]')}>
                <div className="flex items-center gap-1.5">
                  <span>{CATEGORY_ICONS[evt.category] || '•'}</span>
                  <span className={clsx('font-bold', evt.status === 'SUCCESS' ? 'text-emerald-400' : evt.status === 'ERROR' ? 'text-red-400' : evt.status === 'WARNING' ? 'text-yellow-400' : 'text-gray-400')}>{evt.category}</span>
                  <span className="text-gray-500 ml-auto text-[9px]">{new Date(evt.timestamp * 1000).toLocaleTimeString()}</span>
                </div>
                <div className="text-gray-400 mt-0.5">{evt.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Predictions */}
      {state?.recent_predictions?.length > 0 && (
        <div>
          <div className="text-[10px] tracking-widest text-gray-500 font-bold mb-2">PREDICTIONS ({state.recent_predictions.length})</div>
          <div className="space-y-2">
            {state.recent_predictions.map((p: any, i: number) => (
              <MobilePredictionCard key={i} pred={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MobileStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-center">
      <div className="text-[8px] text-gray-500 tracking-wider">{label}</div>
      <div className={clsx('text-sm font-bold mt-0.5', color || 'text-white')}>{value}</div>
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
function MetricScrollCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex-shrink-0 w-28 snap-start p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="text-[9px] text-gray-500 tracking-wider">{label}</div>
      <div className={clsx('text-lg font-bold mt-0.5', color || 'text-white')}>{value}</div>
      {sub && <div className="text-[9px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function MobilePredictionCard({ pred, selected, onSelect, onInspect }: { pred: any; selected?: boolean; onSelect?: () => void; onInspect?: () => void }) {
  const { add: slipAdd, has: slipHas, remove: slipRemove } = useSlipCart()
  const pid = pred.id || pred.fixture_id
  const inSlip = slipHas(pid)

  return (
    <div onClick={onSelect} className={clsx('p-3 rounded-xl border cursor-pointer active:bg-[var(--bg-tertiary)] transition', selected ? 'border-emerald-800/30 bg-[#1a2332]' : 'border-[var(--border)] bg-[var(--bg-secondary)]')}>
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
          {pred.is_value && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 font-bold">VALUE</span>}
        </div>
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {onInspect && (
            <button onClick={onInspect} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-gray-500" title="Inspect">🔍</button>
          )}
          <button
            onClick={async () => { if (inSlip) { slipRemove(pid) } else { await slipAdd(pred) } }}
            className={clsx(
              'px-2 py-1 rounded-lg text-[10px] font-bold transition',
              inSlip ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-600 text-white'
            )}
          >
            {inSlip ? '✓' : '+'}
          </button>
        </div>
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
