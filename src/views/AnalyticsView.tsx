import { BarChart3, MessageSquare, Cpu, TrendingUp, TrendingDown, Plug } from 'lucide-react'
import { getConnectedProviders } from '../lib/providerApi'

// ─── Mock data ────────────────────────────────────────────────────────────────

const DAILY_USAGE = [
  { day: 'Mon', tokens: 320 },
  { day: 'Tue', tokens: 480 },
  { day: 'Wed', tokens: 290 },
  { day: 'Thu', tokens: 650 },
  { day: 'Fri', tokens: 820 },
  { day: 'Sat', tokens: 180 },
  { day: 'Sun', tokens: 240 },
]

const TOP_MODELS = [
  { name: 'claude-sonnet-4-6', provider: 'Anthropic', tokens: 1080000, pct: 45, color: '#cc785c' },
  { name: 'gpt-4o', provider: 'OpenAI', tokens: 768000, pct: 32, color: '#10a37f' },
  { name: 'llama3.2', provider: 'Ollama', tokens: 552000, pct: 23, color: '#7f77dd' },
]


// ─── SVG Line Chart ───────────────────────────────────────────────────────────

const VB_W = 640
const VB_H = 160
const PAD = { top: 16, right: 12, bottom: 32, left: 44 }
const CHART_W = VB_W - PAD.left - PAD.right
const CHART_H = VB_H - PAD.top - PAD.bottom
const MAX_VAL = Math.ceil(Math.max(...DAILY_USAGE.map(d => d.tokens)) / 100) * 100 + 100

function px(i: number) {
  return PAD.left + (i / (DAILY_USAGE.length - 1)) * CHART_W
}
function py(v: number) {
  return PAD.top + CHART_H - (v / MAX_VAL) * CHART_H
}

const points = DAILY_USAGE.map((d, i) => `${px(i)},${py(d.tokens)}`).join(' ')
const areaPath = [
  `M ${px(0)},${py(DAILY_USAGE[0].tokens)}`,
  ...DAILY_USAGE.slice(1).map((d, i) => `L ${px(i + 1)},${py(d.tokens)}`),
  `L ${px(DAILY_USAGE.length - 1)},${PAD.top + CHART_H}`,
  `L ${PAD.left},${PAD.top + CHART_H}`,
  'Z',
].join(' ')

