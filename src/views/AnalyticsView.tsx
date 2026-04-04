import { useState } from 'react'
import { BarChart3, MessageSquare, Cpu, DollarSign, Plug, Trash2, CheckCircle2 } from 'lucide-react'
import {
  getUsageLog, getProviderTotals, getTotals, getUsageByDay, clearUsage,
  type UsageEntry, type ProviderTotals,
} from '../lib/usageTracker'
import { getConnectedProviders } from '../lib/providerApi'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString()
}

function fmtCost(n: number): string {
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(2)}`
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function dayLabel(dateStr: string): string {
  try { return DAY_LABELS[new Date(dateStr + 'T12:00:00').getDay()] }
  catch { return dateStr.slice(5) }
}

// ─── SVG bar chart ────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { date: string; tokens: number }[] }) {
  const VBW = 640; const VBH = 160
  const PAD = { top: 16, right: 12, bottom: 32, left: 44 }
  const W = VBW - PAD.left - PAD.right
  const H = VBH - PAD.top - PAD.bottom
  const maxVal = Math.max(...data.map(d => d.tokens), 1)
  const maxY = Math.ceil(maxVal / 100) * 100 + 100
  const barW = Math.floor(W / data.length) - 4

  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} style={{ width: '100%', height: 160, display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id="bar-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7f77dd" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#7f77dd" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {/* Y grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
        const val = Math.round(maxY * frac)
        const y = PAD.top + H - frac * H
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={VBW - PAD.right} y2={y} stroke="var(--border-color)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
            </text>
          </g>
        )
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const bh = Math.max((d.tokens / maxY) * H, d.tokens > 0 ? 2 : 0)
        const x = PAD.left + i * (W / data.length) + 2
        const y = PAD.top + H - bh
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={bh} rx="3" fill="url(#bar-fill)" />
            <text x={x + barW / 2} y={VBH - 6} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">
              {dayLabel(d.date)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, Icon, color, bg }: {
  label: string; value: string; sub?: string
  Icon: typeof BarChart3; color: string; bg: string
}) {
  return (
    <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
      {sub && <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>}
    </div>
  )
}

// ─── Provider breakdown row ───────────────────────────────────────────────────

function ProviderRow({ pt, totalTokens }: { pt: ProviderTotals; totalTokens: number }) {
  const pct = totalTokens > 0 ? Math.round((pt.totalTokens / totalTokens) * 100) : 0
  const color = pt.color || '#7f77dd'
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[var(--text-primary)] truncate">{pt.providerName}</div>
          <div className="text-xs text-[var(--text-secondary)]">{fmtCost(pt.totalCostUsd)}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="text-xs text-[var(--text-muted)]">{fmtTokens(pt.totalTokens)}</span>
          <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ─── Usage log row ────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: UsageEntry }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-xs">
      <span className="text-[var(--text-secondary)] font-mono w-14 flex-shrink-0">{fmtTime(entry.timestamp)}</span>
      <span className="text-[var(--text-muted)] w-24 truncate flex-shrink-0">{entry.providerName}</span>
      <span className="text-[var(--text-secondary)] font-mono flex-1 truncate">{entry.model}</span>
      <span className="text-[var(--text-muted)] tabular-nums w-14 text-right flex-shrink-0">{fmtTokens(entry.totalTokens)}</span>
      <span className="text-[var(--text-secondary)] tabular-nums w-14 text-right flex-shrink-0">{fmtCost(entry.estimatedCostUsd)}</span>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)

  const refresh = () => { setRefreshKey(k => k + 1); setConfirmClear(false); setCleared(true); setTimeout(() => setCleared(false), 1500) }

  const totals = getTotals()
  const providerTotals = getProviderTotals()
  const dailyData = getUsageByDay(7)
  const recentLog = getUsageLog().slice(0, 20)
  const activeProviderCount = getConnectedProviders().length
  const hasData = totals.tokens > 0

  // Suppress unused refreshKey lint warning by using it in data fetch (already done implicitly via useState trigger)
  void refreshKey

  const handleClear = () => {
    clearUsage()
    refresh()
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
            <BarChart3 size={18} style={{ color: '#7f77dd' }} />
          </div>
          <div>
            <h1 className="font-bold text-[var(--text-primary)] text-lg">Analytics</h1>
            <p className="text-xs text-[var(--text-secondary)]">Real usage across all sessions</p>
          </div>
        </div>
        {/* Reset button */}
        <div className="flex items-center gap-2">
          {cleared && (
            <div className="flex items-center gap-1 text-xs text-[#1d9e75]">
              <CheckCircle2 size={13} /> Cleared
            </div>
          )}
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Clear all usage history?</span>
              <button onClick={handleClear} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-all" style={{ background: '#e05050' }}>
                Confirm
              </button>
              <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
            >
              <Trash2 size={12} />
              Reset Usage
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Empty state */}
        {!hasData && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
              <BarChart3 size={28} className="text-[var(--border-color)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">No usage tracked yet.</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Start a conversation to see your stats here.</p>
            </div>
          </div>
        )}

        {hasData && (
          <>
            {/* Metric cards */}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              <MetricCard
                label="Total Tokens" value={fmtTokens(totals.tokens)}
                sub={`${totals.tokens.toLocaleString()} tokens`}
                Icon={Cpu} color="#d4a227" bg="#d4a22715"
              />
              <MetricCard
                label="Est. Cost" value={fmtCost(totals.costUsd)}
                sub="Estimated at published rates"
                Icon={DollarSign} color="#1d9e75" bg="#1d9e7515"
              />
              <MetricCard
                label="Total Sessions" value={String(totals.sessions)}
                sub="Conversations + workflow runs"
                Icon={MessageSquare} color="#7f77dd" bg="#7f77dd15"
              />
              <MetricCard
                label="Providers Active" value={String(providerTotals.length || activeProviderCount)}
                sub={`${activeProviderCount} provider${activeProviderCount !== 1 ? 's' : ''} connected`}
                Icon={Plug} color="#0ea5e9" bg="#0ea5e915"
              />
            </div>

            {/* Bar chart */}
            <div className="p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Token Usage — Last 7 Days</h3>
                <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                  {fmtTokens(dailyData.reduce((s, d) => s + d.tokens, 0))} total
                </span>
              </div>
              <BarChart data={dailyData} />
            </div>

            {/* Two-col: provider breakdown + daily breakdown */}
            <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* Provider breakdown */}
              <div className="p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Provider Breakdown</h3>
                {providerTotals.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">No provider data yet.</p>
                ) : (
                  <div className="space-y-4">
                    {providerTotals.map(pt => (
                      <ProviderRow key={pt.providerId} pt={pt} totalTokens={totals.tokens} />
                    ))}
                  </div>
                )}
              </div>

              {/* Daily breakdown table */}
              <div className="p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Daily Breakdown</h3>
                <div className="space-y-2">
                  {[...dailyData].reverse().map(d => {
                    const maxTok = Math.max(...dailyData.map(x => x.tokens), 1)
                    const pct = Math.round((d.tokens / maxTok) * 100)
                    return (
                      <div key={d.date} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-secondary)] w-8 flex-shrink-0">{dayLabel(d.date)}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#7f77dd,#a09ae8)' }} />
                        </div>
                        <span className="text-xs text-[var(--text-muted)] tabular-nums w-12 text-right">{fmtTokens(d.tokens)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Week total</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">
                    {fmtTokens(dailyData.reduce((s, d) => s + d.tokens, 0))} tokens
                  </span>
                </div>
              </div>
            </div>

            {/* Usage log */}
            {recentLog.length > 0 && (
              <div className="p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Recent Usage Log</h3>
                {/* Header row */}
                <div className="flex items-center gap-3 px-3 pb-2 border-b border-[var(--border-color)] text-xs text-[var(--text-muted)] font-medium">
                  <span className="w-14 flex-shrink-0">Time</span>
                  <span className="w-24 flex-shrink-0">Provider</span>
                  <span className="flex-1">Model</span>
                  <span className="w-14 text-right flex-shrink-0">Tokens</span>
                  <span className="w-14 text-right flex-shrink-0">Cost</span>
                </div>
                <div className="space-y-0.5 max-h-64 overflow-y-auto mt-1">
                  {recentLog.map(entry => <LogRow key={entry.id} entry={entry} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
