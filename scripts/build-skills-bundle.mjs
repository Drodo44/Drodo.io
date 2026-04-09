import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const REPO_ROOT = process.cwd()
const OUTPUT_DIR = path.join(REPO_ROOT, 'src', 'data', 'skills')
const CACHE_DIR = path.join(path.parse(REPO_ROOT).root, '_drodo_skills_cache')
const FETCHED_AT = new Date().toISOString()

const EXPLICIT_REPOS = [
  { fullName: 'wshobson/agents', minStars: 0, priority: 10 },
  { fullName: 'VoltAgent/awesome-agent-skills', minStars: 0, priority: 9 },
  { fullName: 'travisvn/awesome-claude-skills', minStars: 0, priority: 8 },
  { fullName: 'shanraisshan/claude-code-best-practice', minStars: 0, priority: 10 },
  { fullName: 'alirezarezvani/claude-skills', minStars: 0, priority: 8 },
  { fullName: 'obra/superpowers', minStars: 0, priority: 10 },
]

const MANUAL_DISCOVERED_REPOS = [
  { fullName: 'anthropics/skills', minStars: 10000, priority: 10 },
  { fullName: 'vercel-labs/skills', minStars: 10000, priority: 8 },
  { fullName: 'vercel-labs/agent-skills', minStars: 10000, priority: 9 },
  { fullName: 'github/awesome-copilot', minStars: 10000, priority: 8 },
  { fullName: 'ComposioHQ/awesome-claude-skills', minStars: 10000, priority: 8 },
  { fullName: 'hesreallyhim/awesome-claude-code', minStars: 10000, priority: 8 },
  { fullName: 'sickn33/antigravity-awesome-skills', minStars: 10000, priority: 9 },
  { fullName: 'kepano/obsidian-skills', minStars: 10000, priority: 8 },
  { fullName: 'K-Dense-AI/claude-scientific-skills', minStars: 10000, priority: 8 },
  { fullName: 'coreyhaines31/marketingskills', minStars: 10000, priority: 8 },
  { fullName: 'OthmanAdi/planning-with-files', minStars: 10000, priority: 8 },
  { fullName: 'affaan-m/everything-claude-code', minStars: 10000, priority: 9 },
]

const PATH_MARKERS = new Set([
  'skills',
  'skill',
  'agents',
  'agent',
  'prompts',
  'prompt',
  'commands',
  'command',
  'workflows',
  'workflow',
  'hooks',
])

const ROOT_GUIDE_FILES = new Set([
  'README.md',
  'CLAUDE.md',
  'AGENTS.md',
  'GEMINI.md',
  'SYSTEM_PROMPT.md',
  'PROMPTS.md',
  'COMMANDS.md',
])

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
])

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'vendor',
  '.next',
  '.turbo',
  '.cache',
  'test-results',
  '__pycache__',
])

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
  'into',
  'over',
  'only',
  'then',
  'than',
  'they',
  'them',
  'have',
  'has',
  'had',
  'not',
  'all',
  'any',
  'can',
  'will',
  'its',
  'their',
  'agent',
  'agents',
  'skill',
  'skills',
])

const DOMAIN_RULES = [
  {
    domain: 'coding',
    category: 'Engineering',
    tags: ['coding', 'debugging', 'testing', 'implementation', 'refactoring'],
    keywords: ['code', 'coding', 'debug', 'refactor', 'typescript', 'javascript', 'python', 'test', 'repo', 'pull request', 'api', 'frontend', 'backend', 'software'],
  },
  {
    domain: 'reasoning',
    category: 'General',
    tags: ['reasoning', 'planning', 'analysis'],
    keywords: ['reason', 'plan', 'think', 'decision', 'tradeoff', 'strategy', 'system prompt', 'workflow'],
  },
  {
    domain: 'research',
    category: 'Research',
    tags: ['research', 'analysis', 'information gathering'],
    keywords: ['research', 'investigate', 'analyze', 'synthesize', 'summary', 'web', 'sources', 'evidence'],
  },
  {
    domain: 'creative',
    category: 'Creative',
    tags: ['creative', 'design', 'writing', 'content'],
    keywords: ['design', 'copy', 'writing', 'brand', 'slides', 'content', 'ui', 'ux', 'story'],
  },
  {
    domain: 'business',
    category: 'Business',
    tags: ['business', 'marketing', 'product', 'sales'],
    keywords: ['business', 'marketing', 'sales', 'go-to-market', 'product', 'finance', 'compliance', 'executive'],
  },
  {
    domain: 'devops',
    category: 'DevOps',
    tags: ['devops', 'deployment', 'infrastructure'],
    keywords: ['deploy', 'docker', 'kubernetes', 'ci', 'cd', 'infra', 'pipeline', 'cloud', 'ops'],
  },
  {
    domain: 'security',
    category: 'Security',
    tags: ['security', 'auditing', 'hardening'],
    keywords: ['security', 'vulnerability', 'auth', 'threat', 'pentest', 'hardening', 'incident'],
  },
  {
    domain: 'data',
    category: 'Data',
    tags: ['data', 'sql', 'analytics'],
    keywords: ['data', 'dataset', 'sql', 'analytics', 'query', 'warehouse', 'etl', 'metrics'],
  },
]