const Y_TICKS = 4
function LineChart() {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ width: '100%', height: 160, display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7f77dd" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#7f77dd" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y grid lines + labels */}
      {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
        const val = Math.round((MAX_VAL / Y_TICKS) * i)
        const y = py(val)
        return (
          <g key={i}>
            <line
              x1={PAD.left} y1={y} x2={VB_W - PAD.right} y2={y}
              stroke="#2a2a2e" strokeWidth="1"
            />
            <text
              x={PAD.left - 6} y={y + 4}
              textAnchor="end" fontSize="10" fill="#6b6b78"
            >
              {val >= 1000 ? `${val / 1000}k` : val}
            </text>
          </g>
        )
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#line-fill)" />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="#7f77dd"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points */}
      {DAILY_USAGE.map((d, i) => (
        <circle
          key={d.day}
          cx={px(i)} cy={py(d.tokens)} r="3.5"
          fill="#141418" stroke="#7f77dd" strokeWidth="2"
        />
      ))}

      {/* X labels */}
      {DAILY_USAGE.map((d, i) => (
        <text
          key={d.day}
          x={px(i)} y={VB_H - 6}
          textAnchor="middle" fontSize="10" fill="#6b6b78"
        >
          {d.day}
        </text>
      ))}
    </svg>
  )
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, change, up, Icon, color, bg,
}: {
  label: string
  value: string
  sub?: string
  change?: string
  up?: boolean
  Icon: typeof BarChart3
  color: string
  bg: string
}) {
  return (
    <div className="p-4 rounded-xl border border-[#2a2a2e] bg-[#141418]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#9898a8]">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-[#e8e8ef] tabular-nums">{value}</div>
      {change !== undefined && up !== undefined ? (
        <div className="flex items-center gap-1 mt-1">
          {up
            ? <TrendingUp size={11} style={{ color: '#1d9e75' }} />
            : <TrendingDown size={11} style={{ color: '#e05050' }} />}
          <span className="text-xs" style={{ color: up ? '#1d9e75' : '#e05050' }}>
            {change} vs last month
          </span>
        </div>
      ) : sub ? (
        <div className="text-xs text-[#6b6b78] mt-1">{sub}</div>
      ) : null}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const activeProviders = getConnectedProviders().length

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
          <BarChart3 size={18} style={{ color: '#7f77dd' }} />
        </div>
        <div>
          <h1 className="font-bold text-[#e8e8ef] text-lg">Analytics</h1>
          <p className="text-xs text-[#6b6b78]">Last 7 days</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Metric cards */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <MetricCard
            label="Total Sessions" value="94" change="+31%" up
            Icon={MessageSquare} color="#1d9e75" bg="#1d9e7515"
          />
          <MetricCard
            label="Messages Sent" value="1,247" change="+18%" up
            Icon={MessageSquare} color="#7f77dd" bg="#7f77dd15"
          />
          <MetricCard
            label="Tokens Used" value="2.4M" change="+12%" up
            Icon={Cpu} color="#d4a227" bg="#d4a22715"
          />
          <MetricCard
            label="Active Providers" value={String(activeProviders)}
            sub={activeProviders === 1 ? '1 provider connected' : `${activeProviders} providers connected`}
            Icon={Plug} color="#0ea5e9" bg="#0ea5e915"
          />
        </div>

        {/* Line chart */}
        <div className="p-5 rounded-xl border border-[#2a2a2e] bg-[#141418]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#e8e8ef]">Token Usage — Last 7 Days</h3>
            <span className="text-xs text-[#6b6b78] tabular-nums">
              {DAILY_USAGE.reduce((s, d) => s + d.tokens, 0).toLocaleString()}k total
            </span>
          </div>
          <LineChart />
        </div>

        {/* Two-col: top models + daily breakdown */}
        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Top models */}
          <div className="p-5 rounded-xl border border-[#2a2a2e] bg-[#141418]">
            <h3 className="text-sm font-semibold text-[#e8e8ef] mb-4">Top Models Used</h3>
            <div className="space-y-4">
              {TOP_MODELS.map(m => (
                <div key={m.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#e8e8ef] truncate font-mono">{m.name}</div>
                      <div className="text-xs text-[#6b6b78]">{m.provider}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs text-[#9898a8]">
                        {(m.tokens / 1_000_000).toFixed(1)}M
                      </span>
                      <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color: m.color }}>
                        {m.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#2a2a2e] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${m.pct}%`, background: m.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily breakdown table */}
          <div className="p-5 rounded-xl border border-[#2a2a2e] bg-[#141418]">
            <h3 className="text-sm font-semibold text-[#e8e8ef] mb-4">Daily Breakdown</h3>
            <div className="space-y-2">
              {[...DAILY_USAGE].reverse().map(d => {
                const pct = Math.round((d.tokens / MAX_VAL) * 100)
                return (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="text-xs text-[#6b6b78] w-8 flex-shrink-0">{d.day}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#2a2a2e] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #7f77dd, #a09ae8)',
                        }}
                      />
                    </div>
                    <span className="text-xs text-[#9898a8] tabular-nums w-12 text-right">
                      {d.tokens.toLocaleString()}k
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-[#2a2a2e] flex items-center justify-between">
              <span className="text-xs text-[#6b6b78]">Week total</span>
              <span className="text-xs font-semibold text-[#e8e8ef] tabular-nums">
                {DAILY_USAGE.reduce((s, d) => s + d.tokens, 0).toLocaleString()}k tokens
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
