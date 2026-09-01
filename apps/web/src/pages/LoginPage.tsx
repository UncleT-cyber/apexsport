import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../services/auth'

export function LoginPage() {
  const nav = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    const res = await login(email, password)
    setLoading(false)
    if (res.error) {
      setErr(res.error)
      return
    }
    if (res.mfa_required && res.temp_token) {
      nav('/mfa', { state: { temp_token: res.temp_token, email } })
      return
    }
    nav('/app')
  }

  return (
    <div className="min-h-screen bg-[#070a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#0d1117] border border-[#30363d] rounded-xl p-6">
        <div className="text-center mb-6">
          <div className="w-8 h-8 rounded bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center mx-auto"><span className="text-sm">🏆</span></div>
          <h1 className="text-sm font-bold tracking-widest text-white mt-2">APEXSPORT</h1>
          <p className="text-[11px] text-gray-500 mt-1">Sign in — controlled testing, invite-only</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-500 tracking-wider">Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="w-full mt-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600/50" placeholder="you@apexsports.local" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 tracking-wider">Password</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required className="w-full mt-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600/50" />
          </div>
          {err && <div className="text-xs text-red-400 bg-red-900/10 border border-red-800/30 rounded p-2">{err}</div>}
          <button type="submit" disabled={loading} className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold tracking-wider">{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="flex justify-between mt-4 text-xs">
          <Link to="/forgot-password" className="text-gray-500 hover:text-emerald-400">Forgot password?</Link>
          <Link to="/request-access" className="text-gray-500 hover:text-emerald-400">Request access →</Link>
        </div>
        <div className="text-center mt-4">
          <button onClick={()=>nav('/')} className="text-[11px] text-gray-600 hover:text-white">← Back to landing</button>
        </div>
      </div>
    </div>
  )
}
