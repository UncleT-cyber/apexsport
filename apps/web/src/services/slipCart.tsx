import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authFetch } from './auth'

type SlipCartItem = {
  predictionId: string
  fixtureId: string
  sport?: string
  addedAt: number
}

type SlipCartContextType = {
  items: SlipCartItem[]
  count: number
  has: (predictionId: string) => boolean
  add: (pred: any) => Promise<{ ok: boolean; reason?: string }>
  remove: (predictionId: string) => void
  clear: () => void
  validateItem: (pred: any) => { ok: boolean; reason?: string }
}

const STORAGE_KEY = 'apex_slip_cart'
const MAX_STALE_HOURS = 48
const MAX_CORRELATION = 0.70

function isStale(pred: any): boolean {
  const ts = pred.created_at || pred.captured_at || pred.kickoff_at
  if (!ts) return false
  const t = new Date(ts).getTime()
  if (isNaN(t)) return false
  return (Date.now() - t) > MAX_STALE_HOURS * 3600 * 1000
}

function validatePredictionForSlip(pred: any, existingIds: Set<string>): { ok: boolean; reason?: string } {
  if (!pred || (!pred.id && !pred.fixture_id)) return { ok: false, reason: 'Prediction missing identifier' }
  const pid = pred.id || pred.fixture_id
  if (existingIds.has(pid)) return { ok: false, reason: 'Prediction already in slip' }
  if (!pred.market || !pred.selection) return { ok: false, reason: 'Missing market/selection — not eligible for slip' }
  if (!pred.fixture_id || !pred.fixture_label) return { ok: false, reason: 'Missing fixture information' }
  if (pred.market_odds == null || pred.market_odds < 1.01) return { ok: false, reason: 'Odds unavailable or invalid (<1.01)' }
  if (!pred.sport) return { ok: false, reason: 'Missing sport — cannot determine market semantics' }
  // sport-aware market validation
  if (pred.sport === 'basketball' && pred.market === 'MONEYLINE' && pred.selection === 'DRAW') {
    return { ok: false, reason: 'Basketball MONEYLINE has no DRAW (sport-aware market)' }
  }
  if (isStale(pred)) return { ok: false, reason: `Prediction stale (> ${MAX_STALE_HOURS}h) — market snapshot expired. Refresh or rescan.` }
  return { ok: true }
}

const SlipCartContext = createContext<SlipCartContextType | null>(null)

export function SlipCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SlipCartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as SlipCartItem[]
    } catch {}
    return []
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items])

  const has = useCallback((pid: string) => items.some(i => i.predictionId === pid), [items])

  const validateItem = useCallback((pred: any) => {
    const ids = new Set(items.map(i => i.predictionId))
    return validatePredictionForSlip(pred, ids)
  }, [items])

  const add = useCallback(async (pred: any) => {
    const pid = pred.id || pred.fixture_id
    if (!pid) return { ok: false, reason: 'Prediction has no ID' }
    const v = validatePredictionForSlip(pred, new Set(items.map(i => i.predictionId)))
    if (!v.ok) return v
    // Optimistic local update
    setItems(prev => {
      if (prev.some(i => i.predictionId === pid)) return prev
      const next = [...prev, { predictionId: pid, fixtureId: pred.fixture_id || pid, sport: pred.sport, addedAt: Date.now() }]
      try {
        authFetch('/api/telemetry/slip', {
          method: 'POST',
          body: JSON.stringify({ event: 'PREDICTION_SELECTED', prediction_id: pid, fixture_id: pred.fixture_id, sport: pred.sport })
        }).catch(() => {})
      } catch {}
      return next
    })
    // Canonical backend draft (for validation + persistence across reload)
    try {
      const r = await authFetch(`/api/slips/current/add?prediction_id=${encodeURIComponent(pid)}`, { method: 'POST' })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        const reason = j.detail || j.reason || 'Backend validation failed'
        // rollback optimistic if backend rejected
        setItems(prev => prev.filter(i => i.predictionId !== pid))
        return { ok: false, reason }
      }
    } catch {}
    return { ok: true }
  }, [items])

  const remove = useCallback((pid: string) => {
    setItems(prev => prev.filter(i => i.predictionId !== pid))
    try {
      authFetch('/api/telemetry/slip', {
        method: 'POST',
        body: JSON.stringify({ event: 'PREDICTION_REMOVED', prediction_id: pid })
      }).catch(() => {})
    } catch {}
    try { authFetch(`/api/slips/current/remove?prediction_id=${encodeURIComponent(pid)}`, { method: 'POST' }).catch(() => {}) } catch {}
  }, [])

  const clear = useCallback(() => {
    setItems([])
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    try {
      authFetch('/api/telemetry/slip', {
        method: 'POST',
        body: JSON.stringify({ event: 'SLIP_CLEARED' })
      }).catch(() => {})
    } catch {}
    try { authFetch('/api/slips/current/clear', { method: 'POST' }).catch(() => {}) } catch {}
  }, [])

  return (
    <SlipCartContext.Provider value={{ items, count: items.length, has, add, remove, clear, validateItem }}>
      {children}
    </SlipCartContext.Provider>
  )
}

export function useSlipCart(): SlipCartContextType {
  const ctx = useContext(SlipCartContext)
  if (!ctx) throw new Error('useSlipCart must be used within SlipCartProvider')
  return ctx
}

// Re-export validation for backend parity checks
export { validatePredictionForSlip, isStale }
