import { useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { publicFetch } from '../services/publicFetch'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const token = params.get('token') || ''
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    try {
      const r = await publicFetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, new_password: pw }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.detail || 'Reset failed'); return }
      setDone(true)
      setTimeout(()=> nav('/login'), 1200)
    } catch (e: any) { setErr(String(e)) }
  }

  if (!token) return <div className="min-h-screen bg-[#070a0f] flex items-center justify-center p-6"><div className="text-sm text-red-400">Missing token — use link from email</div></div>

  return (
    <div className="min-h-screen bg-[#070a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#0d1117] border border-[#30363d] rounded-xl p-6">
        <h1 className="text-sm font-bold tracking-widest text-white text-center">Set new password</h1>
        {!done ? (
          <form onSubmit={submit} className="space-y-3 mt-4">
            <input value={pw} onChange={e=>setPw(e.target.value)} type="password" required placeholder="New password (≥8 chars)" className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600/50" />
            {err && <div className="text-xs text-red-400 bg-red-900/10 border border-red-800/30 rounded p-2">{err}</div>}
            <button type="submit" className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">Update password</button>
          </form>
        ) : (
          <div className="text-xs text-emerald-400 bg-emerald-900/10 border border-emerald-800/30 rounded p-2 mt-4 text-center">Password updated — redirecting to login…</div>
        )}
        <div className="text-center mt-3"><Link to="/login" className="text-xs text-gray-600 hover:text-white">Back to login</Link></div>
      </div>
    </div>
  )
}
