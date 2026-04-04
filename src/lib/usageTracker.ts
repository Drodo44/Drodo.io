// Tracks token usage and cost per provider, persisted to localStorage

export interface UsageEntry {
  id: string
  timestamp: string // ISO
  providerId: string
  providerName: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  sessionId?: string
  workflowId?: string
}

export interface ProviderTotals {
  providerId: string
  providerName: string
  color: string
  totalTokens: number
  totalCostUsd: number
  sessionCount: number
  lastUsed: string
}

// ─── Cost tables (per 1M tokens) ─────────────────────────────────────────────

interface CostRates { input: number; output: number }

const COST_TABLE: Record<string, CostRates> = {
  'claude-sonnet-4-6': { input: 3,    output: 15   },
  'claude-opus-4-6':   { input: 15,   output: 75   },
  'gpt-4o':            { input: 2.5,  output: 10   },
  'gpt-4o-mini':       { input: 0.15, output: 0.60 },
  'gemini-2.0-flash':  { input: 0.10, output: 0.40 },
}
const DEFAULT_RATES: CostRates = { input: 1, output: 4 }

function getRates(model: string): CostRates {
  // Try exact match first, then partial match
  if (COST_TABLE[model]) return COST_TABLE[model]
  for (const key of Object.keys(COST_TABLE)) {
    if (model.includes(key) || key.includes(model)) return COST_TABLE[key]
  }
  return DEFAULT_RATES
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = getRates(model)
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const LOG_KEY = 'drodo_usage_log'
const TOTALS_KEY = 'drodo_usage_totals'

function readLog(): UsageEntry[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') } catch { return [] }
}
function writeLog(entries: UsageEntry[]): void {
  // Keep last 500 entries to avoid unbounded growth
  localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-500)))
}

function readTotals(): ProviderTotals[] {
  try { return JSON.parse(localStorage.getItem(TOTALS_KEY) ?? '[]') } catch { return [] }
}
function writeTotals(totals: ProviderTotals[]): void {
  localStorage.setItem(TOTALS_KEY, JSON.stringify(totals))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function trackUsage(
  entry: Omit<UsageEntry, 'id' | 'timestamp'>
): void {
  const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const timestamp = new Date().toISOString()
  const full: UsageEntry = { id, timestamp, ...entry }

  // Append to log
  const log = readLog()
  writeLog([...log, full])

  // Update per-provider totals
  const totals = readTotals()
  const existing = totals.find(t => t.providerId === entry.providerId)
  if (existing) {
    existing.totalTokens += entry.totalTokens
    existing.totalCostUsd += entry.estimatedCostUsd
    existing.sessionCount += 1
    existing.lastUsed = timestamp
  } else {
    totals.push({
      providerId: entry.providerId,
      providerName: entry.providerName,
      color: '#7f77dd', // will be set by caller if needed
      totalTokens: entry.totalTokens,
      totalCostUsd: entry.estimatedCostUsd,
      sessionCount: 1,
      lastUsed: timestamp,
    })
  }
  writeTotals(totals)
}

export function getUsageLog(): UsageEntry[] {
  return readLog().slice().reverse() // newest first
}

export function getProviderTotals(): ProviderTotals[] {
  return readTotals().slice().sort((a, b) => b.totalTokens - a.totalTokens)
}

export function getTotals(): { tokens: number; costUsd: number; sessions: number } {
  const totals = readTotals()
  return {
    tokens: totals.reduce((s, t) => s + t.totalTokens, 0),
    costUsd: totals.reduce((s, t) => s + t.totalCostUsd, 0),
    sessions: totals.reduce((s, t) => s + t.sessionCount, 0),
  }
}

export function clearUsage(): void {
  localStorage.removeItem(LOG_KEY)
  localStorage.removeItem(TOTALS_KEY)
}

export function getUsageByDay(days: number): { date: string; tokens: number; costUsd: number }[] {
  const log = readLog()
  const result: Map<string, { tokens: number; costUsd: number }> = new Map()

  // Pre-fill last N days with zeros
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.set(key, { tokens: 0, costUsd: 0 })
  }

  for (const entry of log) {
    const dateKey = entry.timestamp.slice(0, 10)
    if (result.has(dateKey)) {
      const cur = result.get(dateKey)!
      cur.tokens += entry.totalTokens
      cur.costUsd += entry.estimatedCostUsd
    }
  }

  return Array.from(result.entries()).map(([date, v]) => ({ date, ...v }))
}

export { estimateCost }
