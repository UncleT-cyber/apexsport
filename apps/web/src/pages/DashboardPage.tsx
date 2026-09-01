import { useState, useEffect, useCallback, useRef } from 'react'
import { authFetch } from '../services/auth'
import clsx from 'clsx'
import { usePolling } from '../hooks/usePolling'
import { useWebSocket } from '../hooks/useWebSocket'
import { FixtureSelector } from '../components/FixtureSelector'
import { ProviderIndicator } from '../components/ProviderIndicator'
import { PredictionInspector } from '../components/PredictionInspector'
import { Play, Square, AlertTriangle, TrendingUp, Target, Trophy, BarChart3, Clock, Zap, ArrowRight } from 'lucide-react'

const TELEMETRY_DEFAULT = 200
const TELEMETRY_MIN = 80

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="p-2 bg-[#0d1117] rounded border border-[#30363d]">
      <div className="text-[9px] text-gray-500 tracking-wider">{label}</div>
      <div className={clsx('text-lg font-bold mt-0.5', color || 'text-white')}>{value}</div>
      {sub && <div className="text-[9px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function PredictionRow({ p, onSelect, onInspect, active }: { p: any; onSelect: () => void; onInspect: () => void; active?: boolean }) {
  return (
    <tr className={clsx('border-b border-[#21262d] text-xs hover:bg-[#161b22]', active && 'bg-[#1a2332]')}>
      <td onClick={onSelect} className="py-2 px-2 font-medium cursor-pointer hover:text-white">{p.fixture_label}</td>
      <td onClick={onSelect} className="py-2 px-2 cursor-pointer"><span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', p.selection === 'HOME' ? 'bg-emerald-900/30 text-emerald-400' : p.selection === 'AWAY' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400')}>{p.selection}</span></td>
      <td onClick={onSelect} className="py-2 px-2 text-right font-mono cursor-pointer">{p.market_odds?.toFixed(2)}</td>
      <td onClick={onSelect} className="py-2 px-2 text-right font-mono cursor-pointer">{((p.calibrated_probability || 0) * 100).toFixed(0)}%</td>
      <td onClick={onSelect} className={clsx('py-2 px-2 text-right font-mono cursor-pointer', (p.edge || 0) > 0 ? 'text-emerald-400' : 'text-red-400')} >{((p.edge || 0) * 100).toFixed(1)}%</td>
      <td className="py-2 px-2 text-right flex items-center justify-end gap-1">
        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', p.risk_level === 'LOW' ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : p.risk_level === 'MEDIUM' ? 'bg-yellow-900/20 border-yellow-800/30 text-yellow-400' : 'bg-red-900/20 border-red-800/30 text-red-400')}>{p.risk_level}</span>
        <button onClick={onInspect} className="ml-1 p-1 rounded hover:bg-[#21262d] text-gray-500 hover:text-white" title="Inspect why">🔍</button>
      </td>
    </tr>
  )
}

