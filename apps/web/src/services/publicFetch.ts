/**
 * Public API fetch — prefixes VITE_API_URL in production (Render),
 * uses bare path in dev (Vite proxy).
 * For unauthenticated endpoints: landing page, auth, fixtures, live, news, health.
 */
function getApiBase(): string {
  const envBase = (import.meta as any).env?.VITE_API_URL
  if (envBase) return envBase.replace(/\/$/, '')
  return ''
}

export function publicFetch(input: string, init?: RequestInit): Promise<Response> {
  const base = getApiBase()
  const url = base && input.startsWith('/') ? `${base}${input}` : input
  return fetch(url, init)
}
