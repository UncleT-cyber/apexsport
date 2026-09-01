import { Link } from 'react-router-dom'

export function RequestAccessPage() {
  return (
    <div className="min-h-screen bg-[#070a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#0d1117] border border-[#30363d] rounded-xl p-6 text-center">
        <h1 className="text-sm font-bold tracking-widest text-white">Request access</h1>
        <p className="text-xs text-gray-500 mt-2">APEXSPORT is invite-only during controlled testing.</p>
        <p className="text-xs text-gray-400 mt-3">Contact your administrator to be invited. You will receive an email with a password setup link. No public registration is available.</p>
        <div className="mt-4 p-3 rounded bg-[#161b22] border border-[#21262d] text-left">
          <div className="text-[11px] text-gray-400">What happens after invite?</div>
          <ol className="text-xs text-gray-500 mt-1 list-decimal list-inside space-y-1">
            <li>Admin invites your email as USER or ADMIN</li>
            <li>You set a password via the emailed reset link</li>
            <li>Sign in with email + password, then MFA if enrolled</li>
          </ol>
        </div>
        <div className="flex gap-2 justify-center mt-4">
          <Link to="/login" className="px-4 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold">Go to login</Link>
          <Link to="/" className="px-4 py-1.5 rounded border border-[#30363d] text-xs text-gray-400 hover:text-white">Back to landing</Link>
        </div>
      </div>
    </div>
  )
}
