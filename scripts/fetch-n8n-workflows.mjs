import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import crypto from 'node:crypto'

const execFileAsync = promisify(execFile)

const ROOT_DIR = process.cwd()
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'data', 'workflows')
const TEMPLATE_DIR = path.join(OUTPUT_DIR, 'workflow-templates')
const OFFICIAL_SEARCH_URL = 'https://api.n8n.io/templates/search'
const OFFICIAL_TEMPLATE_URL = 'https://api.n8n.io/templates/workflows'
const OFFICIAL_TEMPLATE_PAGE_URL = 'https://n8n.io/workflows'
const OFFICIAL_PAGE_SIZE = 200
const OFFICIAL_CONCURRENCY = 12

const GITHUB_TEMPLATE_REPOS = [
  {
    owner: 'enescingoz',
    repo: 'awesome-n8n-templates',
    stars: 20969,
  },
  {
    owner: 'wassupjay',
    repo: 'n8n-free-templates',
    stars: 5637,
  },
  {
    owner: 'lucaswalter',
    repo: 'n8n-ai-automations',
    stars: 1434,
  },
  {
    owner: 'Danitilahun',
    repo: 'n8n-workflow-templates',
    stars: 610,
  },
  {
    owner: 'ritik-prog',
    repo: 'n8n-automation-templates-5000',
    stars: 341,
  },
  {
    owner: 'Stirito',
    repo: 'N8N_Workflow_Template',
    stars: 105,
  },
]

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'api', 'app', 'are', 'as', 'at', 'be', 'build', 'by', 'for', 'from',
  'get', 'how', 'in', 'into', 'is', 'it', 'new', 'of', 'on', 'or', 'that', 'the', 'this',
  'to', 'use', 'using', 'with', 'your',
])

const BUILTIN_SERVICE_NAMES = new Set([
  'aggregate',
  'ai',
  'basic llm chain',
  'chat memory manager',
  'chat trigger',
  'code',
  'compare datasets',
  'compression',
  'conversation memory',
  'convert to file',
  'crypto',
  'debug helper',
  'edit fields',
  'execute command',
  'execute sub-workflow',
  'execute workflow',
  'extract from file',
  'filter',
  'form trigger',
  'github trigger',
  'html',
  'http request',
  'http request tool',
  'if',
  'limit',
  'loop over items',
  'manual trigger',
  'markdown',
  'merge',
  'no op',
  'note',
  'rss read',
  'rss read tool',
  'schedule trigger',
  'set',
  'sort',
  'split out',
  'sticky note',
  'stop and error',
  'summarization chain',
  'switch',
  'wait',
  'webhook',
])

const OFFICIAL_CATEGORY_MAP = new Map([
  ['ai', 'AI'],
  ['ai chatbot', 'AI'],
  ['sales', 'Sales'],
  ['marketing', 'Marketing'],
  ['it ops', 'IT Ops'],
  ['devops', 'DevOps'],
  ['document ops', 'Document Ops'],
  ['personal productivity', 'Productivity'],
  ['productivity', 'Productivity'],
  ['communication', 'Communication'],
  ['support', 'Support'],
  ['finance', 'Finance'],
  ['engineering', 'Engineering'],
  ['development', 'Engineering'],
  ['data', 'Data'],
  ['analytics', 'Data'],
  ['e-commerce', 'E-commerce'],
  ['ecommerce', 'E-commerce'],
  ['hr', 'Operations'],
  ['operations', 'Operations'],
  ['social media', 'Marketing'],
  ['other', 'Other'],
])

