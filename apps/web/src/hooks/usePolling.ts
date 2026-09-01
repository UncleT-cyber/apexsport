import { useEffect, useRef, useState } from 'react'

export function usePolling<T>(fn: () => Promise<T>, ms: number) {
  const [data, setData] = useState<T | null>(null)
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    let alive = true
    const tick = async () => { try { const d = await ref.current(); if (alive) setData(d) } catch {} }
    tick()
    const id = setInterval(tick, ms)
    return () => { alive = false; clearInterval(id) }
  }, [ms])
  return { data }
}
