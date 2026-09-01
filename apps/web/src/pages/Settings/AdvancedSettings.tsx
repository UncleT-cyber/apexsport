import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../services/auth'
export function AdvancedSettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/advanced')
    if (r.ok) setCfg(await r.json())
  }, [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async () => {
    setSaving(true)
    await authFetch('/api/settings/advanced', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaving(false)
  }, [cfg])
  if (!cfg) return <div className="text-xs text-gray-500">Loading...</div>
  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-sm font-bold tracking-wider text-white">Advanced</h2>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">Log Level</span>
          <select value={cfg.log_level || 'INFO'} onChange={(e) => setCfg({ ...cfg, log_level: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white">
            <option value="DEBUG">DEBUG</option><option value="INFO">INFO</option><option value="WARNING">WARNING</option><option value="ERROR">ERROR</option>
          </select>
        </label>
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">Cache TTL (s)</span>
          <input type="number" value={cfg.cache_ttl || 60} onChange={(e) => setCfg({ ...cfg, cache_ttl: parseInt(e.target.value) })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white" />
        </label>
        <div className="text-[10px] text-gray-600">Provider TTL, event-state freshness, invalidation graph respected. Never serve stale critical info without age indicator.</div>
      </div>
      <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[11px] text-gray-500">
        Developer: <code className="px-1 py-0.5 rounded bg-[var(--bg-secondary)]">POST /api/settings/test/{'{provider}'}</code>, <code>/api/providers/health</code>, <code>/api/analytics/calibration</code>, JSON logs in <code>logs/</code>.
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold tracking-wider text-white">{saving ? 'SAVING...' : 'SAVE ADVANCED'}</button>
    </div>
  )
}