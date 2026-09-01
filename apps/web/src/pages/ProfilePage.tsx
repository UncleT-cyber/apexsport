import { useEffect, useState } from 'react';
import { authFetch } from '../services/auth'
export function ProfilePage(){
  const [health,setHealth]=useState<any>(null);
  const [sports,setSports]=useState<any[]>([]);
  useEffect(()=>{
    fetch('/api/health').then(r=>r.json()).then(setHealth).catch(()=>setHealth({status:'unknown'}));
    authFetch('/api/admin/sports').then(r=>r.json()).then(d=>setSports(d.sports||[])).catch(()=>{});
  },[]);
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-sm font-bold tracking-widest text-white">PROFILE</h1>
      <div className="flex items-center gap-4 p-4 rounded border border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600/40 to-blue-600/40 border border-emerald-600/50 flex items-center justify-center text-lg text-white">A</div>
        <div><div className="text-sm font-bold text-white">Apex User</div><div className="text-xs text-gray-500">Sports Intelligence • apex@apexsports.local</div><div className="text-[10px] text-gray-600 mt-1">ID: user_apex_001 • Role: analyst</div></div>
        <div className="ml-auto text-right"><div className="text-[10px] text-gray-500">BACKEND</div><div className={health?.status==='ok'?'text-emerald-400 text-xs':'text-red-400 text-xs'}>{health?.status||'...'}</div></div>
      </div>
      <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-primary)]">
        <div className="text-[11px] tracking-widest text-gray-500">REGISTERED SPORTS</div>
        <div className="flex gap-2 mt-2">{sports.map(s=> <span key={s.code} className="px-2 py-1 rounded bg-emerald-900/20 border border-emerald-800/30 text-xs text-emerald-300">{s.name} ({s.code})</span>)}</div>
        <div className="text-[11px] text-gray-600 mt-2">Extensible via <code className="px-1 py-0.5 rounded bg-[var(--bg-secondary)]">sports/registry.py:1</code> — adding a sport requires only <code>sports/&lt;sport&gt;/</code> without rewriting platform core.</div>
      </div>
      <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-gray-400">
        Secrets are server-side only. Frontend consumes canonical DTOs. This profile is local stub — auth hardening (JWT, audit log) tracked in <code>core/security</code>.
      </div>
    </div>
  )
}