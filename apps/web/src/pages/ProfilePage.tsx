import { useEffect, useState, useCallback } from 'react'
import { useAuth, authFetch } from '../services/auth'
import { Shield, ShieldCheck, User, Activity, Dumbbell, Clock, Globe, Save } from 'lucide-react'

export function ProfilePage() {
  const { user } = useAuth()
  const [health, setHealth] = useState<any>(null)
  const [sports, setSports] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    authFetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ status: 'unknown' }))
    authFetch('/api/admin/sports').then(r => r.json()).then(d => setSports(d.sports || [])).catch(() => {})
    authFetch('/api/settings/profile').then(r => { if (r.ok) return r.json() }).then(d => { if (d) setProfile(d) }).catch(() => {})
  }, [])

  const save = useCallback(async () => {
    if (!profile) return
    setSaving(true)
    const r = await authFetch('/api/settings/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }, [profile])

  const email = user?.email || profile?.email || '—'
  const role = user?.role || 'USER'
  const status = user?.status || 'ACTIVE'
  const mfaEnabled = user?.mfa_enabled || false
  const displayName = profile?.display_name || email.split('@')[0]
  const avatarLetter = displayName?.[0]?.toUpperCase() || 'A'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-wider text-white">PROFILE</h1>
          <p className="text-xs text-gray-500 mt-1">Your APEXSPORT account identity</p>
        </div>
        <button onClick={save} disabled={saving || !profile} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-xs font-bold tracking-wider text-white">
          <Save size={12} />{saving ? 'SAVING...' : saved ? 'SAVED!' : 'SAVE'}
        </button>
      </div>

      {/* Identity Card — matches sidebar style */}
      <div className="flex items-center gap-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600/40 to-blue-600/40 border border-emerald-600/50 flex items-center justify-center text-lg text-emerald-200 font-bold flex-shrink-0 relative">
          {avatarLetter}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-secondary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{displayName}</div>
          <div className="text-xs text-gray-500 truncate">{email}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-800/40 text-emerald-300 font-mono">{role}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${status === 'ACTIVE' ? 'bg-emerald-900/30 border border-emerald-800/40 text-emerald-400' : 'bg-red-900/30 border border-red-800/40 text-red-400'}`}>{status}</span>
            {mfaEnabled ? (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 border border-blue-800/40 text-blue-300"><ShieldCheck size={10} /> MFA</span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/30 border border-yellow-800/40 text-yellow-300"><Shield size={10} /> NO MFA</span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-gray-500 tracking-wider">BACKEND</div>
          <div className={`text-xs font-mono ${health?.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{health?.status || '...'}</div>
        </div>
      </div>

      {/* Editable Profile Fields */}
      {profile && (
        <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] space-y-4">
          <div className="text-[11px] tracking-widest text-gray-500 font-bold">PROFILE DETAILS</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-gray-500 text-[10px] flex items-center gap-1"><User size={10} /> Display Name</span>
              <input type="text" value={profile.display_name || ''} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-1 block">
              <span className="text-gray-500 text-[10px] flex items-center gap-1"><Globe size={10} /> Username</span>
              <input type="text" value={profile.username || ''} onChange={(e) => setProfile({ ...profile, username: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white font-mono" />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-gray-500 text-[10px]">Bio</span>
            <textarea value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={3} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-gray-500 text-[10px] flex items-center gap-1"><Clock size={10} /> Timezone</span>
              <input type="text" value={profile.timezone || ''} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-1 block">
              <span className="text-gray-500 text-[10px] flex items-center gap-1"><Globe size={10} /> Language</span>
              <input type="text" value={profile.language || ''} onChange={(e) => setProfile({ ...profile, language: e.target.value })} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
            </label>
          </div>
        </div>
      )}

      {/* Registered Sports */}
      <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="text-[11px] tracking-widest text-gray-500 font-bold flex items-center gap-1"><Dumbbell size={11} /> REGISTERED SPORTS</div>
        <div className="flex flex-wrap gap-2 mt-3">
          {sports.map(s => (
            <span key={s.code} className="px-2.5 py-1 rounded-md bg-emerald-900/20 border border-emerald-800/30 text-xs text-emerald-300 flex items-center gap-1">
              <Activity size={10} />{s.name} <span className="text-emerald-500 font-mono text-[10px]">({s.code})</span>
            </span>
          ))}
          {sports.length === 0 && <span className="text-xs text-gray-600">Loading...</span>}
        </div>
      </div>
    </div>
  )
}
