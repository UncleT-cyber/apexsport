import React, { createContext, useContext, useEffect, useState } from 'react'

type User = { id: string; email: string; role: string; status: string; mfa_enabled: boolean }

type AuthContextType = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ mfa_required?: boolean; temp_token?: string; error?: string }>
  verifyMfa: (tempToken: string, code: string) => Promise<{ error?: string }>
  logout: () => void
  refreshMe: () => Promise<void>
  isAdmin: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function getApiBase(): string {
  // Use env var for production (Render), fallback to Vite proxy /api
  const envBase = (import.meta as any).env?.VITE_API_URL
  if (envBase) return envBase.replace(/\/$/, '')
  return ''
}

export function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('apex_token')
  const headers: Record<string, string> = { ...(init.headers as any) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  // Ensure JSON
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const base = getApiBase()
  let url = typeof input === 'string' ? input : (input as Request).url
  // If base is set and url starts with /api or /health, prefix
  if (base && typeof input === 'string' && input.startsWith('/')) {
    url = `${base}${input}`
  }
  return fetch(url, { ...init, headers })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('apex_token'))
  const [loading, setLoading] = useState(true)

  const refreshMe = async () => {
    const t = localStorage.getItem('apex_token')
    if (!t) { setUser(null); setLoading(false); return }
    try {
      const r = await authFetch('/api/auth/me')
      if (r.ok) {
        const u = await r.json()
        setUser(u)
        setToken(t)
      } else if (r.status === 401 || r.status === 403) {
        localStorage.removeItem('apex_token')
        setUser(null)
        setToken(null)
      }
    } catch {
      // Network error / API sleeping — keep token, user stays "logged in"
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refreshMe() }, [])

  const login = async (email: string, password: string) => {
    const r = await fetch(`${getApiBase()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return { error: j.detail || j.message || 'Login failed' }
    if (j.mfa_required) {
      return { mfa_required: true, temp_token: j.temp_token }
    }
    if (j.access_token) {
      localStorage.setItem('apex_token', j.access_token)
      setToken(j.access_token)
      setUser(j.user)
      return {}
    }
    return { error: 'Unexpected response' }
  }

  const verifyMfa = async (tempToken: string, code: string) => {
    const r = await fetch(`${getApiBase()}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_token: tempToken, code })
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return { error: j.detail || 'Invalid code' }
    if (j.access_token) {
      localStorage.setItem('apex_token', j.access_token)
      setToken(j.access_token)
      setUser(j.user)
      return {}
    }
    return { error: 'No token' }
  }

  const logout = () => {
    localStorage.removeItem('apex_token')
    setUser(null)
    setToken(null)
    // Also call backend logout (best effort)
    authFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, verifyMfa, logout, refreshMe, isAdmin: user?.role === 'ADMIN', isAuthenticated: !!user && !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be within AuthProvider')
  return ctx
}
