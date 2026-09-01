import { useState, useEffect, useRef } from 'react'
import { authFetch } from '../services/auth'
import clsx from 'clsx'

type Msg = { role: 'user' | 'assistant'; content: string; tool_calls?: any[]; provenance?: any }

const STORAGE_KEY = 'apex_copilot_conversation'
const CONTEXT_KEY = 'apex_copilot_context'

function loadMessages(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [{ role: 'assistant', content: 'Hi — I’m APEXSPORT Copilot. Ask me about predictions, fixtures, value, risk, calibration, slips, backtests, or engine status. I’ll use live Apex data (no hallucinations). Try “Why does Apex like this?” while viewing a prediction.' }]
}

function saveMessages(msgs: Msg[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-30))) } catch {}
}

export function Copilot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>(() => loadMessages())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<any>(null)
  const [status, setStatus] = useState<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pulseRef = useRef(0)

  // Load status (global LLM config)
  useEffect(() => {
    authFetch('/api/copilot/status').then(r=>r.json()).then(setStatus).catch(()=>{})
  }, [open])

  // Persist conversation
  useEffect(() => { saveMessages(messages) }, [messages])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  // Listen for context updates from pages (Prediction → Copilot, etc.)
  useEffect(() => {
    const h = (e: any) => {
      const ctx = e.detail
      setContext(ctx)
      try { localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx)) } catch {}
    }
    document.addEventListener('apex:copilot-context' as any, h)
    // restore from storage
    try {
      const raw = localStorage.getItem(CONTEXT_KEY)
      if (raw) setContext(JSON.parse(raw))
    } catch {}
    return () => document.removeEventListener('apex:copilot-context' as any, h)
  }, [])

  // Also listen for cross-link events to auto-open with context
  useEffect(() => {
    const h = (e: any) => {
      const detail = e.detail
      if (detail && typeof detail === 'object' && (detail.prediction_id || detail.slip_id)) {
        setContext(detail)
        setOpen(true)
      }
    }
    document.addEventListener('apex:open-copilot' as any, h)
    return () => document.removeEventListener('apex:open-copilot' as any, h)
  }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const nextMsgs: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMsgs)
    setInput('')
    setLoading(true)
    try {
      const r = await authFetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMsgs.map(m => ({ role: m.role, content: m.content })), context })
      })
      const j = await r.json()
      const answer = j.answer || j.error || 'No response'
      const assistantMsg: Msg = {
        role: 'assistant',
        content: answer,
        tool_calls: j.tool_calls || [],
        provenance: j.provenance || { model_used: j.model_used, provider_used: j.provider_used, prompt_version: j.prompt_version }
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Copilot error: ${String(e).slice(0,200)}` }])
    } finally {
      setLoading(false)
    }
  }

  // Animated glowing icon styles
  return (
    <>
      {/* Collapsed — animated glowing icon bottom-right, inset from edge */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 border-2 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center hover:scale-105 transition-transform group"
          title="APEXSPORT Copilot — alive / active / intelligent"
          aria-label="Open APEXSPORT Copilot"
        >
          <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping group-hover:animate-none" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/10 to-blue-500/10 blur-md animate-pulse" style={{ animationDuration: '2s' }} />
          <span className="relative text-white text-lg font-bold tracking-widest">◆</span>
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
        </button>
      )}

      {/* Expanded — bottom-right chat panel, inset from edge */}
      {open && (
        <div className="fixed bottom-8 right-8 z-40 w-[380px] max-w-[90vw] h-[460px] max-h-[70vh] bg-[var(--bg-secondary)] border border-emerald-800/30 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.2)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-[var(--border)] bg-gradient-to-r from-emerald-950/30 to-blue-950/20 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 border border-emerald-400/50 flex items-center justify-center animate-pulse">
                <span className="text-white text-[10px]">◆</span>
              </div>
              <div>
                <div className="text-xs font-bold tracking-wider text-white">APEXSPORT COPILOT</div>
                <div className="text-[9px] text-gray-500">{status?.is_configured ? `${status.provider_used}:${String(status.model_used||'').slice(0,22)} • ${status.prompt_version}` : 'NO MODEL — set in Settings → AI & Models'} • v1 tools</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setMessages(loadMessages().slice(0,1)); localStorage.removeItem(STORAGE_KEY) }} className="px-1.5 py-1 rounded text-[10px] text-gray-500 hover:text-white border border-transparent hover:border-[var(--border)]">Clear</button>
              <button onClick={() => setOpen(false)} className="w-6 h-6 rounded hover:bg-[var(--bg-tertiary)] flex items-center justify-center text-gray-500 hover:text-white">−</button>
            </div>
          </div>

          {/* Context banner */}
          {context && (
            <div className="px-3 py-1.5 bg-emerald-900/10 border-b border-emerald-800/20 text-[10px] flex items-center justify-between">
              <span className="text-emerald-400 font-mono">Context: {context.type || 'auto'} {context.prediction_id ? `• ${String(context.prediction_id).slice(0,12)}` : context.slip_id ? `• slip ${String(context.slip_id).slice(0,8)}` : ''}</span>
              <button onClick={() => setContext(null)} className="text-gray-500 hover:text-white">×</button>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={clsx('max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed', m.role === 'user' ? 'ml-auto bg-emerald-600 text-white' : 'mr-auto bg-[var(--bg-primary)] border border-[var(--border)] text-gray-200')}>
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                {m.provenance && m.role === 'assistant' && (
                  <div className="mt-1 pt-1 border-t border-[var(--border)] text-[9px] text-gray-500 font-mono">via {m.provenance.provider_used || m.provenance.provider || ''}:{String(m.provenance.model_used || m.provenance.model || '').slice(0,20)} • {m.provenance.prompt_version || ''}</div>
                )}
                {m.tool_calls && m.tool_calls.length > 0 && (
                  <div className="mt-1 text-[9px] text-gray-600 font-mono">tools: {m.tool_calls.map((t:any)=>t.name).join(', ')}</div>
                )}
              </div>
            ))}
            {loading && <div className="mr-auto bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-gray-500">Thinking…</div>}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-[var(--border)] flex gap-1.5 flex-shrink-0">
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send() } }}
              placeholder={context?.prediction_id ? 'Why does Apex like this?' : 'Ask about predictions, value, slips…'}
              className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600/50"
            />
            <button onClick={send} disabled={loading || !input.trim()} className={clsx('px-3 py-1.5 rounded text-xs font-bold', loading || !input.trim() ? 'bg-[#21262d] text-gray-600' : 'bg-emerald-600 hover:bg-emerald-500 text-white')}>Send</button>
          </div>
          <div className="px-2 pb-1 text-[9px] text-gray-600 text-center">Copilot uses live Apex data • Never invents predictions • Provider adapters never influence intelligence</div>
        </div>
      )}
    </>
  )
}