const runtime = {
  totalRepos: 0,
  scannedRepos: 0,
  skippedRepos: 0,
  candidates: 0,
  kept: 0,
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await fs.mkdir(CACHE_DIR, { recursive: true })

  const repos = await collectRepositories()
  runtime.totalRepos = repos.length

  const candidates = []
  for (const repo of repos) {
    try {
      const localPath = await syncRepo(repo)
      const repoCandidates = await extractRepoCandidates(repo, localPath)
      runtime.scannedRepos += 1
      runtime.candidates += repoCandidates.length
      candidates.push(...repoCandidates)
    } catch (error) {
      runtime.skippedRepos += 1
      console.warn(`Skipping ${repo.fullName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const deduped = dedupeCandidates(candidates)
  runtime.kept = deduped.length

  const outputs = buildOutputs(deduped, repos)
  await writeOutputs(outputs)

  console.log(JSON.stringify({
    fetchedAt: FETCHED_AT,
    ...runtime,
    outputDir: OUTPUT_DIR,
  }, null, 2))
}

async function collectRepositories() {
  const repoMap = new Map()

  for (const repo of [...EXPLICIT_REPOS, ...MANUAL_DISCOVERED_REPOS]) {
    const details = await fetchRepository(repo.fullName)
    if (details && details.stars >= repo.minStars) {
      repoMap.set(repo.fullName.toLowerCase(), {
        ...details,
        explicitTarget: EXPLICIT_REPOS.some(item => item.fullName.toLowerCase() === repo.fullName.toLowerCase()),
        priority: repo.priority,
      })
    }
  }

  return [...repoMap.values()].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return b.stars - a.stars
  })
}

async function fetchRepository(fullName) {
  const data = await fetchJson(`https://api.github.com/repos/${fullName}`)
  return {
    fullName: data.full_name,
    cloneUrl: data.clone_url,
    description: data.description ?? '',
    stars: data.stargazers_count ?? 0,
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'drodo-skills-builder',
      Accept: 'application/vnd.github+json',
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText} for ${url}`)
  }
  return response.json()
}

async function syncRepo(repo) {
  const repoDir = path.join(CACHE_DIR, repo.fullName.replace(/[\\/]/g, '__'))
  const gitDir = path.join(repoDir, '.git')
  const exists = await fileExists(gitDir)

  if (!exists) {
    execFileSync('git', ['-c', 'core.longpaths=true', 'clone', '--depth', '1', repo.cloneUrl, repoDir], { stdio: 'ignore' })
    return repoDir
  }

  execFileSync('git', ['-c', 'core.longpaths=true', '-C', repoDir, 'fetch', '--depth', '1', 'origin', 'HEAD'], { stdio: 'ignore' })
  execFileSync('git', ['-c', 'core.longpaths=true', '-C', repoDir, 'reset', '--hard', 'FETCH_HEAD'], { stdio: 'ignore' })
  execFileSync('git', ['-c', 'core.longpaths=true', '-C', repoDir, 'clean', '-fd'], { stdio: 'ignore' })
  return repoDir
}

async function extractRepoCandidates(repo, repoDir) {
  const grouped = new Map()
  await walkRepo(repoDir, '', async relPath => {
    const groupInfo = classifyPath(repo, relPath)
    if (!groupInfo) return

    const absolutePath = path.join(repoDir, relPath)
    const stat = await fs.stat(absolutePath)
    if (!stat.isFile() || stat.size > 200_000) return

    const content = await fs.readFile(absolutePath, 'utf8')
    if (!content.trim()) return

    const existing = grouped.get(groupInfo.key) ?? {
      ...groupInfo,
      files: [],
      repo,
    }
    existing.files.push({ relPath, content })
    grouped.set(groupInfo.key, existing)
  })

  if (grouped.size === 0) {
    for (const fileName of ROOT_GUIDE_FILES) {
      const rootPath = path.join(repoDir, fileName)
      if (await fileExists(rootPath)) {
        const content = await fs.readFile(rootPath, 'utf8')
        grouped.set(`${repo.fullName}::guide::${fileName}`, {
          key: `${repo.fullName}::guide::${fileName}`,
          kind: 'guide',
          rawName: `${repo.fullName.split('/')[1]} ${fileName.replace(/\.[^.]+$/, '')}`,
          files: [{ relPath: fileName, content }],
          repo,
        })
        break
      }
    }
  }

  return [...grouped.values()]
    .map(group => buildCandidate(group))
    .filter(Boolean)
}

async function walkRepo(rootDir, relDir, onFile) {
  const currentDir = path.join(rootDir, relDir)
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue
    const nextRel = relDir ? path.join(relDir, entry.name) : entry.name
    if (entry.isDirectory()) {
      await walkRepo(rootDir, nextRel, onFile)
      continue
    }
    await onFile(nextRel)
  }
}

function classifyPath(repo, relPath) {
  const normalized = relPath.replace(/\\/g, '/')
  const ext = path.extname(normalized).toLowerCase()
  if (!TEXT_EXTENSIONS.has(ext)) return null

  const segments = normalized.split('/')
  const fileName = segments.at(-1) ?? ''
  const lowerSegments = segments.map(part => part.toLowerCase())

  if (ROOT_GUIDE_FILES.has(fileName) && segments.length === 1) {
    return {
      key: `${repo.fullName}::guide::${fileName}`,
      kind: 'guide',
      rawName: `${repo.fullName.split('/')[1]} ${fileName.replace(/\.[^.]+$/, '')}`,
    }
  }

  const markerIndex = lowerSegments.findIndex(segment => PATH_MARKERS.has(segment) || (segment.startsWith('.') && PATH_MARKERS.has(lowerSegments[lowerSegments.indexOf(segment) + 1] ?? '')))
  if (markerIndex === -1) return null

  let kind = lowerSegments[markerIndex]
  let nameIndex = markerIndex + 1
  if (kind.startsWith('.')) {
    kind = lowerSegments[markerIndex + 1] ?? 'guide'
    nameIndex = markerIndex + 2
  }

  const rawName = segments[nameIndex] ? segments[nameIndex].replace(/\.[^.]+$/, '') : fileName.replace(/\.[^.]+$/, '')
  return {
    key: `${repo.fullName}::${kind}::${rawName.toLowerCase()}`,
    kind: singularize(kind),
    rawName,
  }
}

function singularize(value) {
  return value.endsWith('s') ? value.slice(0, -1) : value
}

function buildCandidate(group) {
  const orderedFiles = group.files.sort((a, b) => {
    const aScore = filePriority(a.relPath)
    const bScore = filePriority(b.relPath)
    if (aScore !== bScore) return bScore - aScore
    return a.relPath.localeCompare(b.relPath)
  })

  const combinedContent = []
  let currentLength = 0
  for (const file of orderedFiles) {
    const section = orderedFiles.length === 1
      ? file.content.trim()
      : `# ${file.relPath.replace(/\\/g, '/')}\n\n${file.content.trim()}`
    if (!section) continue
    combinedContent.push(section)
    currentLength += section.length
    if (currentLength >= 18_000) break
  }

  const content = combinedContent.join('\n\n').trim()
  if (content.length < 120) return null

  const parsedFrontmatter = parseMetadataFields(content)
  const name = parsedFrontmatter.name ? humanizeName(parsedFrontmatter.name) : humanizeName(group.rawName)
  const { category, capabilityDomains, tags } = inferMetadata(name, content, group.kind)
  const description = parsedFrontmatter.description || extractDescription(content, name)
  if (looksLikeTemplatePlaceholder(name, description, content)) return null
  const qualityScore = (
    group.repo.priority * 100 +
    Math.min(group.repo.stars / 2000, 80) +
    Math.min(content.length / 250, 60) +
    kindScore(group.kind)
  )

  return {
    name,
    description,
    category,
    capabilityDomains,
    tags,
    content,
    sourceRepo: `github.com/${group.repo.fullName}`,
    sourceStars: group.repo.stars,
    priority: clampPriority(Math.round(group.repo.priority + capabilityDomains.length + Math.min(content.length / 4000, 2))),
    qualityScore,
    repoFullName: group.repo.fullName,
    explicitTarget: group.repo.explicitTarget,
  }
}

function filePriority(relPath) {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase()
  if (normalized.endsWith('/skill.md')) return 10
  if (normalized.endsWith('/readme.md')) return 9
  if (normalized.endsWith('claude.md')) return 8
  if (normalized.endsWith('agents.md')) return 7
  if (normalized.endsWith('/prompt.md')) return 6
  return 1
}

function humanizeName(rawName) {
  return rawName
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

function inferMetadata(name, content, kind) {
  const haystack = `${name}\n${kind}\n${content}`.toLowerCase()
  const domainScores = new Map()
  const tags = new Set([kind.toLowerCase()])

  for (const rule of DOMAIN_RULES) {
    let score = 0
    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword)) score += 1
    }
    if (score > 1) {
      domainScores.set(rule.domain, score)
    }
  }

  const scoredDomains = [...domainScores.entries()]
    .sort((a, b) => b[1] - a[1])
  const sortedDomains = scoredDomains.map(([domain]) => domain)

  const capabilityDomains = sortedDomains.length > 0 ? sortedDomains.slice(0, 3) : ['general']
  const selectedDomains = capabilityDomains.filter(domain => domain !== 'general')
  for (const domain of selectedDomains) {
    const rule = DOMAIN_RULES.find(item => item.domain === domain)
    for (const tag of rule?.tags ?? []) tags.add(tag)
  }

  const primaryRule = DOMAIN_RULES.find(rule => rule.domain === capabilityDomains[0])

  for (const token of tokenize(`${name} ${kind}`)) {
    if (!STOP_WORDS.has(token) && token.length > 3) tags.add(token)
  }

  return {
    category: primaryRule?.category ?? 'General',
    capabilityDomains,
    tags: [...tags].slice(0, 12),
  }
}

