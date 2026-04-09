import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { BaseDirectory } from '@tauri-apps/api/path'
import {
  exists,
  mkdir,
  readFile as readBinaryFile,
  writeFile as writeBinaryFile,
} from '@tauri-apps/plugin-fs'
import type { Provider } from '../types'
import { completeText } from './streamChat'
import { classifyTask } from './modelRegistry'

export interface MemoryEntry {
  id: string
  session_id: string
  agent_id: string
  agent_name: string
  task: string
  type: 'observation' | 'tool_call' | 'output' | 'summary'
  content: string
  timestamp: string
  project_id: string | null
}

export interface MemoryStats {
  count: number
  lastUpdated: string | null
}

const DB_FILE_PATH = 'agent-memory/agent-memory.sqlite'
const LOCALSTORAGE_DB_KEY = 'drodo_agent_memory_db'
const LOCALSTORAGE_META_KEY = 'drodo_agent_memory_meta'
const MEMORY_EVENT_NAME = 'drodo-memory-updated'

let sqlPromise: Promise<SqlJsStatic> | null = null
let initializationPromise: Promise<void> | null = null
let database: Database | null = null
let memoryCache: MemoryEntry[] = []

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function createMemoryId(): string {
  return crypto.randomUUID()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function updateMeta(): void {
  const stats: MemoryStats = {
    count: memoryCache.length,
    lastUpdated: memoryCache[0]?.timestamp ?? null,
  }

  localStorage.setItem(LOCALSTORAGE_META_KEY, JSON.stringify(stats))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<MemoryStats>(MEMORY_EVENT_NAME, { detail: stats }))
  }
}

async function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    })
  }
  return sqlPromise
}

async function readPersistedBytes(): Promise<Uint8Array | null> {
  if (isTauriRuntime()) {
    try {
      const dbExists = await exists(DB_FILE_PATH, { baseDir: BaseDirectory.AppLocalData })
      if (!dbExists) return null
      return await readBinaryFile(DB_FILE_PATH, { baseDir: BaseDirectory.AppLocalData })
    } catch {
      return null
    }
  }

  try {
    const raw = localStorage.getItem(LOCALSTORAGE_DB_KEY)
    return raw ? base64ToBytes(raw) : null
  } catch {
    return null
  }
}

async function persistDatabase(): Promise<void> {
  if (!database) return

  const bytes = database.export()

  if (isTauriRuntime()) {
    await mkdir('agent-memory', { baseDir: BaseDirectory.AppLocalData, recursive: true })
    await writeBinaryFile(DB_FILE_PATH, bytes, { baseDir: BaseDirectory.AppLocalData })
  } else {
    localStorage.setItem(LOCALSTORAGE_DB_KEY, bytesToBase64(bytes))
  }

  updateMeta()
}

function hydrateCache(): void {
  if (!database) {
    memoryCache = []
    updateMeta()
    return
  }

  const results = database.exec(`
    SELECT id, session_id, agent_id, agent_name, task, type, content, timestamp, project_id
    FROM memory_entries
    ORDER BY timestamp DESC
  `)

  const rows = results[0]?.values ?? []
  memoryCache = rows.map(row => ({
    id: String(row[0] ?? ''),
    session_id: String(row[1] ?? ''),
    agent_id: String(row[2] ?? ''),
    agent_name: String(row[3] ?? ''),
    task: String(row[4] ?? ''),
    type: String(row[5] ?? 'observation') as MemoryEntry['type'],
    content: String(row[6] ?? ''),
    timestamp: String(row[7] ?? ''),
    project_id: row[8] == null ? null : String(row[8]),
  }))

  updateMeta()
}

function ensureSchema(): void {
  database?.run(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      task TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      project_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_memory_agent_id ON memory_entries(agent_id);
    CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type);
    CREATE INDEX IF NOT EXISTS idx_memory_timestamp ON memory_entries(timestamp DESC);
  `)
}

export async function initializeAgentMemory(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const SQL = await getSql()
      const bytes = await readPersistedBytes()
      database = bytes ? new SQL.Database(bytes) : new SQL.Database()
      ensureSchema()
      hydrateCache()
      await persistDatabase()
    })()
  }

  await initializationPromise
}

export async function writeMemoryEntry(entry: Omit<MemoryEntry, 'id' | 'timestamp'> & Partial<Pick<MemoryEntry, 'id' | 'timestamp'>>): Promise<MemoryEntry> {
  await initializeAgentMemory()

  const normalizedEntry: MemoryEntry = {
    id: entry.id ?? createMemoryId(),
    session_id: entry.session_id,
    agent_id: entry.agent_id,
    agent_name: entry.agent_name,
    task: entry.task,
    type: entry.type,
    content: entry.content,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    project_id: entry.project_id ?? null,
  }

  database?.run(`
    INSERT OR REPLACE INTO memory_entries (
      id, session_id, agent_id, agent_name, task, type, content, timestamp, project_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    normalizedEntry.id,
    normalizedEntry.session_id,
    normalizedEntry.agent_id,
    normalizedEntry.agent_name,
    normalizedEntry.task,
    normalizedEntry.type,
    normalizedEntry.content,
    normalizedEntry.timestamp,
    normalizedEntry.project_id,
  ])

  hydrateCache()
  await persistDatabase()
  return normalizedEntry
}

