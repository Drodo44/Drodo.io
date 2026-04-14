import { fetchCatalogJson, fetchCatalogText } from './catalogAssets'
import type { Skill } from '../types'

type SkillIndexRecord = Omit<Skill, 'content'> & {
  contentFile: string
}

type RankedSkill = SkillIndexRecord & {
  searchText: string
  tokenSet: Set<string>
  tagSet: Set<string>
  domainSet: Set<string>
}

type SkillCategorySummary = {
  generated_at: string
  total_skills: number
  categories: Array<{ name: string; count: number }>
  capability_domains: Record<string, number>
  top_tags: Array<{ tag: string; count: number }>
  source_repositories: Array<{ repo: string; stars: number; explicit_target: boolean; included_skills: number }>
}

type SkillsCatalog = {
  index: SkillIndexRecord[]
  ranked: RankedSkill[]
  categories: SkillCategorySummary
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  coding: ['code', 'coding', 'implement', 'debug', 'fix', 'test', 'refactor', 'frontend', 'backend', 'typescript', 'javascript', 'python', 'react', 'api'],
  reasoning: ['plan', 'strategy', 'reason', 'tradeoff', 'architecture', 'decide', 'evaluate'],
  research: ['research', 'investigate', 'analyze', 'compare', 'summarize', 'study', 'sources'],
  creative: ['design', 'copy', 'writing', 'brand', 'slide', 'creative', 'content', 'ui', 'ux'],
  business: ['business', 'marketing', 'sales', 'pricing', 'product', 'finance', 'compliance', 'growth'],
  devops: ['deploy', 'deployment', 'infra', 'infrastructure', 'docker', 'kubernetes', 'ci', 'cd', 'ops'],
  security: ['security', 'auth', 'audit', 'owasp', 'threat', 'vulnerability', 'incident'],
  data: ['data', 'sql', 'analytics', 'warehouse', 'etl', 'metrics', 'dashboard', 'query'],
  general: ['workflow', 'agent', 'automation'],
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'your',
  'you',
  'are',
  'use',
  'using',
  'used',
  'will',
  'can',
  'should',
  'when',
  'task',
  'agent',
  'skill',
])

let catalogPromise: Promise<SkillsCatalog> | null = null
let catalogSnapshot: SkillsCatalog | null = null
const skillContentCache = new Map<string, Promise<string>>()

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token))
}

function countPhraseMatches(task: string, searchText: string): number {
  if (!task) return 0

  const phrases = [
    ...task.matchAll(/\b[a-z0-9]+\s+[a-z0-9]+\b/g),
  ].map(match => match[0]).filter(phrase => phrase.length > 6)

  let matches = 0
  for (const phrase of phrases.slice(0, 12)) {
    if (searchText.includes(phrase)) matches += 1
  }
  return matches
}

function inferDomains(task: string): Set<string> {
  const lowerTask = task.toLowerCase()
  const domains = new Set<string>()

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const hits = keywords.filter(keyword => lowerTask.includes(keyword)).length
    if (hits > 0) domains.add(domain)
  }

  if (domains.size === 0) domains.add('general')
  return domains
}

function scoreSkill(
  skill: RankedSkill,
  task: string,
  taskTokenSet: Set<string>,
  inferredDomains: Set<string>,
): number {
  let score = skill.priority * 2

  for (const token of taskTokenSet) {
    if (skill.tokenSet.has(token)) score += 6
    if (skill.tagSet.has(token)) score += 5
  }

  for (const domain of inferredDomains) {
    if (skill.domainSet.has(domain)) score += 18
  }

  const lowerTask = task.toLowerCase()
  if (lowerTask && skill.name.toLowerCase().includes(lowerTask)) score += 12
  if (skill.description.toLowerCase().includes(lowerTask)) score += 10

  const phraseBonus = countPhraseMatches(lowerTask, skill.searchText.toLowerCase())
  score += phraseBonus * 9

  if (taskTokenSet.size <= 2 && skill.capability_domains.includes('general')) score += 4
  return score
}