function extractDescription(content, fallbackName) {
  const withoutMetadata = content
    .replace(/^---[\s\S]*?---/m, ' ')
    .replace(/^id:\s.*$/gim, ' ')
    .replace(/^name:\s.*$/gim, ' ')
    .replace(/^description:\s.*$/gim, ' ')

  const cleaned = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const sentence = withoutMetadata
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/(.{40,220}?[.!?])(\s|$)/)?.[1] ?? cleaned.slice(0, 180)
  return sentence || `${fallbackName} guidance`
}

function parseMetadataFields(content) {
  const lines = content.split(/\r?\n/)
  let name = ''
  let description = ''

  for (const line of lines.slice(0, 40)) {
    const trimmed = line.trim()
    if (!name) {
      const match = trimmed.match(/^name:\s*["']?(.+?)["']?$/i)
      if (match) name = match[1]
    }
    if (!description) {
      const match = trimmed.match(/^description:\s*["']?(.+?)["']?$/i)
      if (match) description = match[1]
    }
    if (name && description) break
  }

  return { name, description }
}

function kindScore(kind) {
  switch (kind) {
    case 'skill': return 24
    case 'agent': return 20
    case 'command': return 18
    case 'prompt': return 18
    case 'workflow': return 16
    case 'guide': return 12
    default: return 8
  }
}

function clampPriority(value) {
  return Math.min(10, Math.max(1, value))
}

function dedupeCandidates(candidates) {
  const kept = []
  const sorted = [...candidates].sort((a, b) => {
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore
    return b.priority - a.priority
  })

  for (const candidate of sorted) {
    const duplicate = kept.find(existing => isDuplicate(existing, candidate))
    if (!duplicate) kept.push(candidate)
  }

  return kept
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return a.name.localeCompare(b.name)
    })
    .map(candidate => ({ ...candidate }))
    .map(((usedIds) => candidate => {
      const id = uniqueId(candidate.name, usedIds)
      usedIds.add(id)
      return { ...candidate, id }
    })(new Set()))
}

function isDuplicate(a, b) {
  const nameA = normalizeKey(a.name)
  const nameB = normalizeKey(b.name)
  if (nameA === nameB) {
    return similarity(a.content, b.content) > 0.38
  }

  if (a.category !== b.category) return false
  const domainOverlap = a.capabilityDomains.some(domain => b.capabilityDomains.includes(domain))
  if (!domainOverlap) return false

  return similarity(a.content, b.content) > 0.86
}

function similarity(left, right) {
  const leftTokens = new Set(tokenize(left).filter(token => !STOP_WORDS.has(token)).slice(0, 220))
  const rightTokens = new Set(tokenize(right).filter(token => !STOP_WORDS.has(token)).slice(0, 220))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0

  let intersection = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1
  }
  return intersection / (leftTokens.size + rightTokens.size - intersection)
}

function tokenize(value) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function uniqueId(name, existingIds) {
  const base = normalizeKey(name).replace(/^-+|-+$/g, '') || 'skill'
  if (!existingIds.has(base)) return base
  let index = 2
  while (existingIds.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

function normalizeKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function looksLikeTemplatePlaceholder(name, description, content) {
  const haystack = `${name}\n${description}\n${content}`.toLowerCase()
  return (
    /\{\{.+?\}\}/.test(haystack) ||
    /\{skill name\}/.test(haystack) ||
    /\bone sentence describing when to use this skill\b/.test(haystack) ||
    /\btrigger conditions\b/.test(haystack)
  )
}

function buildOutputs(deduped, repos) {
  const skillsIndex = deduped.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    tags: item.tags,
    source_repo: item.sourceRepo,
    capability_domains: item.capabilityDomains,
    priority: item.priority,
  }))

  const skillsContent = Object.fromEntries(deduped.map(item => [item.id, item.content]))

  const skillsByDomain = Object.fromEntries(
    ['coding', 'reasoning', 'research', 'creative', 'business', 'devops', 'security', 'data', 'general'].map(domain => [
      domain,
      deduped
        .filter(item => item.capabilityDomains.includes(domain))
        .map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          category: item.category,
          tags: item.tags,
          source_repo: item.sourceRepo,
          capability_domains: item.capabilityDomains,
          priority: item.priority,
        })),
    ]),
  )

  const categoryCounts = deduped.reduce((accumulator, item) => {
    accumulator[item.category] = (accumulator[item.category] ?? 0) + 1
    return accumulator
  }, {})

  const tagCounts = deduped.flatMap(item => item.tags).reduce((accumulator, tag) => {
    accumulator[tag] = (accumulator[tag] ?? 0) + 1
    return accumulator
  }, {})

  const repoCounts = deduped.reduce((accumulator, item) => {
    accumulator[item.sourceRepo] = (accumulator[item.sourceRepo] ?? 0) + 1
    return accumulator
  }, {})

  const skillCategories = {
    generated_at: FETCHED_AT,
    total_skills: deduped.length,
    categories: Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    capability_domains: Object.fromEntries(
      Object.entries(skillsByDomain).map(([domain, items]) => [domain, items.length]),
    ),
    top_tags: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([tag, count]) => ({ tag, count })),
    source_repositories: repos
      .filter(repo => repoCounts[`github.com/${repo.fullName}`] > 0)
      .map(repo => ({
        repo: `github.com/${repo.fullName}`,
        stars: repo.stars,
        explicit_target: repo.explicitTarget,
        included_skills: repoCounts[`github.com/${repo.fullName}`] ?? 0,
      }))
      .sort((a, b) => b.included_skills - a.included_skills),
  }

  return {
    skillsIndex,
    skillsContent,
    skillsByDomain,
    skillCategories,
  }
}

async function writeOutputs(outputs) {
  const files = [
    ['skills-index.json', outputs.skillsIndex],
    ['skills-content.json', outputs.skillsContent],
    ['skills-by-domain.json', outputs.skillsByDomain],
    ['skill-categories.json', outputs.skillCategories],
  ]

  for (const [fileName, payload] of files) {
    await fs.writeFile(path.join(OUTPUT_DIR, fileName), JSON.stringify(payload, null, 2) + '\n', 'utf8')
  }
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
