import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { authFetch } from '../../services/auth'
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={clsx('w-8 h-4 rounded-full transition-colors relative cursor-pointer flex-shrink-0', checked ? 'bg-emerald-600' : 'bg-gray-600')}>
      <div className={clsx('w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}
export function NotificationSettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/notifications')
    if (r.ok) setCfg(await r.json())
  }, [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async () => {
    setSaving(true)
    await authFetch('/api/settings/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaving(false)
  }, [cfg])
  if (!cfg) return <div className="text-xs text-gray-500">Loading...</div>
  const channels = [
    { key: 'in_app', label: 'In-App', desc: 'Within APEXSPORT' },
    { key: 'email', label: 'Email', desc: 'Email notifications' },
    { key: 'telegram', label: 'Telegram', desc: 'Telegram bot' },
    { key: 'whatsapp', label: 'WhatsApp', desc: 'WhatsApp' },
  ]
  const events = [
    { key: 'prediction_generated', label: 'Prediction Generated', desc: 'New prediction created' },
    { key: 'value_detected', label: 'Value Detected', desc: 'Edge exceeds threshold' },
    { key: 'risk_blocked', label: 'Risk Blocked', desc: 'Slip or selection vetoed' },
    { key: 'provider_failure', label: 'Provider Failure', desc: 'Sports data provider down' },
    { key: 'news_received', label: 'News Intelligence', desc: 'High-relevance news linked' },
  ]
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-white">Notifications</h2>
        <button onClick={save} disabled={saving} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold tracking-wider text-white">{saving ? 'SAVING...' : 'SAVE'}</button>
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">CHANNELS</h3>
        {channels.map(c => (
          <div key={c.key} className="flex items-center justify-between py-1">
            <div><div className="text-xs text-white">{c.label}</div><div className="text-[10px] text-gray-500">{c.desc}</div></div>
            <Toggle checked={!!cfg.channels?.[c.key]} onChange={(v) => setCfg({ ...cfg, channels: { ...cfg.channels, [c.key]: v } })} />
          </div>
        ))}
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">EVENTS</h3>
        {events.map(e => (
          <div key={e.key} className="flex items-center justify-between py-1">
            <div><div className="text-xs text-white">{e.label}</div><div className="text-[10px] text-gray-500">{e.desc}</div></div>
            <Toggle checked={!!cfg.events?.[e.key]} onChange={(v) => setCfg({ ...cfg, events: { ...cfg.events, [e.key]: v } })} />
          </div>
        ))}
      </div>
    </div>
  )
}