function log(message) {
  console.log(`[workflows] ${message}`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson(url, attempt = 0) {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'drodo-workflow-bundler',
        accept: 'application/json',
      },
    })

    if (response.ok) {
      return response.json()
    }

    if (attempt < 5 && response.status !== 404) {
      await sleep(500 * (attempt + 1))
      return fetchJson(url, attempt + 1)
    }

    throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`)
  } catch (error) {
    if (attempt < 5) {
      await sleep(500 * (attempt + 1))
      return fetchJson(url, attempt + 1)
    }

    throw error
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function stripMarkdown(value) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_>~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function summarizeDescription(value, fallback) {
  const cleaned = stripMarkdown(value || '')
  if (!cleaned) {
    return fallback
  }

  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned
  return sentence.length > 320 ? `${sentence.slice(0, 317).trimEnd()}...` : sentence
}

function humanizeNodeType(nodeType) {
  const raw = nodeType.split('.').pop() || nodeType
  const withoutSuffix = raw
    .replace(/Tool$/i, '')
    .replace(/Trigger$/i, '')
    .replace(/^lmChat/i, '')
    .replace(/^vectorStore/i, '')

  return withoutSuffix
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bApi\b/g, 'API')
    .replace(/\bAws\b/g, 'AWS')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bGmail\b/g, 'Gmail')
    .replace(/\bGithub\b/g, 'GitHub')
    .replace(/\bGoogle Sheets\b/g, 'Google Sheets')
}

function getNodeDisplayName(node, officialNodeMap) {
  const officialName = officialNodeMap.get(node.type)
  if (officialName) {
    return officialName
  }

  return humanizeNodeType(node.type || node.name || 'Unknown')
}

function extractTriggers(nodes, officialNodeMap) {
  const triggers = []

  for (const node of nodes) {
    const type = (node.type || '').toLowerCase()
    const displayName = getNodeDisplayName(node, officialNodeMap)
    const lowered = displayName.toLowerCase()

    if (
      type.includes('trigger') ||
      type.includes('webhook') ||
      type.includes('schedule') ||
      type.includes('cron') ||
      lowered.includes('trigger') ||
      lowered.includes('webhook') ||
      lowered.includes('schedule')
    ) {
      if (lowered === 'manual') {
        triggers.push('Manual Trigger')
      } else if (!lowered.endsWith('trigger') && !lowered.endsWith('webhook')) {
        triggers.push(`${displayName} Trigger`)
      } else {
        triggers.push(displayName)
      }
    }
  }

  return unique(triggers).slice(0, 12)
}

function extractServices(nodes, officialNodeMap) {
  const services = []

  for (const node of nodes) {
    const displayName = getNodeDisplayName(node, officialNodeMap)
    const lowered = displayName.toLowerCase()

    if (BUILTIN_SERVICE_NAMES.has(lowered)) {
      continue
    }

    if (lowered.endsWith(' trigger')) {
      services.push(displayName.replace(/\s+Trigger$/i, ''))
      continue
    }

    services.push(displayName)
  }

  return unique(services).slice(0, 14)
}

function tokenize(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(token => token && token.length > 2 && !STOP_WORDS.has(token))
}

function extractTaskKeywords(name, description, services, triggers) {
  const keywords = []
  const fullText = `${name} ${description}`.toLowerCase()

  keywords.push(name.toLowerCase())

  for (const service of services) {
    keywords.push(service.toLowerCase())

    if (fullText.includes('sync')) keywords.push(`sync ${service.toLowerCase()}`)
    if (fullText.includes('send')) keywords.push(`send ${service.toLowerCase()}`)
    if (fullText.includes('create')) keywords.push(`create ${service.toLowerCase()}`)
    if (fullText.includes('update')) keywords.push(`update ${service.toLowerCase()}`)
    if (fullText.includes('notify')) keywords.push(`notify ${service.toLowerCase()}`)
    if (fullText.includes('monitor')) keywords.push(`monitor ${service.toLowerCase()}`)
  }

  for (const trigger of triggers) {
    keywords.push(trigger.toLowerCase())
  }

  const tokens = tokenize(`${name} ${description}`)
  for (let index = 0; index < tokens.length - 1; index += 1) {
    keywords.push(`${tokens[index]} ${tokens[index + 1]}`)
  }

  return unique(
    keywords
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length >= 4)
  ).slice(0, 12)
}

function inferCategory({ categoryHints, name, description, services, relativePath }) {
  const loweredHints = [
    ...categoryHints,
    ...(relativePath ? relativePath.split(/[\\/]/g) : []),
    ...services,
    name,
    description,
  ]
    .join(' ')
    .toLowerCase()

  for (const [needle, category] of OFFICIAL_CATEGORY_MAP.entries()) {
    if (loweredHints.includes(needle)) {
      return category
    }
  }

  if (/(slack|discord|gmail|outlook|telegram|whatsapp|twilio|sms|email|teams)/.test(loweredHints)) {
    return 'Communication'
  }
  if (/(hubspot|salesforce|crm|lead|pipeline|deal)/.test(loweredHints)) {
    return 'Sales'
  }
  if (/(shopify|woocommerce|stripe|paypal|checkout|cart|commerce)/.test(loweredHints)) {
    return 'E-commerce'
  }
  if (/(postgres|mysql|snowflake|bigquery|airtable|sheets|database|analytics|csv|excel|sql|data)/.test(loweredHints)) {
    return 'Data'
  }
  if (/(github|gitlab|docker|kubernetes|aws|gcp|azure|terraform|deploy|incident|uptime|monitor)/.test(loweredHints)) {
    return 'DevOps'
  }
  if (/(notion|calendar|drive|docs|document|pdf|forms|todo|task|productivity)/.test(loweredHints)) {
    return 'Productivity'
  }
  if (/(support|ticket|zendesk|intercom|helpdesk)/.test(loweredHints)) {
    return 'Support'
  }
  if (/(content|seo|campaign|ads|newsletter|social|marketing)/.test(loweredHints)) {
    return 'Marketing'
  }
  if (/(agent|openai|anthropic|claude|gemini|llm|rag|vector|chatbot|langchain|perplexity|firecrawl)/.test(loweredHints)) {
    return 'AI'
  }

  return 'Other'
}

function detectComplexity(nodeCount) {
  if (nodeCount <= 5) return 'simple'
  if (nodeCount <= 12) return 'moderate'
  return 'complex'
}

function normalizeWorkflowForHash(workflow) {
  const clone = structuredClone(workflow)
  delete clone.id
  delete clone.versionId
  delete clone.active
  delete clone.pinData
  if (clone.meta && typeof clone.meta === 'object') {
    delete clone.meta.instanceId
    delete clone.meta.templateId
  }
  return clone
}

function createWorkflowHash(workflow) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(normalizeWorkflowForHash(workflow)))
    .digest('hex')
}

function buildTemplateRecord({
  id,
  source,
  name,
  description,
  category,
  tags,
  taskKeywords,
  requiredServices,
  triggers,
  workflow,
}) {
  return {
    id,
    source,
    name,
    description,
    category,
    tags,
    task_keywords: taskKeywords,
    required_services: requiredServices,
    triggers,
    complexity: detectComplexity(Array.isArray(workflow.nodes) ? workflow.nodes.length : 0),
    workflow,
  }
}

function buildIndexEntry(templateRecord) {
  return {
    id: templateRecord.id,
    name: templateRecord.name,
    description: templateRecord.description,
    category: templateRecord.category,
    tags: templateRecord.tags,
    task_keywords: templateRecord.task_keywords,
    required_services: templateRecord.required_services,
    complexity: templateRecord.complexity,
    file: `workflow-templates/${templateRecord.id}.json`,
  }
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length)
  let cursor = 0

  async function worker() {
    while (cursor < values.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await mapper(values[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker())
  )

  return results
}

async function fetchOfficialTemplates() {
  log('Fetching official n8n template index...')
  const firstPage = await fetchJson(`${OFFICIAL_SEARCH_URL}?rows=${OFFICIAL_PAGE_SIZE}&page=1`)
  const total = Number(firstPage.totalWorkflows || 0)
  const pages = Math.ceil(total / OFFICIAL_PAGE_SIZE)
  const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1)
  const searchPages = await mapLimit(pageNumbers, 6, async page => {
    if (page === 1) return firstPage
    return fetchJson(`${OFFICIAL_SEARCH_URL}?rows=${OFFICIAL_PAGE_SIZE}&page=${page}`)
  })

  const summaries = searchPages.flatMap(page => page.workflows || [])
  log(`Official index fetched: ${summaries.length} templates across ${pages} pages.`)

  const details = await mapLimit(summaries, OFFICIAL_CONCURRENCY, async (summary, index) => {
    if ((index + 1) % 250 === 0) {
      log(`Fetched ${index + 1}/${summaries.length} official template details...`)
    }
    try {
      const payload = await fetchJson(`${OFFICIAL_TEMPLATE_URL}/${summary.id}`)
      return {
        summary,
        detail: payload.workflow,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('404')) {
        return null
      }
      throw error
    }
  })

  return details.filter(Boolean).map(({ summary, detail }) => {
    const officialNodeMap = new Map(
      (detail.nodes || []).map(node => [node.name, node.displayName || humanizeNodeType(node.name)])
    )
    const workflow = detail.workflow
    const categories = (detail.categories || []).map(category => category.name)
    const services = extractServices(workflow.nodes || [], officialNodeMap)
    const triggers = extractTriggers(workflow.nodes || [], officialNodeMap)
    const description = summarizeDescription(detail.description || summary.description, detail.name)
    const tags = unique([
      ...categories,
      ...services,
      ...triggers,
      ...tokenize(`${detail.name} ${description}`).slice(0, 6),
    ]).slice(0, 14)

    return buildTemplateRecord({
      id: `official-${detail.id}`,
      source: {
        type: 'official',
        url: `${OFFICIAL_TEMPLATE_PAGE_URL}/${detail.id}`,
        template_id: detail.id,
      },
      name: detail.name,
      description,
      category: inferCategory({
        categoryHints: categories,
        name: detail.name,
        description,
        services,
      }),
      tags,
      taskKeywords: extractTaskKeywords(detail.name, description, services, triggers),
      requiredServices: services,
      triggers,
      workflow,
    })
  })
}

async function ensureEmptyOutputDir() {
  await rm(OUTPUT_DIR, { recursive: true, force: true })
  await mkdir(TEMPLATE_DIR, { recursive: true })
}

async function readJsonFile(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function listJsonFiles(rootDir) {
  const output = []
  const queue = [rootDir]

  while (queue.length > 0) {
    const current = queue.pop()
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(absolute)
        continue
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        output.push(absolute)
      }
    }
  }

  return output
}

function looksLikeWorkflow(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.nodes) &&
    data.nodes.length > 0 &&
    typeof data.connections === 'object'
  )
}

async function cloneRepo(repoDir, owner, repo) {
  const cloneUrl = `https://github.com/${owner}/${repo}.git`
  await execFileAsync('git', ['-c', 'core.longpaths=true', 'clone', '--depth', '1', cloneUrl, repoDir], {
    cwd: path.parse(ROOT_DIR).root,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  })
}

