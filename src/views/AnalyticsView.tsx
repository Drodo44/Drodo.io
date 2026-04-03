import { BarChart3, TrendingUp, Cpu, DollarSign, MessageSquare, Clock } from 'lucide-react'

const METRICS = [
  {
    label: 'Total Tokens',
    value: '2.4M',
    change: '+12%',
    up: true,
    Icon: Cpu,
    color: '#7f77dd',
    bg: '#7f77dd15',
  },
  {
    label: 'Est. Cost',
    value: '$18.42',
    change: '+8%',
    up: true,
    Icon: DollarSign,
    color: '#d4a227',
    bg: '#d4a22715',
  },
  {
    label: 'Total Sessions',
    value: '94',
    change: '+31%',
    up: true,
    Icon: MessageSquare,
    color: '#1d9e75',
    bg: '#1d9e7515',
  },
  {
    label: 'Avg. Session Time',
    value: '14m',
    change: '-5%',
    up: false,
    Icon: Clock,
    color: '#0ea5e9',
    bg: '#0ea5e915',
  },
]

const PROVIDER_USAGE = [
  { name: 'Anthropic', tokens: 1200000, pct: 50, color: '#cc785c' },
  { name: 'OpenAI', tokens: 720000, pct: 30, color: '#10a37f' },
  { name: 'Ollama', tokens: 480000, pct: 20, color: '#7f77dd' },
]

const DAILY_USAGE = [
  { day: 'Mon', tokens: 320 },
  { day: 'Tue', tokens: 480 },
  { day: 'Wed', tokens: 290 },
  { day: 'Thu', tokens: 650 },
  { day: 'Fri', tokens: 820 },
  { day: 'Sat', tokens: 180 },
  { day: 'Sun', tokens: 240 },
]

const MAX_TOKENS = Math.max(...DAILY_USAGE.map(d => d.tokens))

export function AnalyticsView() {
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
          <p className="text-xs text-[#6b6b78]">Last 30 days</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {METRICS.map(metric => {
            const { Icon } = metric
            return (
              <div
                key={metric.label}
                className="p-4 rounded-xl border border-[#2a2a2e] bg-[#141418]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[#9898a8]">{metric.label}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: metric.bg }}>
                    <Icon size={14} style={{ color: metric.color }} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-[#e8e8ef]">{metric.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp
                    size={11}
                    style={{ color: metric.up ? '#1d9e75' : '#e05050', transform: metric.up ? 'none' : 'scaleY(-1)' }}
                  />
                  <span className="text-xs" style={{ color: metric.up ? '#1d9e75' : '#e05050' }}>
                    {metric.change} vs last month
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Daily Usage Chart */}
        <div className="p-5 rounded-xl border border-[#2a2a2e] bg-[#141418]">
          <h3 className="text-sm font-semibold text-[#e8e8ef] mb-4">Daily Token Usage (k)</h3>
          <div className="flex items-end gap-3 h-32">
            {DAILY_USAGE.map(d => (
              <div key={d.day} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: Math.max(4, (d.tokens / MAX_TOKENS) * 96),
                    background: 'linear-gradient(180deg, #7f77dd, #5a52b0)',
                    opacity: 0.8,
                  }}
                />
                <span className="text-xs text-[#6b6b78]">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Provider Usage */}
        <div className="p-5 rounded-xl border border-[#2a2a2e] bg-[#141418]">
          <h3 className="text-sm font-semibold text-[#e8e8ef] mb-4">Provider Usage</h3>
          <div className="space-y-3">
            {PROVIDER_USAGE.map(p => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-[#e8e8ef]">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9898a8]">{(p.tokens / 1000).toFixed(0)}k tokens</span>
                    <span className="text-xs font-medium" style={{ color: p.color }}>{p.pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[#2a2a2e] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${p.pct}%`, background: p.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
