import { useState } from 'react'
import { authFetch } from '../services/auth'
import { usePolling } from '../hooks/usePolling'

export function BacktestingPage() {
  const [sport, setSport] = useState('football')
  const [market, setMarket] = useState('')
  const [minEdge, setMinEdge] = useState('')
  const [risk, setRisk] = useState('')
  const [minConf, setMinConf] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { data: preds } = usePolling(() => authFetch(`/api/backtesting/predictions?sport=${sport}${market?`&market=${market}`:''}${minEdge?`&min_edge=${minEdge}`:''}${risk?`&risk=${risk}`:''}`).then(r => r.json()).catch(() => null), 5000)
  const { data: cfg } = usePolling(() => authFetch('/api/backtesting/config').then(r => r.json()).catch(() => null), 10000)

  const run = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (sport) qs.set('sport', sport)
      if (market) qs.set('market', market)
      if (minEdge) qs.set('min_edge', minEdge)
      if (risk) qs.set('risk', risk)
      if (minConf) qs.set('min_confidence', minConf)
      const r = await authFetch(`/api/backtesting/run?${qs.toString()}`, { method: 'POST' })
      setResult(await r.json())
    } finally { setLoading(false) }
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-sm font-bold tracking-widest text-white">BACKTEST — REPRODUCIBLE HISTORICAL REPLAY</h1>
        <div className="text-[11px] text-gray-500 mt-1">Historical Market Snapshot + Historical Feature Snapshot + Model Version + Prompt Version + Engine Configuration → Historical Prediction → Outcome → Backtest Metrics. No future leakage (sorted by created_at).</div>
        <div className="text-[10px] text-gray-600 mt-0.5">Analytics = what actually happened. Backtest = what would have happened historically under this configuration. Same canonical engine records.</div>
      </div>

      {/* Configuration — only implemented controls */}
      <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="text-[10px] tracking-widest text-gray-500 mb-2">CONFIGURATION — only implemented controls shown</div>
        <div className="grid grid-cols-5 gap-2">
          <div>
            <div className="text-[10px] text-gray-500">Sport</div>
            <select value={sport} onChange={e => { setSport(e.target.value); setMarket('') }} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
              <option value="football">Football</option><option value="basketball">Basketball</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Market</div>
            <select value={market} onChange={e => setMarket(e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
              <option value="">All</option>
              {(cfg?.markets?.[sport] || (sport === 'football' ? ['MATCH_RESULT','OVER_UNDER','BTTS'] : ['MONEYLINE','SPREAD','TOTAL_POINTS'])).map((m: string) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Min edge</div>
            <select value={minEdge} onChange={e => setMinEdge(e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
              <option value="">Any</option><option value="0">≥0%</option><option value="0.02">≥2%</option><option value="0.05">≥5%</option><option value="0.10">≥10%</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Risk filter</div>
            <select value={risk} onChange={e => setRisk(e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
              <option value="">Any</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="BLOCKED">BLOCKED</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Min confidence</div>
            <select value={minConf} onChange={e => setMinConf(e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
              <option value="">Any</option><option value="0.4">≥0.4</option><option value="0.6">≥0.6</option><option value="0.8">≥0.8</option>
            </select>
          </div>
        </div>
        <div className="text-[10px] text-gray-600 mt-2">{cfg?.note || 'Correlation constraints & stake model not yet exposed — UI shows only implemented controls.'}</div>
        <div className="flex gap-2 mt-3">
          <button onClick={run} disabled={loading} className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-50">{loading ? 'RUNNING…' : 'RUN BACKTEST'}</button>
          <span className="text-xs text-gray-600 self-center">{preds?.count ?? 0} predictions for {sport}{market ? ` • ${market}` : ''} (historical snapshots)</span>
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          {result.error ? (
            <div className="p-3 rounded border border-yellow-800/30 bg-yellow-900/10 text-xs text-yellow-400">
              {result.error}
              {result.prediction_count != null && <span className="text-gray-500"> — {result.prediction_count} predictions available but no outcomes yet. POST outcomes as fixtures resolve.</span>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
                  <div className="text-[10px] tracking-widest text-gray-500">REPLAY</div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="text-white">Hit rate: <span className="font-bold">{(result.hit_rate * 100).toFixed(1)}%</span> ({result.wins}/{result.predictions_evaluated})</div>
                    <div className="text-white">Brier: <span className="font-mono">{result.brier?.toFixed(4) ?? '—'}</span></div>
                    <div className="text-white">Avg edge: {result.replay ? `${(result.replay?.accuracy ?? result.hit_rate * 100).toFixed(1)}%` : '—'}</div>
                    <div className="text-[10px] text-gray-600">Period: {result.period || '—'} • Config: {JSON.stringify(result.config || {})}</div>
                  </div>
                </div>
                <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
                  <div className="text-[10px] tracking-widest text-gray-500">WALK-FORWARD</div>
                  {result.walk_forward ? (
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="text-white">Avg hit: {(result.walk_forward.avg_accuracy * 100).toFixed(1)}% over {result.walk_forward.folds} folds</div>
                      <div className="text-white">Avg Brier: <span className="font-mono">{result.walk_forward.avg_brier?.toFixed(4)}</span></div>
                      <div className="text-[10px] text-gray-600">Window 4, step 2 — no leakage</div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 mt-2">—</div>
                  )}
                </div>
                <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
                  <div className="text-[10px] tracking-widest text-gray-500">PROVENANCE</div>
                  <div className="mt-2 space-y-1 text-[11px] text-gray-400">
                    <div>Model: <span className="text-white font-mono">{result.model_version ?? '—'}</span></div>
                    <div>Prompt: <span className="text-white font-mono">{result.prompt_version ?? '—'}</span></div>
                    <div>Feature: <span className="text-white font-mono">{result.feature_version ?? '—'}</span></div>
                    <div>Pipeline: <span className="text-white font-mono">{result.pipeline_version ?? '—'}</span></div>
                    <div>Predictions evaluated: {result.predictions_evaluated ?? '—'}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-primary)]">
                  <div className="text-[10px] tracking-widest text-gray-500">OUTCOME DISTRIBUTION</div>
                  <div className="text-xs text-gray-500 mt-1">Period {result.period} • Wins {result.wins} / {result.predictions_evaluated} • See analytics for yield where stake model is configured.</div>
                </div>
                <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-primary)]">
                  <div className="text-[10px] tracking-widest text-gray-500">REPRODUCIBILITY</div>
                  <div className="text-[11px] text-gray-500 mt-1">Each historical prediction retains <span className="font-mono text-gray-300">data_snapshot_at</span> — backtest never uses today's data to pretend it is historical.</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => document.dispatchEvent(new CustomEvent('apex:navigate' as any, { detail: 'analytics' }))} className="px-3 py-1.5 rounded border border-[var(--border)] text-xs text-gray-400 hover:text-white">View in Analytics →</button>
        <button onClick={() => document.dispatchEvent(new CustomEvent('apex:open-copilot' as any, { detail: { type: 'backtest', sport, market } }))} className="px-3 py-1.5 rounded border border-emerald-800/30 bg-emerald-900/10 text-xs text-emerald-400 hover:bg-emerald-900/20">Ask Copilot — why did this backtest underperform?</button>
      </div>

      <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[11px] text-gray-500">
        <div className="font-bold text-gray-400">Shared truth:</div>
        <div className="mt-1">Backtest reuses <span className="font-mono text-gray-300">Canonical Prediction</span> records with <span className="font-mono">model_version/feature_version/prompt_version/data_snapshot_at</span>. Record outcomes via <code className="px-1 py-0.5 rounded bg-[var(--bg-secondary)]">POST /api/analytics/outcome</code> — then replay is deterministic and shows hit rate / Brier. Metrics not yet calculable (e.g., max drawdown) show <span className="text-yellow-400">INSUFFICIENT DATA</span>.</div>
      </div>
    </div>
  )
}