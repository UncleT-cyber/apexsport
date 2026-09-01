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
export function AppearanceSettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/appearance')
    if (r.ok) setCfg(await r.json())
  }, [])
  useEffect(() => { load() }, [load])
  const applyTheme = useCallback((theme: string) => {
    const root = document.documentElement
    if (theme === 'light') {
      root.style.setProperty('--bg-primary', '#ffffff')
      root.style.setProperty('--bg-secondary', '#f6f8fa')
      root.style.setProperty('--bg-tertiary', '#eaeef2')
      root.style.setProperty('--border', '#d0d7de')
      root.style.setProperty('--text-primary', '#1f2328')
      root.style.setProperty('--text-secondary', '#656d76')
      root.classList.add('light-theme')
    } else {
      root.style.setProperty('--bg-primary', '#0d1117')
      root.style.setProperty('--bg-secondary', '#161b22')
      root.style.setProperty('--bg-tertiary', '#21262d')
      root.style.setProperty('--border', '#30363d')
      root.style.setProperty('--text-primary', '#e6edf3')
      root.style.setProperty('--text-secondary', '#8b949e')
      root.classList.add('dark-theme')
    }
    localStorage.setItem('apex-sports-theme', theme)
  }, [])
  const save = useCallback(async () => {
    if (!cfg) return
    setSaving(true)
    await authFetch('/api/settings/appearance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    applyTheme(cfg.theme)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }, [cfg, applyTheme])
  if (!cfg) return <div className="text-xs text-gray-500">Loading...</div>
  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-sm font-bold tracking-wider text-white">Appearance</h2>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">Theme</span>
          <select value={cfg.theme || 'dark'} onChange={(e) => setCfg({ ...cfg, theme: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white">
            <option value="dark">Dark</option><option value="light">Light</option>
          </select>
        </label>
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">Density</span>
          <select value={cfg.density || 'comfortable'} onChange={(e) => setCfg({ ...cfg, density: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white">
            <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
          </select>
        </label>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white">Sidebar auto-collapse</span>
          <Toggle checked={!!cfg.sidebar_auto_collapse} onChange={(v) => setCfg({ ...cfg, sidebar_auto_collapse: v })} />
        </div>
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold tracking-wider text-white">{saving ? 'SAVING...' : saved ? 'SAVED!' : 'SAVE APPEARANCE'}</button>
    </div>
  )
}