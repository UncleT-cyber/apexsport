import { useState, useMemo } from 'react'
import { authFetch } from '../services/auth'
import { usePolling } from '../hooks/usePolling'
import { useWebSocket } from '../hooks/useWebSocket'
import clsx from 'clsx'
import { PredictionInspector } from '../components/PredictionInspector'
import { useSlipCart } from '../services/slipCart'
import { Trophy, Filter, TrendingUp, AlertTriangle, Clock, Zap, ArrowRight, Search, X, ShoppingCart, Check, Trash2 } from 'lucide-react'

type Sport = 'football' | 'basketball' | ''
type MarketFilter = 'all' | 'MATCH_RESULT' | 'MONEYLINE' | 'OVER_UNDER' | 'BTTS'
type ValueFilter = 'all' | 'value' | 'novalue'

export function PredictionsPage() {
  const [sport, setSport] = useState<Sport>('football')
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all')
  const [valueFilter, setValueFilter] = useState<ValueFilter>('all')
  const [search, setSearch] = useState('')
  const [inspectorId, setInspectorId] = useState<string | null>(null)
  const [selectedPred, setSelectedPred] = useState<any>(null)
  const [liveOnly, setLiveOnly] = useState(false)
  const { has: slipHas, add: slipAdd, remove: slipRemove } = useSlipCart()

  const { data: scanner } = usePolling(() => authFetch(`/api/scanner/state?sport=${sport || 'football'}`).then(r => r.json()).catch(() => null), 4000)
  const { data: predsData } = usePolling(() => authFetch(`/api/predictions?sport=${sport || ''}&limit=50`).then(r => r.json()).catch(() => null), 4000)
  const { data: calib } = usePolling(() => authFetch(`/api/analytics/calibration?sport=${sport}`).then(r => r.json()).catch(() => null), 6000)
  const { data: live } = usePolling(() => authFetch(`/api/live?sport=${sport}`).then(r => r.json()).catch(() => null), 5000)

  const handleEvent = (e: any) => {
    const t = e.event_type || e.event || ''
    if (t === 'PREDICTION_CREATED' || t === 'SCANNER_PREDICTION_GENERATED') setSelectedPred(e.data)
  }
  useWebSocket(handleEvent)

  const predictions: any[] = useMemo(() => {
    // CANONICAL: predictions come from prediction_store via /api/predictions (persisted), scanner is telemetry.
    let preds: any[] = predsData?.predictions || scanner?.recent_predictions || []
    // live feed is NOT canonical predictions — only show as augment if no provenance, but mark clearly
    // We keep live augment only for fixtures not yet predicted, but they lack provenance (no specialists chain)
    if (live?.live) {
      const liveIds = new Set(preds.map((p: any) => p.fixture_id))
      for (const l of live.live) {
        if (!liveIds.has(l.id)) preds.push({ ...l, is_value: l.edge > 0, market: l.market || 'MATCH_RESULT', _liveAugment: true })
      }
    }
    // sport filter
    if (sport) preds = preds.filter((p: any) => p.sport === sport || !p.sport)
    // market filter
    if (marketFilter !== 'all') preds = preds.filter((p: any) => p.market === marketFilter)
    // value filter
    if (valueFilter === 'value') preds = preds.filter((p: any) => p.is_value)
    else if (valueFilter === 'novalue') preds = preds.filter((p: any) => !p.is_value)
    // search
    if (search.trim()) {
      const q = search.toLowerCase()
      preds = preds.filter((p: any) =>
        (p.fixture_label || '').toLowerCase().includes(q) ||
        (p.competition || '').toLowerCase().includes(q) ||
        (p.fixture_id || '').toLowerCase().includes(q)
      )
    }
    // live-only
    if (liveOnly) preds = preds.filter((p: any) => live?.live?.some((l: any) => l.id === p.fixture_id))
    return preds
  }, [scanner, live, sport, marketFilter, valueFilter, search, liveOnly])

  const activePred = selectedPred || predictions[0] || null

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <PredictionInspector predId={inspectorId} onClose={() => setInspectorId(null)} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Trophy size={18} className="text-emerald-400" />
          <div>
            <h1 className="text-sm font-bold tracking-widest text-white">PREDICTIONS — FULL INTELLIGENCE</h1>
            <div className="text-[10px] text-gray-500">Every prediction traces through: Features → 6 Specialists → Ensemble → Calibration → Value → Risk → Provenance</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={sport} onChange={e => setSport(e.target.value as Sport)} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
            <option value="">All Sports</option><option value="football">Football</option><option value="basketball">Basketball</option>
          </select>
          <select value={marketFilter} onChange={e => setMarketFilter(e.target.value as MarketFilter)} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
            <option value="all">All Markets</option><option value="MATCH_RESULT">MATCH_RESULT</option><option value="MONEYLINE">MONEYLINE</option><option value="OVER_UNDER">OVER/UNDER</option>
          </select>
          <select value={valueFilter} onChange={e => setValueFilter(e.target.value as ValueFilter)} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
            <option value="all">All Picks</option><option value="value">VALUE Only</option><option value="novalue">No Value</option>
          </select>
          <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer"><input type="checkbox" checked={liveOnly} onChange={e => setLiveOnly(e.target.checked)} className="accent-emerald-500" /> LIVE</label>
          <span className="text-[10px] text-gray-600">{predictions.length} predictions</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fixture, competition, or ID…" className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600/50" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"><X size={12} /></button>}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-2">
        <div className="p-2 bg-[#0d1117] rounded border border-[#30363d]">
          <div className="text-[9px] text-gray-500 tracking-wider">TOTAL</div>
          <div className="text-lg font-bold mt-0.5 text-white">{predictions.length}</div>
        </div>
        <div className="p-2 bg-[#0d1117] rounded border border-[#30363d]">
          <div className="text-[9px] text-gray-500 tracking-wider">VALUE</div>
          <div className="text-lg font-bold mt-0.5 text-emerald-400">{predictions.filter((p: any) => p.is_value).length}</div>
        </div>
        <div className="p-2 bg-[#0d1117] rounded border border-[#30363d]">
          <div className="text-[9px] text-gray-500 tracking-wider">AVG EDGE</div>
          <div className="text-lg font-bold mt-0.5 text-white">{(predictions.reduce((a: number, p: any) => a + (p.edge || 0), 0) / Math.max(1, predictions.length) * 100).toFixed(1)}%</div>
        </div>
        <div className="p-2 bg-[#0d1117] rounded border border-[#30363d]">
          <div className="text-[9px] text-gray-500 tracking-wider">AVG CAL PROB</div>
          <div className="text-lg font-bold mt-0.5 text-white">{(predictions.reduce((a: number, p: any) => a + (p.calibrated_probability || 0), 0) / Math.max(1, predictions.length) * 100).toFixed(0)}%</div>
        </div>
        <div className="p-2 bg-[#0d1117] rounded border border-[#30363d]">
          <div className="text-[9px] text-gray-500 tracking-wider">CALIBRATION</div>
          <div className="text-lg font-bold mt-0.5 text-white">{calib?.brier_score != null ? calib.brier_score.toFixed(3) : '—'}</div>
        </div>
      </div>

      {predictions.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <div className="text-sm mb-2">No predictions match filters</div>
          <div className="text-xs">Run a scan — predictions appear here with full intelligence provenance.</div>
          <button onClick={() => authFetch(`/api/scanner/scan-now?sport=${sport || 'football'}`, { method: 'POST' })} className="mt-3 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">SCAN NOW</button>
        </div>
      ) : (
        <div className="space-y-2">
          {predictions.map((p: any) => {
            const isActive = activePred?.fixture_id === p.fixture_id
            return (
              <div key={(p.id || p.fixture_id) + p.selection} onClick={() => setSelectedPred(p)} className={clsx('rounded border p-3 cursor-pointer transition', isActive ? 'bg-[#1a2332] border-emerald-800/30' : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className={clsx(p.is_value ? 'text-emerald-400' : 'text-gray-600')} />
                    <span className="text-sm font-bold text-white">{p.fixture_label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0d1117] border border-[var(--border)] text-gray-500">{p.competition}</span>
                    {live?.live?.some((l: any) => l.id === p.fixture_id) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/30 border border-red-800/30 text-red-400 animate-pulse">LIVE</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', p.selection==='HOME'?'bg-emerald-900/30 text-emerald-400': p.selection==='AWAY'?'bg-red-900/30 text-red-400':'bg-yellow-900/30 text-yellow-400')}>{p.selection}</span>
                    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', p.risk_level==='LOW'?'text-emerald-400 border-emerald-800/30':'text-yellow-400 border-yellow-800/30')}>{p.risk_level}</span>
                    {p.is_value && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-900/30 border border-emerald-800/30 text-emerald-400">VALUE</span>}
                    <button onClick={(e) => { e.stopPropagation(); setInspectorId(p.id || p.fixture_id) }} className="p-1 rounded hover:bg-[#21262d] text-gray-500 hover:text-white" title="Inspect why">🔍</button>
                    {(() => {
                      const pid = p.id || p.fixture_id
                      const inSlip = slipHas(pid)
                      return inSlip ? (
                        <button onClick={(e) => { e.stopPropagation(); slipRemove(pid) }} className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-900/30 border border-emerald-800/30 text-emerald-400 text-[10px] font-bold hover:bg-emerald-900/50" title="Remove from slip">ADDED ✓</button>
                      ) : (
                        <button onClick={async (e) => { e.stopPropagation(); const res = await slipAdd(p); if (!res.ok) alert(res.reason) }} className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white text-[10px] font-bold" title="Add to slip (cart)">ADD TO SLIP</button>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px]">
                  <span className="text-gray-500">Market: <span className="text-white">{p.market}</span></span>
                  <span className="text-gray-500">Odds: <span className="font-mono text-white">{p.market_odds?.toFixed(2)}</span></span>
                  <span className="text-gray-500">Prob: <span className="font-mono text-white">{(p.probability*100).toFixed(0)}%</span></span>
                  <span className="text-gray-500">Cal: <span className="font-mono text-emerald-400">{(p.calibrated_probability*100).toFixed(0)}%</span></span>
                  <span className="text-gray-500">Edge: <span className={clsx(p.edge>0?'text-emerald-400':'text-red-400')}>{((p.edge||0)*100).toFixed(1)}%</span></span>
                  <span className="text-gray-500">EV: <span className={clsx(p.expected_value>0?'text-emerald-400':'text-gray-400')}>{p.expected_value?.toFixed(2)}</span></span>
                  <span className="text-gray-600 ml-auto font-mono text-[9px]">{p.sport}/{p.prompt_paths ? Object.values(p.prompt_paths)[0] : p.model_used} • {p.competition}</span>
                </div>
                {p.prompt_paths && <div className="text-[9px] text-gray-600 mt-1 font-mono truncate">Prompt: {Object.values(p.prompt_paths).join(' • ').slice(0,90)}</div>}
                {p.is_value && <div className="mt-1.5 text-[9px] text-emerald-500">Fair odds {p.fair_odds} vs market {p.market_odds} → edge {(p.edge*100).toFixed(1)}%</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom — detail of selected */}
      {activePred && (
        <div className="p-3 rounded border border-emerald-800/20 bg-emerald-950/20">
          <div className="text-[10px] tracking-widest text-emerald-400 mb-2">SELECTED PREDICTION — {activePred.fixture_label}</div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-[10px] text-gray-500">Market / Pick</div>
              <div className="text-white font-bold">{activePred.market} → {activePred.selection}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">Probabilities</div>
              <div className="flex gap-2">
                 {Object.entries(activePred.probabilities || {}).map(([k,v]) => (
                   <span key={k} className="text-white font-mono">{k} {((v as number||0)*100).toFixed(0)}%</span>
                 ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">Calibrated / Edge / EV</div>
              <div className="text-emerald-400 font-mono">{(activePred.calibrated_probability*100).toFixed(1)}% • edge {((activePred.edge||0)*100).toFixed(1)}% • EV {activePred.expected_value?.toFixed(2)}</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setInspectorId(activePred.id || activePred.fixture_id)} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">INSPECT WHY</button>
            {(() => {
              const pid = activePred.id || activePred.fixture_id
              const inSlip = slipHas(pid)
              return inSlip ? (
                <button onClick={() => slipRemove(pid)} className="px-3 py-1.5 rounded bg-emerald-900/30 border border-emerald-800/30 text-emerald-400 text-xs font-bold flex items-center gap-1"><Check size={12}/> ADDED TO SLIP ✓ — REMOVE?</button>
              ) : (
                <button onClick={async () => { const res = await slipAdd(activePred); if (!res.ok) alert(res.reason) }} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"><ShoppingCart size={12}/> ADD TO SLIP</button>
              )
            })()}
            <button onClick={async () => {
              if (!activePred) return
              const pid = activePred.id || activePred.fixture_id
              // Canonical: add to slip first if not already, then BUILD via cart
              if (!slipHas(pid)) {
                const res = await slipAdd(activePred)
                if (!res.ok) { alert(res.reason); return }
              }
              document.dispatchEvent(new CustomEvent('apex:navigate', { detail: 'slips' }))
            }} className="px-3 py-1.5 rounded border border-[var(--border)] text-xs text-gray-400 hover:text-white">GO TO MY SLIP →</button>
          </div>
        </div>
      )}
    </div>
  )
}