import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../services/auth'
import clsx from 'clsx';
export function MarketDataSettings(){
  const [providers,setProviders]=useState<Record<string,any>>({});
  const [edits,setEdits]=useState<Record<string,any>>({});
  const [tests,setTests]=useState<Record<string,any>>({});
  const [saving,setSaving]=useState(false);
  const load=useCallback(async()=>{
    const r=await authFetch('/api/settings/market-data'); if(r.ok) setProviders((await r.json()).providers||{});
  },[]);
  useEffect(()=>{load()},[load]);
  const save=async(p:string)=>{
    setSaving(true);
    const body:any={ [p]: { api_key: edits[p]?.api_key, base_url: edits[p]?.base_url } };
    if(body[p].api_key?.startsWith('*')) delete body[p].api_key;
    await authFetch('/api/settings/market-data',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    setEdits(prev=>({...prev,[p]:{}})); await load(); setSaving(false);
  };
  const test=async(p:string)=>{
    setTests(prev=>({...prev,[p]:{status:'testing',message:'Testing...'}}));
    const r=await authFetch(`/api/settings/test/${p}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key: edits[p]?.api_key})});
    const j=await r.json().catch(()=>({status:'error',message:'failed'})); setTests(prev=>({...prev,[p]:j}));
  };
  return (
    <div className="space-y-4">
      <div className="text-[11px] text-gray-500">Connect sports data & odds providers. Keys are stored server-side and never returned in full.</div>
      {Object.entries(providers).map(([id,cfg]:any)=>(
        <div key={id} className="p-3 rounded border border-[var(--border)] bg-[var(--bg-secondary)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">{cfg.display_name}</span>
            <span className={clsx('text-[10px] px-2 py-0.5 rounded',cfg.has_key?'bg-emerald-900/30 text-emerald-400':'bg-gray-800 text-gray-500')}>{cfg.has_key?'CONFIGURED':'NOT CONFIGURED'}</span>
          </div>
          {cfg.api_key && <div className="text-[10px] text-gray-600 font-mono">Stored: {cfg.api_key}</div>}
          <input placeholder="API Key" type="password" value={edits[id]?.api_key||''} onChange={e=>setEdits(p=>({...p,[id]:{...p[id],api_key:e.target.value}}))} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white" />
          <input placeholder={id==='sportmonks' ? 'https://api.sportmonks.com/v3 (API base — key from my.sportmonks.com)' : id==='api_football' ? 'https://v3.football.api-sports.io' : id==='sportradar' ? 'https://api.sportradar.com' : id==='the_odds_api' ? 'https://api.the-odds-api.com/v4' : 'Base URL (optional)'} value={edits[id]?.base_url||cfg.base_url||''} onChange={e=>setEdits(p=>({...p,[id]:{...p[id],base_url:e.target.value}}))} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white" />
          {id==='sportmonks' && <div className="text-[10px] text-gray-600">API base is <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)]">https://api.sportmonks.com/v3</code> — key from <code>my.sportmonks.com</code> → My API → Copy key into API Key field.</div>}
          {id==='sportradar' && <div className="text-[10px] text-gray-600">API base is <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)]">https://api.sportradar.com</code> — key from <code>developer.sportradar.com</code> / <code>my.sportradar.com</code>. Test hits <code>/soccer/trial/v4/en/sports.json?api_key=...</code></div>}
          {id==='api_football' && <div className="text-[10px] text-gray-600">Base <code>https://v3.football.api-sports.io</code> — key header <code>x-apisports-key</code>. Get key at <code>api-football.com</code></div>}
          {id==='the_odds_api' && <div className="text-[10px] text-gray-600">Base <code>https://api.the-odds-api.com/v4</code> — test hits <code>/sports?apiKey=...</code></div>}
          <div className="flex gap-2 items-center">
            <button onClick={()=>save(id)} disabled={saving} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-50">{saving?'SAVING...':'SAVE'}</button>
            <button onClick={()=>test(id)} className="px-3 py-1 rounded border border-[var(--border)] text-xs text-gray-400 hover:text-white">TEST</button>
            {tests[id] && <span className={clsx('text-xs',tests[id].status==='ok'?'text-emerald-400':'text-yellow-400',tests[id].status==='error'&&'text-red-400')}>{tests[id].message}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}