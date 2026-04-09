import canonicalModelsRaw from '../../model_registry/canonical_models.ndjson?raw'
import providerMappingsRaw from '../../model_registry/provider_mappings.ndjson?raw'
import type { Provider } from '../types'
import { decryptStoredKey } from './encryption'
import { completeText } from './streamChat'
import {
  ACCESS_PROVIDER_BY_APP_PROVIDER_ID,
  APP_PROVIDER_ID_BY_ACCESS_PROVIDER,
  getProviderCatalogEntry,
} from './providerCatalog'

type CanonicalTaskScore = {
  score: number | null
  rank: number | null
  confidence: number | null
  evidence_count: number
  last_reviewed_at: string | null
  source_ids: string[]
}

type CanonicalCapabilitiesRecord = Record<string, boolean>

type RawCanonicalModel = {
  model_uid: string
  canonical_owner: string
  family_name: string
  variant_name: string
  normalized_slug: string
  modalities?: string[]
  capabilities?: CanonicalCapabilitiesRecord
  task_scores?: Record<string, CanonicalTaskScore>
  strength_tags?: string[]
  status?: string
  router_hints?: {
    latency_tier?: string | null
    cost_tier?: string | null
    preferred_for?: string[]
    avoid_for?: string[]
    fallback_model_uids?: string[]
  }
}

type RawProviderMapping = {
  model_uid: string
  access_provider: string
  provider_model_id: string
  provider_model_label: string
  api_compatibility: string
  available: boolean
  context_window: number | null
  max_output_tokens: number | null
  pricing?: Record<string, number | string | null>
}

export interface CanonicalModel {
  model_uid: string
  canonical_owner: string
  family_name: string
  variant_name: string
  normalized_slug: string
  capabilities: string[]
  modalities: string[]
  task_scores: Record<string, CanonicalTaskScore>
  strength_tags: string[]
  status: string
  router_hints: {
    latency_tier?: string | null
    cost_tier?: string | null
    preferred_for?: string[]
    avoid_for?: string[]
    fallback_model_uids?: string[]
  }
}

export interface ProviderMapping {
  model_uid: string
  access_provider: string
  provider_model_id: string
  provider_model_label: string
  api_compatibility: string
  available: boolean
  context_window: number | null
  max_output_tokens: number | null
  pricing: Record<string, number | string | null>
}

const STORAGE_KEY = 'drodo_provider_configs'
const USER_CAPABILITY_TAGS_KEY = 'drodo_model_capability_tags'

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  coding: ['code', 'coding', 'implement', 'debug', 'fix', 'test', 'typescript', 'javascript', 'python', 'react', 'refactor', 'build'],
  reasoning: ['reason', 'logic', 'tradeoff', 'decision', 'architecture', 'plan', 'diagnose', 'evaluate'],
  research: ['research', 'investigate', 'compare', 'source', 'study', 'survey', 'analyze'],
  creative_writing: ['write', 'copy', 'creative', 'story', 'brand', 'headline', 'blog', 'content'],
  tool_use: ['tool', 'function', 'call', 'api', 'automation', 'workflow', 'integrate', 'connector'],
  agentic: ['agent', 'swarm', 'orchestrate', 'orchestration', 'delegate', 'multi-agent'],
  vision: ['image', 'vision', 'screenshot', 'ocr', 'photo', 'diagram'],
  multimodal: ['video', 'audio', 'voice', 'image', 'multimodal', 'transcribe'],
  long_context: ['long context', 'large context', 'huge file', 'entire repo', 'whole repository', 'many files'],
  document_extraction: ['extract', 'document', 'pdf', 'receipt', 'invoice', 'table', 'form'],
  research_heavy: ['benchmark', 'sources', 'citations'],
  math: ['math', 'equation', 'calculate', 'proof', 'algebra'],
  general_chat: ['chat', 'answer', 'help'],
}

const CAPABILITY_ALIASES: Record<string, string[]> = {
  tool_use: ['tool_calling', 'function_calling', 'agent_orchestration'],
  agentic: ['agent_orchestration', 'tool_calling', 'function_calling'],
  vision: ['image_input', 'vision_understanding'],
  multimodal: ['image_input', 'audio_input', 'video_input', 'vision_understanding'],
  document_extraction: ['document_extraction'],
  coding: ['code_generation'],
  reasoning: ['reasoning'],
}

