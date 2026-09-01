import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/auth'

export function MfaPage() {
  const nav = useNavigate()
  const loc = useLocation() as any
  const temp = loc.state?.temp_token
  const email = loc.state?.email
  const { verifyMfa } = useAuth()
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!temp) {
    return (
      <div className="min-h-screen bg-[#070a0f] flex items-center justify-center p-6">
        <div className="text-sm text-gray-400">No MFA challenge — <button onClick={()=>nav('/login')} className="text-emerald-400 underline">sign in again</button></div>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    const res = await verifyMfa(temp, code)
    setLoading(false)
    if (res.error) { setErr(res.error); return }
    nav('/app')
  }

  return (
    <div className="min-h-screen bg-[#070a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#0d1117] border border-[#30363d] rounded-xl p-6">
        <h1 className="text-sm font-bold tracking-widest text-white text-center">MFA — Authenticator code</h1>
        <p className="text-[11px] text-gray-500 text-center mt-1">Open your authenticator app for {email || 'APEXSPORT'} and enter the 6-digit code.</p>
        <form onSubmit={submit} className="space-y-3 mt-4">
          <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="000000" maxLength={6} inputMode="numeric" autoFocus className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-3 text-center text-lg tracking-[0.3em] text-white font-mono focus:outline-none focus:border-emerald-600/50" />
          {err && <div className="text-xs text-red-400 bg-red-900/10 border border-red-800/30 rounded p-2">{err}</div>}
          <button type="submit" disabled={loading || code.length !== 6} className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold">Verify</button>
        </form>
        <div className="text-center mt-3">
          <button onClick={()=>nav('/login')} className="text-xs text-gray-600 hover:text-white">Back to login</button>
        </div>
      </div>
    </div>
  )
}
