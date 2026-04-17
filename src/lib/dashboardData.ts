import type { Message, Project, ProjectStatus, Session } from '../types'

const SESSION_STORAGE_KEY = 'drodo_sessions'
const PROJECT_STORAGE_KEY = 'drodo_projects'

function loadStoredArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function saveStoredArray<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // Ignore storage write errors so the UI remains usable.
  }
}

function byNewest<T extends { createdAt: string }>(a: T, b: T): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

export function loadSessions(): Session[] {
  return loadStoredArray<Session>(SESSION_STORAGE_KEY).sort(byNewest)
}

export function saveSessions(sessions: Session[]): void {
  saveStoredArray(SESSION_STORAGE_KEY, sessions.sort(byNewest))
}

export function upsertSession(session: Session): Session[] {
  const next = [...loadSessions().filter(existing => existing.id !== session.id), session].sort(byNewest)
  saveSessions(next)
  return next
}

export function deleteSession(sessionId: string): Session[] {
  const next = loadSessions().filter(session => session.id !== sessionId)
  saveSessions(next)
  return next
}

export function loadProjects(): Project[] {
  return loadStoredArray<Project>(PROJECT_STORAGE_KEY).sort(byNewest)
}

export function saveProjects(projects: Project[]): void {
  saveStoredArray(PROJECT_STORAGE_KEY, projects.sort(byNewest))
}

export function deleteProject(projectId: string): Project[] {
  const next = loadProjects().filter(project => project.id !== projectId)
  saveProjects(next)
  return next
}

export function cycleProjectStatus(status: ProjectStatus): ProjectStatus {
  if (status === 'active') return 'paused'
  if (status === 'paused') return 'complete'
  return 'active'
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')           // headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')      // bold
    .replace(/\*([^*]+)\*/g, '$1')          // italic
    .replace(/__([^_]+)__/g, '$1')          // bold alt
    .replace(/_([^_]+)_/g, '$1')            // italic alt
    .replace(/~~([^~]+)~~/g, '$1')          // strikethrough
    .replace(/`{3}[\s\S]*?`{3}/g, '')       // code blocks
    .replace(/`([^`]+)`/g, '$1')            // inline code
    .replace(/^\s*[-*+]\s+/gm, '')          // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')          // ordered list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // images
    .replace(/^>\s+/gm, '')                 // blockquotes
    .replace(/---+/g, '')                   // horizontal rules
    .replace(/\n{2,}/g, '\n')              // collapse blank lines
    .trim()
}

export function truncatePreview(content: string, maxLength = 80): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength).trimEnd()}…`
}

export function getLatestConversationPreview(messages: Message[]): string {
  const latest = [...messages]
    .reverse()
    .find(message => (message.role === 'user' || message.role === 'assistant') && message.content.trim())

  return latest ? truncatePreview(stripMarkdown(latest.content)) : ''
}

export function getConversationMessageCount(messages: Message[]): number {
  return messages.filter(
    message => (message.role === 'user' || message.role === 'assistant') && message.content.trim()
  ).length
}

export function formatRelativeTime(dateLike: string): string {
  const timestamp = new Date(dateLike).getTime()
  if (Number.isNaN(timestamp)) return 'Unknown'

  const diff = Date.now() - timestamp
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`

  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