async function fetchGitHubTemplates() {
  const tempRoot = path.join(path.parse(ROOT_DIR).root, `dw-${Date.now()}`)
  await mkdir(tempRoot, { recursive: true })
  const templates = []

  try {
    for (const repoInfo of GITHUB_TEMPLATE_REPOS) {
      const repoDir = path.join(tempRoot, `${repoInfo.owner}-${repoInfo.repo}`)
      log(`Cloning ${repoInfo.owner}/${repoInfo.repo} (${repoInfo.stars} stars)...`)
      await cloneRepo(repoDir, repoInfo.owner, repoInfo.repo)

      const jsonFiles = await listJsonFiles(repoDir)
      log(`Scanning ${jsonFiles.length} JSON files in ${repoInfo.owner}/${repoInfo.repo}...`)

      for (const filePath of jsonFiles) {
        let data
        try {
          data = await readJsonFile(filePath)
        } catch {
          continue
        }

        if (!looksLikeWorkflow(data)) {
          continue
        }

        const relativePath = path.relative(repoDir, filePath)
        const nameFromFile = path.basename(filePath, '.json').replace(/[_-]+/g, ' ').trim()
        const name = String(data.name || nameFromFile || 'Untitled workflow').trim()
        const description = summarizeDescription(
          typeof data.description === 'string' ? data.description : '',
          `n8n workflow template from ${repoInfo.owner}/${repoInfo.repo}: ${name}`
        )
        const services = extractServices(data.nodes || [], new Map())
        const triggers = extractTriggers(data.nodes || [], new Map())
        const pathParts = relativePath
          .split(/[\\/]/g)
          .slice(0, -1)
          .map(part => part.replace(/[_-]+/g, ' ').trim())

        const tags = unique([
          ...(Array.isArray(data.tags) ? data.tags.map(tag => String(tag)) : []),
          ...pathParts,
          ...services,
          ...triggers,
          ...tokenize(`${name} ${description}`).slice(0, 6),
        ]).slice(0, 14)

        const slugBase = `${repoInfo.owner}-${repoInfo.repo}-${relativePath.replace(/\\/g, '-')}`
        const idHash = crypto.createHash('sha1').update(slugBase).digest('hex').slice(0, 10)

        templates.push(
          buildTemplateRecord({
            id: `${slugify(repoInfo.repo)}-${slugify(name).slice(0, 80)}-${idHash}`,
            source: {
              type: 'github',
              repository: `${repoInfo.owner}/${repoInfo.repo}`,
              repository_stars: repoInfo.stars,
              path: relativePath.replace(/\\/g, '/'),
              url: `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/main/${relativePath.replace(/\\/g, '/')}`,
            },
            name,
            description,
            category: inferCategory({
              categoryHints: pathParts,
              name,
              description,
              services,
              relativePath,
            }),
            tags,
            taskKeywords: extractTaskKeywords(name, description, services, triggers),
            requiredServices: services,
            triggers,
            workflow: data,
          })
        )
      }
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }

  return templates
}

function dedupeTemplates(templates) {
  const seenHashes = new Map()
  const kept = []
  const duplicates = []

  for (const template of templates) {
    const hash = createWorkflowHash(template.workflow)
    const existing = seenHashes.get(hash)
    if (!existing) {
      seenHashes.set(hash, template.id)
      kept.push(template)
      continue
    }

    duplicates.push({ duplicate: template.id, existing })
  }

  return { kept, duplicates }
}

async function writeBundle(templates) {
  await ensureEmptyOutputDir()

  const sortedTemplates = templates
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))

  const index = sortedTemplates.map(buildIndexEntry)
  const byCategory = {}

  for (const entry of index) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = []
    }
    byCategory[entry.category].push(entry)
  }

  for (const [category, entries] of Object.entries(byCategory)) {
    entries.sort((left, right) => left.name.localeCompare(right.name))
    byCategory[category] = entries
  }

  await writeFile(
    path.join(OUTPUT_DIR, 'workflows-index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    'utf8'
  )
  await writeFile(
    path.join(OUTPUT_DIR, 'workflows-by-category.json'),
    `${JSON.stringify(byCategory, null, 2)}\n`,
    'utf8'
  )

  await mapLimit(sortedTemplates, 24, async template => {
    const outputPath = path.join(TEMPLATE_DIR, `${template.id}.json`)
    await writeFile(outputPath, `${JSON.stringify(template, null, 2)}\n`, 'utf8')
  })
}

async function main() {
  const startedAt = Date.now()

  const officialTemplates = await fetchOfficialTemplates()
  log(`Official templates normalized: ${officialTemplates.length}`)

  const githubTemplates = await fetchGitHubTemplates()
  log(`GitHub workflow candidates normalized: ${githubTemplates.length}`)

  const dedupedOfficial = dedupeTemplates(officialTemplates)
  const officialHashes = new Set(dedupedOfficial.kept.map(template => createWorkflowHash(template.workflow)))
  const githubUnique = githubTemplates.filter(template => !officialHashes.has(createWorkflowHash(template.workflow)))
  const dedupedGithub = dedupeTemplates(githubUnique)
  const allTemplates = [...dedupedOfficial.kept, ...dedupedGithub.kept]

  await writeBundle(allTemplates)

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  log(
    [
      `Bundle written to ${path.relative(ROOT_DIR, OUTPUT_DIR)}`,
      `official=${dedupedOfficial.kept.length}`,
      `github_extra=${dedupedGithub.kept.length}`,
      `total=${allTemplates.length}`,
      `elapsed=${elapsedSeconds}s`,
    ].join(' | ')
  )
}

main().catch(async error => {
  console.error(error)
  process.exitCode = 1
})
