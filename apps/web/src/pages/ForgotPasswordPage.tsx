import { useState } from 'react'
import { Link } from 'react-router-dom'
import { publicFetch } from '../services/publicFetch'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    try {
      const r = await publicFetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.detail || 'Failed'); return }
      setDone(true)
      if (j.reset_token) setToken(j.reset_token)
    } catch (e: any) { setErr(String(e)) }
  }

  return (
    <div className="min-h-screen bg-[#070a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#0d1117] border border-[#30363d] rounded-xl p-6">
        <h1 className="text-sm font-bold tracking-widest text-white text-center">Forgot password</h1>
        {!done ? (
          <form onSubmit={submit} className="space-y-3 mt-4">
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="you@apexsports.local" className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600/50" />
            {err && <div className="text-xs text-red-400 bg-red-900/10 border border-red-800/30 rounded p-2">{err}</div>}
            <button type="submit" className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">Send reset link</button>
            <div className="text-center"><Link to="/login" className="text-xs text-gray-600 hover:text-white">Back to login</Link></div>
          </form>
        ) : (
          <div className="space-y-3 mt-4">
            <div className="text-xs text-emerald-400 bg-emerald-900/10 border border-emerald-800/30 rounded p-2">If account exists, reset email sent. Check your email.</div>
            {token && <div className="text-[11px] text-gray-500 break-all p-2 rounded bg-[#161b22] border border-[#21262d]">Dev token: <Link to={`/reset-password?token=${token}`} className="text-emerald-400 underline">{token.slice(0,16)}…</Link> (click to reset)</div>}
            <div className="flex gap-2 justify-center">
              <Link to="/login" className="text-xs text-gray-500 hover:text-white">Back to login</Link>
              <Link to="/" className="text-xs text-gray-500 hover:text-white">Landing</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
