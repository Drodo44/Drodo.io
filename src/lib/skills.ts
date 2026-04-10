import skillsIndexData from '../data/skills/skills-index.json'
import skillsContentData from '../data/skills/skills-content.json'
import skillCategoriesData from '../data/skills/skill-categories.json'
import skillsByDomainData from '../data/skills/skills-by-domain.json'
import type { Skill } from '../types'

type SkillIndexRecord = Omit<Skill, 'content'>

type RankedSkill = Skill & {
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

const SKILLS_INDEX = skillsIndexData as SkillIndexRecord[]
const SKILLS_CONTENT = skillsContentData as Record<string, string>
const SKILLS_BY_DOMAIN = skillsByDomainData as Record<string, SkillIndexRecord[]>
const SKILL_CATEGORIES = skillCategoriesData as SkillCategorySummary

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

const SKILLS: RankedSkill[] = SKILLS_INDEX.map(skill => {
  const content = SKILLS_CONTENT[skill.id] ?? ''
  const searchText = `${skill.name}\n${skill.description}\n${skill.tags.join(' ')}\n${skill.capability_domains.join(' ')}\n${content.slice(0, 2400)}`
  return {
    ...skill,
    content,
    searchText,
    tokenSet: new Set(tokenize(searchText)),
    tagSet: new Set(skill.tags.map(tag => tag.toLowerCase())),
    domainSet: new Set(skill.capability_domains.map(domain => domain.toLowerCase())),
  }
})

export function getSkillsForTask(task: string): string {
  const normalizedTask = task.trim()
  const inferredDomains = inferDomains(normalizedTask)
  const taskTokens = tokenize(normalizedTask)
  const taskTokenSet = new Set(taskTokens)

  const ranked = SKILLS
    .map(skill => ({ skill, score: scoreSkill(skill, normalizedTask, taskTokenSet, inferredDomains) }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score)

  const selected = ranked.slice(0, ranked.length > 0 ? 12 : 10).map(entry => entry.skill)
  const fallback = selected.length > 0
    ? selected
    : SKILLS
      .filter(skill => skill.capability_domains.includes('general') || skill.priority >= 9)
      .slice(0, 10)

  const skillsBlock = fallback
    .slice(0, 15)
    .map(skill => `### ${skill.name}\n${skill.content.trim()}`)
    .join('\n\n')

  return skillsBlock ? `## Available Skills\n\n${skillsBlock}` : ''
}

export function getAllSkillCategories(): string[] {
  return SKILL_CATEGORIES.categories.map(category => category.name)
}

export function getAllSkills(): Skill[] {
  return SKILLS.map(skill => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    tags: skill.tags,
    source_repo: skill.source_repo,
    capability_domains: skill.capability_domains,
    priority: skill.priority,
    content: skill.content,
  }))
}

export function getSkillsByDomain(domain: string): Skill[] {
  const normalizedDomain = domain.toLowerCase()
  const entries = SKILLS_BY_DOMAIN[normalizedDomain] ?? []
  return entries.map(entry => ({
    ...entry,
    content: SKILLS_CONTENT[entry.id] ?? '',
  }))
}

export function getSkillCount(): number {
  return SKILLS_INDEX.length
}

export function getAllSkillDomains(): string[] {
  return Object.entries(SKILL_CATEGORIES.capability_domains)
    .filter(([, count]) => count > 0)
    .map(([domain]) => domain)
}

export function getTopSkillCategories(limit = 5): Array<{ name: string; count: number }> {
  return SKILL_CATEGORIES.categories.slice(0, limit)
}

export function getSkillCatalogSummary(): string {
  const categorySummary = getTopSkillCategories(6)
    .map(item => `${item.name} (${item.count})`)
    .join(', ')

  const domainSummary = Object.entries(SKILL_CATEGORIES.capability_domains)
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

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token))
}
