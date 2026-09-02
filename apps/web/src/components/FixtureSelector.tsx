import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import clsx from 'clsx'
import { Search, ChevronDown } from 'lucide-react'
import { authFetch } from '../services/auth'

interface Fixture {
  id: string
  label: string
  home: string
  away: string
  competition: string
  sport: string
  kickoff_at: string
}

export function FixtureSelector({ value, onSelect, sport }: { value: string; onSelect: (id: string, f?: Fixture) => void; sport: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchFixtures = useCallback(async () => {
    setLoading(true)
    try {
      const r = await authFetch(`/api/fixtures?sport=${sport}`)
      const j = await r.json()
      setFixtures(j.fixtures || [])
    } catch {}
    setLoading(false)
  }, [sport])

  useEffect(() => { fetchFixtures() }, [fetchFixtures])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const active = useMemo(() => fixtures.find(f => f.id === value) || null, [fixtures, value])
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return fixtures.filter(f => !q || f.label.toLowerCase().includes(q) || f.competition.toLowerCase().includes(q)).slice(0, 8)
  }, [fixtures, query])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-xs">
        <span className="font-bold text-white">{active ? active.label : 'Select fixture'}</span>
        {active && <span className="text-[10px] text-gray-500">{active.competition}</span>}
        <ChevronDown size={12} className={clsx('text-gray-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 rounded border border-[var(--border)] bg-[var(--bg-secondary)] shadow-lg z-20 overflow-hidden">
          <div className="p-2 border-b border-[var(--border)] flex items-center gap-2">
            <Search size={12} className="text-gray-500" />
            <input autoFocus placeholder="Search fixtures..." value={query} onChange={e => setQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-xs text-white placeholder:text-gray-600" />
          </div>
          <div className="max-h-64 overflow-auto">
            {loading ? <div className="p-3 text-xs text-gray-500">Loading…</div> : filtered.length === 0 ? <div className="p-3 text-xs text-gray-600">No fixtures</div> : filtered.map(f => (
              <button key={f.id} onClick={() => { onSelect(f.id, f); setOpen(false) }} className={clsx('w-full text-left px-3 py-2 hover:bg-[var(--bg-tertiary)] flex items-center justify-between', value === f.id && 'bg-[var(--bg-tertiary)]')}>
                <div>
                  <div className="text-xs font-medium text-white">{f.label}</div>
                  <div className="text-[10px] text-gray-500">{f.competition} • {new Date(f.kickoff_at).toLocaleDateString()}</div>
                </div>
                <span className="text-[10px] text-gray-600">{f.sport}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
