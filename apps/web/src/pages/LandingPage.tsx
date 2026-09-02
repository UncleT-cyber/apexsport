import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = performance.now()
        const animate = (now: number) => {
          const elapsed = now - start
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.floor(eased * end))
          if (progress < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

export function LandingPage() {
  const nav = useNavigate()

  return (
    <div className="h-screen overflow-y-auto bg-[#070a0f] text-white flex flex-col" style={{ height: '100dvh' }}>

      {/* ─── NAV ─────────────────────────────────────────────────────────── */}
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

      {/* ─── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&w=1920&q=80"
            alt="Football stadium at night"
            className="w-full h-full object-cover"
            loading="eager"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#070a0f]/30 via-[#070a0f]/60 to-[#070a0f]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070a0f]/40 via-transparent to-emerald-950/20" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(63,185,80,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(63,185,80,0.4) 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
        </div>

        <div className="relative px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 max-w-6xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d1117]/80 border border-[#21262d] backdrop-blur text-[10px] tracking-widest text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            APEXSPORT • SPORTS INTELLIGENCE ENGINE
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[0.88]">
            <span className="text-white">SEE THE GAME</span><br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">BEFORE THE MARKET DOES.</span>
          </h1>
          <p className="mt-5 text-sm sm:text-base text-gray-300 max-w-2xl leading-relaxed">
            Multi-sport AI intelligence engine. <span className="text-white">Live data</span>, <span className="text-white">specialist AI</span>, <span className="text-white">statistical models</span>, <span className="text-white">calibration</span>, <span className="text-white">value detection</span>, and <span className="text-white">risk management</span> — all explainable, all deterministic.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <button onClick={() => nav('/login')} className="px-8 py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold tracking-wider shadow-[0_0_32px_rgba(16,185,129,0.35)] transition-all hover:shadow-[0_0_48px_rgba(16,185,129,0.5)]">ENTER APEXSPORT →</button>
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="px-6 py-3.5 rounded-lg border border-[#30363d] bg-[#0d1117]/70 backdrop-blur text-sm text-gray-300 hover:text-white hover:bg-[#161b22] transition-colors">EXPLORE THE ENGINE</button>
          </div>

          <div className="flex flex-wrap gap-2 mt-8 text-[10px] tracking-widest text-gray-500">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d1117]/80 border border-[#21262d] backdrop-blur"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE MARKETS</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d1117]/80 border border-[#21262d] backdrop-blur">MULTI-PROVIDER DATA</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d1117]/80 border border-[#21262d] backdrop-blur">6 AI SPECIALISTS</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d1117]/80 border border-[#21262d] backdrop-blur">DETERMINISTIC MATH</span>
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ───────────────────────────────────────────────────── */}
      <section className="border-y border-[#1c2128] bg-[#0d1117]/50">
        <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono"><AnimatedCounter end={4} /></div>
            <div className="text-[10px] tracking-widest text-gray-500 mt-1">SPORTS</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono"><AnimatedCounter end={6} /></div>
            <div className="text-[10px] tracking-widest text-gray-500 mt-1">AI SPECIALISTS</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono"><AnimatedCounter end={8} suffix="s" /></div>
            <div className="text-[10px] tracking-widest text-gray-500 mt-1">PIPELINE STAGES</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">100<span className="text-base">%</span></div>
            <div className="text-[10px] tracking-widest text-gray-500 mt-1">EXPLAINABLE</div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-16 max-w-6xl mx-auto w-full">
        <div className="text-center">
          <span className="text-[10px] tracking-widest text-emerald-500">PIPELINE</span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white">THE APEX ENGINE</h2>
          <p className="text-xs text-gray-500 mt-1">Eight-stage explainable intelligence pipeline. Every step auditable.</p>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: '📡', title: 'MULTI-PROVIDER DATA', desc: 'Sportmonks, API-Football, Sportradar, The Odds API — fault-tolerant ingestion with automatic failover.' },
            { icon: '🧮', title: 'FEATURE ENGINEERING', desc: 'xG, team strength, form momentum, availability, H2H matchup, market odds — 50+ normalized signals.' },
            { icon: '🤖', title: 'SPECIALIST AI', desc: 'Sport-specific prompts per specialist — not one generic model. Football specialists know the sport.' },
            { icon: '📊', title: 'ENSEMBLE & CALIBRATION', desc: 'Isotonic regression, Platt scaling, conformal prediction — calibrated probabilities, not raw scores.' },
            { icon: '💎', title: 'VALUE DETECTION', desc: 'Edge = calibrated probability − implied probability. Expected value calculation. Kelly criterion sizing.' },
            { icon: '🛡️', title: 'RISK MANAGEMENT', desc: 'Correlation-aware parlays, portfolio diversification, max exposure, loss limits — structured risk.' },
            { icon: '🔍', title: 'PROVENANCE & AUDIT', desc: 'Every prediction carries: sport, specialist, model, prompt path, feature snapshot, pipeline version.' },
            { icon: '💬', title: 'COPILOT INTERFACE', desc: 'Natural language over the same engine. Ask questions, get explainable answers grounded in data.' },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-[#21262d] bg-[#0d1117] p-4 hover:border-emerald-800/30 transition-colors group">
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="text-xs font-bold tracking-widest text-white">{f.title}</div>
              <div className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PIPELINE VISUAL ─────────────────────────────────────────────── */}
      <section className="px-6 py-12 max-w-6xl mx-auto w-full border-t border-[#1c2128]">
        <div className="text-center mb-8">
          <span className="text-[10px] tracking-widest text-emerald-500">VISUALIZE</span>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white">PIPELINE FLOW</h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] font-mono">
          {['DATA', 'FEATURES', 'SPECIALIST AI', 'ENSEMBLE', 'CALIBRATION', 'VALUE', 'RISK', 'PREDICTION'].map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`px-3 py-1.5 rounded-lg border transition-all ${s === 'PREDICTION' ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)]' : s === 'SPECIALIST AI' ? 'bg-[#161b22] border-emerald-800/30 text-emerald-400' : 'bg-[#0d1117] border-[#21262d] text-gray-500'}`}>{s}</span>
              {i < 7 && <span className="text-emerald-600/50">→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* ─── PREDICTION OUTPUT ───────────────────────────────────────────── */}
      <section className="px-6 pb-12 max-w-6xl mx-auto w-full">
        <div className="text-center mb-6">
          <span className="text-[10px] tracking-widest text-emerald-500">INTELLIGENCE OUTPUT</span>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white">WHAT YOU GET</h2>
        </div>
        <div className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden max-w-lg mx-auto">
          <div className="px-4 py-2.5 border-b border-[#21262d] flex items-center justify-between">
            <span className="text-[10px] tracking-widest text-gray-500">PREDICTION STRUCTURE</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/20 border border-emerald-800/30 text-emerald-400">LIVE OUTPUT</span>
          </div>
          <div className="p-4">
            <div className="text-xs text-gray-500">Fixture • Competition • Market</div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-base font-bold text-white">Selection</span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 font-bold">VALUE</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div>
                <div className="text-[10px] text-gray-500">Market Implied</div>
                <div className="text-white font-mono font-bold">—</div>
                <div className="text-[10px] text-gray-600">from odds</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500">Apex Calibrated</div>
                <div className="text-emerald-400 font-mono font-bold">—</div>
                <div className="text-[10px] text-gray-600">isotonic reg.</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500">Edge / Risk</div>
                <div className="text-emerald-400 font-mono font-bold">—</div>
                <div className="text-[10px] text-gray-600">risk tier</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#21262d]">
              <div className="text-[11px] text-gray-400">Key factors, provenance, and deterministic formulas populated by the engine from live data.</div>
              <div className="text-[10px] text-gray-600 mt-1 font-mono">edge = calibrated − implied • EV = calibrated×odds − 1</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COPILOT ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-12 max-w-6xl mx-auto w-full border-t border-[#1c2128]">
        <div className="rounded-2xl border border-emerald-800/20 bg-gradient-to-br from-emerald-950/10 via-[#0d1117] to-blue-950/10 p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1">
            <span className="text-[10px] tracking-widest text-emerald-500">INTERFACE</span>
            <h2 className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-white">APEX COPILOT</h2>
            <p className="text-sm text-gray-400 mt-2 max-w-md">"Ask Apex about the game." Natural language over the same canonical engine — predictions, value, risk, calibration, slips.</p>
            <div className="flex flex-wrap gap-2 mt-4 text-[10px] tracking-widest text-gray-600">
              <span className="px-2 py-0.5 rounded bg-[#0d1117] border border-[#21262d]">READ-ONLY TOOLS</span>
              <span className="px-2 py-0.5 rounded bg-[#0d1117] border border-[#21262d]">DOMAIN GROUNDED</span>
              <span className="px-2 py-0.5 rounded bg-[#0d1117] border border-[#21262d]">EXPLAINABLE</span>
            </div>
          </div>
          <div className="w-full md:w-80 rounded-xl border border-[#21262d] bg-[#070a0f] overflow-hidden shadow-2xl">
            <div className="px-3 py-2 border-b border-[#21262d] flex items-center gap-2 bg-[#0d1117]">
              <span className="w-5 h-5 rounded-full bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center text-[10px]">◆</span>
              <span className="text-xs font-bold text-white">APEX COPILOT</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="p-3 space-y-2.5 text-xs">
              <div className="max-w-[85%] rounded-lg rounded-br-sm bg-[#161b22] border border-[#21262d] px-3 py-2 text-gray-300">Why does APEX like this pick?</div>
              <div className="max-w-[85%] ml-auto rounded-lg rounded-bl-sm bg-emerald-600 text-white px-3 py-2">
                <div className="font-bold">Calibrated probability from specialist ensemble</div>
                <div className="text-emerald-100 mt-1">vs market implied → edge detected</div>
                <div className="text-emerald-200/70 mt-1 text-[10px]">Feature factors • provenance • risk tier</div>
                <div className="text-emerald-300/50 mt-1 text-[10px] font-mono">Engine: specialist → ensemble → calibration</div>
              </div>
              <div className="text-[10px] text-gray-600 text-center pt-1">Live Copilot uses read-only domain tools.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SPORTS ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-12 max-w-6xl mx-auto w-full border-t border-[#1c2128]">
        <div className="text-center mb-8">
          <span className="text-[10px] tracking-widest text-emerald-500">COVERAGE</span>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white">MULTI-SPORT ENGINE</h2>
          <p className="text-xs text-gray-500 mt-1">Football first. Not the limit.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl overflow-hidden border border-[#21262d] bg-[#0d1117] group hover:border-emerald-800/30 transition-colors">
            <div className="relative h-36 overflow-hidden">
              <img src="https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&w=600&q=80" alt="Football" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/20 to-transparent" />
              <span className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white font-bold tracking-widest">LIVE</span>
            </div>
            <div className="p-4">
              <div className="text-sm font-bold text-white tracking-wide">FOOTBALL</div>
              <div className="text-[11px] text-gray-500 mt-1">xG • team strength • form momentum • availability • H2H • market intelligence</div>
              <div className="flex flex-wrap gap-1.5 mt-3 text-[10px]">
                <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-gray-500">Premier League</span>
                <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-gray-500">La Liga</span>
                <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-gray-500">Champions League</span>
                <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-gray-500">+150</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden border border-[#21262d] bg-[#0d1117] group hover:border-emerald-800/30 transition-colors">
            <div className="relative h-36 overflow-hidden">
              <img src="https://images.pexels.com/photos/175700/pexels-photo-175700.jpeg?auto=compress&w=600&q=80" alt="Basketball" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/20 to-transparent" />
              <span className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white font-bold tracking-widest">LIVE</span>
            </div>
            <div className="p-4">
              <div className="text-sm font-bold text-white tracking-wide">BASKETBALL</div>
              <div className="text-[11px] text-gray-500 mt-1">Pace • offensive/defensive rating • rebound rate • fatigue index • matchup efficiency</div>
              <div className="flex flex-wrap gap-1.5 mt-3 text-[10px]">
                <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-gray-500">NBA</span>
                <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-gray-500">EuroLeague</span>
                <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-gray-500">NCAA</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-4">
          {['Tennis', 'Cricket', 'MMA', 'Motorsport'].map((s) => (
            <span key={s} className="text-[10px] tracking-widest text-gray-600 px-3 py-1 rounded border border-dashed border-[#21262d]">{s.toUpperCase()} — ARCHITECTURE READY</span>
          ))}
        </div>
      </section>

      {/* ─── WHY APEXSPORT ───────────────────────────────────────────────── */}
      <section className="px-6 py-12 max-w-6xl mx-auto w-full border-t border-[#1c2128]">
        <div className="text-center mb-8">
          <span className="text-[10px] tracking-widest text-emerald-500">WHY APEXSPORT</span>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white">NOT ANOTHER PICKS SERVICE</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: '🔬', title: 'SCIENCE, NOT TIPS', desc: 'Every prediction backed by statistical models, calibrated probabilities, and provenance metadata. No gut feelings.' },
            { icon: '⚡', title: 'SPEED TO EDGE', desc: 'Multi-provider data ingestion with automatic failover. First-mover advantage on market inefficiencies.' },
            { icon: '🛡️', title: 'RISK FIRST', desc: 'Portfolio-aware risk management. Kelly criterion sizing, correlation-aware parlays, structured exposure limits.' },
          ].map((b) => (
            <div key={b.title} className="rounded-xl border border-[#21262d] bg-[#0d1117] p-5 text-center hover:border-emerald-800/30 transition-colors">
              <div className="text-3xl mb-3">{b.icon}</div>
              <div className="text-xs font-bold tracking-widest text-white">{b.title}</div>
              <div className="text-[11px] text-gray-500 mt-2 leading-relaxed">{b.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="px-6 py-16 text-center border-t border-[#1c2128] bg-gradient-to-b from-transparent via-emerald-950/5 to-emerald-950/10">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">SPORTS MOVE FAST.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">YOUR INTELLIGENCE SHOULD TOO.</span></h2>
        <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">Join the controlled testing program. Multi-sport AI intelligence, built for speed, grounded in science.</p>
        <button onClick={() => nav('/login')} className="mt-6 px-10 py-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold tracking-wider shadow-[0_0_32px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_0_48px_rgba(16,185,129,0.5)]">ENTER APEXSPORT →</button>
        <div className="text-[11px] text-gray-600 mt-3">Invite-only • Controlled testing • No public registration</div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="px-6 py-4 border-t border-[#1c2128] bg-[#070a0f]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">🏆</span>
            <span className="text-xs font-bold tracking-[0.15em] text-gray-400">APEXSPORT</span>
          </div>
          <div className="text-[10px] text-gray-600">© 2026 APEXSPORT. Intelligence engine, not a sportsbook.</div>
          <div className="text-[10px] text-gray-600">Images: Pexels — non-commercial use</div>
        </div>
      </footer>
    </div>
  )
}
