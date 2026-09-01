import { usePolling } from '../hooks/usePolling'
import { authFetch } from '../services/auth'
import clsx from 'clsx'

export function ProviderIndicator({ compact }: { compact?: boolean }) {
  const { data } = usePolling(() => authFetch('/api/providers/health').then(r => r.json().catch(() => null)), 8000)
  if (!data) return null
  const providers = Object.entries(data as Record<string, any>)
  const configured = providers.filter(([, v]) => v.configured).length
  const healthy = providers.filter(([, v]) => v.is_healthy).length
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className={clsx('w-1.5 h-1.5 rounded-full', healthy > 0 ? 'bg-emerald-400' : 'bg-red-400')} />
        <span className="text-gray-500">{configured}/{providers.length} providers</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      {providers.map(([name, v]: any) => (
        <span key={name} className={clsx('text-[10px] px-1.5 py-0.5 rounded border', v.configured ? (v.is_healthy ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-yellow-900/20 border-yellow-800/30 text-yellow-400') : 'bg-gray-800 border-gray-700 text-gray-500')}>
          {name.toUpperCase()} {v.configured ? '●' : '○'}
        </span>
      ))}
    </div>
  )
}