import { useState } from 'react'
import clsx from 'clsx'

export function SlipPreview({ slip, report, onInspectPrediction, compact = false }: {
  slip: any | null
  report?: any | null
  onInspectPrediction?: (predId: string) => void
  compact?: boolean
}) {
  const [stake, setStake] = useState<number>(10)

  if (!slip || !slip.selections?.length) {
    return <div className="text-xs text-gray-600 py-4 text-center">No selections — optimizer filtered all candidates (check edge/confidence thresholds or run a fresh scan).</div>
  }

  const totalOdds = slip.total_odds ?? slip.selections.reduce((a: number, s: any) => a * (s.odds || 1), 1).toFixed(2)
  const numericTotal = typeof totalOdds === 'string' ? parseFloat(totalOdds) : totalOdds
  const potentialReturn = (stake * numericTotal).toFixed(2)
  const potentialProfit = (stake * numericTotal - stake).toFixed(2)

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const html = `
      <html>
        <head>
          <title>APEXSPORT — Bet Slip ${slip.id}</title>
          <style>
            @page { size: 80mm auto; margin: 8mm; }
            body { font-family: monospace; font-size: 10px; color: #000; background: #fff; width: 72mm; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
            .title { font-weight: bold; font-size: 13px; letter-spacing: 1px; }
            .sub { font-size: 8px; color: #555; }
            .meta { display: flex; justify-content: space-between; font-size: 8px; margin: 4px 0; }
            .selection { border: 1px solid #000; padding: 6px; margin: 6px 0; page-break-inside: avoid; }
            .legHead { font-weight: bold; font-size: 10px; }
            .row { display: flex; justify-content: space-between; font-size: 9px; margin: 2px 0; }
            .totalBox { border: 1px solid #000; padding: 6px; margin-top: 8px; background: #f0f0f0; }
            .totalRow { display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; }
            .footer { text-align: center; font-size: 7px; color: #555; margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; }
            .stamp { text-align: center; font-size: 8px; margin-top: 6px; border: 1px solid #000; padding: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">APEXSPORT</div>
            <div class="sub">INTELLIGENCE • NOT A SPORTSBOOK</div>
            <div class="sub">Canonical Slip — ${slip.id}</div>
            <div class="sub">Generated from Prediction provenance • Traceable to Prediction ID</div>
          </div>
          <div class="meta"><span>Provider: ${slip.sportsbook || 'CANONICAL'}</span><span>${new Date(slip.created_at || Date.now()).toLocaleString()}</span></div>
          <div class="meta"><span>Sport canonical → sportsbook at edge</span><span>Status: ${slip.status || 'draft'}</span></div>
          ${slip.selections.map((s: any, i: number) => `
            <div class="selection">
              <div class="legHead">LEG ${i + 1} — ${s.sport || ''} • ${s.competition || ''}</div>
              <div class="row"><span>Fixture</span><span>${s.event_label}</span></div>
              <div class="row"><span>Market → Selection</span><span>${s.market} → ${s.selection}</span></div>
              <div class="row"><span>Odds</span><span>${Number(s.odds).toFixed(2)}</span></div>
              <div class="row"><span>Cal. Prob / Edge</span><span>${(s.calibrated_probability * 100 || 0).toFixed(1)}% / ${(s.edge * 100 || 0).toFixed(1)}%</span></div>
              <div class="row" style="font-size:7px;color:#555"><span>Prediction ID</span><span style="font-family:monospace">${s.prediction_id || ''}</span></div>
              ${s.kickoff_at ? `<div class="row" style="font-size:7px"><span>Kickoff</span><span>${s.kickoff_at}</span></div>` : ''}
            </div>
          `).join('')}
          <div class="totalBox">
            <div class="totalRow"><span>COMBINED ODDS</span><span>${Number(totalOdds).toFixed(2)}</span></div>
            <div class="row"><span>Stake</span><span>${stake.toFixed(2)}</span></div>
            <div class="row"><span>Potential Return</span><span>${potentialReturn}</span></div>
            <div class="row" style="font-size:8px;color:#333"><span>Profit</span><span>${potentialProfit}</span></div>
            ${slip.booking_code ? `<div class="row"><span>Booking Code</span><span>${slip.booking_code} (external)</span></div>` : '<div class="row" style="font-size:7px;color:#555">Booking codes are external reference only — never invented by Apex</div>'}
          </div>
          <div class="stamp">APEXSPORT CANONICAL SLIP<br/>Prediction → SlipSelection → Slip → SportsbookSlip<br/>Pipeline: scanner→features→specialists→ensemble→calibration→value→risk→prediction→slip</div>
          <div class="footer">This slip was generated from canonical Predictions. Sportsbook adapters are output formatters only and do not influence the intelligence model.<br/>ID ${slip.id} • ${slip.selections.length} leg(s) • Risk ${slip.risk_level || ''} • ${new Date().toLocaleString()}</div>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  return (
    <div className="space-y-2">
      {!compact && report && (
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="px-1.5 py-0.5 rounded bg-[#0d1117] border border-[var(--border)]">{report.chosen}/{report.candidates} chosen</span>
          <span className="px-1.5 py-0.5 rounded bg-[#0d1117] border border-[var(--border)]">corr {report.correlation}</span>
          <span className={clsx('px-1.5 py-0.5 rounded border', report.overall_risk==='LOW'?'bg-emerald-900/20 border-emerald-800/30 text-emerald-400':'bg-yellow-900/20 border-yellow-800/30 text-yellow-400')}>{report.overall_risk}</span>
          {report.valid === false && <span className="text-red-400">{report.validation_errors?.join(', ')}</span>}
        </div>
      )}

      {/* PRINT CONTROLS */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-gray-500">
          Canonical Slip <span className="font-mono text-gray-300">{slip.id.slice(0,12)}…</span> • {slip.sportsbook || 'CANONICAL'} • {slip.status} • {slip.selections.length} leg(s)
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-gray-500 flex items-center gap-1">Stake <input type="number" value={stake} onChange={e=>setStake(parseFloat(e.target.value)||0)} className="w-14 bg-[#0d1117] border border-[var(--border)] rounded px-1 py-0.5 text-white font-mono text-[10px]" /></label>
          <button onClick={handlePrint} className="px-2 py-1 rounded bg-[#21262d] border border-[var(--border)] text-[10px] text-white hover:bg-[#30363d]">🖨️ PRINT SLIP</button>
        </div>
      </div>

      {/* VISUAL SLIP — ticket style */}
      <div className="rounded border border-[var(--border)] bg-white text-black overflow-hidden print:shadow-none" style={{ fontFamily: 'Courier New, monospace' }}>
        {/* Header: ticket header */}
        <div className="bg-black text-white px-3 py-2 text-center border-b-2 border-dashed border-gray-400">
          <div className="text-sm font-bold tracking-widest">APEXSPORT</div>
          <div className="text-[9px] tracking-wider text-gray-300">INTELLIGENCE • NOT A SPORTSBOOK</div>
          <div className="text-[8px] text-gray-400 mt-0.5">CANONICAL SLIP • {slip.id}</div>
        </div>

        <div className="px-3 py-2 space-y-2 bg-white">
          {/* Meta */}
          <div className="flex justify-between text-[9px] text-gray-500">
            <span>Provider: <span className="text-black font-bold">{(slip.sportsbook || 'CANONICAL').toUpperCase()}</span> {slip.sportsbook ? '(edge mapping)' : '(canonical)'}</span>
            <span>{slip.created_at ? new Date(slip.created_at).toLocaleString() : new Date().toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[9px] text-gray-500">
            <span>Status: <span className="text-black">{slip.status || 'draft'}</span> • Risk {slip.risk_level || report?.overall_risk || '—'}</span>
            <span className="font-mono">{slip.id.slice(0,16)}</span>
          </div>

          {/* Legs — each selection as ticket leg */}
          <div className="space-y-1.5">
            {slip.selections.map((s: any, i: number) => (
              <div key={s.prediction_id || s.event_id + i} className="border border-black px-2 py-1.5 bg-[#f8f8f8]">
                <div className="flex justify-between text-[10px] font-bold">
                  <span>LEG {i + 1} — {s.sport?.toUpperCase() || ''} {s.competition ? `• ${s.competition}` : ''}</span>
                  <span>{s.market} → <span className={clsx(s.selection==='HOME'?'text-emerald-700': s.selection==='AWAY'?'text-red-700':'text-yellow-700')}>{s.selection}</span></span>
                </div>
                <div className="text-[11px] font-bold mt-0.5">{s.event_label}</div>
                {s.kickoff_at && <div className="text-[8px] text-gray-500">Kickoff: {s.kickoff_at}</div>}
                <div className="flex justify-between text-[10px] mt-1">
                  <span>Odds <span className="font-bold">{Number(s.odds).toFixed(2)}</span></span>
                  <span>Cal {(s.calibrated_probability * 100 || 0).toFixed(1)}% • Edge {(s.edge * 100 || 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-[8px] text-gray-500 font-mono mt-0.5">
                  <span>pred {s.prediction_id?.slice(0,16) || '—'}</span>
                  {onInspectPrediction && s.prediction_id && (
                    <button onClick={() => onInspectPrediction(s.prediction_id)} className="text-emerald-700 underline hover:text-emerald-900" title="Inspect prediction provenance">inspect</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border border-black bg-[#efefef] px-2 py-2 space-y-1">
            <div className="flex justify-between text-[11px] font-bold"><span>COMBINED ODDS</span><span className="font-mono">{Number(totalOdds).toFixed(2)}</span></div>
            <div className="flex justify-between text-[10px]"><span>Stake</span><span className="font-mono">{stake.toFixed(2)}</span></div>
            <div className="flex justify-between text-[10px]"><span>Potential Return</span><span className="font-mono font-bold">{potentialReturn}</span></div>
            <div className="flex justify-between text-[9px] text-gray-600"><span>Profit</span><span className="font-mono">{potentialProfit}</span></div>
            {slip.booking_code ? (
              <div className="flex justify-between text-[9px] mt-1 pt-1 border-t border-dashed border-gray-400"><span>Booking Code</span><span className="font-mono font-bold">{slip.booking_code}</span></div>
            ) : (
              <div className="text-[8px] text-gray-500 mt-1 pt-1 border-t border-dashed border-gray-400">Booking codes are external references only — never invented by Apex</div>
            )}
          </div>

          <div className="text-center text-[8px] text-gray-500 leading-tight">
            Prediction → SlipSelection → Slip → SportsbookSlip<br/>
            This slip was generated from canonical Predictions. Sportsbook adapters are output formatters only.<br/>
            <span className="font-mono">ID {slip.id} • {slip.selections.length} leg(s) • {new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs border-t border-[var(--border)] pt-2">
        <div className="text-gray-400">Total odds: <span className="text-white font-bold font-mono">{Number(totalOdds).toFixed(2)}</span> • Risk: <span className={clsx(slip.risk_level==='LOW'?'text-emerald-400': slip.risk_level==='MEDIUM'?'text-yellow-400':'text-red-400')}>{slip.risk_level || report?.overall_risk || '—'}</span> • <span className="text-gray-600">{slip.selections.length} leg{slip.selections.length!==1?'s':''}</span></div>
        <div className="text-[10px] text-gray-600">ID <span className="font-mono">{slip.id}</span> • {slip.status}</div>
      </div>
      {slip.booking_code ? (
        <div className="text-[10px] text-yellow-400">Booking code: <span className="font-mono">{slip.booking_code}</span> <span className="text-gray-600">(external reference — never invented by Apex)</span></div>
      ) : null}
    </div>
  )
}

export function PersistedSlipCard({ slip, onSelect, active }: { slip: any; onSelect: () => void; active?: boolean }) {
  return (
    <button onClick={onSelect} className={clsx('w-full text-left p-2 rounded border text-xs', active ? 'bg-[#1a2332] border-emerald-800/30' : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]')}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-gray-500">{slip.id.slice(0,12)}…</span>
        <span className={clsx('text-[10px] px-1 py-0.5 rounded border', slip.risk_level==='LOW'?'text-emerald-400 border-emerald-800/30':'text-yellow-400 border-yellow-800/30')}>{slip.risk_level}</span>
      </div>
      <div className="text-white font-medium truncate mt-1">{slip.selections.map((s:any)=>s.event_label).join(' • ') || '—'}</div>
      <div className="text-gray-500 text-[11px] mt-0.5">{slip.selections.length} legs • {slip.total_odds} odds • {slip.status} • {new Date(slip.created_at).toLocaleDateString()}</div>
    </button>
  )
}
