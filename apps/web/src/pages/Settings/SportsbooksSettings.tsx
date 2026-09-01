import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { authFetch } from '../../services/auth'
export function SportsbooksSettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const books = ['sportybet','bet9ja','betway','draftkings','fanduel','generic']
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/sportsbooks')
    if (r.ok) setCfg(await r.json())
  }, [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async () => {
    setSaving(true)
    await authFetch('/api/settings/sportsbooks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaving(false)
  }, [cfg])
  if (!cfg) return <div className="text-xs text-gray-500">Loading...</div>
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-sm font-bold tracking-wider text-white">Sportsbooks</h2>
        <p className="text-[10px] text-gray-500 mt-1">Apex is not a sportsbook. Mappings are formatting only — no unauthorized automation, no private API reverse-engineering.</p>
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">ENABLED SPORTSBOOKS (priority order)</h3>
        <div className="grid grid-cols-2 gap-2">
          {books.map(b => (
            <label key={b} className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={(cfg.enabled||[]).includes(b)} onChange={(e) => {
                const s = new Set(cfg.enabled||[])
                if (e.target.checked) s.add(b); else s.delete(b)
                setCfg({ ...cfg, enabled: Array.from(s) })
              }} className="accent-emerald-500" />
              {b.toUpperCase()}
              {(cfg.priority||[]).indexOf(b) >=0 && <span className="text-[10px] text-gray-600">#{cfg.priority.indexOf(b)+1}</span>}
            </label>
          ))}
        </div>
        <p className="text-[10px] text-gray-600">Canonical slip → sportsbook market keys via <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)]">sportsbooks/mappings</code>. Booking codes are external references only — never invented.</p>
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold tracking-wider text-white">{saving ? 'SAVING...' : 'SAVE SPORTSBOOKS'}</button>
    </div>
  )
}