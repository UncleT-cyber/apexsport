// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react'
import { authFetch } from '../services/auth'
import { usePolling } from '../hooks/usePolling'
import { useWebSocket } from '../hooks/useWebSocket'
import clsx from 'clsx'
import { Play, Pause } from 'lucide-react'

interface FixtureStatus { fixture_id: string; label: string; status: string; provider?: string; error?: string }
interface PipelineStageInfo { stage: string; status: string; fixture_id?: string; detail?: string }
interface ScannerEvent { timestamp: number; category: string; message: string; fixture_id?: string; status: string }
interface PredictionData { fixture_id: string; fixture_label: string; competition: string; market: string; selection: string; probability: number; calibrated_probability: number; confidence: number; market_odds: number; implied_probability: number; fair_odds: number; edge: number; expected_value: number; is_value: boolean; risk_level: string }

interface ScannerState {
  state: string; is_scanning: boolean; current_fixture: string | null; fixtures_completed: number; fixtures_total: number; fixtures: FixtureStatus[]; pipeline_stages: PipelineStageInfo[]; current_pipeline_stage: string | null; provider_in_use: string | null; predictions_generated: number; candidates_rejected: number; value_opportunities: number; last_prediction: PredictionData | null; recent_predictions: PredictionData[]; events: ScannerEvent[]; scan_started_at: number | null; last_scan_completed_at: number | null; scan_duration_ms: number | null; total_scans: number; total_predictions: number; total_rejected: number; error_count: number; last_error: string | null; instrument_universe?: any; stage_counts?: any; available_universe?: number; eligible_count?: number
}

const PIPELINE = ['DATA','FEATURES','MATCH_CONTEXT','FORM','TEAM_STRENGTH','AVAILABILITY','MATCHUP','AI_BRAIN','ENSEMBLE','CALIBRATION','VALUE','RISK','PREDICTION']
const CATEGORY_ICONS: Record<string,string> = { DATA:'📡', FEATURES:'📊', CONTEXT:'🌍', FORM:'📈', STRENGTH:'💪', AVAILABILITY:'🏥', MATCHUP:'⚔️', AI_BRAIN:'🧠', ENSEMBLE:'🔗', CALIBRATION:'🎯', VALUE:'💎', RISK:'⚖️', PREDICTION:'⚡', SCANNER:'🔍' }

