import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../services/auth'
export function IntegrationSettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/integrations')
    if (r.ok) setCfg(await r.json())
  }, [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async () => {
    setSaving(true)
    await authFetch('/api/settings/integrations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaving(false)
  }, [cfg])
  if (!cfg) return <div className="text-xs text-gray-500">Loading...</div>
  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-sm font-bold tracking-wider text-white">Integrations</h2>
      <p className="text-[10px] text-gray-500">Webhooks and external adapters — provider-agnostic, capability-based.</p>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">WEBHOOKS</h3>
        <textarea value={JSON.stringify(cfg.webhooks||[], null, 2)} onChange={(e) => {
          try { setCfg({ ...cfg, webhooks: JSON.parse(e.target.value) }) } catch {}
        }} rows={4} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-xs text-white font-mono" placeholder='[{"url":"https://example.com/hook","events":["PREDICTION_CREATED"]}]' />
        <h3 className="text-xs font-bold tracking-wider text-gray-400">THE ODDS API BASE</h3>
        <input type="text" value={cfg.the_odds_api_base || ''} onChange={(e) => setCfg({ ...cfg, the_odds_api_base: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white" placeholder="https://api.the-odds-api.com/v4" />
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold tracking-wider text-white">{saving ? 'SAVING...' : 'SAVE INTEGRATIONS'}</button>
    </div>
  )
}