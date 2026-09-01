import { useState } from 'react'
import { authFetch } from '../services/auth'
import { usePolling } from '../hooks/usePolling'
import clsx from 'clsx'
import { SlipPreview, PersistedSlipCard } from '../components/SlipPreview'
import { PredictionInspector } from '../components/PredictionInspector'
import { useSlipCart } from '../services/slipCart'

export function SlipsPage() {
  const [sport, setSport] = useState('football')
  const [sportsbook, setSportsbook] = useState('sportybet')
  const [optimized, setOptimized] = useState<any>(null)
  const [odds, setOdds] = useState<any>(null)
  const [selectedPredIds, setSelectedPredIds] = useState<Set<string>>(new Set())
  const [customSlip, setCustomSlip] = useState<any>(null)
  const [detailSlip, setDetailSlip] = useState<any>(null)
  const [inspectorId, setInspectorId] = useState<string | null>(null)
  const { items: cartItems, remove: cartRemove, clear: cartClear } = useSlipCart()
  const [validateState, setValidateState] = useState<any>(null)
  const [building, setBuilding] = useState(false)

  const { data: slipPreview } = usePolling(() => authFetch(`/api/slips/optimize?sport=${sport}`).then(r=>r.json()).catch(()=>null), 4000)
  const { data: exportPreview } = usePolling(() => authFetch(`/api/slips/export/preview?sport=${sport}&sportsbook=${sportsbook}`).then(r=>r.json()).catch(()=>null), 5000)
  const { data: predictionsData } = usePolling(() => authFetch(`/api/predictions?sport=${sport}&limit=12`).then(r=>r.json()).catch(()=>null), 5000)
  const { data: persistedData } = usePolling(() => authFetch(`/api/slips`).then(r=>r.json()).catch(()=>null), 4000)
  const { data: currentData } = usePolling(() => authFetch(`/api/slips/current`).then(r=>r.json()).catch(()=>null), 3000)
  const currentSlip: any = currentData?.slip || null
  const currentMeta: any = currentData?.meta || {}
  const staleness: any[] = currentData?.staleness || []

  const handleOptimize = async () => {
    const r = await authFetch(`/api/slips/optimize?sport=${sport}&max_selections=4&min_edge=0.03`, {method:'POST'})
    setOptimized(await r.json())
  }
  const handleOdds = async () => {
    const r = await authFetch(`/api/slips/odds?sport=${sport}`)
    setOdds(await r.json())
  }
  const handleCreateCustom = async () => {
    if (!selectedPredIds.size) return
    const r = await authFetch(`/api/slips/from-prediction-ids`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ prediction_ids: Array.from(selectedPredIds), sportsbook })
    })
    const j = await r.json()
    if (j.slip) setCustomSlip(j)
    setSelectedPredIds(new Set())
  }

  const slip = optimized?.slip || slipPreview?.slip
  const report = optimized?.report || slipPreview?.report
  const formatted = exportPreview?.formatted
  const predictions: any[] = predictionsData?.predictions || []
  const persisted: any[] = Array.isArray(persistedData) ? persistedData : (persistedData?.slips || [])
  const displayedSlip = detailSlip || customSlip?.slip || null

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <PredictionInspector predId={inspectorId} onClose={() => setInspectorId(null)} />

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xs font-bold tracking-widest text-white">BET SLIP BUILDER — CANONICAL</h2>
        <select value={sport} onChange={e=>setSport(e.target.value)} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-gray-300">
          <option value="football">Football</option><option value="basketball">Basketball</option>
        </select>
        <select value={sportsbook} onChange={e=>setSportsbook(e.target.value)} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-gray-300">
          <option value="sportybet">SportyBet</option><option value="bet9ja">Bet9ja</option><option value="betway">Betway</option><option value="draftkings">DraftKings</option><option value="fanduel">FanDuel</option><option value="generic">Generic</option>
        </select>
        <button onClick={handleOptimize} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">OPTIMIZE (correlation-aware)</button>
        <button onClick={handleOdds} className="px-3 py-1.5 rounded border border-[var(--border)] text-xs text-gray-400 hover:text-white">LOAD NORMALIZED ODDS</button>
        <span className="text-[10px] text-gray-600">{predictions.length} predictions • {persisted.length} persisted slips</span>
      </div>

      {report && (
        <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-xs">
          <div className="text-gray-400">Optimizer: <span className="text-white">{report.chosen}/{report.candidates} chosen</span> • correlation {report.correlation} • risk {report.overall_risk} • total odds {report.total_odds}</div>
          {report.rejected?.length>0 && <div className="text-[10px] text-gray-600 mt-1">Rejected: {report.rejected.slice(0,3).map((r:any)=>`${(r.event_id||'').slice(0,10)}: ${r.reason}`).join(' • ')}</div>}
          {!report.valid && <div className="text-red-400 text-[10px] mt-1">Validation: {report.validation_errors?.join(', ')}</div>}
        </div>
      )}

      {/* MY SLIP — Current workspace (cart) — shopping cart for predictions */}
      <div className="p-3 rounded border-2 border-emerald-800/40 bg-gradient-to-r from-emerald-950/20 to-[var(--bg-secondary)]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-bold tracking-widest text-white flex items-center gap-2">MY SLIP <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">{cartItems.length} selection{cartItems.length!==1?'s':''}</span> <span className="text-[10px] font-normal text-gray-500">• Current/uncommitted — shopping cart</span></div>
            <div className="text-[10px] text-gray-500">APEXSPORT • MY SLIP • {cartItems.length} SELECTIONS • Prediction → SlipSelection → Slip</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async()=>{ const r=await authFetch('/api/slips/current/validate',{method:'POST'}); const j=await r.json(); setValidateState(j); }} className="px-2 py-1 rounded border border-[var(--border)] text-[10px] text-gray-300 hover:text-white">VALIDATE SLIP</button>
            <button onClick={async()=>{
              setBuilding(true);
              const r=await authFetch('/api/slips/current/build',{method:'POST'});
              const j=await r.json();
              setBuilding(false);
              if (j.error) { alert(j.error + (j.rejected? '\nRejected: '+j.rejected.slice(0,2).map((x:any)=>x.reason).join('; '): '')); return; }
              if (j.slip) { setCustomSlip(j); setDetailSlip(j.slip); }
              if (j.removed?.length) alert(`Built slip ${j.slip.id} — optimizer removed ${j.removed.length} selection(s): ${j.removed.map((x:any)=>x.reason).join('; ')}\nNever silently removed — explanation shown.`);
            }} disabled={!currentSlip?.selections?.length || building} className={clsx('px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1', currentSlip?.selections?.length ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-[#21262d] text-gray-600')}>{building ? 'BUILDING…' : 'BUILD SLIP'}</button>
            <button onClick={()=>{ cartClear(); authFetch('/api/slips/current/clear',{method:'POST'}).catch(()=>{}) }} className="px-2 py-1 rounded border border-[var(--border)] text-[10px] text-red-400 hover:bg-red-900/10">CLEAR</button>
          </div>
        </div>

        {!currentSlip || !currentSlip.selections?.length ? (
          <div className="text-xs text-gray-600 py-4 text-center border border-dashed border-[var(--border)] rounded">
            <div className="text-sm text-gray-500 mb-1">Your slip is empty</div>
            <div className="text-[11px]">Browse <span className="text-emerald-400">Predictions</span> and click <span className="text-white">ADD TO SLIP</span> — selections appear here and persist as you navigate Dashboard ↔ Predictions ↔ Slips.</div>
            <div className="text-[10px] text-gray-600 mt-2">Each selection traces to its Prediction (prediction_id) — the Prediction is always the source of truth.</div>
          </div>
        ) : (
          <>
            {staleness.length > 0 && (
              <div className="mb-2 p-2 rounded bg-yellow-900/20 border border-yellow-800/30 text-[10px] text-yellow-400">
                ⚠ STALE: {staleness.length} selection(s) have stale market snapshots — odds may have changed. Use refresh/revalidation before finalizing.
                {staleness.map((s:any)=> <div key={s.prediction_id} className="font-mono text-[9px]">{s.prediction_id.slice(0,12)}: {s.reason}</div>)}
              </div>
            )}
            {validateState && !validateState.valid && (
              <div className="mb-2 p-2 rounded bg-red-900/20 border border-red-800/30 text-[10px] text-red-400">
                Validation: {validateState.errors?.join('; ')}
              </div>
            )}
            {validateState?.valid && <div className="mb-2 p-1.5 rounded bg-emerald-900/20 border border-emerald-800/30 text-[10px] text-emerald-400">✓ VALID — correlation {currentMeta.correlation} • risk {currentMeta.aggregate_risk}</div>}
            <div className="space-y-1.5 max-h-[320px] overflow-auto pr-1">
              {currentSlip.selections.map((s:any,i:number)=>(
                <div key={s.prediction_id || s.event_id + i} className="flex items-start justify-between p-2 rounded border border-[var(--border)] bg-[var(--bg-primary)]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-white font-bold truncate">{s.event_label}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-[#0d1117] border border-[var(--border)] text-gray-500">{s.sport} • {s.competition}</span>
                      <span className={clsx('text-[10px] font-bold px-1 py-0.5 rounded', s.selection==='HOME'?'bg-emerald-900/30 text-emerald-400': s.selection==='AWAY'?'bg-red-900/30 text-red-400':'bg-yellow-900/30 text-yellow-400')}>{s.selection}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {s.market} {s.sport==='basketball' ? '(MONEYLINE HOME/AWAY)' : s.sport==='football' ? '(MATCH_RESULT HOME/DRAW/AWAY)' : ''} • Odds {s.odds?.toFixed(2)} • Apex {(s.calibrated_probability*100||0).toFixed(1)}% • Edge {(s.edge*100||0).toFixed(1)}% • Risk {s.risk_level || ''}
                    </div>
                    <div className="text-[9px] font-mono text-gray-600 truncate">pred {s.prediction_id} • {s.model_used||''} • {s.sport}</div>
                    {staleness.some((x:any)=>x.prediction_id===s.prediction_id) && <div className="text-[9px] text-yellow-400">STALE</div>}
                  </div>
                  <div className="ml-2 flex flex-col gap-1">
                    <button onClick={()=>setInspectorId(s.prediction_id)} className="px-2 py-1 rounded border border-[var(--border)] text-[10px] text-gray-400 hover:text-white">VIEW PREDICTION</button>
                    <button onClick={()=>{ cartRemove(s.prediction_id); authFetch(`/api/slips/current/remove?prediction_id=${encodeURIComponent(s.prediction_id)}`,{method:'POST'}).catch(()=>{}) }} className="px-2 py-1 rounded bg-red-900/20 border border-red-800/30 text-[10px] text-red-400 hover:bg-red-900/30">REMOVE</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 rounded bg-[#0d1117] border border-[var(--border)] flex items-center justify-between text-xs">
              <div>
                <div className="text-gray-500">SLIP SUMMARY</div>
                <div className="text-white">Selections: {currentSlip.selections.length} • Combined Odds: <span className="font-mono font-bold">{currentSlip.total_odds?.toFixed(2) || currentSlip.selections.reduce((a:number,s:any)=>a*s.odds,1).toFixed(2)}</span> • Aggregate Risk: <span className={clsx(currentMeta.aggregate_risk==='LOW'?'text-emerald-400': 'text-yellow-400')}>{currentMeta.aggregate_risk || '—'}</span> • Correlation: {currentMeta.correlation ?? '—'}</div>
              </div>
              <div className="text-[10px] text-gray-600">State: {currentData?.state || 'DRAFT'} • {currentSlip.selections.length} leg{currentSlip.selections.length!==1?'s':''}</div>
            </div>
            {currentSlip.selections.length > 0 && <div className="mt-2"><SlipPreview slip={currentSlip} onInspectPrediction={setInspectorId} /></div>}
          </>
        )}
      </div>

      {/* PREDICTION PICKER — build custom slip from real predictions */}
      <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] tracking-widest text-gray-500">PREDICTION PICKER — select to build canonical slip ({sport})</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600">{selectedPredIds.size} selected</span>
            <button onClick={handleCreateCustom} disabled={!selectedPredIds.size} className={clsx('px-2 py-1 rounded text-xs font-bold', selectedPredIds.size ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-[#21262d] text-gray-600')}>CREATE SLIP FROM SELECTED</button>
            {selectedPredIds.size>0 && <button onClick={()=>setSelectedPredIds(new Set())} className="px-2 py-1 rounded border border-[var(--border)] text-xs text-gray-400">clear</button>}
          </div>
        </div>
        {!predictions.length ? (
          <div className="text-xs text-gray-600 py-3 text-center">No predictions for {sport} — <button onClick={() => authFetch(`/api/scanner/scan-now?sport=${sport}`, {method:'POST'})} className="text-emerald-400 underline">SCAN NOW</button> to generate provenance-traced predictions.</div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {predictions.map((p:any)=> {
              const pid = p.id || p.fixture_id
              const checked = selectedPredIds.has(pid)
              return (
                <label key={pid} className={clsx('flex items-start gap-2 p-2 rounded border cursor-pointer text-xs', checked ? 'bg-[#1a2332] border-emerald-800/30' : 'bg-[var(--bg-primary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]')}>
                  <input type="checkbox" checked={checked} onChange={e=>{
                    const ns = new Set(selectedPredIds)
                    if (e.target.checked) ns.add(pid); else ns.delete(pid)
                    setSelectedPredIds(ns)
                  }} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold truncate">{p.fixture_label}</span>
                      <span className={clsx('text-[10px] font-bold px-1 py-0.5 rounded', p.selection==='HOME'?'bg-emerald-900/30 text-emerald-400': p.selection==='AWAY'?'bg-red-900/30 text-red-400':'bg-yellow-900/30 text-yellow-400')}>{p.selection}</span>
                      <span className="text-[10px] text-gray-600">{p.market}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{p.competition} • {p.market_odds?.toFixed(2)} @ {(p.calibrated_probability*100).toFixed(0)}% cal • edge {(p.edge*100).toFixed(1)}% • <span className={clsx(p.risk_level==='LOW'?'text-emerald-400':'text-yellow-400')}>{p.risk_level}</span></div>
                    <div className="text-[9px] font-mono text-gray-600 truncate">{pid}</div>
                  </div>
                  <button onClick={(e)=>{e.preventDefault(); setInspectorId(pid)}} className="p-1 text-gray-500 hover:text-white" title="Inspect why">🔍</button>
                </label>
              )
            })}
          </div>
        )}
        {customSlip && (
          <div className="mt-3 p-2 rounded border border-emerald-800/30 bg-emerald-900/10">
            <div className="text-[10px] tracking-widest text-emerald-400 mb-1">CUSTOM SLIP CREATED — {customSlip.slip?.id}</div>
            <SlipPreview slip={customSlip.slip} report={customSlip} onInspectPrediction={setInspectorId} />
            {!customSlip.valid && <div className="text-[10px] text-red-400 mt-1">{customSlip.validation_errors?.join(', ')}</div>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-primary)]">
          <div className="text-[10px] tracking-widest text-gray-500 mb-2">CANONICAL SLIP — OPTIMIZER (sportsbook-independent)</div>
          {!slip || !slip.selections?.length ? <div className="text-xs text-gray-600">No value selections yet. Run a scan first — optimizer respects edge ≥3%, confidence ≥40%, correlation ≤0.70.</div> : (
            <SlipPreview slip={slip} report={report} onInspectPrediction={setInspectorId} />
          )}
          {slip?.id && (
            <div className="mt-2 flex gap-2">
              <button onClick={async()=>{
                const r = await authFetch(`/api/slips/${slip.id}`)
                setDetailSlip(await r.json())
              }} className="text-[10px] px-2 py-1 rounded border border-[var(--border)] text-gray-400 hover:text-white">VIEW PERSISTED DETAIL</button>
              <button onClick={async()=>{
                const r = await authFetch(`/api/slips/${slip.id}/export?sportsbook=${sportsbook}`, {method:'POST'})
                const j = await r.json()
                alert(JSON.stringify(j, null, 2))
              }} className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white">EXPORT → {sportsbook.toUpperCase()}</button>
            </div>
          )}
        </div>

        <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-primary)]">
          <div className="text-[10px] tracking-widest text-gray-500 mb-2">SPORTSBOOK EXPORT PREVIEW — {sportsbook.toUpperCase()} (edge mapping)</div>
          {!formatted ? <div className="text-xs text-gray-600">Select sportsbook to see canonical → book mapping.</div> : (
            <>
              <div className="space-y-1">
                {formatted.selections.map((s:any,i:number)=>(
                  <div key={i} className="text-xs flex justify-between border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--bg-secondary)]">
                    <span className="text-gray-300">{s.event} <span className="text-gray-600">({s.canonical_market} → {s.market})</span></span>
                    <span className="text-white">{s.selection} @ {s.odds}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">Book total: <span className="text-white">{formatted.total_odds}</span> • {formatted.count} legs</div>
              {formatted.booking_code && <div className="text-[10px] text-yellow-400 mt-1">Booking code: {formatted.booking_code} (external)</div>}
              <div className="text-[10px] text-gray-600 mt-2">Formatting only at edge — core slip stays canonical. Never invents booking codes.</div>
            </>
          )}
        </div>
      </div>

      {/* PERSISTED SLIPS — dynamic, no hardcoding */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="text-[10px] tracking-widest text-gray-500 mb-2">PERSISTED SLIPS — CANONICAL STORE ({persisted.length})</div>
          {!persisted.length ? <div className="text-xs text-gray-600 py-4 text-center">No persisted slips yet — optimize or create from picker.</div> : (
            <div className="space-y-1.5 max-h-[320px] overflow-auto pr-1">
              {persisted.map((s:any)=>(
                <PersistedSlipCard key={s.id} slip={s} onSelect={()=>setDetailSlip(s)} active={detailSlip?.id===s.id} />
              ))}
            </div>
          )}
        </div>
        <div className="col-span-2 p-3 rounded border border-[var(--border)] bg-[var(--bg-primary)]">
          <div className="text-[10px] tracking-widest text-gray-500 mb-2">SLIP DETAIL — DYNAMIC PREVIEW {detailSlip ? `• ${detailSlip.id}` : ''}</div>
          {!detailSlip ? <div className="text-xs text-gray-600 py-6 text-center">Select a persisted slip to inspect its dynamic preview — each selection traces to its Prediction (🔍).</div> : (
            <>
              <SlipPreview slip={detailSlip} onInspectPrediction={setInspectorId} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={async()=>{
                  const r = await authFetch(`/api/slips/${detailSlip.id}/validate`, {method:'POST'})
                  const j = await r.json()
                  alert(j.valid ? 'VALID' : `INVALID: ${j.errors.join(', ')}`)
                }} className="px-2 py-1 rounded border border-[var(--border)] text-xs text-gray-400 hover:text-white">VALIDATE</button>
                <button onClick={()=>{
                  // Trigger SlipPreview print via opening PDF endpoint
                  window.open(`/api/slips/${detailSlip.id}/export/pdf`, '_blank')
                }} className="px-2 py-1 rounded bg-[#21262d] border border-[var(--border)] text-xs text-white hover:bg-[#30363d]">PRINT / PDF</button>
                <button onClick={async()=>{
                  const r = await authFetch(`/api/slips/${detailSlip.id}/export/json`)
                  const j = await r.json()
                  const blob = new Blob([JSON.stringify(j, null, 2)], {type:'application/json'})
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `apex-slip-${detailSlip.id}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }} className="px-2 py-1 rounded border border-[var(--border)] text-xs text-gray-300 hover:text-white">EXPORT JSON</button>
                <button onClick={async()=>{
                  const r = await authFetch(`/api/slips/${detailSlip.id}/export?sportsbook=${sportsbook}`, {method:'POST'})
                  const j = await r.json()
                  if (j.error && j.status) alert(`${j.status}: ${j.error}`)
                  else alert(JSON.stringify(j, null, 2))
                }} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs">EXPORT {sportsbook.toUpperCase()}</button>
                <button onClick={async()=>{
                  await authFetch(`/api/slips/${detailSlip.id}`, {method:'DELETE'})
                  setDetailSlip(null)
                }} className="px-2 py-1 rounded border border-red-900/50 text-xs text-red-400 hover:bg-red-900/10">DELETE</button>
              </div>
              <div className="text-[10px] text-gray-600 mt-1">Canonical JSON export is portable (not provider-specific). Provider export is separate layer — if provider not connected: NOT CONNECTED; if adapter cannot generate execution representation: EXPORT NOT AVAILABLE.</div>
            </>
          )}
        </div>
      </div>

      {odds && (
        <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="text-[10px] tracking-widest text-gray-500 mb-2">NORMALIZED CANONICAL ODDS — {sport} ({odds.count})</div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            {odds.odds.slice(0,9).map((o:any,i:number)=>(
              <div key={i} className="border border-[var(--border)] rounded px-2 py-1 bg-[var(--bg-primary)]">
                <div className="text-gray-400">{o.event_id} {o.market} {o.selection}</div>
                <div className="text-white">{o.price_decimal.toFixed(2)} <span className="text-gray-600">via {o.bookmaker}</span> {o.is_stale && <span className="text-red-400">STALE</span>}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}