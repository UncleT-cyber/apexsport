import { usePolling } from '../hooks/usePolling'
import { authFetch } from '../services/auth'
import { useState } from 'react'
import clsx from 'clsx'

function Metric({ label, value, sub, good }: { label: string; value: string; sub?: string; good?: boolean }) {
  return (
    <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="text-[9px] tracking-widest text-gray-500">{label}</div>
      <div className={clsx('text-sm font-bold mt-0.5', value === '—' || value === 'INSUFFICIENT DATA' ? 'text-gray-600' : good === false ? 'text-red-400' : good ? 'text-emerald-400' : 'text-white')}>{value}</div>
      {sub && <div className="text-[9px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

export function AnalyticsPage() {
  const [sport, setSport] = useState<string | undefined>(undefined)
  const [market, setMarket] = useState<string | undefined>(undefined)
  const { data: overview } = usePolling(() => authFetch(`/api/analytics/overview${sport ? `?sport=${sport}` : ''}`).then(r => r.json()).catch(() => null), 5000)
  const { data: calib } = usePolling(() => authFetch(`/api/analytics/calibration${sport ? `?sport=${sport}` : ''}`).then(r => r.json()).catch(() => null), 5000)
  const { data: value } = usePolling(() => authFetch(`/api/analytics/value${sport ? `?sport=${sport}` : ''}`).then(r => r.json()).catch(() => null), 5000)
  const { data: risk } = usePolling(() => authFetch(`/api/analytics/risk${sport ? `?sport=${sport}` : ''}`).then(r => r.json()).catch(() => null), 5000)
  const { data: sportComp } = usePolling(() => authFetch(`/api/analytics/sport-comparison`).then(r => r.json()).catch(() => null), 6000)
  const { data: models } = usePolling(() => authFetch(`/api/analytics/models${sport ? `?sport=${sport}` : ''}`).then(r => r.json()).catch(() => null), 6000)
  const { data: perf } = usePolling(() => {
    const qs = new URLSearchParams()
    if (sport) qs.set('sport', sport)
    if (market) qs.set('market', market)
    return authFetch(`/api/analytics/performance?${qs.toString()}`).then(r => r.json()).catch(() => null)
  }, 5000)

  const ov = overview
  const hasData = ov && ov.total_predictions > 0
  const hasResolved = ov && ov.resolved > 0

  return (
    <div className="p-4 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-sm font-bold tracking-widest text-white">ANALYTICS — PERFORMANCE OBSERVATORY</h1>
          <div className="text-[10px] text-gray-500">Engine → Predictions → Slips → Analytics → Copilot → Backtest — same canonical truth. No fake metrics.</div>
        </div>
        <div className="flex gap-2">
          <select value={sport || ''} onChange={e => setSport(e.target.value || undefined)} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
            <option value="">All sports</option><option value="football">Football</option><option value="basketball">Basketball</option>
          </select>
          <select value={market || ''} onChange={e => setMarket(e.target.value || undefined)} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white">
            <option value="">All markets</option><option value="MATCH_RESULT">MATCH_RESULT</option><option value="MONEYLINE">MONEYLINE</option><option value="SPREAD">SPREAD</option><option value="TOTAL_POINTS">TOTAL_POINTS</option>
          </select>
        </div>
      </div>

      {/* 1. OVERVIEW */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold tracking-widest text-emerald-400">1. OVERVIEW</h2>
        {!hasData ? (
          <div className="p-6 rounded border border-dashed border-[var(--border)] text-center text-xs text-gray-600">No predictions yet — run a scan to populate analytics. Metrics show <span className="text-gray-400">—</span> or <span className="text-yellow-400">INSUFFICIENT DATA</span> until engine produces data.</div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            <Metric label="PREDICTIONS" value={String(ov.total_predictions)} sub={`${ov.resolved} resolved • ${ov.unresolved} unresolved`} />
            <Metric label="HIT RATE" value={ov.hit_rate != null ? `${(ov.hit_rate * 100).toFixed(1)}%` : '—'} sub={`${ov.wins}/${ov.resolved} wins`} good={ov.hit_rate != null && ov.hit_rate > 0.5} />
            <Metric label="ROI / YIELD" value={ov.roi != null ? `${(ov.roi * 100).toFixed(1)}%` : 'INSUFFICIENT DATA'} sub={ov.profit != null ? `P/L ${ov.profit}` : 'need resolved + stake model'} />
            <Metric label="AVG EDGE" value={ov.avg_edge != null ? `${(ov.avg_edge * 100).toFixed(1)}%` : '—'} sub={`avg odds ${ov.avg_odds ?? '—'}`} />
            <Metric label="BRIER" value={ov.brier_score != null ? ov.brier_score.toFixed(3) : 'INSUFFICIENT DATA'} sub={ov.calibration_status} good={ov.brier_score != null && ov.brier_score < 0.22} />
          </div>
        )}
        {ov && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)]"><span className="text-gray-500">Active sports</span> <span className="text-white ml-1">{ov.active_sports?.join(', ') || '—'}</span></div>
            <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)]"><span className="text-gray-500">Volume</span> <span className="text-white ml-1">{Object.entries(ov.volume_by_sport || {}).map(([k, v]) => `${k} ${v}`).join(' • ') || '—'}</span></div>
            <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)]"><span className="text-gray-500">Avg calibrated</span> <span className="text-white ml-1">{ov.avg_calibrated != null ? `${(ov.avg_calibrated * 100).toFixed(1)}%` : '—'}</span></div>
          </div>
        )}
      </section>

      {/* 2. PREDICTION PERFORMANCE */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold tracking-widest text-emerald-400">2. PREDICTION PERFORMANCE</h2>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <Metric label="FILTERED TOTAL" value={perf ? String(perf.total) : '—'} sub={perf ? `${perf.resolved} resolved` : 'sport/market/risk filters'} />
          <Metric label="FILTERED HIT RATE" value={perf?.hit_rate != null ? `${(perf.hit_rate * 100).toFixed(1)}%` : hasResolved ? '—' : 'INSUFFICIENT DATA'} sub={perf?.wins != null ? `${perf.wins} wins` : ''} />
          <Metric label="FILTERED ROI" value={perf?.roi != null ? `${(perf.roi * 100).toFixed(1)}%` : hasResolved ? '—' : 'INSUFFICIENT DATA'} sub={perf?.profit != null ? `P/L ${perf.profit}` : ''} />
          <Metric label="PREDICTION VOLUME" value={perf ? String(perf.total) : '—'} sub="last 100 filtered" />
        </div>
        {perf && perf.total === 0 && <div className="text-[11px] text-gray-600">No predictions match current filters (sport={sport || 'all'} market={market || 'all'}). Adjust filters or run a scan.</div>}
      </section>

      {/* 3. MODEL / SPECIALIST PERFORMANCE */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold tracking-widest text-emerald-400">3. MODEL / SPECIALIST PERFORMANCE</h2>
        {!models ? (
          <div className="text-xs text-gray-600">Loading…</div>
        ) : models.total_predictions === 0 ? (
          <div className="p-3 rounded border border-dashed border-[var(--border)] text-xs text-gray-600">No specialist data yet.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-xs">
              <div className="text-[10px] text-gray-500">SPECIALISTS</div>
              <div className="text-white mt-1">{models.specialists?.join(', ') || '—'}</div>
              <div className="text-[10px] text-gray-600 mt-1">Disagreement avg {models.avg_disagreement ?? '—'} • Failure rate {models.failure_rate != null ? `${(models.failure_rate * 100).toFixed(1)}%` : '—'}</div>
            </div>
            <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-xs">
              <div className="text-[10px] text-gray-500">MODEL VERSIONS</div>
              <div className="text-white mt-1">{Object.entries(models.model_versions || {}).map(([k, v]) => `${k}×${v}`).join(' • ') || '—'}</div>
              <div className="text-[10px] text-gray-600 mt-1">Hit rate {models.hit_rate != null ? `${(models.hit_rate * 100).toFixed(1)}%` : 'INSUFFICIENT DATA'}</div>
            </div>
            <div className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-xs">
              <div className="text-[10px] text-gray-500">NOTE</div>
              <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">{models.note}</div>
            </div>
          </div>
        )}
      </section>

      {/* 4. CALIBRATION */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold tracking-widest text-emerald-400">4. CALIBRATION ANALYTICS</h2>
        <div className="flex gap-2 text-xs">
          <span className="text-gray-600">{calib?.total_predictions || 0} total • {calib?.resolved || 0} resolved • Brier {calib?.brier_score ?? '—'} • LogLoss {calib?.log_loss ?? '—'}</span>
          {calib?.resolved != null && calib.resolved < 20 && <span className="text-yellow-400">INSUFFICIENT DATA — need 20+ resolved for calibration ACTIVE (see intelligence/calibration)</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {(calib?.curve || []).map((b: any) => (
            <div key={b.bucket} className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-center">
              <div className="text-[10px] text-gray-500">{b.bucket}</div>
              <div className="text-xs text-white mt-1">pred {b.predicted_rate?.toFixed(2) ?? '—'}</div>
              <div className="text-xs mt-0.5" style={{ color: b.actual_rate == null ? '#6e7681' : Math.abs(b.predicted_rate - b.actual_rate) < 0.1 ? '#3fb950' : '#f85149' }}>{b.actual_rate != null ? `actual ${b.actual_rate.toFixed(2)}` : 'unresolved'}</div>
              <div className="text-[10px] text-gray-600 mt-1">{b.count} preds {b.brier != null && `• Brier ${b.brier}`}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. VALUE ANALYTICS */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold tracking-widest text-emerald-400">5. VALUE ANALYTICS</h2>
        <div className="grid grid-cols-5 gap-2">
          {(value?.bands || []).map((b: any) => (
            <div key={b.band} className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-center">
              <div className="text-[10px] text-gray-500">{b.band}</div>
              <div className="text-xs text-white mt-1">{b.count} preds</div>
              <div className="text-[10px] text-gray-400">avg edge {b.avg_edge != null ? `${(b.avg_edge * 100).toFixed(1)}%` : '—'}</div>
              <div className="text-[10px] mt-1" style={{ color: b.hit_rate == null ? '#6e7681' : b.hit_rate > 0.5 ? '#3fb950' : '#f85149' }}>{b.hit_rate != null ? `hit ${(b.hit_rate * 100).toFixed(1)}%` : b.resolved === 0 ? 'unresolved' : '—'}</div>
              <div className="text-[9px] text-gray-600">{b.resolved} resolved{b.roi != null ? ` • ROI ${(b.roi * 100).toFixed(1)}%` : ''}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-gray-600">Edge bands: &lt;0% / 0–2% / 2–5% / 5–10% / 10%+ — compare hit rate / ROI where enough resolved outcomes exist. No ROI without outcomes (truthful incompleteness).</div>
      </section>

      {/* 6. RISK ANALYTICS */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold tracking-widest text-emerald-400">6. RISK ANALYTICS</h2>
        <div className="grid grid-cols-4 gap-2">
          {(risk?.by_risk || []).map((r: any) => (
            <div key={r.risk} className={clsx('p-2 rounded border text-center', r.risk === 'LOW' ? 'border-emerald-800/30 bg-emerald-900/10' : r.risk === 'BLOCKED' ? 'border-red-800/30 bg-red-900/10' : 'border-[var(--border)] bg-[var(--bg-secondary)]')}>
              <div className="text-[10px] tracking-widest text-gray-500">{r.risk}</div>
              <div className="text-xs text-white mt-1">{r.count} preds</div>
              <div className="text-[10px] mt-1" style={{ color: r.hit_rate == null ? '#6e7681' : '#e3b341' }}>{r.hit_rate != null ? `hit ${(r.hit_rate * 100).toFixed(1)}%` : r.resolved === 0 ? 'unresolved' : '—'}</div>
              <div className="text-[9px] text-gray-600">{r.resolved} resolved</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-gray-600">Risk is engine assessment, not certainty. LOW does not guarantee success.</div>
      </section>

      {/* 7. SPORT COMPARISON */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold tracking-widest text-emerald-400">7. SPORT COMPARISON</h2>
        {!sportComp ? (
          <div className="text-xs text-gray-600">Loading…</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {(sportComp.sports || ['football', 'basketball']).map((s: string) => {
              const d = sportComp.by_sport?.[s]
              return (
                <div key={s} className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
                  <div className="text-[10px] tracking-widest text-gray-500">{s.toUpperCase()}</div>
                  <div className="text-xs text-white mt-1">{d?.total_predictions ?? 0} preds • {d?.resolved ?? 0} resolved</div>
                  <div className="text-[11px] mt-1" style={{ color: d?.hit_rate == null ? '#6e7681' : '#e3b341' }}>Hit {d?.hit_rate != null ? `${(d.hit_rate * 100).toFixed(1)}%` : '—'} • Brier {d?.brier_score ?? '—'}</div>
                  <div className="text-[10px] text-gray-600 mt-1">Avg edge {d?.avg_edge != null ? `${(d.avg_edge * 100).toFixed(1)}%` : '—'} • ROI {d?.roi != null ? `${(d.roi * 100).toFixed(1)}%` : '—'}</div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="flex gap-2">
        <button onClick={() => document.dispatchEvent(new CustomEvent('apex:open-copilot' as any, { detail: { type: 'analytics', sport } }))} className="px-3 py-1.5 rounded border border-emerald-800/30 bg-emerald-900/10 text-xs text-emerald-400 hover:bg-emerald-900/20">Ask Copilot about these metrics →</button>
        <button onClick={() => document.dispatchEvent(new CustomEvent('apex:navigate' as any, { detail: 'backtest' }))} className="px-3 py-1.5 rounded border border-[var(--border)] text-xs text-gray-400 hover:text-white">Open Backtest →</button>
      </div>

      <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[11px] text-gray-500">
        <div className="font-bold text-gray-400">Shared truth:</div>
        <div className="mt-1">Canonical Prediction ─┬─► UI &nbsp; ├─► Analytics &nbsp; ├─► Copilot &nbsp; └─► Backtest — same store. Fill outcomes via <code className="px-1 py-0.5 rounded bg-[var(--bg-secondary)]">POST /api/analytics/outcome</code> then metrics activate. No fake Brier. <span className="text-gray-400">Truthful incompleteness: if a metric cannot be calculated, it shows <span className="text-yellow-400">INSUFFICIENT DATA</span> or <span className="text-gray-300">—</span>.</span></div>
      </div>
    </div>
  )
}