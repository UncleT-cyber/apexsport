import { useState, useEffect } from 'react';
import { authFetch } from '../../services/auth'
export function ScannerSettings(){
  const [cfg,setCfg]=useState<any>({});
  useEffect(()=>{ authFetch('/api/settings').then(r=>r.json()).then(d=>setCfg(d.scanner||{})).catch(()=>{}); },[]);
  const save=async()=>{
    await authFetch('/api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({scanner: cfg})});
  };
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-gray-500">Scanner orchestration: discovery → features → specialists → ensemble → value → risk.</div>
      <div className="flex items-center gap-2"><span className="text-xs text-gray-400 w-40">Interval (s)</span><input type="number" value={cfg.interval_seconds||300} onChange={e=>setCfg((p:any)=>({...p,interval_seconds: parseInt(e.target.value)}))} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white w-24" /></div>
      <div className="flex items-center gap-2"><span className="text-xs text-gray-400 w-40">Top N</span><input type="number" value={cfg.top_n||10} onChange={e=>setCfg((p:any)=>({...p,top_n: parseInt(e.target.value)}))} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-white w-24" /></div>
      <button onClick={save} className="px-4 py-1.5 rounded bg-emerald-600 text-white text-xs">SAVE SCANNER</button>
    </div>
  )
}