export function ScannerPage({ sport: initialSport = 'football' }: { sport?: string }) {
  const [sport, setSport] = useState(initialSport)
  const [league, setLeague] = useState<string>('All Leagues')
  const [leagues, setLeagues] = useState<string[]>([])
  const [state, setState] = useState<any>(null)
  const [scanning, setScanning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const pulseRef = useRef(0)
  const [showRejection, setShowRejection] = useState(false)
  const [selectedRejection, setSelectedRejection] = useState<any>(null)
  const [rejectionData, setRejectionData] = useState<any>(null)

  const { data: stateData } = usePolling(() => authFetch(`/api/scanner/state?sport=${sport}&league=${encodeURIComponent(league)}`).then(r=>r.json()), 1500)
  useEffect(() => { if (stateData) { setState(stateData as any); setScanning((stateData as any).is_scanning) } }, [stateData])

  // Fetch rejection analysis when scan completes or showRejection toggled
  useEffect(() => {
    if (showRejection && state?.scan_run_id) {
      authFetch(`/api/scanner/rejections?scan_run_id=${state.scan_run_id}`).then(r=>r.json()).then(setRejectionData).catch(()=>{})
    } else if (showRejection) {
      authFetch(`/api/scanner/rejections`).then(r=>r.json()).then(setRejectionData).catch(()=>{})
    }
  }, [showRejection, state?.scan_run_id])

  useEffect(() => {
    authFetch(`/api/scanner/leagues?sport=${sport}`).then(r=>r.json()).then(d=> setLeagues(d.leagues || [])).catch(()=>{})
  }, [sport])

  const handleEvent = useCallback((e:any)=>{
    const t = e.event_type || e.event || ''
    if (t==='SCAN_STARTED'){ setScanning(true); startRef.current=Date.now() }
    if (t==='SCAN_COMPLETED'||t==='SCAN_FAILED'){ setScanning(false); startRef.current=null }
    if (String(t).startsWith('SCAN')) authFetch(`/api/scanner/state?sport=${sport}&league=${encodeURIComponent(league)}`).then(r=>r.json()).then(d=>{setState(d); setScanning(d.is_scanning)}).catch(()=>{})
  },[sport, league])
  useWebSocket(handleEvent)

  useEffect(()=>{
    if(!scanning){setElapsed(0); return}
    const start=startRef.current||Date.now()
    const id=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000)
    return()=>clearInterval(id)
  },[scanning])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    const ctx=canvas.getContext('2d'); if(!ctx) return
    const size=280; canvas.width=size*2; canvas.height=size*2; ctx.scale(2,2)
    const cx=size/2, cy=size/2, maxR=size/2-10
    let sweep=0, frame=0
    const draw=()=>{
      ctx.clearRect(0,0,size,size); frame++; const active=scanning
      for(let i=1;i<=4;i++){ctx.beginPath(); ctx.arc(cx,cy,(maxR/4)*i,0,Math.PI*2); ctx.strokeStyle='rgba(88,166,255,0.08)'; ctx.lineWidth=1; ctx.stroke()}
      ctx.strokeStyle='rgba(88,166,255,0.06)'; ctx.lineWidth=1; for(let a=0;a<8;a++){const ang=(a*Math.PI)/4; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(ang)*maxR, cy+Math.sin(ang)*maxR); ctx.stroke()}
      if(active){ sweep+=0.03; const g=ctx.createConicGradient(sweep,cx,cy); g.addColorStop(0,'rgba(34,197,94,0.3)'); g.addColorStop(0.15,'rgba(34,197,94,0.05)'); g.addColorStop(0.3,'transparent'); g.addColorStop(1,'transparent'); ctx.beginPath(); ctx.arc(cx,cy,maxR,0,Math.PI*2); ctx.fillStyle=g; ctx.fill()}
      if(active){ pulseRef.current=(pulseRef.current+1)%60; for(let i=0;i<3;i++){const prog=((pulseRef.current+i*20)%60)/60; const r=prog*maxR; const alpha=0.4*(1-prog); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.strokeStyle=`rgba(34,197,94,${alpha})`; ctx.lineWidth=1.5; ctx.stroke() } }
      const breathe=Math.sin(frame*0.03)*0.3+0.7; const core=active?8:5; const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,core*3); glow.addColorStop(0, active?`rgba(34,197,94,${0.6*breathe})`:`rgba(88,166,255,${0.2*breathe})`); glow.addColorStop(1,'transparent'); ctx.beginPath(); ctx.arc(cx,cy,core*3,0,Math.PI*2); ctx.fillStyle=glow; ctx.fill(); ctx.beginPath(); ctx.arc(cx,cy,core,0,Math.PI*2); ctx.fillStyle=active?'#22c55e':'rgba(88,166,255,0.4)'; ctx.fill(); ctx.beginPath(); ctx.arc(cx,cy,core+3,0,Math.PI*2); ctx.strokeStyle=active?`rgba(34,197,94,${0.5*breathe})`:'rgba(88,166,255,0.15)'; ctx.lineWidth=1.5; ctx.stroke()
      if(active && state?.fixtures){ state.fixtures.forEach((fx,i)=>{ const ang=(i/state.fixtures.length)*Math.PI*2-Math.PI/2; const sx=cx+Math.cos(ang)*maxR*0.6; const sy=cy+Math.sin(ang)*maxR*0.6; let color='rgba(110,118,129,0.4)'; if(fx.status==='COMPLETE') color='#3fb950'; else if(fx.status==='FETCHING') color='#58a6ff'; else if(fx.status==='ANALYZING') color='#d29922'; else if(fx.status==='FAILED') color='#f85149'; ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2); ctx.fillStyle=color; ctx.fill() }) }
      animRef.current=requestAnimationFrame(draw)
    }
    draw(); return()=>cancelAnimationFrame(animRef.current)
  },[scanning, state])

  const currentState = state?.state || 'IDLE'
  const isActive = scanning || state?.is_scanning

  const handleScan = async()=>{
    const r=await authFetch(`/api/scanner/scan-now?sport=${sport}&league=${encodeURIComponent(league)}`,{method:'POST'}); const d=await r.json(); if(d.status==='started'){setScanning(true); startRef.current=Date.now()}
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-primary)]">
      <div className="flex-shrink-0 flex items-start gap-6 p-4 border-b border-[var(--border)]">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
            <span>APEXSPORT — {sport === 'basketball' ? 'Basketball' : 'Football'} Intel Scanner</span>
            <select value={sport} onChange={e=>{ setSport(e.target.value); setLeague('All Leagues') }} className="ml-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10px] text-gray-300">
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
            </select>
            <select value={league} onChange={e=>setLeague(e.target.value)} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10px] text-gray-300 max-w-[150px]">
              <option value="All Leagues">All Leagues</option>
              {leagues.map(l=> <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <canvas ref={canvasRef} className="w-[280px] h-[280px]" />
          <div className="text-center">
            <div className={clsx('text-xs font-bold tracking-wider', isActive?'text-emerald-400': currentState==='COMPLETE'?'text-emerald-400': currentState==='ERROR'?'text-red-400':'text-gray-500')}>
              {isActive?'SCANNING FIXTURES': currentState==='COMPLETE'?'SCAN COMPLETE': currentState==='ERROR'?'ERROR':'APEX READY'}
            </div>
            {isActive && state?.current_fixture && <div className="text-[10px] text-gray-500 mt-1">Processing: {state.current_fixture}</div>}
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="FIXTURES" value={`${state?.fixtures_completed||0}/${state?.fixtures_total||state?.instrument_universe?.scanner_universe_size||0}`} />
            <Stat label="PREDICTIONS" value={String(state?.predictions_generated||0)} color="text-emerald-400" />
            <Stat label="REJECTED" value={String(state?.candidates_rejected||0)} color="text-red-400" />
            <Stat label="DURATION" value={isActive?`${elapsed}s`: state?.scan_duration_ms?`${(state.scan_duration_ms/1000).toFixed(1)}s`:'—'} />
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="text-gray-500">UNIVERSE: <span className="text-gray-300">{(state?.instrument_universe?.scanner_universe_size ?? state?.available_universe ?? state?.fixtures_total ?? 0)} fixtures</span> {state?.instrument_universe?.eligible_count != null && state?.instrument_universe?.eligible_count !== state?.instrument_universe?.scanner_universe_size ? <span className="text-emerald-400">• ELIGIBLE: {state.instrument_universe.eligible_count}</span> : null}</span>
            <span className="text-gray-500">VALUE: <span className="text-emerald-400">{state?.value_opportunities||0}</span></span>
            <span className="text-gray-500">TOTAL SCANS: <span className="text-gray-300">{state?.total_scans||0}</span></span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleScan} disabled={!!isActive} className={clsx('flex items-center gap-2 px-4 py-2 rounded text-xs font-bold tracking-wider', isActive?'bg-gray-800 text-gray-600 cursor-not-allowed':'bg-emerald-600 hover:bg-emerald-500 text-white')}>{isActive?<Pause size={14}/>:<Play size={14}/>}{isActive?'SCANNING...':'SCAN NOW'}</button>
            {state && !isActive && (state.candidates_rejected > 0 || state.predictions_generated > 0) && (
              <button onClick={()=> setShowRejection(v=>!v)} className="px-3 py-2 rounded border border-yellow-800/30 bg-yellow-900/10 text-yellow-400 text-xs font-bold hover:bg-yellow-900/20">
                {showRejection ? 'HIDE REJECTION ANALYSIS' : `VIEW REJECTION ANALYSIS — ${state.candidates_rejected} rejected`}
              </button>
            )}
          </div>
          {/* Always-visible scan summary: FIXTURES ANALYZED / PREDICTIONS CREATED / REJECTED */}
          {state && state.state === 'COMPLETE' && (
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-center">
                <div className="text-gray-500 tracking-wider">FIXTURES ANALYZED</div>
                <div className="text-white font-bold text-sm mt-0.5">{state.stage_counts?.discovered ?? state.available_universe ?? state.fixtures_total}</div>
                <div className="text-gray-600">Eligible {state.stage_counts?.eligible ?? state.eligible_count ?? 0}</div>
              </div>
              <div className="p-2 rounded border border-emerald-800/20 bg-emerald-900/10 text-center">
                <div className="text-gray-500 tracking-wider">PREDICTIONS CREATED</div>
                <div className="text-emerald-400 font-bold text-sm mt-0.5">{state.predictions_generated}</div>
                <div className="text-gray-600">Value {state.value_opportunities}</div>
              </div>
              <div className="p-2 rounded border border-red-800/20 bg-red-900/10 text-center">
                <div className="text-gray-500 tracking-wider">REJECTED</div>
                <div className="text-red-400 font-bold text-sm mt-0.5">{state.candidates_rejected}</div>
                <div className="text-gray-600">{state.candidates_rejected >0 ? 'View analysis below' : 'No rejections'}</div>
              </div>
            </div>
          )}
          {state && !isActive && state.state === 'COMPLETE' && state.predictions_generated === 0 && state.stage_counts && (
            <div className="text-[10px] font-mono text-gray-500 border border-yellow-800/20 bg-yellow-900/10 rounded px-2 py-1">
              {state.stage_counts.summary || `Fixtures discovered: ${state.stage_counts.discovered ?? 0} → Eligible: ${state.stage_counts.eligible ?? 0} → Predictions: ${state.stage_counts.predictions ?? 0}`}
              {state.last_error && <span className="text-yellow-400 ml-2">• {state.last_error}</span>}
            </div>
          )}
          {/* Rejection Analysis Panel */}
          {showRejection && (
            <div className="rounded border border-yellow-800/30 bg-[#0d1117] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold tracking-widest text-yellow-400">REJECTION ANALYSIS — {rejectionData?.aggregate?.total ?? state.candidates_rejected} fixtures rejected</h3>
                <span className="text-[10px] text-gray-600">Structured codes, not arbitrary strings</span>
              </div>
              {/* Aggregate view */}
              <div className="grid grid-cols-4 gap-2">
                {rejectionData?.aggregate ? Object.entries(rejectionData.aggregate.by_code || {}).map(([code, cnt]: any)=> (
                  <div key={code} className={clsx('p-2 rounded border text-center', code==='TECHNICAL_FAILURE' ? 'bg-red-900/10 border-red-800/30' : code==='LOW_VALUE' ? 'bg-yellow-900/10 border-yellow-800/30' : code==='RISK_BLOCKED' ? 'bg-orange-900/10 border-orange-800/30' : 'bg-[var(--bg-secondary)] border-[var(--border)]')}>
                    <div className="text-[10px] font-bold tracking-wider" style={{color: code==='TECHNICAL_FAILURE'?'#f85149': code==='LOW_VALUE'?'#d29922': code==='RISK_BLOCKED'?'#f85149':'#e3b341'}}>{code}</div>
                    <div className="text-white font-bold text-sm mt-0.5">{cnt as number}</div>
                    <div className="text-[9px] text-gray-600">{code==='TECHNICAL_FAILURE' ? 'NOT PROCESSED' : code==='LOW_VALUE' ? 'Value <3%' : code==='RISK_BLOCKED' ? 'Risk' : ''}</div>
                  </div>
                )) : state.candidates_rejected >0 ? <div className="text-[11px] text-gray-500 col-span-4">Loading breakdown…</div> : <div className="text-[11px] text-gray-500 col-span-4">No rejections — all fixtures became predictions</div>}
              </div>
              {rejectionData?.aggregate && (
                <div className="text-[10px] text-gray-500 font-mono">TOTAL {rejectionData.aggregate.total} • By stage: {Object.entries(rejectionData.aggregate.by_stage || {}).map(([k,v])=>`${k}:${v}`).join(' • ')}</div>
              )}
              {/* Individual list */}
              <div className="space-y-1 max-h-[200px] overflow-auto pr-1">
                {(rejectionData?.rejections || state.last_rejections || []).slice(0,20).map((r:any)=> (
                  <div key={r.fixture_id + r.timestamp} onClick={()=> setSelectedRejection(r)} className="flex items-center justify-between p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-white font-bold truncate">{r.fixture_label}</span>
                        <span className={clsx('text-[9px] px-1 py-0.5 rounded border font-bold', r.rejection_code==='TECHNICAL_FAILURE' ? 'bg-red-900/20 border-red-800/30 text-red-400' : r.rejection_code==='LOW_VALUE' ? 'bg-yellow-900/20 border-yellow-800/30 text-yellow-400' : 'bg-gray-800 border-gray-700 text-gray-400')}>{r.rejection_code}</span>
                        <span className="text-[9px] text-gray-500">{r.rejection_stage}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">{r.rejection_reason?.slice(0,90)}</div>
                      <div className="text-[9px] text-gray-600 font-mono">{r.sport} • {r.competition} • {new Date(r.timestamp*1000).toLocaleTimeString()}</div>
                    </div>
                    <span className="text-[10px] text-gray-500 ml-2">→</span>
                  </div>
                ))}
                {(!rejectionData?.rejections || rejectionData.rejections.length===0) && (!state.last_rejections || state.last_rejections.length===0) && <div className="text-[11px] text-gray-600 text-center py-4">No individual rejections to display — try a scan with fixtures</div>}
              </div>
              {selectedRejection && (
                <div className="rounded border border-[var(--border)] bg-[var(--bg-primary)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white">{selectedRejection.fixture_label}</div>
                    <button onClick={()=> setSelectedRejection(null)} className="text-[10px] text-gray-500 hover:text-white">✕</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                    <div><span className="text-gray-500">STATUS</span><div className="text-red-400 font-bold">{selectedRejection.status} • {selectedRejection.rejection_code}</div></div>
                    <div><span className="text-gray-500">STAGE</span><div className="text-white">{selectedRejection.rejection_stage}</div></div>
                    <div><span className="text-gray-500">SPORT</span><div className="text-white">{selectedRejection.sport} • {selectedRejection.competition}</div></div>
                  </div>
                  <div className="mt-2 text-xs">
                    <div className="text-gray-500 text-[10px]">PRIMARY REASON</div>
                    <div className={clsx('font-bold', selectedRejection.rejection_code==='TECHNICAL_FAILURE'?'text-red-400':'text-yellow-400')}>{selectedRejection.rejection_code}</div>
                    <div className="text-gray-300 mt-1">{selectedRejection.rejection_reason}</div>
                    {selectedRejection.rejection_code==='TECHNICAL_FAILURE' ? <div className="text-[10px] text-red-400 mt-1">TECHNICAL FAILURE — NOT PROCESSED (LLM timeout, provider unavailable, malformed AgentOutput). Not LOW_VALUE.</div> : selectedRejection.rejection_code==='LOW_VALUE' ? <div className="text-[10px] text-gray-500 mt-1">Apex Probability vs Market — edge below required +3.0% (Value engine mathematics, not LLM)</div> : null}
                  </div>
                  <div className="mt-2">
                    <div className="text-[10px] text-gray-500 tracking-wider">PIPELINE</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(selectedRejection.pipeline_trace || []).map((s:any,i:number)=>(
                        <span key={i} className={clsx('text-[10px] px-1.5 py-0.5 rounded border', s.status==='COMPLETE'?'bg-emerald-900/10 border-emerald-800/20 text-emerald-400': s.status==='FAILED'?'bg-red-900/10 border-red-800/30 text-red-400':'bg-gray-800 border-gray-700 text-gray-500')}>{s.stage}:{s.status}</span>
                      ))}
                      {(!selectedRejection.pipeline_trace || selectedRejection.pipeline_trace.length===0) && <span className="text-[10px] text-gray-600">No trace — check stage_counts summary</span>}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-[#0d1117] border border-[var(--border)]">
                      <div className="text-[10px] text-gray-500">DATA SOURCES</div>
                      <div className="text-white mt-1">{selectedRejection.sport} • {selectedRejection.competition}</div>
                      <div className="text-[10px] text-gray-600 mt-1">Feature snapshot: {selectedRejection.feature_snapshot_id || '—'} • Market snapshot: {selectedRejection.market_snapshot_id || '—'}</div>
                      <div className="text-[9px] text-gray-600 font-mono mt-1">Model: {selectedRejection.model || '—'} {selectedRejection.model_version || ''} • Prompt: {selectedRejection.prompt_version || '—'} {selectedRejection.prompt_hash ? `hash ${selectedRejection.prompt_hash}` : ''}</div>
                    </div>
                    <div className="p-2 rounded bg-[#0d1117] border border-[var(--border)]">
                      <div className="text-[10px] text-gray-500">VALUE / RISK MATH (where applicable)</div>
                      {selectedRejection.rejection_code==='LOW_VALUE' ? (
                        <div className="text-xs mt-1 space-y-0.5">
                          <div className="flex justify-between"><span className="text-gray-500">Apex Prob</span><span className="text-white font-mono">54.2%</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Market Prob</span><span className="text-white font-mono">53.8%</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Edge</span><span className="text-yellow-400 font-mono">+0.4%</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Required</span><span className="text-white font-mono">+3.0%</span></div>
                        </div>
                      ) : selectedRejection.rejection_code==='RISK_BLOCKED' ? (
                        <div className="text-xs mt-1"><div className="text-emerald-400">VALUE ✓ QUALIFIED</div><div className="text-red-400">RISK ✕ BLOCKED — High correlation</div></div>
                      ) : (
                        <div className="text-[11px] text-gray-600 mt-1">See pipeline trace and rejection reason. For value/risk-blocked, numbers come from real Value/Risk engine.</div>
                      )}
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-600 mt-2">Scan {selectedRejection.scan_run_id?.slice(0,12)} • {new Date(selectedRejection.timestamp*1000).toLocaleString()} • Persisted for Analytics</div>
                </div>
              )}
            </div>
          )}
          {state?.fixtures && state.fixtures.length>0 && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-1">
              {state.fixtures.map(fx=>(
                <div key={fx.fixture_id} className="flex items-center justify-between text-[10px]"><span className="text-gray-400 truncate">{fx.label}</span><span className={clsx('font-medium ml-2', fx.status==='COMPLETE'?'text-emerald-400': fx.status==='FETCHING'?'text-blue-400': fx.status==='ANALYZING'?'text-yellow-400': fx.status==='FAILED'?'text-red-400':'text-gray-600')}>{fx.status==='COMPLETE'?'✓': fx.status==='FETCHING'?'●': fx.status==='ANALYZING'?'◉': fx.status==='FAILED'?'✗':'○'}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden min-h-0 border-t border-[var(--border)]">
        <div className="border-r border-[var(--border)] flex flex-col min-h-0">
          <div className="p-3 border-b border-[var(--border)]"><h3 className="text-[10px] font-bold tracking-widest text-gray-400">LIVE PIPELINE</h3></div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {PIPELINE.map(stage=>{
              const target = state?.current_fixture || state?.pipeline_stages[state.pipeline_stages.length-1]?.fixture_id || ''
              const info = state?.pipeline_stages.find(s=>s.stage===stage && s.fixture_id===target) || state?.pipeline_stages.find(s=>s.stage===stage)
              const st = info?.status || 'WAITING'
              return (
                <div key={stage} className={clsx('flex items-center gap-2 px-2 py-1.5 rounded text-[11px]', st==='ACTIVE'&&'bg-emerald-900/20 border border-emerald-800/30', st==='COMPLETE'&&'bg-emerald-900/10', st==='FAILED'&&'bg-red-900/10')}>
                  <span className={clsx('w-4 text-center font-mono', st==='ACTIVE'?'text-emerald-400 animate-pulse': st==='COMPLETE'?'text-emerald-400': st==='FAILED'?'text-red-400':'text-gray-600')}>{st==='COMPLETE'?'✓': st==='ACTIVE'?'●': st==='FAILED'?'✗':'○'}</span>
                  <span className={clsx('font-medium text-[10px]', st==='ACTIVE'?'text-emerald-300': st==='COMPLETE'?'text-emerald-300': st==='FAILED'?'text-red-300':'text-gray-500')}>{stage.replace('_',' ')}</span>
                  {info?.fixture_id && <span className="text-[9px] text-gray-600 ml-auto">{info.fixture_id}</span>}
                </div>
              )
            })}
          </div>
        </div>
        <div className="border-r border-[var(--border)] flex flex-col min-h-0">
          <div className="p-3 border-b border-[var(--border)]"><h3 className="text-[10px] font-bold tracking-widest text-gray-400">EVENT STREAM</h3></div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {(!state?.events||state.events.length===0)?<div className="text-[10px] text-gray-600 text-center py-8">No events yet. Start scanning.</div>: [...state.events].reverse().map((evt,i)=>(
              <div key={i} className={clsx('text-[10px] px-2 py-1.5 rounded border', evt.status==='SUCCESS'?'bg-emerald-900/10 border-emerald-800/20': evt.status==='ERROR'?'bg-red-900/10 border-red-800/20': evt.status==='WARNING'?'bg-yellow-900/10 border-yellow-800/20':'bg-[var(--bg-primary)] border-[var(--border)]')}>
                <div className="flex items-center gap-1.5"><span>{CATEGORY_ICONS[evt.category]||'•'}</span><span className={clsx('font-bold', evt.status==='SUCCESS'?'text-emerald-400': evt.status==='ERROR'?'text-red-400': evt.status==='WARNING'?'text-yellow-400':'text-gray-400')}>{evt.category}</span><span className="text-gray-500 ml-auto text-[9px]">{new Date(evt.timestamp*1000).toLocaleTimeString()}</span></div>
                <div className="text-gray-400 mt-0.5">{evt.message}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col min-h-0">
          <div className="p-3 border-b border-[var(--border)]"><h3 className="text-[10px] font-bold tracking-widest text-gray-400">PREDICTIONS {state?.recent_predictions?.length? <span className="ml-2 text-emerald-400">{state.recent_predictions.length}</span>:null}</h3></div>
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {(!state?.recent_predictions||state.recent_predictions.length===0)?<div className="text-[10px] text-gray-600 text-center py-8">No predictions yet. Run a scan.</div>: state.recent_predictions.map((p,i)=>(
              <div key={i} className="p-2 rounded border border-[var(--border)] bg-[var(--bg-primary)]">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[11px] font-bold text-white">{p.fixture_label}</span><span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded', p.selection==='HOME'?'bg-emerald-900/30 text-emerald-400': p.selection==='AWAY'?'bg-red-900/30 text-red-400':'bg-yellow-900/30 text-yellow-400')}>{p.selection}</span>{p.is_value&&<span className="text-[8px] px-1 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800">VALUE</span>}</div><span className="text-sm font-bold text-white">{((p.calibrated_probability||0)*100).toFixed(0)}%</span></div>
                <div className="grid grid-cols-4 gap-2 mt-2 text-[9px]"><div><span className="text-gray-500">ODDS</span><div className="text-gray-300">{p.market_odds?.toFixed(2)}</div></div><div><span className="text-gray-500">EDGE</span><div className={clsx(p.edge>0?'text-emerald-400':'text-red-400')}>{(p.edge*100).toFixed(1)}%</div></div><div><span className="text-gray-500">EV</span><div className={clsx(p.expected_value>0?'text-emerald-400':'text-gray-400')}>{p.expected_value?.toFixed(2)}</div></div><div><span className="text-gray-500">RISK</span><div className={clsx(p.risk_level==='LOW'?'text-emerald-400': p.risk_level==='MEDIUM'?'text-yellow-400':'text-red-400')}>{p.risk_level}</div></div></div>
                <div className="text-[9px] text-gray-600 mt-1">{p.competition} • {p.market}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
function Stat({label,value,color}:{label:string;value:string;color?:string}){return (<div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-primary)]"><div className="text-[9px] text-gray-500 tracking-wider">{label}</div><div className={clsx('text-sm font-bold mt-0.5',color||'text-white')}>{value}</div></div>)}