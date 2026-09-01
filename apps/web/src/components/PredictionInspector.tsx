import { useState, useEffect } from 'react'
import clsx from 'clsx'

export function PredictionInspector({ predId, onClose }: { predId: string | null; onClose: () => void }) {
  const [pred, setPred] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showJson, setShowJson] = useState(false)

  useEffect(() => {
    if (!predId) return
    setLoading(true)
    fetch(`/api/predictions/${predId}`)
      .then(r => r.json())
      .then(p => {
        setPred(p)
        // Expose context for Copilot (Prediction → Copilot)
        try {
          document.dispatchEvent(new CustomEvent('apex:copilot-context' as any, { detail: { type: 'prediction', prediction_id: p.id || predId, fixture_id: p.fixture_id, sport: p.sport, market: p.market } }))
        } catch {}
      })
      .catch(() => setPred(null))
      .finally(() => setLoading(false))
  }, [predId])

  if (!predId) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[720px] max-w-[90vw] bg-[var(--bg-primary)] border-l border-[var(--border)] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-xs font-bold tracking-wider text-white">PREDICTION INSPECTOR — FULL PROVENANCE</div>
            <div className="text-[10px] text-gray-500">{pred?.fixture_label || predId} • {pred?.sport} • {pred?.market} {pred?.selection}</div>
            {pred?.provenance && (
              <div className="text-[9px] text-emerald-400 font-mono mt-0.5">Provenance: {pred.provenance.sport} → {pred.provenance.pipeline_version} / {pred.feature_version}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowJson(!showJson)} className="px-2 py-1 rounded border border-[var(--border)] text-[10px] text-gray-400 hover:text-white">{showJson ? 'Hide JSON' : 'Raw JSON'}</button>
            <button onClick={onClose} className="px-2 py-1 rounded bg-[#21262d] text-xs text-gray-400 hover:text-white">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-3">
          {loading ? (
            <div className="text-xs text-gray-500 p-4">Loading provenance…</div>
          ) : !pred ? (
            <div className="text-xs text-gray-600 p-4">Prediction not found</div>
          ) : showJson ? (
            <pre className="text-[10px] font-mono text-gray-300 whitespace-pre-wrap break-words bg-[#0d1117] p-3 rounded border border-[var(--border)] overflow-auto max-h-[70vh]">{JSON.stringify(pred, null, 2)}</pre>
          ) : (
            <>
              {/* WHY APEX? — concise analytical explanation (not chain-of-thought dump) */}
              <div className="rounded border border-emerald-800/30 bg-emerald-950/20 p-3">
                <div className="text-[10px] tracking-widest text-emerald-400 mb-1">WHY APEX?</div>
                <div className="text-xs text-gray-200 leading-relaxed">
                  {pred.is_value ? (
                    <>
                      Apex identified <span className="text-emerald-400 font-bold">positive value</span> after comparing the calibrated probability ({(pred.calibrated_probability*100).toFixed(1)}%) against the current market price (implied {(pred.implied_probability*100).toFixed(1)}%). Edge +{((pred.edge||0)*100).toFixed(1)}% • EV {pred.expected_value?.toFixed(2)} • {pred.is_value ? 'VALUE' : 'NO VALUE'} at {pred.market_odds} odds.
                    </>
                  ) : (
                    <>
                      Apex assessed this fixture at {(pred.calibrated_probability*100).toFixed(1)}% calibrated (raw {(pred.probability*100).toFixed(1)}% {pred.calibration_active ? 'calibrated active' : 'calibration insufficient data'}), versus market implied {(pred.implied_probability*100).toFixed(1)}% at {pred.market_odds} odds. Edge {((pred.edge||0)*100).toFixed(1)}% — {pred.is_value ? 'VALUE' : 'NO VALUE'}.
                    </>
                  )}{' '}
                  {pred.specialist_outputs?.length > 0 && (
                    <>Key supporting factors included {pred.specialist_outputs.slice(0,2).map((s:any)=> s.key_factors?.[0] || s.specialist_id).join(', ')}.</>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 mt-1.5">AI analysis (6 specialists) + Apex deterministic mathematics (ensemble → calibration → value → risk) are kept separate — you can inspect each below. No private chain-of-thought is exposed.</div>
              </div>

              {/* AI INTELLIGENCE — transparent provenance */}
              <Section title="AI INTELLIGENCE — transparent provenance" defaultOpen>
                <div className="text-[10px] text-gray-500 mb-2">Actual execution record — not hardcoded. Provider adapters never influence the intelligence model.</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Primary Model</span><div className="text-white font-mono">{pred.model_used} <span className="text-gray-600">({pred.provider_used})</span></div><div className="text-[9px] text-gray-600">Model version: v1 • Pipeline: {pred.pipeline_version}</div></div>
                  <div><span className="text-gray-500">Feature Snapshot</span><div className="text-white font-mono">{pred.feature_snapshot_id?.slice(0,16)}…</div><div className="text-[9px] text-gray-600">Feature version: {pred.feature_version}</div></div>
                  <div><span className="text-gray-500">Specialists</span><div className="text-white">{pred.agents_used || pred.specialist_outputs?.length || 0} • {pred.sport} sport-aware</div><div className="text-[9px] text-gray-600">Each uses sport-specific prompt + features</div></div>
                  <div><span className="text-gray-500">Evaluation</span><div className="text-white font-mono text-[11px]">{pred.created_at ? new Date(pred.created_at).toLocaleString() : '—'}</div><div className="text-[9px] text-gray-600">ID {pred.id}</div></div>
                </div>
                <div className="mt-2">
                  <div className="text-[10px] text-gray-400 font-bold">Models involved</div>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {(pred.provenance?.specialists || pred.specialist_outputs || []).slice(0,6).map((s:any,i:number)=>(
                      <div key={i} className="px-2 py-1 rounded bg-[#0d1117] border border-[var(--border)] text-[10px]">
                        <div className="text-white font-medium">{s.specialist || s.specialist_id}</div>
                        <div className="text-gray-500 font-mono">Model: {s.model || pred.model_used}</div>
                        <div className="text-emerald-400 font-mono">Prompt: {s.prompt_path || `${pred.sport}/${s.specialist || s.specialist_id}/v1`}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-2">Prompt versions</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(pred.prompt_paths ? Object.entries(pred.prompt_paths) : (pred.provenance?.specialists || []).map((s:any)=>[s.specialist, s.prompt_path])).map(([k,v]:any)=>(
                      <span key={k} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/10 border border-emerald-800/20 text-emerald-400">{String(v)}</span>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-2 font-mono">Pipeline: Features → Specialists → Ensemble (deterministic) → Calibration (raw vs calibrated) → Value (edge/EV) → Risk → Prediction</div>
                  <div className="text-[9px] text-gray-500 mt-1">Deterministic calculations (probability handling, ensemble, calibration, implied/fair/edge/EV/risk/correlation) are never delegated to the LLM.</div>
                </div>
              </Section>

              {/* MATCH CONTEXT */}
              <Section title="MATCH CONTEXT" defaultOpen>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Fixture</span><div className="text-white font-medium">{pred.fixture_label} ({pred.fixture_id})</div></div>
                  <div><span className="text-gray-500">Competition</span><div className="text-white">{pred.competition} • <span className="px-1 py-0.5 rounded bg-emerald-900/20 border border-emerald-800/20 text-emerald-400 font-mono text-[10px]">{pred.sport}</span></div></div>
                  <div><span className="text-gray-500">Market</span><div className="text-white">{pred.market} → {pred.selection} <span className="text-gray-600 text-[10px]">({pred.sport === 'basketball' ? 'MONEYLINE HOME/AWAY' : pred.sport === 'football' ? 'MATCH_RESULT HOME/DRAW/AWAY' : pred.market})</span></div></div>
                  <div><span className="text-gray-500">Kickoff</span><div className="text-white">{pred.kickoff_at ? new Date(pred.kickoff_at).toLocaleString() : '—'}</div></div>
                  <div><span className="text-gray-500">Pipeline</span><div className="text-white font-mono">{pred.pipeline_version} • {pred.feature_version}</div></div>
                  <div>
                    <span className="text-gray-500">Model</span>
                    <div className="text-white font-mono text-[11px]">{pred.model_used} <span className="text-gray-600">({pred.provider_used})</span></div>
                    {pred.prompt_paths && Object.keys(pred.prompt_paths).length > 0 && (
                      <div className="text-[9px] text-gray-600 font-mono mt-0.5">Prompt paths: {Object.values(pred.prompt_paths).slice(0,2).join(', ')}</div>
                    )}
                  </div>
                </div>
                {pred.provenance && (
                  <div className="mt-2 p-2 rounded bg-emerald-950/20 border border-emerald-900/20">
                    <div className="text-[9px] tracking-widest text-emerald-400">PROVENANCE CHAIN</div>
                    <div className="text-[10px] font-mono text-gray-300 mt-1">
                      {pred.sport} → {pred.provenance.specialists?.length || pred.specialist_outputs?.length || 0} specialists → Model {pred.model_used} → Feature {pred.feature_snapshot_id} → Pipeline {pred.pipeline_version}
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1">Every prediction records: sport / specialist / model / model_version / prompt_version / prompt_path / feature_snapshot_id / pipeline_version</div>
                  </div>
                )}
              </Section>

              {/* FEATURES */}
              <Section title={`FEATURES — ${pred.sport} specific`}>
                <div className="text-[10px] text-gray-500 mb-1">Sport-aware: {pred.sport === 'football' ? 'xG, xGA, goals, clean_sheets, home_away_form' : pred.sport === 'basketball' ? 'pace, offensive_rating, defensive_rating, rest_days, rotation' : 'sport-specific evidence'} — never cross-leaks football features into basketball</div>
                <div className="space-y-1">
                  {(pred.feature_snapshot?.groups || []).map((g: any) => (
                    <div key={g.name} className={clsx('flex items-center justify-between px-2 py-1.5 rounded border text-xs', g.status === 'available' ? 'bg-emerald-900/10 border-emerald-800/20' : g.status === 'unavailable' ? 'bg-gray-800 border-gray-700' : 'bg-yellow-900/10 border-yellow-800/20')}>
                      <span className={clsx('font-medium', g.status === 'available' ? 'text-emerald-400' : g.status === 'unavailable' ? 'text-gray-500' : 'text-yellow-400')}>{g.name}</span>
                      <span className="text-[10px] text-gray-500">{g.status}{g.unavailable_reason ? ` — ${g.unavailable_reason.slice(0,80)}` : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-gray-600 mt-1">Snapshot {pred.feature_snapshot?.id} • <span className="font-mono">{pred.feature_snapshot?.sport || pred.sport}</span> • {pred.feature_snapshot?.groups?.filter((g:any)=>g.status==='available').length || 0}/{pred.feature_snapshot?.groups?.length || 0} available</div>
              </Section>

              {/* AI BRAIN — sport-aware */}
              <Section title={`AI BRAIN — ${pred.agents_used || (pred.specialist_outputs?.length || 0)} specialists (${pred.sport})`}>
                <div className="text-[10px] text-gray-500 mb-2">Each specialist uses a sport-specific prompt + feature context. Shared contracts, sport-specific intelligence.</div>
                <div className="space-y-2">
                  {(pred.specialist_outputs || []).map((s: any) => (
                    <div key={s.specialist_id} className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{s.specialist_id}</span>
                        <span className="text-[9px] text-emerald-400 font-mono bg-emerald-900/20 border border-emerald-800/20 rounded px-1.5 py-0.5">{s.prompt_path || `${s.sport || pred.sport}/${s.specialist_id}/${s.prompt_version}`} </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className="text-gray-500">Model</span><span className="text-white font-mono">{s.model} <span className="text-gray-600">({s.model_version})</span></span>
                        <span className="text-gray-500">Prompt</span><span className="text-emerald-400 font-mono">{s.prompt_version}</span>
                        <span className={clsx('px-1 py-0.5 rounded text-[9px] border', s.prompt_status === 'not_implemented' ? 'bg-red-900/20 border-red-800/30 text-red-400' : 'bg-emerald-900/10 border-emerald-800/20 text-emerald-400')}>{s.prompt_status || 'available'}</span>
                      </div>
                      <div className="text-xs text-gray-300 mt-1">{s.assessment}</div>
                      <div className="grid grid-cols-3 gap-1 mt-1.5 text-[10px]">
                        {Object.entries(s.probabilities || {}).map(([k, v]: any) => (
                          <div key={k} className="flex justify-between bg-[#0d1117] rounded px-1.5 py-0.5"><span className="text-gray-500">{k}</span><span className="text-white font-mono">{(v*100).toFixed(1)}%</span></div>
                        ))}
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {(s.evidence || []).slice(0,2).map((e: any, i: number) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#0d1117] border border-[var(--border)] text-gray-400">{e.feature}: {String(e.observation).slice(0,40)}</span>
                        ))}
                      </div>
                      {s.warnings?.length >0 && <div className="text-[9px] text-yellow-400 mt-1">⚠ {s.warnings.join(' • ')}</div>}
                      <div className="text-[9px] text-gray-600 mt-1 font-mono">{s.sport || pred.sport}/{s.specialist_id} → {s.model} → {s.prompt_path || `${pred.sport}/${s.specialist_id}/${s.prompt_version}`}</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* ENSEMBLE */}
              <Section title="ENSEMBLE — deterministic">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-gray-500">Probabilities</span><div className="font-mono text-white">{Object.entries(pred.ensemble?.probabilities || {}).map(([k,v]:any)=>`${k} ${(v*100).toFixed(0)}%`).join(' • ') || '—'}</div></div>
                  <div><span className="text-gray-500">Disagreement</span><div className="font-mono text-white">{pred.ensemble?.disagreement ?? '—'}</div></div>
                  <div><span className="text-gray-500">Confidence</span><div className="font-mono text-white">{pred.ensemble ? (pred.ensemble.confidence*100).toFixed(0)+'%' : (pred.confidence*100).toFixed(0)+'%'}</div></div>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">Deterministic weighted average by confidence • shared interface • sport-agnostic math</div>
              </Section>

              {/* CALIBRATION */}
              <Section title="CALIBRATION">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-gray-500">Raw</span><div className="font-mono text-white">{(pred.probability*100).toFixed(1)}%</div></div>
                  <div><span className="text-gray-500">Calibrated</span><div className="font-mono text-emerald-400">{(pred.calibrated_probability*100).toFixed(1)}%</div></div>
                  <div><span className="text-gray-500">Status</span><div className={clsx('text-[10px] px-1.5 py-0.5 rounded inline-block', pred.calibration_active ? 'bg-emerald-900/20 text-emerald-400' : 'bg-yellow-900/20 text-yellow-400')}>{pred.calibration_active ? 'ACTIVE' : 'INSUFFICIENT_DATA'}</div></div>
                </div>
              </Section>

              {/* VALUE */}
              <Section title={`VALUE — deterministic (${pred.market})`}>
                <div className="text-[10px] text-gray-500 mb-1">{pred.sport === 'basketball' ? 'MONEYLINE HOME/AWAY — no draw' : pred.sport === 'football' ? 'MATCH_RESULT HOME/DRAW/AWAY' : ''} • sport-aware market semantics</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-gray-500">Market odds</span><div className="font-mono text-white">{pred.market_odds?.toFixed(2)} (imp {(pred.implied_probability*100).toFixed(1)}%)</div></div>
                  <div><span className="text-gray-500">Fair odds</span><div className="font-mono text-white">{pred.fair_odds?.toFixed(2)}</div></div>
                  <div><span className="text-gray-500">Edge / EV</span><div className={clsx('font-mono', (pred.edge||0)>0 ? 'text-emerald-400' : 'text-red-400')}>{((pred.edge||0)*100).toFixed(1)}% / {pred.expected_value?.toFixed(2)}</div></div>
                </div>
              </Section>

              {/* RISK */}
              <Section title="RISK — independent">
                <div className="flex items-center gap-2 text-xs">
                  <span className={clsx('px-2 py-0.5 rounded border text-xs font-bold', pred.risk_level==='LOW' ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : pred.risk_level==='MEDIUM' ? 'bg-yellow-900/20 border-yellow-800/30 text-yellow-400' : 'bg-red-900/20 border-red-800/30 text-red-400')}>{pred.risk_level}</span>
                  <span className="text-gray-500">Market: {pred.market_snapshot?.status || 'available'} • {pred.market_snapshot?.entries || 0} odds</span>
                </div>
              </Section>

              {/* FINAL */}
              <div className="rounded border border-emerald-800/30 bg-emerald-900/10 p-3">
                <div className="text-[10px] tracking-wider text-emerald-400">FINAL PREDICTION — {pred.sport.toUpperCase()}</div>
                <div className="text-lg font-bold text-white mt-1">{pred.selection} <span className="text-sm font-normal text-gray-400">via {pred.market}</span> <span className="float-right font-mono">{(pred.calibrated_probability*100).toFixed(0)}% calibrated</span></div>
                <div className="text-[10px] text-gray-500 mt-1">ID {pred.id} • {new Date(pred.created_at || Date.now()).toLocaleString()} • pipeline {pred.pipeline_version} • feature {pred.feature_snapshot_id}</div>
                {pred.provenance && (
                  <div className="text-[9px] text-gray-600 mt-1 font-mono">
                    Provenance: {pred.sport} → {pred.provenance.specialists?.map((s:any)=> s.specialist + ':' + s.prompt_path).slice(0,2).join(' • ')}
                  </div>
                )}
              </div>

              {/* CROSS-LINKS */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { document.dispatchEvent(new CustomEvent('apex:copilot-context' as any, { detail: { type: 'prediction', prediction_id: pred.id } })); document.dispatchEvent(new CustomEvent('apex:open-copilot' as any, { detail: { type: 'prediction', prediction_id: pred.id } })) }} className="px-2 py-1.5 rounded border border-emerald-800/30 bg-emerald-900/10 text-[11px] text-emerald-400 hover:bg-emerald-900/20">Ask Copilot → WHY APEX?</button>
                <button onClick={() => { window.dispatchEvent(new CustomEvent('apex:navigate' as any, { detail: 'analytics' })); }} className="px-2 py-1.5 rounded border border-[var(--border)] text-[11px] text-gray-400 hover:text-white">View in Analytics →</button>
                <button onClick={() => {
                  // ADD TO SLIP cross-link
                  fetch(`/api/slips/current/add?prediction_id=${encodeURIComponent(pred.id)}`, { method: 'POST' })
                    .then(r => r.json().then(j => ({ ok: r.ok, j })))
                    .then(({ ok, j }) => {
                      if (!ok) alert(j.detail || 'Add to slip failed')
                      else { document.dispatchEvent(new CustomEvent('apex:navigate' as any, { detail: 'slips' })) }
                    })
                }} className="px-2 py-1.5 rounded bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-500">ADD TO SLIP →</button>
                <button onClick={() => { navigator.clipboard?.writeText(pred.id); alert('Prediction ID copied: ' + pred.id) }} className="px-2 py-1.5 rounded border border-[var(--border)] text-[11px] text-gray-400 hover:text-white">Copy ID</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--bg-tertiary)]">
        <span className="text-xs font-bold tracking-wider text-gray-400">{title}</span>
        <span className="text-gray-500 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="p-3 border-t border-[var(--border)]">{children}</div>}
    </div>
  )
}
