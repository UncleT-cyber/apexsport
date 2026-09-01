import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../services/auth'
export function DistributionSettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/distribution')
    if (r.ok) setCfg(await r.json())
  }, [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async () => {
    setSaving(true)
    await authFetch('/api/settings/distribution', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaving(false)
  }, [cfg])
  if (!cfg) return <div className="text-xs text-gray-500">Loading...</div>
  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-sm font-bold tracking-wider text-white">Distribution</h2>
      <p className="text-[10px] text-gray-500">Distribute intelligence reports and slips — canonical DTOs, never raw provider JSON.</p>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">CHANNELS</h3>
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">Telegram Bot Token (server-side only)</span>
          <input type="password" value={cfg.telegram_bot_token && !cfg.telegram_bot_token.startsWith('*') ? cfg.telegram_bot_token : ''} placeholder={cfg.telegram_bot_token || 'Not set'} onChange={(e) => setCfg({ ...cfg, telegram_bot_token: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white" />
        </label>
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">WhatsApp Phone ID</span>
          <input type="text" value={cfg.whatsapp_phone_id || ''} onChange={(e) => setCfg({ ...cfg, whatsapp_phone_id: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white" />
        </label>
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold tracking-wider text-white">{saving ? 'SAVING...' : 'SAVE DISTRIBUTION'}</button>
    </div>
  )
}