import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { authFetch } from '../../services/auth'
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={clsx('w-8 h-4 rounded-full transition-colors relative cursor-pointer flex-shrink-0', checked ? 'bg-red-600' : 'bg-gray-600')}>
      <div className={clsx('w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}
export function RiskSettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/risk')
    if (r.ok) setCfg(await r.json())
    else setCfg({})
  }, [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async () => {
    if (!cfg) return
    setSaving(true)
    await authFetch('/api/settings/risk', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false)
  }, [cfg])
  if (!cfg) return <div className="text-xs text-gray-500">Loading...</div>
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-wider text-white">Risk Management</h2>
          <p className="text-[10px] text-gray-500 mt-1">Deterministic risk — explainable, independent from prediction. Directly affects slip decisions.</p>
        </div>
        <button onClick={save} disabled={saving} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-[10px] font-bold tracking-wider text-white">{saving ? 'SAVING...' : saved ? 'SAVED!' : 'SAVE'}</button>
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[
            {k:'max_risk_per_slip_pct',label:'Max Risk / Slip (%)',step:0.1},
            {k:'max_daily_loss_pct',label:'Max Daily Loss (%)',step:0.1},
            {k:'max_open_slips',label:'Max Open Slips',step:1},
            {k:'min_confidence_threshold',label:'Min Confidence',step:0.01},
            {k:'min_edge_threshold',label:'Min Edge',step:0.01},
          ].map(f=>(
            <label key={f.k} className="space-y-1 block">
              <span className="text-gray-500 text-[10px]">{f.label}</span>
              <input type="number" step={f.step} value={cfg[f.k] ?? ''} onChange={e=>setCfg((p:any)=>({...p,[f.k]: parseFloat(e.target.value)||0}))} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white" />
            </label>
          ))}
        </div>
        <label className="flex items-center justify-between py-2 border-t border-[var(--border)]">
          <span className="text-xs text-white">Kill Switch (block all new slips)</span>
          <Toggle checked={!!cfg.kill_switch_enabled} onChange={v=>setCfg((p:any)=>({...p,kill_switch_enabled:v}))} />
        </label>
        <p className="text-[10px] text-gray-600">Evaluates: uncertainty, confidence, data_quality, market_quality, correlation, exposure, slip composition, model disagreement. Risk ≠ prediction.</p>
      </div>
    </div>
  )
}