const canonicalModelByUid = new Map<string, CanonicalModel>()
const canonicalModelBySlug = new Map<string, CanonicalModel>()
const providerMappingsByUid = new Map<string, ProviderMapping[]>()
const canonicalModelByProviderModelId = new Map<string, CanonicalModel>()

function parseNdjson<T>(raw: string): T[] {
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line) as T)
}

function normalizeCanonicalModel(raw: RawCanonicalModel): CanonicalModel {
  const capabilities = Object.entries(raw.capabilities ?? {})
    .filter(([, enabled]) => enabled)
    .map(([capability]) => capability)

  return {
    model_uid: raw.model_uid,
    canonical_owner: raw.canonical_owner,
    family_name: raw.family_name,
    variant_name: raw.variant_name,
    normalized_slug: raw.normalized_slug,
    capabilities,
    modalities: raw.modalities ?? [],
    task_scores: raw.task_scores ?? {},
    strength_tags: raw.strength_tags ?? [],
    status: raw.status ?? 'active',
    router_hints: raw.router_hints ?? {},
  }
}

function normalizeProviderMapping(raw: RawProviderMapping): ProviderMapping {
  return {
    model_uid: raw.model_uid,
    access_provider: raw.access_provider,
    provider_model_id: raw.provider_model_id,
    provider_model_label: raw.provider_model_label,
    api_compatibility: raw.api_compatibility,
    available: raw.available,
    context_window: raw.context_window ?? null,
    max_output_tokens: raw.max_output_tokens ?? null,
    pricing: raw.pricing ?? {},
  }
}

for (const rawModel of parseNdjson<RawCanonicalModel>(canonicalModelsRaw)) {
  const model = normalizeCanonicalModel(rawModel)
  canonicalModelByUid.set(model.model_uid, model)
  canonicalModelBySlug.set(model.normalized_slug, model)
}

for (const rawMapping of parseNdjson<RawProviderMapping>(providerMappingsRaw)) {
  const mapping = normalizeProviderMapping(rawMapping)
  const list = providerMappingsByUid.get(mapping.model_uid) ?? []
  list.push(mapping)
  providerMappingsByUid.set(mapping.model_uid, list)

  const model = canonicalModelByUid.get(mapping.model_uid)
  if (model && !canonicalModelByProviderModelId.has(mapping.provider_model_id.toLowerCase())) {
    canonicalModelByProviderModelId.set(mapping.provider_model_id.toLowerCase(), model)
  }
}

function getStoredProviderConfigs(): Record<string, { apiKey?: string; baseUrl?: string; model?: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { apiKey?: string; baseUrl?: string; model?: string }>
    return Object.fromEntries(
      Object.entries(parsed).map(([providerId, config]) => [
        providerId,
        {
          ...config,
          apiKey: decryptStoredKey(config.apiKey ?? ''),
        },
      ]),
    )
  } catch {
    return {}
  }
}

function getUserCapabilityTags(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(USER_CAPABILITY_TAGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string[]>
    return Object.fromEntries(
      Object.entries(parsed).map(([providerModelId, tags]) => [
        providerModelId.toLowerCase(),
        Array.from(new Set((tags ?? []).map(tag => tag.trim().toLowerCase()).filter(Boolean))),
      ]),
    )
  } catch {
    return {}
  }
}

function setUserCapabilityTags(tags: Record<string, string[]>): void {
  localStorage.setItem(USER_CAPABILITY_TAGS_KEY, JSON.stringify(tags))
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 2)
}

function determineRequiredCapabilities(task: string, domains: string[]): string[] {
  const lowerTask = task.toLowerCase()
  const required = new Set<string>(['text_input', 'text_output'])

  if (domains.includes('tool_use') || domains.includes('agentic')) required.add('tool_use')
  if (domains.includes('coding')) required.add('coding')
  if (domains.includes('reasoning')) required.add('reasoning')
  if (domains.includes('vision') || /\b(image|vision|screenshot|photo|ocr)\b/.test(lowerTask)) required.add('vision')
  if (domains.includes('multimodal') || /\b(audio|voice|video)\b/.test(lowerTask)) required.add('multimodal')
  if (domains.includes('document_extraction') || /\b(pdf|document|receipt|invoice|extract)\b/.test(lowerTask)) {
    required.add('document_extraction')
  }

  return [...required]
}