function buildCatalog(index: SkillIndexRecord[], categories: SkillCategorySummary): SkillsCatalog {
  const ranked = index.map(skill => {
    const searchText = [
      skill.name,
      skill.description,
      skill.tags.join(' '),
      skill.capability_domains.join(' '),
    ].join('\n')

    return {
      ...skill,
      searchText,
      tokenSet: new Set(tokenize(searchText)),
      tagSet: new Set(skill.tags.map(tag => tag.toLowerCase())),
      domainSet: new Set(skill.capability_domains.map(domain => domain.toLowerCase())),
    }
  })

  return { index, ranked, categories }
}

function getCatalog(): SkillsCatalog {
  return catalogSnapshot ?? {
    index: [],
    ranked: [],
    categories: {
      generated_at: '',
      total_skills: 0,
      categories: [],
      capability_domains: {},
      top_tags: [],
      source_repositories: [],
    },
  }
}

async function loadSkillContent(skill: SkillIndexRecord): Promise<string> {
  if (!skillContentCache.has(skill.id)) {
    skillContentCache.set(skill.id, fetchCatalogText(`skills/${skill.contentFile}`))
  }

  try {
    return await (skillContentCache.get(skill.id) as Promise<string>)
  } catch {
    return ''
  }
}

export async function ensureSkillsCatalogLoaded(): Promise<void> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const [index, categories] = await Promise.all([
        fetchCatalogJson<SkillIndexRecord[]>('skills/skills-index.json'),
        fetchCatalogJson<SkillCategorySummary>('skills/skill-categories.json'),
      ])

      const catalog = buildCatalog(index, categories)
      catalogSnapshot = catalog
      return catalog
    })()
  }

  await catalogPromise
}

export async function getSkillsForTask(task: string): Promise<string> {
  await ensureSkillsCatalogLoaded()

  const normalizedTask = task.trim()
  const inferredDomains = inferDomains(normalizedTask)
  const taskTokens = tokenize(normalizedTask)
  const taskTokenSet = new Set(taskTokens)
  const { ranked } = getCatalog()

  const scored = ranked
    .map(skill => ({ skill, score: scoreSkill(skill, normalizedTask, taskTokenSet, inferredDomains) }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score)

  const selected = scored.slice(0, scored.length > 0 ? 12 : 10).map(entry => entry.skill)
  const fallback = selected.length > 0
    ? selected
    : ranked
      .filter(skill => skill.capability_domains.includes('general') || skill.priority >= 9)
      .slice(0, 10)

  const skillsWithContent = await Promise.all(
    fallback.slice(0, 15).map(async skill => ({
      skill,
      content: await loadSkillContent(skill),
    }))
  )

  const skillsBlock = skillsWithContent
    .filter(entry => entry.content.trim().length > 0)
    .map(entry => `### ${entry.skill.name}\n${entry.content.trim()}`)
    .join('\n\n')

  return skillsBlock ? `## Available Skills\n\n${skillsBlock}` : ''
}

export function getAllSkillCategories(): string[] {
  return getCatalog().categories.categories.map(category => category.name)
}

export function getAllSkills(): Skill[] {
  return getCatalog().index.map(skill => ({
    ...skill,
    content: '',
  }))
}

export function getSkillsByDomain(domain: string): Skill[] {
  const normalizedDomain = domain.toLowerCase()
  return getCatalog().index
    .filter(skill => skill.capability_domains.some(entry => entry.toLowerCase() === normalizedDomain))
    .map(skill => ({
      ...skill,
      content: '',
    }))
}

export function getSkillCount(): number {
  return getCatalog().index.length
}

export function getAllSkillDomains(): string[] {
  return Object.entries(getCatalog().categories.capability_domains)
    .filter(([, count]) => count > 0)
    .map(([domain]) => domain)
}

export function getTopSkillCategories(limit = 5): Array<{ name: string; count: number }> {
  return getCatalog().categories.categories.slice(0, limit)
}

export function getSkillCatalogSummary(): string {
  const categorySummary = getTopSkillCategories(6)
    .map(item => `${item.name} (${item.count})`)
    .join(', ')

  const domainSummary = Object.entries(getCatalog().categories.capability_domains)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([domain, count]) => `${domain} (${count})`)
    .join(', ')

  return [
    `Total bundled skills: ${getSkillCount()}`,
    `Top categories: ${categorySummary}`,
    `Capability domains: ${domainSummary}`,
  ].join('\n')
}
