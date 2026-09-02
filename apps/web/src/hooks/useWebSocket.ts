import { useEffect, useRef, useState } from 'react'

export function useWebSocket(onEvent?: (e: any) => void) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  useEffect(() => {
    let cancelled = false
    let connectTimeout: number | null = null

    const connect = () => {
      if (cancelled) return
      const token = localStorage.getItem('apex_token')
      const apiBase = (import.meta as any).env?.VITE_API_URL || ''
      let wsHost = location.host
      if (apiBase) {
        try { wsHost = new URL(apiBase).host } catch {}
      }
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const base = `${proto}//${wsHost}/ws`
      const url = token ? `${base}?token=${encodeURIComponent(token)}` : base
      try {
        const ws = new WebSocket(url)
        // Suppress browser's noisy error logging for expected StrictMode unmount
        const origOnError = ws.onerror
        ws.onerror = () => {
          // Swallow - onclose will handle reconnect, don't call ws.close() here if CONNECTING
          if (ws.readyState === WebSocket.CONNECTING) return
        }
        wsRef.current = ws
        ws.onopen = () => { if (!cancelled) setConnected(true) }
        ws.onclose = () => {
          setConnected(false)
          if (!cancelled) reconnectRef.current = window.setTimeout(connect, 3000)
        }
        ws.onmessage = (msg) => { try { const d = JSON.parse(msg.data); onEvent?.(d) } catch {} }
      } catch {
        if (!cancelled) reconnectRef.current = window.setTimeout(connect, 3000)
      }
    }

    connectTimeout = window.setTimeout(connect, 120)
    return () => {
      cancelled = true
      if (connectTimeout) clearTimeout(connectTimeout)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      const ws = wsRef.current
      if (ws) {
        // Prevent "closed before established" log: detach handlers and only close if OPEN
        try {
          ws.onopen = null as any
          ws.onclose = null as any
          ws.onerror = null as any
          ws.onmessage = null as any
          if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'unmount')
          else if (ws.readyState === WebSocket.CONNECTING) {
            // Let it die quietly - add one-time open->close to avoid log
            ws.addEventListener('open', () => { try { ws.close() } catch {} }, { once: true } as any)
          }
        } catch {}
      }
      wsRef.current = null
      setConnected(false)
    }
  }, [])
  return { connected }
}