function modelSupportsCapabilities(model: CanonicalModel, requiredCapabilities: string[]): boolean {
  const modelCapabilities = new Set(model.capabilities)
  return requiredCapabilities.every(capability => {
    const aliases = CAPABILITY_ALIASES[capability] ?? [capability]
    return aliases.some(alias => modelCapabilities.has(alias))
  })
}

function getModelDomainScore(model: CanonicalModel, domains: string[]): number {
  const scores = domains
    .map(domain => model.task_scores[domain]?.score ?? null)
    .filter((score): score is number => typeof score === 'number' && score > 0)

  if (scores.length === 0) return 0
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function getModelDomainConfidence(model: CanonicalModel, domains: string[]): number {
  const confidences = domains
    .map(domain => model.task_scores[domain]?.confidence ?? null)
    .filter((confidence): confidence is number => typeof confidence === 'number' && confidence > 0)

  if (confidences.length === 0) return 0
  return confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
}

function getTaskProviderBoost(model: CanonicalModel, mapping: ProviderMapping, domains: string[]): number {
  const userTags = getUserCapabilityTags()[mapping.provider_model_id.toLowerCase()] ?? []
  let boost = 0

  for (const domain of domains) {
    if (userTags.includes(domain)) boost += 10
  }

  for (const preferred of model.router_hints.preferred_for ?? []) {
    const preferredTokens = tokenize(preferred)
    if (preferredTokens.some(token => domains.includes(token) || userTags.includes(token))) {
      boost += 4
    }
  }

  const latencyTier = model.router_hints.latency_tier
  if (latencyTier === 'fast') boost += 3
  if (latencyTier === 'medium') boost += 1

  const costTier = model.router_hints.cost_tier
  if (costTier === 'low') boost += 2
  if (costTier === 'medium') boost += 1

  if (mapping.available) boost += 6
  if (mapping.context_window && domains.includes('long_context')) {
    boost += Math.min(8, mapping.context_window / 32000)
  }

  return boost
}

function buildProviderFromMapping(mapping: ProviderMapping, fallbackProvider: Provider): Provider | null {
  const providerId = APP_PROVIDER_ID_BY_ACCESS_PROVIDER[mapping.access_provider]
  if (!providerId) return null

  const base = getProviderCatalogEntry(providerId)
  if (!base) return null

  const savedConfig = getStoredProviderConfigs()[providerId]
  const provider = {
    ...base,
    baseUrl: savedConfig?.baseUrl || base.baseUrl,
    apiKey: savedConfig?.apiKey || (fallbackProvider.id === providerId ? fallbackProvider.apiKey : ''),
    model: mapping.provider_model_id,
    isConnected: base.isLocal || !!savedConfig?.apiKey || !!(fallbackProvider.id === providerId && fallbackProvider.apiKey),
  }

  if (!provider.isConnected && !provider.isLocal && provider.id !== fallbackProvider.id) {
    return null
  }

  return provider
}

export function classifyTask(task: string): string[] {
  const lowerTask = task.toLowerCase()
  const domains = new Set<string>()

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(keyword => lowerTask.includes(keyword))) {
      domains.add(domain === 'research_heavy' ? 'research' : domain)
    }
  }

  if (/\b(pdf|document|receipt|invoice|form|spreadsheet)\b/.test(lowerTask)) domains.add('document_extraction')
  if (/\b(image|vision|ocr|photo|diagram)\b/.test(lowerTask)) domains.add('vision')
  if (/\b(audio|voice|video|transcribe)\b/.test(lowerTask)) domains.add('multimodal')
  if (/\b(math|equation|calculate|proof)\b/.test(lowerTask)) domains.add('math')
  if (domains.size === 0) domains.add('general_chat')

  return [...domains]
}

export function filterModelsByCapability(domains: string[], requiredCapabilities: string[]): CanonicalModel[] {
  return [...canonicalModelByUid.values()]
    .filter(model => model.status === 'active')
    .filter(model => modelSupportsCapabilities(model, requiredCapabilities))
    .filter(model => getModelDomainScore(model, domains) > 0)
}

