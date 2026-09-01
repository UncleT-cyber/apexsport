import { useAuth } from '../../services/auth'
import { useNavigate } from 'react-router-dom'

export function SessionSettings() {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  const handleLogout = async () => {
    logout()
    nav('/login', { replace: true })
  }

  const handleLogoutAll = async () => {
    // For file-based auth, logout is stateless (clear token). In production with Supabase, this would revoke all sessions.
    logout()
    localStorage.removeItem('apex_token')
    nav('/login', { replace: true })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-sm font-bold tracking-wider text-white">Session</h2>
        <p className="text-[11px] text-gray-500 mt-1">Manage your current session. Signing out clears the local JWT and requires re-authentication (password + MFA if enabled).</p>
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">CURRENT SESSION</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-[10px] text-gray-500">Email</div>
            <div className="text-white font-mono">{user?.email || '—'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Role / Status</div>
            <div className="text-white">{user?.role || '—'} • {user?.status || '—'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">MFA</div>
            <div className={user?.mfa_enabled ? 'text-emerald-400' : 'text-gray-500'}>{user?.mfa_enabled ? 'Enabled' : 'Not enabled'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Token</div>
            <div className="text-[10px] text-gray-600 font-mono">Stored in localStorage as apex_token</div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">SIGN OUT</h3>
        <p className="text-[11px] text-gray-500">Sign out will clear your session and require password (+ MFA if enabled) to re-enter. No provider or LLM keys are exposed during logout.</p>
        <div className="flex gap-2">
          <button onClick={handleLogout} className="px-4 py-1.5 rounded bg-[#21262d] border border-[#30363d] text-xs text-white hover:bg-[#30363d]">Sign out</button>
          <button onClick={handleLogoutAll} className="px-4 py-1.5 rounded bg-red-900/20 border border-red-800/30 text-xs text-red-400 hover:bg-red-900/30">Sign out everywhere</button>
        </div>
        <div className="text-[10px] text-gray-600">For controlled testing, sessions are stateless JWT (1 day). Server does not retain service-role keys in browser.</div>
      </div>
    </div>
  )
}
