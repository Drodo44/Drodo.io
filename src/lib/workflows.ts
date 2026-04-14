import { fetchCatalogJson } from './catalogAssets'

export interface WorkflowIndex {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  task_keywords: string[]
  required_services: string[]
  complexity: 'simple' | 'moderate' | 'complex'
  file: string
}

export interface WorkflowMatch {
  workflow: WorkflowIndex
  confidence: number
  filePath: string
}

type RankedWorkflow = WorkflowIndex & {
  searchText: string
  tokenSet: Set<string>
  tagSet: Set<string>
  serviceSet: Set<string>
  keywordPhrases: string[]
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'build', 'by', 'for', 'from', 'how', 'in', 'into',
  'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'use', 'using', 'with', 'your',
])

let workflowCatalogPromise: Promise<WorkflowIndex[]> | null = null
let workflowIndexSnapshot: WorkflowIndex[] = []
let rankedWorkflowsSnapshot: RankedWorkflow[] = []
const templateCache = new Map<string, Promise<object | null>>()

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter(token => token.length > 2 && !STOP_WORDS.has(token))
}

function setOverlap(queryTokens: Set<string>, candidateTokens: Set<string>): number {
  if (queryTokens.size === 0 || candidateTokens.size === 0) {
    return 0
  }

  let matches = 0
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      matches += 1
    }
  }

  return matches / Math.max(queryTokens.size, 1)
}

function phraseScore(query: string, phrases: string[]): number {
  let best = 0
  for (const phrase of phrases) {
    if (!phrase) continue
    if (query.includes(phrase)) {
      best = Math.max(best, Math.min(0.72, 0.45 + phrase.split(' ').length * 0.08))
      continue
    }

    const phraseTokens = new Set(tokenize(phrase))
    const queryTokens = new Set(tokenize(query))
    best = Math.max(best, setOverlap(queryTokens, phraseTokens) * 0.45)
  }
  return best
}

function scoreWorkflow(query: string, workflow: RankedWorkflow): number {
  const normalizedQuery = normalizeText(query)
  const queryTokens = new Set(tokenize(query))

  if (!normalizedQuery || queryTokens.size === 0) {
    return 0
  }

  const keywordScore = phraseScore(normalizedQuery, workflow.keywordPhrases)
  const nameScore = normalizedQuery.includes(normalizeText(workflow.name))
    ? 0.7
    : setOverlap(queryTokens, new Set(tokenize(workflow.name))) * 0.55
  const tokenScore = setOverlap(queryTokens, workflow.tokenSet) * 0.5
  const serviceScore = setOverlap(queryTokens, workflow.serviceSet) * 0.32
  const tagScore = setOverlap(queryTokens, workflow.tagSet) * 0.18
  const categoryScore = normalizedQuery.includes(normalizeText(workflow.category)) ? 0.12 : 0

  const score = Math.min(1, keywordScore + nameScore + tokenScore + serviceScore + tagScore + categoryScore)
  return Number(score.toFixed(4))
}

function buildRankedWorkflows(index: WorkflowIndex[]): RankedWorkflow[] {
  return index.map(workflow => {
    const tokenSet = new Set(tokenize([
      workflow.name,
      workflow.description,
      workflow.category,
      workflow.tags.join(' '),
      workflow.task_keywords.join(' '),
      workflow.required_services.join(' '),
    ].join(' ')))

    return {
      ...workflow,
      searchText: normalizeText([
        workflow.name,
        workflow.description,
        workflow.category,
        workflow.tags.join(' '),
        workflow.task_keywords.join(' '),
        workflow.required_services.join(' '),
      ].join(' ')),
      tokenSet,
      tagSet: new Set(workflow.tags.map(normalizeText).filter(Boolean)),
      serviceSet: new Set(workflow.required_services.map(normalizeText).filter(Boolean)),
      keywordPhrases: workflow.task_keywords.map(normalizeText).filter(Boolean),
    }
  })
}

function getWorkflowIndex(): WorkflowIndex[] {
  return workflowIndexSnapshot
}

function getRankedWorkflows(): RankedWorkflow[] {
  return rankedWorkflowsSnapshot
}

function getTemplatePath(id: string): string | null {
  const workflow = getWorkflowIndex().find(entry => entry.id === id)
  if (!workflow) {
    return null
  }
  return `workflows/${workflow.file}`
}

export async function ensureWorkflowCatalogLoaded(): Promise<void> {
  if (!workflowCatalogPromise) {
    workflowCatalogPromise = (async () => {
      const index = await fetchCatalogJson<WorkflowIndex[]>('workflows/workflows-index.json')
      workflowIndexSnapshot = index
      rankedWorkflowsSnapshot = buildRankedWorkflows(index)
      return index
    })()
  }

  await workflowCatalogPromise
}

export function findWorkflowForTask(task: string): WorkflowMatch | null {
  const ranked = getRankedWorkflows()
    .map(workflow => ({
      workflow,
      confidence: scoreWorkflow(task, workflow),
    }))
    .filter(result => result.confidence > 0.18)
    .sort((left, right) => right.confidence - left.confidence)

  const best = ranked[0]
  if (!best) {
    return null
  }

  return {
    workflow: best.workflow,
    confidence: best.confidence,
    filePath: best.workflow.file,
  }
}

export async function getWorkflowTemplate(id: string): Promise<object | null> {
  const templatePath = getTemplatePath(id)
  if (!templatePath) {
    return null
  }

  if (!templateCache.has(id)) {
    templateCache.set(id, fetchCatalogJson<object>(templatePath).then(record => {
      if (
        record &&
        typeof record === 'object' &&
        'workflow' in record &&
        (record as { workflow?: object }).workflow
      ) {
        return (record as { workflow: object }).workflow
      }
      return record
    }).catch(() => null))
  }

  return templateCache.get(id) as Promise<object | null>
}

export function getWorkflowCategories(): string[] {
  return [...new Set(getWorkflowIndex().map(workflow => workflow.category))].sort((left, right) => left.localeCompare(right))
}

export function getWorkflowCount(): number {
  return getWorkflowIndex().length
}

export function searchWorkflows(query: string): WorkflowIndex[] {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return getWorkflowIndex().slice()
  }

  return getRankedWorkflows()
    .map(workflow => ({
      workflow,
      score: scoreWorkflow(trimmedQuery, workflow),
    }))
    .filter(result => result.score > 0.08)
    .sort((left, right) => right.score - left.score || left.workflow.name.localeCompare(right.workflow.name))
    .map(result => result.workflow)
}