export function DashboardPage() {
  const [sport, setSport] = useState<'football' | 'basketball'>('football')
  const [activeFixture, setActiveFixture] = useState('')
  const [selectedPred, setSelectedPred] = useState<any>(null)
  const [inspectorId, setInspectorId] = useState<string | null>(null)
  const [telemetryHeight, setTelemetryHeight] = useState(TELEMETRY_DEFAULT)
  const dragRef = useRef<{ y: number; h: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: health } = usePolling(() => fetch('/health').then(r => r.json().catch(() => null)), 15000)
  const { data: scanner } = usePolling(() => authFetch(`/api/scanner/state?sport=${sport}`).then(r => r.json().catch(() => null)), 3000)
  const { data: fixturesData } = usePolling(() => authFetch(`/api/fixtures?sport=${sport}`).then(r => r.json().catch(() => null)), 10000)
  const { data: slipsOdds } = usePolling(() => authFetch(`/api/slips/odds?sport=${sport}`).then(r => r.json().catch(() => null)), 10000)
  const { data: calib } = usePolling(() => authFetch(`/api/analytics/calibration?sport=${sport}`).then(r => r.json().catch(() => null)), 6000)
  const { data: live } = usePolling(() => authFetch(`/api/live?sport=${sport}`).then(r => r.json().catch(() => null)), 5000)
  const { data: brain } = usePolling(() => authFetch('/api/brain/status').then(r => r.json().catch(() => null)), 5000)
  const { data: predsData } = usePolling(() => authFetch(`/api/predictions?sport=${sport}&limit=50`).then(r => r.json().catch(() => null)), 4000)

  const scannerState: any = scanner
  const fixtures: any[] = fixturesData?.fixtures || []
  // CANONICAL: predictions come from prediction_store (persisted), scanner recent is live telemetry only.
  // No duplicated recomputation — edge/calibration/risk are taken verbatim from Prediction.
  const predictions: any[] = (predsData?.predictions && predsData.predictions.length > 0 ? predsData.predictions : (scannerState?.recent_predictions || []))
  const isScanning = !!scannerState?.is_scanning
  const liveFixtures: any[] = live?.live || []

  const handleEvent = useCallback((e: any) => {
    const t = e.event_type || e.event || ''
    if (t === 'PREDICTION_CREATED' || t === 'SCANNER_PREDICTION_GENERATED') {
      setSelectedPred(e.data)
    }
  }, [])
  useWebSocket(handleEvent)

  const toggleScan = useCallback(async () => {
    if (isScanning) {
      // no stop endpoint yet — just notify
      return
    }
    await authFetch(`/api/scanner/scan-now?sport=${sport}`, { method: 'POST' })
  }, [isScanning, sport])

  // telemetry resize — container-relative, not window (60% of Dashboard viewport)
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.y - e.clientY
      const containerH = containerRef.current?.clientHeight ?? window.innerHeight
      const maxH = Math.round(containerH * 0.6)
      const next = Math.min(Math.max(dragRef.current.h + delta, TELEMETRY_MIN), maxH)
      setTelemetryHeight(next)
    }
    const onUp = () => { setIsDragging(false); document.body.style.cursor = ''; }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'ns-resize'
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); document.body.style.cursor = '' }
  }, [isDragging])

  const activePred = selectedPred || predictions[0] || null
  const activeFixtureObj = fixtures.find(f => f.id === activeFixture) || fixtures[0]

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden h-full">
      {/* HERO — compact */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-950/20 via-[#0d1117] to-blue-950/15 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center flex-shrink-0"><Trophy size={12} className="text-emerald-400" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-bold tracking-wider text-white">APEXSPORT</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-800/30 text-emerald-300">INTELLIGENCE • NOT A SPORTSBOOK</span>
                {brain && (
                  <span className={clsx('hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[10px]', brain.is_configured ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-yellow-900/20 border-yellow-800/30 text-yellow-400')}>
                    {brain.enabled_count}/{brain.total_agents} agents • {brain.is_configured ? `${brain.active_llm.provider}:${brain.active_llm.model.slice(0,18)}` : 'NO MODEL'}
                  </span>
                )}
              </div>
              <div className="hidden lg:block text-[11px] text-gray-500 leading-none mt-0.5">6 specialists → ensemble → calibration → value → risk → prediction → <span className="text-emerald-400">slip</span> • Providers hot-swappable • Markets canonical</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggleScan} disabled={isScanning} className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold tracking-wider border', isScanning ? 'bg-gray-800 text-gray-500 border-gray-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500')}>
              {isScanning ? <><Square size={12} /> SCANNING</> : <><Play size={12} /> SCAN NOW</>}
            </button>
            <a href="#scanner" onClick={() => document.dispatchEvent(new CustomEvent('apex:navigate', { detail: 'scanner' }))} className="hidden md:inline-flex px-2.5 py-1.5 rounded border border-[var(--border)] text-xs text-gray-400 hover:text-white">How to navigate →</a>
          </div>
        </div>
      </div>

      {/* Top bar: selectors + status — compact */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex-shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <select value={sport} onChange={e => { setSport(e.target.value as any); setSelectedPred(null) }} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white">
            <option value="football">Football</option><option value="basketball">Basketball</option>
          </select>
          <FixtureSelector value={activeFixture} onSelect={(id) => setActiveFixture(id)} sport={sport} />
          <span className="hidden sm:inline text-[10px] text-gray-600">{fixtures.length} fixtures • {liveFixtures.length} live • {predictions.length} predictions</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <ProviderIndicator compact />
          <span className={clsx('flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border', health ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-red-900/20 border-red-800/30 text-red-400')}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', health ? 'bg-emerald-400' : 'bg-red-400')} /> {health ? 'CONNECTED' : 'OFFLINE'}
          </span>
          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', isScanning ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400 animate-pulse' : 'bg-gray-800 border-gray-700 text-gray-500')}>{isScanning ? 'SCANNER ON' : 'IDLE'}</span>
          <span className="hidden md:inline text-[10px] text-gray-600">{scannerState?.instrument_universe?.by_competition ? Object.entries(scannerState.instrument_universe.by_competition).slice(0, 2).map(([k, v]: any) => `${k} ${v}`).join(' • ') : ''}</span>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-auto min-h-0">
        {/* Left: Fixture context + odds vs model */}
        <div className="col-span-7 flex flex-col border-r border-[var(--border)] min-h-0">
          <div className="p-2.5 flex-1 min-h-0 overflow-auto space-y-2.5">
            {/* Metrics — 4 cards, no hardcoding */}
            <div className="grid grid-cols-4 gap-2">
              <MetricCard label="UNIVERSE" value={`${scannerState?.fixtures_total || fixtures.length}`} sub={`${sport} • ${fixtures.length} fixtures`} />
              <MetricCard label="PREDICTIONS" value={`${scannerState?.predictions_generated || 0}`} sub={`${scannerState?.value_opportunities || 0} value`} color="text-emerald-400" />
              <MetricCard label="CALIBRATION" value={calib?.brier_score != null ? calib.brier_score.toFixed(3) : '—'} sub={`${calib?.resolved || 0}/${calib?.total_predictions || 0} resolved • Brier`} />
              <MetricCard label="LIVE / ODDS" value={`${liveFixtures.length} / ${slipsOdds?.count || 0}`} sub={`${liveFixtures.length} live • ${slipsOdds?.count || 0} odds`} color={liveFixtures.length ? 'text-emerald-400' : 'text-gray-500'} />
            </div>

            {/* Active fixture card */}
            {activeFixtureObj ? (
              <div className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-emerald-400" />
                    <span className="text-xs font-bold text-white">{activeFixtureObj.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#21262d] border border-[var(--border)] text-gray-400">{activeFixtureObj.competition}</span>
                    {liveFixtures.find((l: any) => l.id === activeFixtureObj.id) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 border border-red-800/30 text-red-400 animate-pulse">LIVE</span>}
                  </div>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10} />{new Date(activeFixtureObj.kickoff_at).toLocaleString()}</span>
                </div>
                {(() => {
                  const pred = predictions.find((p: any) => p.fixture_id === activeFixtureObj.id) || activePred
                  const odds = slipsOdds?.odds?.filter((o: any) => o.event_id === activeFixtureObj.id) || []
                  if (!pred && odds.length === 0) return <div className="text-xs text-gray-600 mt-2">No prediction yet — run <span className="text-emerald-400">SCAN NOW</span> to generate intelligence.</div>
                  return (
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-[10px] tracking-wider text-gray-500">MODEL vs MARKET</div>
                        {pred ? (
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between"><span className="text-gray-500">Market odds</span><span className="font-mono text-white">{pred.market_odds?.toFixed(2)} (imp {(pred.implied_probability * 100).toFixed(1)}%)</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Model prob</span><span className="font-mono text-white">{(pred.probability * 100).toFixed(1)}%</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Calibrated</span><span className="font-mono text-emerald-400">{(pred.calibrated_probability * 100).toFixed(1)}% (fair {pred.fair_odds})</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Edge / EV</span><span className={clsx('font-mono', (pred.edge || 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>{((pred.edge || 0) * 100).toFixed(1)}% / {pred.expected_value?.toFixed(2)}</span></div>
                          </div>
                        ) : <div className="text-xs text-gray-600">No model yet</div>}
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] tracking-wider text-gray-500">CANONICAL ODDS</div>
                        {odds.length ? odds.slice(0, 4).map((o: any) => (
                          <div key={o.id} className="flex justify-between text-xs"><span className="text-gray-500">{o.market} {o.selection}</span><span className="font-mono text-white">{o.price_decimal.toFixed(2)} <span className="text-gray-600">{o.bookmaker}</span></span></div>
                        )) : <div className="text-xs text-gray-600">No odds snapshot — connect The Odds API</div>}
                      </div>
                    </div>
                  )
                })()}
                <div className="mt-2 flex gap-2">
                  <button onClick={() => { setSport(sport); authFetch(`/api/scanner/scan-now?sport=${sport}`, { method: 'POST' }) }} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">SCAN THIS FIXTURE</button>
                  <a href="#slips" className="px-3 py-1.5 rounded border border-[var(--border)] text-xs text-gray-400 hover:text-white">Build slip →</a>
                </div>
              </div>
            ) : (
              <div className="rounded border border-dashed border-[var(--border)] p-4 text-center text-xs text-gray-600">No fixture selected</div>
            )}

            {/* Pipeline hint */}
            <div className="rounded border border-[var(--border)] bg-[#0d1117] p-2 flex items-center gap-1.5 text-[10px] font-mono text-gray-600 overflow-auto">
              <span>DATA</span><span className="text-emerald-600">→</span><span>FEATURES</span><span className="text-emerald-600">→</span><span>6× SPECIALISTS</span><span className="text-emerald-600">→</span><span>ENSEMBLE</span><span className="text-emerald-600">→</span><span>CALIBRATION</span><span className="text-emerald-600">→</span><span>VALUE</span><span className="text-emerald-600">→</span><span>RISK</span><span className="text-emerald-600">→</span><span className="text-white">PREDICTION</span>
            </div>
          </div>
        </div>

        {/* Right: Prediction detail + predictions list */}
        <div className="col-span-5 flex flex-col overflow-hidden min-h-0">
          <div className="p-3 border-b border-[var(--border)] flex-shrink-0">
            <h3 className="text-xs font-bold tracking-wider text-gray-400 flex items-center gap-2"><Target size={12} />SELECTED PREDICTION</h3>
            {activePred ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{activePred.fixture_label}</span>
                  <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', activePred.selection === 'HOME' ? 'bg-emerald-900/30 text-emerald-400' : activePred.selection === 'AWAY' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400')}>{activePred.selection}</span>
                  {activePred.is_value && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-800/30 text-emerald-400">VALUE</span>}
                  <span className="ml-auto text-lg font-bold text-white">{((activePred.calibrated_probability || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div><span className="text-gray-500">MARKET</span><div className="text-white">{activePred.market}</div></div>
                  <div><span className="text-gray-500">EDGE</span><div className={clsx((activePred.edge || 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>{((activePred.edge || 0) * 100).toFixed(1)}%</div></div>
                  <div><span className="text-gray-500">RISK</span><div className={clsx(activePred.risk_level === 'LOW' ? 'text-emerald-400' : 'text-yellow-400')}>{activePred.risk_level}</div></div>
                </div>
                <div className="text-[10px] text-gray-500">Confidence {(activePred.confidence * 100).toFixed(0)}% • via {activePred.competition} • {activePred.sport}</div>
                <button
                  onClick={async () => {
                    if (!activePred) return
                    const pid = activePred.id || activePred.fixture_id
                    const r = await authFetch('/api/slips/from-prediction-ids', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prediction_ids: [pid], sportsbook: 'generic' })
                    })
                    const j = await r.json()
                    if (j.error || j.validation_errors?.length) {
                      alert(`Slip validation failed: ${(j.validation_errors || [j.error]).join('; ')}`)
                      return
                    }
                    if (j.slip) {
                      // Persisted canonical Slip — navigate to Slips and preview
                      const slipId = j.slip.id
                      // Store for SlipPreview via detailSlip if user stays, or dispatch navigate event
                      document.dispatchEvent(new CustomEvent('apex:navigate', { detail: 'slips' }))
                      // Also keep inspector-like feedback
                      alert(`Slip created: ${slipId} — ${j.slip.selections.length} leg(s) • total ${j.slip.total_odds} • risk ${j.slip.risk_level || j.valid ? 'validated' : 'draft'}\nOpen Slips to preview & print. Prediction ID ${pid} traced → SlipSelection → Slip → SportsbookSlip.\nSportsbook mapping is at the edge (not influencing model).`)
                    } else {
                      alert(`Slip creation failed: ${JSON.stringify(j).slice(0,300)}`)
                    }
                  }}
                  className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold tracking-wider"
                >
                  BUILD SLIP FROM PREDICTION
                </button>
              </div>
            ) : (
              <div className="text-xs text-gray-600 text-center py-4">Run a scan — predictions appear here. Each shows probability vs confidence (distinct), calibrated prob, edge, EV, risk.</div>
            )}
          </div>
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-2 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
              <h3 className="text-xs font-bold tracking-wider text-gray-400">RECENT PREDICTIONS</h3>
              <span className="text-[10px] text-gray-600">{predictions.length} • click to inspect</span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--bg-secondary)]">
                  <tr className="text-gray-500 border-b border-[#30363d]"><th className="text-left py-1 px-2">Fixture</th><th className="text-left py-1 px-2">Pick</th><th className="text-right py-1 px-2">Odds</th><th className="text-right py-1 px-2">Prob</th><th className="text-right py-1 px-2">Edge</th><th className="text-right py-1 px-2">Risk</th></tr>
                </thead>
                <tbody>
                  {predictions.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-gray-600">No predictions — <button onClick={() => authFetch(`/api/scanner/scan-now?sport=${sport}`, { method: 'POST' })} className="text-emerald-400 underline">SCAN NOW</button></td></tr> : predictions.map((p: any) => <PredictionRow key={(p.id || p.fixture_id) + p.selection} p={p} onSelect={() => setSelectedPred(p)} onInspect={() => setInspectorId(p.id || p.fixture_id)} active={activePred?.fixture_id === p.fixture_id} />)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <PredictionInspector predId={inspectorId} onClose={() => setInspectorId(null)} />

      {/* Bottom resizable telemetry — fixed at bottom, VSCode-style drag handle */}
      <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col sticky bottom-0" style={{ height: `${telemetryHeight}px` }}>
        <div
          onMouseDown={(e) => { e.preventDefault(); dragRef.current = { y: e.clientY, h: telemetryHeight }; setIsDragging(true) }}
          className="group flex-shrink-0 h-2 -mt-1 flex items-center justify-center cursor-ns-resize border-t border-transparent hover:border-emerald-600/40 hover:bg-emerald-600/10 transition-colors"
          title="Drag to resize — hover near top edge"
        >
          <div className="w-12 h-1 rounded-full bg-[#30363d] group-hover:bg-emerald-500/60 transition-colors" />
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0">
          <h3 className="text-xs font-bold tracking-wider text-gray-400 flex items-center gap-2">LIVE INTELLIGENCE & PROVIDER HEALTH <span className="hidden sm:inline text-[9px] font-normal text-gray-600">— drag to resize</span></h3>
          <span className="text-[10px] text-gray-600">{liveFixtures.length} live • {predictions.length} predictions • {slipsOdds?.count || 0} odds</span>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-2 px-3 pb-2 overflow-hidden min-h-0">
          <div className="rounded border border-[var(--border)] bg-[#0d1117] p-2 overflow-auto">
            <div className="text-[10px] tracking-wider text-gray-500 mb-1">PROVIDERS & BRAIN</div>
            <ProviderIndicator />
            {brain && (
              <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-1">
                <div className="flex justify-between text-[10px]"><span className="text-gray-500">AI Brain</span><span className={clsx(brain.is_configured ? 'text-emerald-400' : 'text-yellow-400')}>{brain.enabled_count}/{brain.total_agents} agents</span></div>
                <div className="text-[10px] text-gray-500 truncate" title={brain.active_llm ? `${brain.active_llm.provider}:${brain.active_llm.model}` : 'no model'}>Model: {brain.is_configured ? `${brain.active_llm.provider}:${brain.active_llm.model.slice(0,28)}` : 'STUB (set in Settings → AI)'}</div>
                <div className="text-[9px] text-gray-600">Source of truth: Settings → AI & Models (persisted agents + selected model)</div>
              </div>
            )}
            <div className="text-[10px] text-gray-600 mt-2">Hot-swappable via Provider Registry. No core depends on Sportmonks.</div>
          </div>
          <div className="rounded border border-[var(--border)] bg-[#0d1117] p-2 overflow-auto">
            <div className="text-[10px] tracking-wider text-gray-500 mb-1">SCANNER PIPELINE</div>
            <div className="space-y-1">
              {(scannerState?.pipeline_stages || []).slice(-5).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[10px]"><span className={clsx(s.status === 'COMPLETE' ? 'text-emerald-400' : s.status === 'ACTIVE' ? 'text-yellow-400 animate-pulse' : 'text-gray-600')}>{s.status === 'COMPLETE' ? '✓' : s.status === 'ACTIVE' ? '●' : '○'}</span><span className="text-gray-300">{s.stage}</span><span className="text-gray-600">{s.fixture_id}</span></div>
              ))}
              {(!scannerState?.pipeline_stages || scannerState.pipeline_stages.length === 0) && <div className="text-[10px] text-gray-600">Idle — waiting for scan</div>}
            </div>
          </div>
          <div className="rounded border border-[var(--border)] bg-[#0d1117] p-2 overflow-auto">
            <div className="text-[10px] tracking-wider text-gray-500 mb-1">CALIBRATION</div>
            {calib ? (
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between"><span className="text-gray-500">Brier</span><span className="text-white font-mono">{calib.brier_score ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Resolved</span><span className="text-white">{calib.resolved}/{calib.total_predictions}</span></div>
                <div className="w-full bg-[#21262d] rounded h-1.5 mt-1"><div className="bg-emerald-600 h-1.5 rounded" style={{ width: `${Math.min(100, (calib.resolved / Math.max(1, calib.total_predictions)) * 100)}%` }} /></div>
              </div>
            ) : <div className="text-[10px] text-gray-600">No data — run backtest</div>}
          </div>
        </div>
      </div>
    </div>
  )
}