function keywordScore(taskTokens: Set<string>, entry: MemoryEntry): number {
  const entryTokens = new Set(
    `${entry.task} ${entry.content}`.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2),
  )
  if (taskTokens.size === 0 || entryTokens.size === 0) return 0

  let matches = 0
  for (const token of taskTokens) {
    if (entryTokens.has(token)) matches += 1
  }
  return matches / taskTokens.size
}

function semanticScore(taskDomains: string[], entry: MemoryEntry): number {
  const entryDomains = new Set(classifyTask(`${entry.task}\n${entry.content}`))
  const shared = taskDomains.filter(domain => entryDomains.has(domain)).length
  return taskDomains.length > 0 ? shared / taskDomains.length : 0
}

function recencyScore(entry: MemoryEntry): number {
  const ageMs = Date.now() - new Date(entry.timestamp).getTime()
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24))
  return Math.max(0, 1 - ageDays / 30)
}

export function getRelevantMemory(task: string, limit = 10): MemoryEntry[] {
  const taskTokens = new Set(task.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2))
  const taskDomains = classifyTask(task)

  return memoryCache
    .filter(entry => entry.type === 'summary')
    .map(entry => ({
      entry,
      score: keywordScore(taskTokens, entry) * 0.55 + semanticScore(taskDomains, entry) * 0.35 + recencyScore(entry) * 0.1,
    }))
    .filter(result => result.score > 0.08)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(result => result.entry)
}

export function injectMemoryContext(task: string): string {
  const memories = getRelevantMemory(task)
  if (memories.length === 0) return ''

  const body = memories
    .map(entry => `- ${entry.agent_name} (${new Date(entry.timestamp).toLocaleString()}): ${entry.content}`)
    .join('\n')

  return `## Relevant Prior Context\n\n${body}\n\n`
}

function buildFallbackSummary(entries: MemoryEntry[]): string {
  const important = entries
    .filter(entry => entry.type === 'output' || entry.type === 'tool_call')
    .slice(-8)
    .map(entry => `[${entry.type}] ${entry.content}`)
    .join('\n')

  return important.slice(0, 2500)
}

export async function compressMemory(agentId: string, provider?: Provider): Promise<void> {
  await initializeAgentMemory()

  const entries = memoryCache
    .filter(entry => entry.agent_id === agentId && entry.type !== 'summary')
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))

  if (entries.length === 0) return

  const latest = entries[entries.length - 1]
  const transcript = entries
    .map(entry => `[${entry.type}] ${entry.timestamp}\n${entry.content}`)
    .join('\n\n')

  let summary = buildFallbackSummary(entries)

  if (provider && (provider.isLocal || provider.apiKey)) {
    try {
      const summaryResponse = await completeText(provider, [
        {
          id: `memory-system-${agentId}`,
          role: 'system',
          content: 'Compress this agent session into a concise semantic summary preserving all key facts, decisions, file paths, and outcomes. Max 500 tokens.',
          timestamp: new Date(),
        },
        {
          id: `memory-user-${agentId}`,
          role: 'user',
          content: transcript,
          timestamp: new Date(),
        },
      ])

      if (summaryResponse.trim()) {
        summary = summaryResponse.trim()
      }
    } catch {
      // Fall back to deterministic compression below.
    }
  }

  database?.run(`DELETE FROM memory_entries WHERE agent_id = ? AND type = 'summary'`, [agentId])
  hydrateCache()

  await writeMemoryEntry({
    session_id: latest.session_id,
    agent_id: latest.agent_id,
    agent_name: latest.agent_name,
    task: latest.task,
    type: 'summary',
    content: summary,
    project_id: latest.project_id,
  })
}

export async function getMemoryStats(): Promise<MemoryStats> {
  await initializeAgentMemory()
  return {
    count: memoryCache.length,
    lastUpdated: memoryCache[0]?.timestamp ?? null,
  }
}

export function onMemoryStatsChange(listener: (stats: MemoryStats) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = (event: Event) => {
    const stats = (event as CustomEvent<MemoryStats>).detail
    listener(stats)
  }

  window.addEventListener(MEMORY_EVENT_NAME, handler)
  return () => {
    window.removeEventListener(MEMORY_EVENT_NAME, handler)
  }
}
