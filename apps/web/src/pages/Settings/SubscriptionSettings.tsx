export function SubscriptionSettings() {
  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-sm font-bold tracking-wider text-white">Subscription</h2>
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Plan</span>
          <span className="text-xs text-white font-bold px-2 py-1 rounded bg-emerald-900/30 border border-emerald-800/50">PRO</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Status</span>
          <span className="text-xs text-emerald-400">Active</span>
        </div>
        <div className="text-[11px] text-gray-500">Sports intelligence platform — football and basketball. Future sports added without rewrite.</div>
      </div>
    </div>
  )
}
