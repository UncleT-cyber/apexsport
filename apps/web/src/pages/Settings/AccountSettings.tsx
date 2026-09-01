import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../services/auth'
export function AccountSettings() {
  const [account, setAccount] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/account')
    if (r.ok) setAccount(await r.json())
  }, [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async () => {
    setSaving(true)
    await authFetch('/api/settings/account', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account) })
    setSaving(false)
  }, [account])
  if (!account) return <div className="text-xs text-gray-500">Loading...</div>
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-sm font-bold tracking-wider text-white">Account</h2>
        <p className="text-[10px] text-gray-500 mt-1">Manage your APEXSPORT account — intelligence platform, not a sportsbook</p>
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">ACCOUNT INFORMATION</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-gray-500 text-[10px]">Email</span>
            <input type="email" value={account.email || ''} onChange={(e) => setAccount({ ...account, email: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 text-[10px]">Username</span>
            <input type="text" value={account.username || ''} onChange={(e) => setAccount({ ...account, username: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white" />
          </label>
        </div>
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">INTELLIGENCE MODE</h3>
        <p className="text-[10px] text-gray-500">Controls default data usage for all intelligence activities</p>
        <div className="space-y-2">
          {[
            { value: 'paper', label: 'Paper Intelligence', desc: 'Real data, paper slips — no booking codes sent, no fabricated fixtures' },
            { value: 'live', label: 'Live Intelligence', desc: 'Real data with live rescan — strictly provider-derived, still no unauthorized booking' },
          ].map((m) => (
            <label key={m.value} className="flex items-start gap-3 p-2 rounded hover:bg-[var(--bg-tertiary)] cursor-pointer">
              <input type="radio" name="data_mode" checked={account.data_mode === m.value} onChange={() => setAccount({ ...account, data_mode: m.value })} className="accent-emerald-500 mt-0.5" />
              <div>
                <div className="text-xs text-white font-medium">{m.label}</div>
                <div className="text-[10px] text-gray-500">{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-xs font-bold tracking-wider text-white">{saving ? 'SAVING...' : 'SAVE CHANGES'}</button>
    </div>
  )
}