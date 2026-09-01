import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { authFetch } from '../../services/auth'

export function SecuritySettings() {
  const [me, setMe] = useState<any>(null)
  const [enroll, setEnroll] = useState<any>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await authFetch('/api/auth/me')
    if (r.ok) setMe(await r.json())
  }, [])
  useEffect(() => { load() }, [load])

  const startEnroll = async () => {
    setErr(null); setMsg(null)
    const r = await authFetch('/api/auth/mfa/enroll', { method: 'POST' })
    const j = await r.json().catch(()=>({}))
    if (!r.ok) { setErr(j.detail || 'Enroll failed'); return }
    setEnroll(j)
  }

  const verifyEnroll = async () => {
    setErr(null)
    const r = await authFetch('/api/auth/mfa/enroll/verify', { method: 'POST', body: JSON.stringify({ code }) })
    const j = await r.json().catch(()=>({}))
    if (!r.ok) { setErr(j.detail || 'Invalid code'); return }
    setMsg('MFA enabled — authenticator linked. Server-side TOTP enforced for protected APIs.')
    setEnroll(null); setCode(''); load()
  }

  const disable = async () => {
    const r = await authFetch('/api/auth/mfa/disable', { method: 'POST' })
    if (r.ok) { setMsg('MFA disabled'); load() }
  }

  if (!me) return <div className="text-xs text-gray-500">Loading…</div>

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-sm font-bold tracking-wider text-white">Security — MFA</h2>
      <p className="text-[11px] text-gray-500">TOTP authenticator-app MFA. Enforced server-side for protected API access. Do not use TOTP secret as password recovery.</p>

      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-white">MFA Status</div>
            <div className="text-[11px] text-gray-500">{me.mfa_enabled ? 'Enabled — login requires TOTP code' : 'Not enabled — enable for session assurance'}</div>
          </div>
          <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border', me.mfa_enabled ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-yellow-900/20 border-yellow-800/30 text-yellow-400')}>{me.mfa_enabled ? 'ENABLED' : 'DISABLED'}</span>
        </div>

        {!me.mfa_enabled ? (
          <div className="space-y-3">
            {!enroll ? (
              <button onClick={startEnroll} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">Enroll MFA — Show QR</button>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-gray-400">Scan this QR with Authenticator (Google Authenticator, Authy, 1Password):</div>
                <img src={enroll.qr_data_uri} alt="MFA QR" className="w-40 h-40 bg-white p-2 rounded mx-auto border border-[#21262d]" />
                <div className="text-[10px] text-gray-600 break-all font-mono">Secret: {enroll.secret} • URL: {enroll.otpauth_url.slice(0,60)}…</div>
                <div className="flex gap-2">
                  <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="6-digit code" maxLength={6} className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-center tracking-[0.3em] text-white font-mono" />
                  <button onClick={verifyEnroll} className="px-4 py-2 rounded bg-emerald-600 text-white text-xs font-bold">Verify & Enable</button>
                </div>
                <div className="text-[10px] text-gray-600">Server verifies code via pyotp — no custom crypto.</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={disable} className="px-3 py-1.5 rounded border border-red-800/30 bg-red-900/10 text-red-400 text-xs">Disable MFA</button>
            <button onClick={startEnroll} className="px-3 py-1.5 rounded border border-[#30363d] text-xs text-gray-400">Re-enroll (new QR)</button>
          </div>
        )}
        {msg && <div className="text-xs text-emerald-400 bg-emerald-900/10 border border-emerald-800/30 rounded p-2">{msg}</div>}
        {err && <div className="text-xs text-red-400 bg-red-900/10 border border-red-800/30 rounded p-2">{err}</div>}
        <div className="text-[10px] text-gray-600">MFA enforced server-side: protected APIs check <code className="px-1 py-0.5 rounded bg-[#0d1117] border border-[#21262d]">mfa_verified</code> claim. No secrets in browser beyond masked keys.</div>
      </div>
    </div>
  )
}