export function rankModelsForTask(task: string, userProviderIds: string[]): ProviderMapping[] {
  const domains = classifyTask(task)
  const requiredCapabilities = determineRequiredCapabilities(task, domains)
  const allowedAccessProviders = new Set(
    userProviderIds.flatMap(providerId => ACCESS_PROVIDER_BY_APP_PROVIDER_ID[providerId] ?? []),
  )

  const filteredModels = filterModelsByCapability(domains, requiredCapabilities)
  const joined = filteredModels.flatMap(model =>
    (providerMappingsByUid.get(model.model_uid) ?? [])
      .map(mapping => ({ model, mapping })),
  )

  const scoped = joined.filter(({ mapping }) => (
    allowedAccessProviders.size === 0 || allowedAccessProviders.has(mapping.access_provider)
  ))

  const candidates = scoped.length > 0 ? scoped : joined

  return candidates
    .sort((left, right) => {
      const leftScore = getModelDomainScore(left.model, domains) + getTaskProviderBoost(left.model, left.mapping, domains) + getModelDomainConfidence(left.model, domains) * 10
      const rightScore = getModelDomainScore(right.model, domains) + getTaskProviderBoost(right.model, right.mapping, domains) + getModelDomainConfidence(right.model, domains) * 10

      return (
        rightScore - leftScore ||
        (right.mapping.context_window ?? 0) - (left.mapping.context_window ?? 0) ||
        (right.mapping.max_output_tokens ?? 0) - (left.mapping.max_output_tokens ?? 0) ||
        left.mapping.provider_model_id.localeCompare(right.mapping.provider_model_id)
      )
    })
    .map(entry => entry.mapping)
}

export function getBestModelForTask(task: string, userProviderIds: string[], fallbackProvider: Provider): Provider {
  const rankedMappings = rankModelsForTask(task, userProviderIds)

  for (const mapping of rankedMappings) {
    const provider = buildProviderFromMapping(mapping, fallbackProvider)
    if (provider) return provider
  }

  return fallbackProvider
}

export function getModelByProviderModelId(providerModelId: string): CanonicalModel | null {
  return canonicalModelByProviderModelId.get(providerModelId.toLowerCase()) ?? null
}

export function addUserCapabilityTag(providerModelId: string, tag: string): void {
  const normalizedProviderModelId = providerModelId.trim().toLowerCase()
  const normalizedTag = tag.trim().toLowerCase()
  if (!normalizedProviderModelId || !normalizedTag) return

  const next = getUserCapabilityTags()
  const tags = new Set(next[normalizedProviderModelId] ?? [])
  tags.add(normalizedTag)
  next[normalizedProviderModelId] = [...tags]
  setUserCapabilityTags(next)
}

export async function autoTagModel(providerModelId: string, provider: Provider): Promise<void> {
  if (!providerModelId.trim()) return
  if (!provider.isLocal && !provider.apiKey) return

  const benchmarkProvider: Provider = {
    ...provider,
    model: providerModelId,
  }

  const prompt = [
    'Return one short response that does all of the following:',
    '1. Solve 19 * 23.',
    '2. Provide a JavaScript function named sumPairs that adds two numbers.',
    '3. Return a JSON object with a key "tool_plan" and an array value of two short steps.',
    '4. Finish with one vivid sentence selling a new productivity app.',
  ].join('\n')

  try {
    const response = await completeText(benchmarkProvider, [
      {
        id: `system-autotag-${Date.now()}`,
        role: 'system',
        content: 'You are being evaluated for routing. Respond directly and compactly.',
        timestamp: new Date(),
      },
      {
        id: `user-autotag-${Date.now()}`,
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      },
    ])

    const lower = response.toLowerCase()
    const detectedTags = new Set<string>()

    if (/\b437\b/.test(lower) || /19\s*\*\s*23/.test(prompt)) detectedTags.add('reasoning')
    if (/function\s+sumPairs|const\s+sumPairs|=>/.test(response)) detectedTags.add('coding')
    if (/"tool_plan"\s*:/.test(response)) detectedTags.add('tool_use')
    if (/[.!?].*[a-z]{4,}/i.test(response) && /\bapp\b/.test(lower)) detectedTags.add('creative_writing')

    const strongestTag = [...detectedTags][0] ?? 'general_chat'
    addUserCapabilityTag(providerModelId, strongestTag)
  } catch {
    // Auto-tagging should never block the UI or saving provider state.
  }
}
