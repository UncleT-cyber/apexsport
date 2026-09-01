import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../services/auth'
import clsx from 'clsx'

const LLM_PROVIDERS = [
  { id: 'openai', label: 'OpenAI', base_url: 'https://api.openai.com/v1' },
  { id: 'anthropic', label: 'Anthropic', base_url: 'https://api.anthropic.com' },
  { id: 'openrouter', label: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1' },
  { id: 'huggingface', label: 'HuggingFace Router', base_url: 'https://router.huggingface.co/v1' },
  { id: 'gemini', label: 'Google Gemini', base_url: 'https://generativelanguage.googleapis.com' },
  { id: 'groq', label: 'Groq', base_url: 'https://api.groq.com/openai/v1' },
]

interface ProviderConfig {
  api_key: string
  has_key: boolean
  selected_model: string
  base_url: string
}

interface AIState {
  providers: Record<string, ProviderConfig>
  agents: Record<string, boolean>
}

export function AISettings() {
  const [ai, setAi] = useState<AIState | null>(null)
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({})
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({})
  const [testResults, setTestResults] = useState<Record<string, { status: string; message: string }>>({})
  const [providerModels, setProviderModels] = useState<Record<string, any[]>>({})
  const [modelsLoading, setModelsLoading] = useState<Record<string, boolean>>({})
  const [modelsError, setModelsError] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await authFetch('/api/settings/ai')
      if (r.ok) {
        const data: AIState = await r.json()
        setAi(data)
        const models: Record<string, string> = {}
        const urls: Record<string, string> = {}
        for (const [k, v] of Object.entries(data.providers || {})) {
          if (v.selected_model) models[k] = v.selected_model
          if (v.base_url) urls[k] = v.base_url
        }
        setSelectedModels(models)
        setBaseUrls(urls)
      }
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const saveProvider = useCallback(async (provider: string) => {
    setSaving(true)
    setError('')
    try {
      const body: any = { providers: { [provider]: {} } }
      if (keys[provider]) body.providers[provider].api_key = keys[provider]
      if (baseUrls[provider] !== undefined) body.providers[provider].base_url = baseUrls[provider]
      if (selectedModels[provider]) body.providers[provider].selected_model = selectedModels[provider]
      const r = await authFetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Save failed')
      setKeys(prev => ({ ...prev, [provider]: '' }))
      await load()
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }, [keys, baseUrls, selectedModels, load])

  const saveAgents = useCallback(async () => {
    setSaving(true)
    try {
      await authFetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: ai?.agents }),
      })
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }, [ai?.agents])

  const testConnection = useCallback(async (provider: string) => {
    setTestResults(prev => ({ ...prev, [provider]: { status: 'testing', message: 'Testing connection...' } }))
    try {
      const r = await authFetch(`/api/settings/test/${provider}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await r.json()
      setTestResults(prev => ({ ...prev, [provider]: data }))
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [provider]: { status: 'error', message: e.message } }))
    }
  }, [])

  const fetchModels = useCallback(async (provider: string) => {
    setModelsLoading(prev => ({ ...prev, [provider]: true }))
    setModelsError(prev => ({ ...prev, [provider]: '' }))
    try {
      const r = await authFetch(`/api/settings/models/${provider}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || data.error || 'Failed to fetch models')
      if (data.error) throw new Error(data.error)
      setProviderModels(prev => ({ ...prev, [provider]: data.models || [] }))
    } catch (e: any) {
      setModelsError(prev => ({ ...prev, [provider]: e.message }))
    }
    setModelsLoading(prev => ({ ...prev, [provider]: false }))
  }, [])

  if (!ai) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div>
          <h2 className="text-sm font-bold tracking-wider text-white">AI & Models</h2>
          <p className="text-[10px] text-gray-500 mt-1">Configure LLM providers, models, and specialist agents — sports intelligence</p>
        </div>
        {error && <div className="text-xs text-red-400 p-2 bg-red-900/10 rounded">{error}</div>}
        <div className="text-xs text-gray-500 p-4">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-sm font-bold tracking-wider text-white">AI & Models</h2>
        <p className="text-[10px] text-gray-500 mt-1">Configure LLM providers (keys server-side only) and toggle specialist agents — football + basketball. Models are fetched live, never hardcoded.</p>
      </div>

      {error && <div className="text-xs text-red-400 p-2 bg-red-900/10 rounded">{error}</div>}

      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-4">
        <h3 className="text-xs font-bold tracking-wider text-gray-400">AI PROVIDERS — LIVE ENDPOINT TEST & DYNAMIC MODEL LIST</h3>
        <div className="space-y-3">
          {LLM_PROVIDERS.map((p) => {
            const cfg = ai.providers?.[p.id]
            const hasKey = cfg?.has_key || false
            const testR = testResults[p.id]
            const displayBase = baseUrls[p.id] ?? cfg?.base_url ?? p.base_url
            const models = providerModels[p.id] || []
            const loading = modelsLoading[p.id]
            const err = modelsError[p.id]
            return (
              <div key={p.id} className="p-3 bg-[var(--bg-primary)] rounded border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-2 h-2 rounded-full', hasKey ? 'bg-emerald-400' : 'bg-gray-600')} />
                    <span className="text-xs font-bold text-white">{p.label}</span>
                    {hasKey && cfg?.selected_model && (
                      <span className="text-[9px] text-gray-500 font-mono">{cfg.selected_model}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasKey && (
                      <>
                        <button onClick={() => testConnection(p.id)} className="px-2 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-[10px] text-gray-400 hover:text-white">
                          TEST
                        </button>
                        <button onClick={() => fetchModels(p.id)} disabled={loading} className="px-2 py-0.5 bg-purple-600/20 border border-purple-600/30 rounded text-[10px] text-purple-400 hover:bg-purple-600/30 disabled:opacity-50">
                          {loading ? 'FETCHING...' : `FETCH MODELS ${models.length ? `(${models.length})` : ''}`}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <label className="space-y-1 block">
                  <span className="text-gray-500 text-[10px]">API Key — test & connect for every listed provider</span>
                  <input type="password" value={keys[p.id] || ''} onChange={(e) => setKeys(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder={hasKey ? 'Enter new key to replace...' : 'Enter API key...'} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-white font-mono" />
                </label>

                <label className="space-y-1 block">
                  <span className="text-gray-500 text-[10px]">Base URL {p.id === 'huggingface' && <span className="text-gray-600">— use https://router.huggingface.co/v1 (router), not huggingface.co — will auto-fix https://router.huggingface.co/ → /v1</span>}</span>
                  <input type="text" value={displayBase} onChange={(e) => setBaseUrls(prev => ({ ...prev, [p.id]: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-white font-mono" />
                </label>

                {/* Dynamic model selector — no hardcoded names */}
                <div className="space-y-1">
                  <span className="text-gray-500 text-[10px]">Selected Model — dynamically fetched, shows FREE / PAID (ApexLoop style)</span>
                  {models.length > 0 ? (
                    <select value={selectedModels[p.id] || ''} onChange={(e) => setSelectedModels(prev => ({ ...prev, [p.id]: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-[10px] text-white font-mono">
                      <option value="">— Select model —</option>
                      {models.slice(0, 100).map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.id} {m.is_free ? '[FREE]' : '[PAID]'} {m.downloads ? `(${m.downloads} dl)` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={selectedModels[p.id] || ''} onChange={(e) => setSelectedModels(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder={hasKey ? 'Click FETCH MODELS to list, or type manually' : 'Save key then FETCH MODELS'} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-white font-mono" />
                  )}
                  {models.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {models.slice(0, 3).map((m: any) => (
                        <span key={m.id} className={clsx('text-[9px] px-1.5 py-0.5 rounded border', m.is_free ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-yellow-900/20 border-yellow-800/30 text-yellow-400')}>
                          {m.id.slice(0, 24)} {m.is_free ? 'FREE' : 'PAID'}
                        </span>
                      ))}
                      <span className="text-[9px] text-gray-600">+{models.length} total • green FREE, yellow PAID • fetched live</span>
                    </div>
                  )}
                  {err && <div className="text-[10px] text-red-400 bg-red-900/10 p-1.5 rounded">{err}</div>}
                </div>

                {(keys[p.id] || displayBase !== p.base_url || selectedModels[p.id] !== (cfg?.selected_model || '')) && (
                  <button onClick={() => saveProvider(p.id)} disabled={saving} className="px-3 py-1 bg-emerald-600/20 border border-emerald-600/30 rounded text-[10px] text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-50">
                    {saving ? 'SAVING...' : 'SAVE'}
                  </button>
                )}

                {testR && (
                  <div className={clsx('text-[10px] p-1.5 rounded', testR.status === 'ok' ? 'text-emerald-400 bg-emerald-900/10' : testR.status === 'testing' ? 'text-yellow-400' : 'text-red-400 bg-red-900/10')}>
                    {testR.message}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wider text-gray-400">SPECIALIST AGENTS — SPORTS INTELLIGENCE</h3>
          <button onClick={saveAgents} disabled={saving} className="px-2 py-0.5 bg-emerald-600/20 border border-emerald-600/30 rounded text-[10px] text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-50">
            {saving ? 'SAVING...' : 'SAVE AGENTS'}
          </button>
        </div>
        <p className="text-[10px] text-gray-500">Toggle which AI specialists participate — football 6 + basketball 6. All outputs are structured & validated. No hardcoded model names.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {[
            { key: 'form_sentinel', label: 'Form Sentinel', desc: 'Recent form, momentum, last 5' },
            { key: 'team_strength', label: 'Team Strength', desc: 'Elo, xG, home/away splits' },
            { key: 'player_availability', label: 'Player Availability', desc: 'Injuries, suspensions, lineup' },
            { key: 'matchup_analyst', label: 'Matchup Analyst', desc: 'Tactical H2H, formation clash' },
            { key: 'market_analyst', label: 'Market Analyst', desc: 'Odds movement, steam' },
            { key: 'strategy_ensemble', label: 'Strategy Ensemble', desc: 'Combine specialists → calibrated' },
            { key: 'pace_tempo', label: 'Pace & Tempo (BB)', desc: 'Possessions, tempo control' },
            { key: 'shooting_efficiency', label: 'Shooting Efficiency (BB)', desc: 'eFG%, TS% variance' },
            { key: 'rebound_rim', label: 'Rebound & Rim (BB)', desc: 'Rebound %, rim protection' },
            { key: 'availability_fatigue', label: 'Availability & Fatigue (BB)', desc: 'Back-to-back, load' },
            { key: 'matchup_scheme', label: 'Matchup Scheme (BB)', desc: 'Pace clash, assignments' },
            { key: 'market_efficiency', label: 'Market Efficiency (BB)', desc: 'Spread/total steam' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-center justify-between p-2 rounded hover:bg-[var(--bg-tertiary)] cursor-pointer">
              <div>
                <div className="text-xs text-white">{label}</div>
                <div className="text-[9px] text-gray-500">{desc}</div>
              </div>
              <div className={clsx('w-8 h-4 rounded-full transition-colors relative cursor-pointer', ai.agents?.[key] !== false ? 'bg-emerald-600' : 'bg-gray-600')} onClick={() => setAi({ ...ai, agents: { ...ai.agents, [key]: ai.agents?.[key] === false } })}>
                <div className={clsx('w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform', ai.agents?.[key] !== false ? 'translate-x-4' : 'translate-x-0.5')} />
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}