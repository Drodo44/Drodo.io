import type { Message } from '../types'
import type { AppSettings } from './appSettings'
import { readFile } from './tauri'

export function loadEnabledSkills(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('drodo_enabled_skills') ?? '{"memory":true}')
  } catch { return { memory: true } }
}

interface InstalledPackage {
  id: string
  name: string
  installedAt: string
  content?: string
  category?: string
}

interface SkillLibraryCache {
  content: string
  fetchedAt: number
}

// Role keyword map for matching skill library sections to agent roles
const ROLE_KEYWORDS: Record<string, string[]> = {
  coding: ['code', 'implement', 'build', 'debug', 'refactor', 'typescript', 'javascript', 'python', 'developer', 'engineer', 'programming'],
  research: ['research', 'find', 'analyze', 'investigate', 'discover', 'information', 'search', 'analyst'],
  writing: ['write', 'content', 'copy', 'blog', 'article', 'draft', 'edit', 'writer', 'copywriter'],
  analysis: ['analyze', 'review', 'evaluate', 'assess', 'audit', 'report', 'data', 'insights'],
  qa: ['test', 'qa', 'quality', 'verify', 'validate', 'check', 'tester'],
  devops: ['deploy', 'ci', 'cd', 'infrastructure', 'docker', 'kubernetes', 'pipeline', 'devops'],
  security: ['security', 'pentest', 'auth', 'vulnerability', 'penetration', 'harden', 'threat'],
}

function isRelevant(category: string | undefined, systemMsgContent: string): boolean {
  if (!category) return false
  const keywords = category.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  const content = systemMsgContent.toLowerCase()
  return keywords.some(k => content.includes(k))
}

function extractSkillLibraryContext(systemContent: string): string {
  try {
    const raw = localStorage.getItem('drodo_skill_library')
    if (!raw) return ''
    const cache = JSON.parse(raw) as SkillLibraryCache
    if (!cache.content) return ''

    const lowerSystem = systemContent.toLowerCase()

    // Determine which role best matches this agent's system prompt
    let bestRole = ''
    let bestScore = 0
    for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
      const score = keywords.filter(kw => lowerSystem.includes(kw)).length
      if (score > bestScore) {
        bestScore = score
        bestRole = role
      }
    }

    if (!bestRole || bestScore === 0) return ''

    // Extract lines from the library that match the role keywords
    const roleKws = ROLE_KEYWORDS[bestRole]
    const lines = cache.content.split('\n')
    const matched: string[] = []
    let inSection = false

    for (const line of lines) {
      const lower = line.toLowerCase()
      // Enter a matching section on heading match
      if (line.startsWith('#') || line.startsWith('##') || line.startsWith('###')) {
        inSection = roleKws.some(kw => lower.includes(kw))
      }
      if (inSection || roleKws.some(kw => lower.includes(kw))) {
        matched.push(line)
      }
      if (matched.join('\n').length > 2000) break
    }

    const result = matched.join('\n').slice(0, 2000).trim()
    return result ? `[Skill Library — ${bestRole}]\n${result}` : ''
  } catch {
    return ''
  }
}

