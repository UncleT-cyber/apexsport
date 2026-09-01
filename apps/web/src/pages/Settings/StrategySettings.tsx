import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../services/auth'
export function StrategySettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/strategy')
    if (r.ok) setCfg(await r.json())
  }, [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async () => {
    setSaving(true)
    await authFetch('/api/settings/strategy', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaving(false)
  }, [cfg])
  if (!cfg) return <div className="text-xs text-gray-500">Loading...</div>
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-sm font-bold tracking-wider text-white">Intelligence Strategy</h2>
        <p className="text-[10px] text-gray-500 mt-1">How APEXSPORT analyzes — not a trading strategy. Controls sport focus, scanner aggressiveness, market filters.</p>
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">Sport Focus</span>
          <select value={cfg.sport_focus || 'football'} onChange={(e) => setCfg({ ...cfg, sport_focus: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white">
            <option value="football">Football</option><option value="basketball">Basketball</option><option value="all">All</option>
          </select>
        </label>
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">Scanner Aggressiveness</span>
          <select value={cfg.scanner_aggressiveness || 'balanced'} onChange={(e) => setCfg({ ...cfg, scanner_aggressiveness: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white">
            <option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option>
          </select>
        </label>
        <div className="space-y-1">
          <span className="text-gray-500 text-[10px]">Market Filters (canonical)</span>
          <div className="grid grid-cols-2 gap-2">
            {['MATCH_RESULT','MONEYLINE','SPREAD','TOTAL_POINTS','BTTS','TOTAL_GOALS'].map(m => (
              <label key={m} className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={(cfg.market_filters||[]).includes(m)} onChange={(e) => {
                  const list = new Set(cfg.market_filters||[])
                  if (e.target.checked) list.add(m); else list.delete(m)
                  setCfg({ ...cfg, market_filters: Array.from(list) })
                }} className="accent-emerald-500" />
                {m}
              </label>
            ))}
          </div>
        </div>
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold tracking-wider text-white">{saving ? 'SAVING...' : 'SAVE STRATEGY'}</button>
    </div>
  )
}