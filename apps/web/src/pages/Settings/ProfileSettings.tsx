import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../services/auth'
export function ProfileSettings() {
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const load = useCallback(async () => {
    const r = await authFetch('/api/settings/profile')
    if (r.ok) setProfile(await r.json())
  }, [])
  useEffect(() => { load() }, [load])
  const save = useCallback(async () => {
    if (!profile) return
    setSaving(true)
    const r = await authFetch('/api/settings/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }, [profile])
  if (!profile) return <div className="text-xs text-gray-500 p-6">Loading...</div>
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-wider text-white">Profile</h1>
          <p className="text-xs text-gray-500 mt-1">Manage your APEXSPORT profile</p>
        </div>
        <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-xs font-bold tracking-wider text-white">{saving ? 'SAVING...' : saved ? 'SAVED!' : 'SAVE PROFILE'}</button>
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-6 space-y-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-600/40 to-blue-600/40 border border-emerald-600/50 flex items-center justify-center text-3xl text-emerald-200 font-bold flex-shrink-0">{profile.display_name?.[0]?.toUpperCase() || 'A'}</div>
          <div className="flex-1 space-y-3">
            <label className="space-y-1 block">
              <span className="text-gray-500 text-[10px]">Display Name</span>
              <input type="text" value={profile.display_name || ''} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-1 block">
              <span className="text-gray-500 text-[10px]">Username</span>
              <input type="text" value={profile.username || ''} onChange={(e) => setProfile({ ...profile, username: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white font-mono" />
            </label>
          </div>
        </div>
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">Email</span>
          <input type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
        </label>
        <label className="space-y-1 block">
          <span className="text-gray-500 text-[10px]">Bio</span>
          <textarea value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={3} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 block">
            <span className="text-gray-500 text-[10px]">Timezone</span>
            <input type="text" value={profile.timezone || ''} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
          </label>
          <label className="space-y-1 block">
            <span className="text-gray-500 text-[10px]">Language</span>
            <input type="text" value={profile.language || ''} onChange={(e) => setProfile({ ...profile, language: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
          </label>
        </div>
      </div>
    </div>
  )
}