export async function injectSkills(
  messages: Message[],
  userQuery: string,
  enabledSkills: Record<string, boolean>,
  settings: AppSettings
): Promise<Message[]> {
  const result = messages.map(m => ({ ...m }))

  const systemIdx = result.findIndex(m => m.role === 'system')
  const userIdx = result.findIndex(m => m.role === 'user')

  // ── Installed packages ─────────────────────────────────────────────────────
  try {
    const installedPackages: InstalledPackage[] = JSON.parse(
      localStorage.getItem('drodo_installed_packages') ?? '[]'
    )
    const systemContent = systemIdx >= 0 ? result[systemIdx].content : ''
    const relevant = installedPackages.filter(p => p.content && isRelevant(p.category, systemContent))
    if (relevant.length && systemIdx >= 0) {
      const packageContext = relevant
        .map(p => `[${p.name}]\n${p.content!.slice(0, 2000)}`)
        .join('\n\n')
      result[systemIdx] = {
        ...result[systemIdx],
        content: packageContext + '\n\n' + result[systemIdx].content,
      }
    }
  } catch { /* ignore */ }

  // ── Skill library injection (drodo_skill_library) ──────────────────────────
  if (systemIdx >= 0) {
    try {
      const skillCtx = extractSkillLibraryContext(result[systemIdx].content)
      if (skillCtx) {
        result[systemIdx] = {
          ...result[systemIdx],
          content: skillCtx + '\n\n' + result[systemIdx].content,
        }
      }
    } catch { /* ignore */ }
  }

  // ── Web search (Tavily) ────────────────────────────────────────────────────
  if (enabledSkills['web-search'] && settings.tavilyApiKey) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: settings.tavilyApiKey, query: userQuery, max_results: 5 }),
      })
      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ title: string; content: string }> }
        const results = data.results ?? []
        if (results.length && systemIdx >= 0) {
          const searchContext =
            '\n\n[Web Search Results]\n' +
            results.map(r => `${r.title}: ${r.content}`).join('\n')
          result[systemIdx] = {
            ...result[systemIdx],
            content: result[systemIdx].content + searchContext,
          }
        }
      }
    } catch { /* ignore */ }
  }

  // ── Persistent memory ──────────────────────────────────────────────────────
  if (enabledSkills['memory']) {
    try {
      const entries: Array<{ topic: string; content: string }> = JSON.parse(
        localStorage.getItem('drodo_memory_entries') ?? '[]'
      )
      const queryWords = new Set(
        userQuery
          .toLowerCase()
          .split(/\W+/)
          .filter(w => w.length > 3)
      )
      const matched = entries
        .filter(e => e.topic.toLowerCase().split(/\W+/).some(w => queryWords.has(w)))
        .slice(0, 3)
      if (matched.length && systemIdx >= 0) {
        const memContext =
          '\n\n[Relevant Memory]\n' +
          matched.map(e => `${e.topic}: ${e.content}`).join('\n')
        result[systemIdx] = {
          ...result[systemIdx],
          content: result[systemIdx].content + memContext,
        }
      }
    } catch { /* ignore */ }
  }

  // ── File reader ────────────────────────────────────────────────────────────
  if (enabledSkills['file-reader'] && userIdx >= 0) {
    const userContent = result[userIdx].content
    const filePaths = [
      ...(userContent.match(/[A-Za-z]:\\[^\s"']+/g) ?? []),
      ...(userContent.match(/\/[\w./\-_]+/g) ?? []),
    ]
    const fileContents: string[] = []
    for (const path of filePaths.slice(0, 3)) {
      try {
        const content = await readFile(path)
        fileContents.push(`[File: ${path}]\n${content}`)
      } catch { /* ignore */ }
    }
    if (fileContents.length) {
      result[userIdx] = {
        ...result[userIdx],
        content: result[userIdx].content + '\n\n' + fileContents.join('\n\n'),
      }
    }
  }

  // ── Web scraper ────────────────────────────────────────────────────────────
  if (enabledSkills['web-scraper'] && userIdx >= 0) {
    const userContent = result[userIdx].content
    const urls = userContent.match(/https?:\/\/[^\s"']+/g) ?? []
    const scrapedContents: string[] = []
    for (const url of urls.slice(0, 2)) {
      try {
        const res = await fetch(url)
        if (res.ok) {
          const html = await res.text()
          const parser = new DOMParser()
          const doc = parser.parseFromString(html, 'text/html')
          const text = doc.body?.innerText?.slice(0, 3000) ?? ''
          if (text) scrapedContents.push(`[Scraped: ${url}]\n${text}`)
        }
      } catch { /* ignore */ }
    }
    if (scrapedContents.length) {
      result[userIdx] = {
        ...result[userIdx],
        content: result[userIdx].content + '\n\n' + scrapedContents.join('\n\n'),
      }
    }
  }

  return result
}
