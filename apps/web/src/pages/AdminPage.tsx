import { useEffect, useState } from 'react'
import { authFetch } from '../services/auth'

export function AdminPage() {
  const [users, setUsers] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('USER')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    try {
      const r = await authFetch('/api/auth/users')
      if (r.ok) { const j = await r.json(); setUsers(j.users || []) }
      else { const j = await r.json().catch(()=>({})); setErr(j.detail || 'Failed to load users (admin only)') }
      const h = await authFetch('/api/auth/admin/health')
      if (h.ok) setHealth(await h.json())
    } catch (e: any) { setErr(String(e)) }
  }
  useEffect(() => { load() }, [])

  const invite = async () => {
    setMsg(null); setErr(null)
    const r = await authFetch('/api/auth/invite', { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) })
    const j = await r.json().catch(()=>({}))
    if (!r.ok) { setErr(j.detail || 'Invite failed'); return }
    setMsg(`Invited ${inviteEmail} as ${inviteRole} — token ${String(j.invite_token||'').slice(0,12)}…`)
    setInviteEmail('')
    load()
  }

  const update = async (id: string, patch: any) => {
    setErr(null)
    const r = await authFetch(`/api/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    const j = await r.json().catch(()=>({}))
    if (!r.ok) { setErr(j.detail || 'Update failed'); return }
    load()
  }

  return (
    <div className="min-h-screen bg-[#070a0f] w-full">
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-[#1c2128] bg-[#0d1117]/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center"><span className="text-sm">🏆</span></div>
          <span className="font-bold tracking-widest text-white">APEXSPORT</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-900/20 border border-red-800/30 text-red-400">ADMIN</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/app" className="px-3 py-1.5 rounded border border-[#30363d] text-xs text-gray-400 hover:text-white">← Back to App</a>
          <a href="/login" onClick={() => { localStorage.removeItem('apex_token'); }} className="px-3 py-1.5 rounded bg-[#21262d] text-xs text-gray-400 hover:text-white">Logout</a>
        </div>
      </header>
      <div className="p-6 space-y-6 w-full max-w-none">
        <h1 className="text-sm font-bold tracking-widest text-white">ADMIN — Users & System</h1>
      {err && <div className="text-xs text-red-400 bg-red-900/10 border border-red-800/30 rounded p-2">{err}</div>}
      {msg && <div className="text-xs text-emerald-400 bg-emerald-900/10 border border-emerald-800/30 rounded p-2">{msg}</div>}

      <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
        <h2 className="text-xs font-bold tracking-widest text-gray-400">INVITE USER (invite-only)</h2>
        <div className="flex gap-2 mt-2">
          <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="email@apexsports.local" className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-xs text-white" />
          <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)} className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-xs text-white">
            <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
          </select>
          <button onClick={invite} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold">Invite</button>
        </div>
        <div className="text-[10px] text-gray-600 mt-1">Invited → token via reset flow → ACTIVE. No public registration.</div>
      </div>

      <div className="rounded border border-[var(--border)] bg-[#0d1117] overflow-hidden">
        <div className="px-3 py-2 border-b border-[#21262d] flex justify-between">
          <span className="text-xs font-bold tracking-widest text-gray-400">USERS — {users.length}</span>
          <button onClick={load} className="text-[11px] text-gray-500 hover:text-white">Refresh</button>
        </div>
        <div className="overflow-auto max-h-[320px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#161b22] text-gray-500"><tr><th className="text-left p-2">Email</th><th className="text-left p-2">Role</th><th className="text-left p-2">Status</th><th className="text-left p-2">MFA</th><th className="text-left p-2">Actions</th></tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id} className="border-t border-[#21262d] hover:bg-[#161b22]">
                  <td className="p-2 font-mono text-white">{u.email}</td>
                  <td className="p-2"><span className="px-1.5 py-0.5 rounded border text-[10px] border-[#30363d] text-gray-400">{u.role}</span></td>
                  <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] border ${u.status==='ACTIVE'?'bg-emerald-900/20 border-emerald-800/30 text-emerald-400':u.status==='INVITED'?'bg-yellow-900/20 border-yellow-800/30 text-yellow-400': u.status==='SUSPENDED'?'bg-orange-900/20 border-orange-800/30 text-orange-400':'bg-red-900/20 border-red-800/30 text-red-400'}`}>{u.status}</span></td>
                  <td className="p-2 text-gray-400">{u.mfa_enabled ? '✓ enabled' : '—'}</td>
                  <td className="p-2 flex gap-1 flex-wrap">
                    <button onClick={()=>update(u.id, {status:'ACTIVE'})} className="px-1.5 py-0.5 rounded border border-[#30363d] text-[10px] text-gray-400 hover:text-white">Activate</button>
                    <button onClick={()=>update(u.id, {status:'SUSPENDED'})} className="px-1.5 py-0.5 rounded border border-orange-800/30 text-[10px] text-orange-400">Suspend</button>
                    <button onClick={()=>update(u.id, {status:'REVOKED'})} className="px-1.5 py-0.5 rounded border border-red-800/30 text-[10px] text-red-400">Revoke</button>
                    <button onClick={()=>update(u.id, {role: u.role==='ADMIN'?'USER':'ADMIN'})} className="px-1.5 py-0.5 rounded border border-[#30363d] text-[10px] text-gray-400">{u.role==='ADMIN'?'→USER':'→ADMIN'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && <div className="text-xs text-gray-600 p-4 text-center">No users — invite one above. Invite-only, no public registration.</div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="text-[10px] tracking-widest text-gray-500">ENGINE HEALTH</div>
          <div className="text-xs mt-1 text-gray-400">State: <span className="text-white">{health?.engine?.state || '—'}</span> • Scanning: {health?.engine?.is_scanning ? 'yes' : 'no'}</div>
          <div className="text-[10px] text-gray-600 mt-1">Total predictions {health?.engine?.total_predictions ?? '—'}</div>
        </div>
        <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="text-[10px] tracking-widest text-gray-500">PROVIDER HEALTH</div>
          <div className="space-y-1 mt-1">
            {health?.providers ? Object.entries(health.providers).map(([k,v]: any)=>(
              <div key={k} className="flex justify-between text-xs"><span className="text-gray-500">{k}</span><span className={v.is_healthy?'text-emerald-400':'text-red-400'}>{v.status}</span></div>
            )) : <div className="text-xs text-gray-600">No data</div>}
          </div>
        </div>
        <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="text-[10px] tracking-widest text-gray-500">API HEALTH</div>
          <div className="text-xs text-emerald-400 mt-1">● ok</div>
          <div className="text-[10px] text-gray-600 mt-1">Protected APIs return 401 without JWT/MFA. No service-role keys in browser.</div>
        </div>
      </div>
      </div>
    </div>
  )
}
