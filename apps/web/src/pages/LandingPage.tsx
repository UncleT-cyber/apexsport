import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { publicFetch } from '../services/publicFetch'

type Fixture = { id: string; label: string; home: string; away: string; competition: string; kickoff_at: string; status: string; sport: string }
type NewsArticle = { id: string; sport: string; league?: string; fixture_id?: string; title: string; summary?: string; image_url?: string; published_at: string; source: string; source_url?: string; type?: string }

export function LandingPage() {
  const nav = useNavigate()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [live, setLive] = useState<Fixture[]>([])
  const [news, setNews] = useState<NewsArticle[]>([])
  const [newsFilter, setNewsFilter] = useState<'ALL' | 'FOOTBALL' | 'BASKETBALL'>('ALL')
  const [newsError, setNewsError] = useState<string | null>(null)

  // Fetch live sports via existing backend abstraction (provider → adapter → canonical → API)
  // Landing uses public endpoints — gracefully handles provider unavailable / no live fixtures
  useEffect(() => {
    const load = async () => {
      try {
        const r = await publicFetch('/api/fixtures?sport=football')
        if (r.ok) {
          const j = await r.json()
          setFixtures((j.fixtures || []).slice(0, 6))
        }
      } catch {}
      try {
        const r = await publicFetch('/api/live?sport=football')
        if (r.ok) {
          const j = await r.json()
          setLive((j.live || j.fixtures || []).slice(0, 4))
        }
      } catch {}
      // News via canonical provider abstraction
      try {
        const r = await publicFetch('/api/news?sport=football')
        if (r.ok) {
          const j = await r.json()
          const list: NewsArticle[] = (j.news || []).map((n: any) => ({
            id: n.id,
            sport: n.sport || 'football',
            league: n.league,
            fixture_id: n.fixture_id,
            title: n.title,
            summary: n.body || n.summary,
            image_url: n.image_url,
            published_at: n.published_at,
            source: n.source || 'Sportmonks',
            source_url: n.url || n.source_url,
            type: n.type || 'general',
          }))
          setNews(list)
          if (!list.length) setNewsError(null)
        } else {
          setNewsError(null)
        }
      } catch {
        setNewsError(null)
      }
    }
    load()
  }, [])

  const filteredNews = news.filter(n => newsFilter === 'ALL' ? true : n.sport?.toUpperCase() === newsFilter)

  return (
    <div className="h-screen overflow-y-auto bg-[#070a0f] text-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Nav */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b border-[#1c2128]/80 bg-[#070a0f]/80 backdrop-blur supports-[backdrop-filter]:bg-[#070a0f]/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center"><span className="text-sm">🏆</span></div>
          <div>
            <div className="font-bold tracking-[0.18em] text-sm">APEXSPORT</div>
            <div className="text-[9px] tracking-[0.2em] text-gray-500 -mt-0.5">AI SPORTS INTELLIGENCE</div>
          </div>
          <span className="hidden md:inline text-[10px] px-2 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-gray-500 ml-3">INTELLIGENCE • NOT A SPORTSBOOK</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/login')} className="px-4 py-1.5 rounded border border-[#30363d] text-xs text-gray-300 hover:text-white hover:bg-[#161b22]">Sign in</button>
          <button onClick={() => nav('/request-access')} className="hidden sm:inline-flex px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">Request access</button>
        </div>
      </header>

      {/* HERO — cinematic */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&w=1920&q=80"
            alt="Football stadium at night"
            className="w-full h-full object-cover"
            loading="eager"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#070a0f]/40 via-[#070a0f]/65 to-[#070a0f]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070a0f]/50 via-transparent to-emerald-950/20" />
          {/* data overlay grid */}
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `linear-gradient(rgba(63,185,80,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(63,185,80,0.3) 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
        </div>

        <div className="relative px-6 py-16 sm:py-24 max-w-6xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d1117]/80 border border-[#21262d] backdrop-blur text-[10px] tracking-widest text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            APEXSPORT • SPORTS INTELLIGENCE
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[0.9]">
            <span className="text-white">SEE THE GAME</span><br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">BEFORE THE MARKET DOES.</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-gray-300 max-w-2xl leading-relaxed">
            AI-powered sports intelligence built from <span className="text-white">live data</span>, <span className="text-white">specialist analysis</span>, <span className="text-white">statistical models</span>, <span className="text-white">calibration</span>, <span className="text-white">value</span> and <span className="text-white">risk</span>.
            <span className="text-gray-500"> Football is the first domain, not the limit.</span>
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <button onClick={() => nav('/login')} className="px-7 py-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold tracking-wider shadow-[0_0_24px_rgba(16,185,129,0.35)]">ENTER APEXSPORT →</button>
            <button onClick={() => document.getElementById('engine')?.scrollIntoView({ behavior: 'smooth' })} className="px-5 py-3 rounded border border-[#30363d] bg-[#0d1117]/70 backdrop-blur text-sm text-gray-300 hover:text-white hover:bg-[#161b22]">EXPLORE INTELLIGENCE</button>
          </div>

          <div className="flex flex-wrap gap-2 mt-8 text-[10px] tracking-widest text-gray-500">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d1117]/80 border border-[#21262d] backdrop-blur"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE MARKETS</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d1117]/80 border border-[#21262d] backdrop-blur">MULTI-PROVIDER DATA</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d1117]/80 border border-[#21262d] backdrop-blur">6 AI SPECIALISTS</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d1117]/80 border border-[#21262d] backdrop-blur">DETERMINISTIC MATH</span>
          </div>
        </div>
      </section>

      {/* LIVE SPORTS — real backend */}
      <section className="px-6 py-10 max-w-6xl mx-auto w-full">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-bold tracking-[0.18em] text-white">LIVE — FROM THE PITCH</h2>
          <span className="text-[11px] text-gray-600">{fixtures.length} fixtures • {live.length} live • via Provider → Adapter → Canonical</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          {(live.length ? live : fixtures).slice(0, 6).map((f) => (
            <div key={f.id} className="rounded-xl overflow-hidden border border-[#21262d] bg-[#0d1117] group hover:border-[#30363d] transition-colors">
              <div className="h-1 bg-gradient-to-r from-emerald-600 to-cyan-500 opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-gray-500">{f.competition || f.sport}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${f.status === 'live' ? 'bg-red-900/20 border-red-800/30 text-red-400 animate-pulse' : 'bg-[#161b22] border-[#21262d] text-gray-500'}`}>{(f.status || 'scheduled').toUpperCase()}</span>
                </div>
                <div className="mt-2 text-sm font-bold text-white">{f.label}</div>
                <div className="text-[11px] text-gray-500 mt-1">{f.kickoff_at ? new Date(f.kickoff_at).toLocaleString() : '—'} • {f.sport}</div>
              </div>
            </div>
          ))}
          {!fixtures.length && !live.length && (
            <div className="md:col-span-3 rounded-xl border border-dashed border-[#21262d] bg-[#0d1117]/50 p-8 text-center">
              <div className="text-xs text-gray-500">No live fixtures right now — provider returned no results.</div>
              <div className="text-[11px] text-gray-600 mt-1">APEXSPORT shows elegant fallback, not broken cards. Data via backend provider abstraction.</div>
            </div>
          )}
        </div>
      </section>

      {/* NEWS — LATEST FROM THE WORLD OF SPORT */}
      <section className="px-6 py-10 max-w-6xl mx-auto w-full border-t border-[#1c2128]">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-[0.18em] text-white">LATEST FROM THE WORLD OF SPORT</h2>
          <div className="flex gap-1.5">
            {(['ALL', 'FOOTBALL', 'BASKETBALL'] as const).map((s) => (
              <button key={s} onClick={() => setNewsFilter(s)} className={`px-3 py-1 rounded text-xs font-bold border ${newsFilter === s ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-[#0d1117] border-[#21262d] text-gray-500 hover:text-white'}`}>{s}</button>
            ))}
          </div>
        </div>
        {newsError && <div className="mt-3 text-xs text-red-400 bg-red-900/10 border border-red-800/30 rounded p-2">{newsError}</div>}
        {!filteredNews.length ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#21262d] bg-[#0d1117]/50 p-8 text-center">
            <div className="text-xs text-gray-500">No news available — provider unavailable or no articles in window.</div>
            <div className="text-[11px] text-gray-600 mt-1">APEXSPORT uses Sportmonks News API via <span className="font-mono text-gray-400">NewsProvider → NewsAdapter → CanonicalNewsArticle</span>. Gracefully handles empty result.</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            {/* Hero story */}
            {filteredNews[0] && (
              <a href={filteredNews[0].source_url || '#'} target={filteredNews[0].source_url ? '_blank' : undefined} rel="noreferrer" className="md:col-span-2 rounded-xl overflow-hidden border border-[#21262d] bg-[#0d1117] group hover:border-[#30363d] transition-colors">
                <div className="h-48 bg-[#161b22] relative overflow-hidden">
                  <img src={filteredNews[0].image_url || 'https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&w=800&q=80'} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent" />
                  <span className="absolute top-3 left-3 text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold">{filteredNews[0].sport?.toUpperCase()}</span>
                </div>
                <div className="p-4">
                  <div className="text-sm font-bold text-white line-clamp-2">{filteredNews[0].title}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{filteredNews[0].summary || '—'}</div>
                  <div className="text-[11px] text-gray-600 mt-2">{filteredNews[0].source} • {filteredNews[0].published_at ? new Date(filteredNews[0].published_at).toLocaleString() : ''}</div>
                </div>
              </a>
            )}
            <div className="space-y-3">
              {filteredNews.slice(1, 4).map((n) => (
                <a key={n.id} href={n.source_url || '#'} target={n.source_url ? '_blank' : undefined} rel="noreferrer" className="flex gap-3 p-3 rounded-xl border border-[#21262d] bg-[#0d1117] hover:border-[#30363d] transition-colors">
                  <img src={n.image_url || 'https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&w=200&q=60'} alt="" className="w-16 h-16 rounded object-cover bg-[#161b22] flex-shrink-0" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white line-clamp-2 leading-tight">{n.title}</div>
                    <div className="text-[11px] text-gray-600 mt-1">{n.source} • {n.sport}</div>
                  </div>
                </a>
              ))}
              {filteredNews.length === 1 && <div className="text-xs text-gray-600 p-4 text-center border border-dashed border-[#21262d] rounded-xl">More stories will appear as provider ingests.</div>}
            </div>
          </div>
        )}
        <div className="text-[10px] text-gray-600 mt-3">Headlines via canonical provider — click through to legitimate source (licensing respected, excerpts only).</div>
      </section>

      {/* APEX ENGINE */}
      <section id="engine" className="px-6 py-12 max-w-6xl mx-auto w-full border-t border-[#1c2128]">
        <h2 className="text-xs font-bold tracking-[0.18em] text-white text-center">THE APEX ENGINE</h2>
        <p className="text-xs text-gray-500 text-center mt-1">Explainable pipeline — product, not telemetry.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-mono">
          {['DATA', 'FEATURES', 'SPECIALIST AI', 'ENSEMBLE', 'CALIBRATION', 'VALUE', 'RISK', 'PREDICTION'].map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`px-2.5 py-1 rounded border ${s === 'PREDICTION' ? 'bg-emerald-600 border-emerald-500 text-white' : s === 'SPECIALIST AI' ? 'bg-[#161b22] border-emerald-800/30 text-emerald-400' : 'bg-[#0d1117] border-[#21262d] text-gray-500'}`}>{s}</span>
              {i < 7 && <span className="text-emerald-600 animate-pulse">→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* PREDICTION EXAMPLE */}
      <section className="px-6 pb-10 max-w-6xl mx-auto w-full">
        <div className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden max-w-md mx-auto">
          <div className="px-3 py-2 border-b border-[#21262d] flex items-center justify-between">
            <span className="text-[10px] tracking-widest text-gray-500">PREDICTION EXAMPLE</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/20 border border-yellow-800/30 text-yellow-400">ILLUSTRATIVE EXAMPLE</span>
          </div>
          <div className="p-4">
            <div className="text-xs text-gray-500">Arsenal vs Chelsea • Premier League • MATCH_RESULT</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-bold text-white">HOME</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/20 border border-emerald-800/30 text-emerald-400">VALUE</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
              <div><div className="text-[10px] text-gray-500">Market prob</div><div className="text-white font-mono">48.1%</div><div className="text-[10px] text-gray-600">2.08</div></div>
              <div><div className="text-[10px] text-gray-500">Apex prob</div><div className="text-emerald-400 font-mono">54.3%</div><div className="text-[10px] text-gray-600">calibrated</div></div>
              <div><div className="text-[10px] text-gray-500">Edge / Risk</div><div className="text-emerald-400 font-mono">+6.2% / LOW</div><div className="text-[10px] text-gray-600">conf 62%</div></div>
            </div>
            <div className="text-[11px] text-gray-500 mt-3">Key factors: home attacking form, opponent defensive availability, H2H matchup.</div>
            <div className="text-[10px] text-gray-600 mt-1">Deterministic math: `edge = calibrated − implied`, `EV = calibrated×odds −1`. Not LLM arithmetic.</div>
          </div>
        </div>
      </section>

      {/* COPILOT */}
      <section className="px-6 py-10 max-w-6xl mx-auto w-full border-t border-[#1c2128]">
        <div className="rounded-xl border border-emerald-800/20 bg-gradient-to-br from-emerald-950/10 via-[#0d1117] to-blue-950/10 p-6 flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1">
            <h2 className="text-sm font-bold tracking-widest text-white">APEX COPILOT</h2>
            <p className="text-xs text-gray-400 mt-1">“Ask Apex about the game.”</p>
            <p className="text-xs text-gray-500 mt-2 max-w-md">Conversational interface over the same canonical engine — predictions, value, risk, calibration, slips. Demo conversation, not live engine telemetry.</p>
          </div>
          <div className="w-full md:w-80 rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden">
            <div className="px-3 py-2 border-b border-[#21262d] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center text-[10px]">◆</span>
              <span className="text-xs font-bold text-white">APEX COPILOT</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="p-3 space-y-2 text-xs">
              <div className="max-w-[80%] rounded-lg bg-[#161b22] border border-[#21262d] px-2.5 py-1.5 text-gray-300">Why does APEX like Arsenal?</div>
              <div className="max-w-[80%] ml-auto rounded-lg bg-emerald-600 text-white px-2.5 py-1.5">Arsenal HOME 54.3% calibrated vs 48.1% market — edge +6.2% • xG home form + opponent DF availability. (Engine: openrouter:cohere, prompts football/form/v1)</div>
              <div className="text-[10px] text-gray-600 text-center">Marketing demo — live Copilot uses read-only domain tools.</div>
            </div>
          </div>
        </div>
      </section>

      {/* SPORTS */}
      <section className="px-6 pb-10 max-w-6xl mx-auto w-full border-t border-[#1c2128] pt-8">
        <h2 className="text-xs font-bold tracking-[0.18em] text-white text-center">SPORTS</h2>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl overflow-hidden border border-[#21262d] bg-[#0d1117]">
            <img src="https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&w=600&q=80" alt="Football" className="w-full h-32 object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            <div className="p-3">
              <div className="text-xs font-bold text-white">FOOTBALL</div>
              <div className="text-[11px] text-emerald-400 mt-1">● Live • Full pipeline</div>
              <div className="text-[11px] text-gray-600 mt-1">xG, team strength, availability, matchup, market intelligence.</div>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden border border-[#21262d] bg-[#0d1117]">
            <img src="https://images.pexels.com/photos/175700/pexels-photo-175700.jpeg?auto=compress&w=600&q=80" alt="Basketball" className="w-full h-32 object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            <div className="p-3">
              <div className="text-xs font-bold text-white">BASKETBALL</div>
              <div className="text-[11px] text-emerald-400 mt-1">● Live • Pace-aware specialists</div>
              <div className="text-[11px] text-gray-600 mt-1">Pace, offensive/defensive rating, rebound, fatigue.</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 text-center mt-3">Football is the first domain, not the limit. <span className="text-gray-500">Tennis • Cricket • Motorsport</span> — architecture ready, not yet operational.</p>
      </section>

      {/* FINAL CTA */}
      <section className="px-6 py-12 text-center border-t border-[#1c2128] bg-gradient-to-b from-transparent to-emerald-950/10">
        <h2 className="text-lg font-bold tracking-tight text-white">SPORTS MOVE FAST.<br />YOUR INTELLIGENCE SHOULD TOO.</h2>
        <button onClick={() => nav('/login')} className="mt-4 px-8 py-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold tracking-wider shadow-[0_0_24px_rgba(16,185,129,0.3)]">ENTER APEXSPORT →</button>
        <div className="text-[11px] text-gray-600 mt-2">Invite-only • Controlled testing</div>
      </section>

      <footer className="px-6 py-3 border-t border-[#1c2128] text-[10px] text-gray-600 flex justify-between">
        <span>© 2026 APEXSPORT</span>
        <span>Images: Pexels/Unsplash — see landing-images.md</span>
      </footer>
    </div>
  )
}
