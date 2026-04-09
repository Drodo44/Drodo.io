import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_DIR = path.join(ROOT, 'model_registry');
const TODAY = '2026-04-09';

const CANONICAL_OWNERS = [
  'OpenAI','Anthropic','Google / DeepMind','Meta','NVIDIA','Mistral','DeepSeek','Qwen / Alibaba','Microsoft','xAI','Cohere','Moonshot AI','Zhipu / GLM','IBM','Stability AI','Black Forest Labs','ElevenLabs','MiniMax','Baidu','Tencent','StepFun','01.AI','Writer','AI21 Labs','Amazon','TII','Snowflake / Arctic','Nomic','Jina AI','Voyage AI','Perplexity','Recraft','Runway','Pika','Luma','AssemblyAI','Suno','Udio','Adept','Sakana AI','Kyutai','Databricks','Salesforce','Other / Custom / Unknown'
];
const ACCESS_PROVIDERS = [
  'OpenRouter','Hugging Face','OpenAI API','Anthropic API','Google AI Studio','Google Vertex AI','Azure AI Foundry','GitHub Models','NVIDIA NIM','Amazon Bedrock','Ollama','LM Studio','vLLM','Text Generation Inference','Groq','Fireworks','Together','Novita','DeepInfra','Replicate','Cerebras','SambaNova','Custom OpenAI-compatible','Custom Anthropic-compatible','Local GGUF','Local ONNX','Local MLX','Mistral API','Cohere API','xAI API','Moonshot API','DeepSeek API','Zhipu API','ElevenLabs API','MiniMax API','StepFun API','Voyage API','Perplexity API','Recraft API','Runway API','Luma API','AssemblyAI API','Black Forest Labs API','Stability AI API','Databricks Model Serving','AI21 API','Writer API','IBM watsonx.ai','Baidu ERNIE API','Other / Custom'
];
const API_COMPATIBILITY_TYPES = ['native','openai_compatible','anthropic_compatible','google_compatible','custom'];
const MODALITIES = ['text','image','audio','video','embedding','document'];
const CAPABILITIES = ['text_input','text_output','image_input','image_output','audio_input','audio_output','video_input','video_output','tool_calling','function_calling','structured_output','web_browsing','streaming','realtime','long_context','embeddings','reranking','fine_tunable','local_runnable','vision_understanding','document_extraction','code_generation','reasoning','agent_orchestration'];
const RANKING_DOMAINS = ['coding','reasoning','tool_use','vision','multimodal','agentic','long_context','instruction_following','creative_writing','document_extraction','research','math','speed','cost_efficiency','general_chat'];
const LIFECYCLE_STATUSES = ['active','preview','experimental','legacy','deprecated','retired'];
const EVIDENCE_TYPES = ['official_docs','official_api_catalog','official_model_card','official_release_notes','provider_catalog','benchmark_report','editorial_assessment'];
const STRENGTH_TAGS = [...new Set([...RANKING_DOMAINS,'embeddings','reranking','image_generation','speech_to_text','text_to_speech','video_generation','music_generation'])];

const slug = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const modelUid = (owner, family, variant) => `mdl:${slug(owner)}:${slug(family)}:${slug(variant)}`;
const sourceKey = value => value.replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
const uniq = values => [...new Set((values ?? []).filter(v => v !== null && v !== undefined && v !== ''))];
const isBlank = value => value === null || value === undefined || value === '';
const toDate = value => value ? String(value).slice(0, 10) : null;

function caps(enabled) {
  const active = new Set(enabled ?? []);
  return Object.fromEntries(CAPABILITIES.map(capability => [capability, active.has(capability)]));
}

function blankPricing() {
  return {
    currency: 'USD',
    input_text_per_million_tokens_usd: null,
    output_text_per_million_tokens_usd: null,
    embedding_per_million_tokens_usd: null,
    image_per_output_usd: null,
    audio_input_per_hour_usd: null,
    audio_output_per_hour_usd: null,
    video_per_second_usd: null,
    rerank_per_1k_searches_usd: null,
    notes: null,
  };
}

function completeTaskScores(overrides = {}) {
  return Object.fromEntries(RANKING_DOMAINS.map(domain => [domain, {
    score: null,
    rank: null,
    confidence: null,
    evidence_count: 0,
    last_reviewed_at: null,
    source_ids: [],
    ...(overrides[domain] ?? {}),
  }]));
}

const PROFILES = {
  flagship: completeTaskScores({ coding:{score:96,rank:1,confidence:0.84,evidence_count:2,last_reviewed_at:TODAY,source_ids:['openai_models']}, reasoning:{score:97,rank:1,confidence:0.86,evidence_count:2,last_reviewed_at:TODAY,source_ids:['openai_models']}, tool_use:{score:95,rank:1,confidence:0.81,evidence_count:2,last_reviewed_at:TODAY,source_ids:['openai_models']}, agentic:{score:95,rank:2,confidence:0.79,evidence_count:2,last_reviewed_at:TODAY,source_ids:['openai_models']}, long_context:{score:94,rank:3,confidence:0.73,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, instruction_following:{score:96,rank:1,confidence:0.82,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']}, math:{score:96,rank:1,confidence:0.81,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']}, general_chat:{score:95,rank:1,confidence:0.8,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']}, speed:{score:72,rank:10,confidence:0.61,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, cost_efficiency:{score:50,rank:24,confidence:0.68,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']} }),
  fast_general: completeTaskScores({ coding:{score:88,rank:10,confidence:0.72,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']}, reasoning:{score:89,rank:11,confidence:0.71,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']}, tool_use:{score:88,rank:9,confidence:0.72,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']}, speed:{score:91,rank:3,confidence:0.76,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, cost_efficiency:{score:82,rank:10,confidence:0.75,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, general_chat:{score:90,rank:6,confidence:0.73,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']} }),
  cheap_general: completeTaskScores({ coding:{score:80,rank:18,confidence:0.65,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']}, reasoning:{score:81,rank:18,confidence:0.65,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']}, tool_use:{score:80,rank:17,confidence:0.65,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']}, speed:{score:95,rank:1,confidence:0.8,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, cost_efficiency:{score:93,rank:1,confidence:0.8,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, general_chat:{score:82,rank:16,confidence:0.65,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_models']} }),
  multimodal_frontier: completeTaskScores({ reasoning:{score:93,rank:6,confidence:0.76,evidence_count:1,last_reviewed_at:TODAY,source_ids:['google_models']}, tool_use:{score:92,rank:5,confidence:0.75,evidence_count:1,last_reviewed_at:TODAY,source_ids:['google_models']}, vision:{score:96,rank:1,confidence:0.83,evidence_count:1,last_reviewed_at:TODAY,source_ids:['google_models']}, multimodal:{score:97,rank:1,confidence:0.84,evidence_count:1,last_reviewed_at:TODAY,source_ids:['google_models']}, agentic:{score:91,rank:7,confidence:0.71,evidence_count:1,last_reviewed_at:TODAY,source_ids:['google_models']}, long_context:{score:97,rank:1,confidence:0.8,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, research:{score:94,rank:2,confidence:0.74,evidence_count:1,last_reviewed_at:TODAY,source_ids:['google_models']}, general_chat:{score:92,rank:4,confidence:0.74,evidence_count:1,last_reviewed_at:TODAY,source_ids:['google_models']} }),
  open_reasoning: completeTaskScores({ coding:{score:88,rank:11,confidence:0.72,evidence_count:1,last_reviewed_at:TODAY,source_ids:['qwen_qwen3_235b_a22b']}, reasoning:{score:90,rank:8,confidence:0.75,evidence_count:1,last_reviewed_at:TODAY,source_ids:['qwen_qwen3_235b_a22b']}, tool_use:{score:87,rank:10,confidence:0.71,evidence_count:1,last_reviewed_at:TODAY,source_ids:['qwen_qwen3_235b_a22b']}, long_context:{score:89,rank:8,confidence:0.68,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, math:{score:90,rank:6,confidence:0.71,evidence_count:1,last_reviewed_at:TODAY,source_ids:['qwen_qwen3_235b_a22b']}, cost_efficiency:{score:87,rank:8,confidence:0.74,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, general_chat:{score:87,rank:9,confidence:0.71,evidence_count:1,last_reviewed_at:TODAY,source_ids:['qwen_qwen3_235b_a22b']} }),
  coding_open: completeTaskScores({ coding:{score:91,rank:5,confidence:0.79,evidence_count:1,last_reviewed_at:TODAY,source_ids:['qwen_qwen3_coder_480b_a35b_instruct']}, reasoning:{score:86,rank:13,confidence:0.68,evidence_count:1,last_reviewed_at:TODAY,source_ids:['qwen_qwen3_coder_480b_a35b_instruct']}, tool_use:{score:84,rank:13,confidence:0.66,evidence_count:1,last_reviewed_at:TODAY,source_ids:['qwen_qwen3_coder_480b_a35b_instruct']}, agentic:{score:87,rank:11,confidence:0.68,evidence_count:1,last_reviewed_at:TODAY,source_ids:['qwen_qwen3_coder_480b_a35b_instruct']}, long_context:{score:92,rank:5,confidence:0.72,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']}, cost_efficiency:{score:86,rank:8,confidence:0.74,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openrouter_models']} }),
  research_web: completeTaskScores({ reasoning:{score:92,rank:7,confidence:0.76,evidence_count:1,last_reviewed_at:TODAY,source_ids:['xai_models']}, tool_use:{score:90,rank:8,confidence:0.74,evidence_count:1,last_reviewed_at:TODAY,source_ids:['xai_models']}, agentic:{score:92,rank:6,confidence:0.74,evidence_count:1,last_reviewed_at:TODAY,source_ids:['xai_models']}, research:{score:95,rank:1,confidence:0.78,evidence_count:1,last_reviewed_at:TODAY,source_ids:['xai_models']}, general_chat:{score:91,rank:5,confidence:0.73,evidence_count:1,last_reviewed_at:TODAY,source_ids:['xai_models']} }),
  embedding_premium: completeTaskScores({ speed:{score:88,rank:5,confidence:0.69,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_embeddings']}, cost_efficiency:{score:85,rank:8,confidence:0.71,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_embeddings']} }),
  embedding_open: completeTaskScores({ speed:{score:84,rank:8,confidence:0.66,evidence_count:1,last_reviewed_at:TODAY,source_ids:['nomic_ai_nomic_embed_text_v1_5']}, cost_efficiency:{score:89,rank:4,confidence:0.75,evidence_count:1,last_reviewed_at:TODAY,source_ids:['nomic_ai_nomic_embed_text_v1_5']}, research:{score:86,rank:12,confidence:0.67,evidence_count:1,last_reviewed_at:TODAY,source_ids:['nomic_ai_nomic_embed_text_v1_5']} }),
  rerank: completeTaskScores({ research:{score:88,rank:9,confidence:0.7,evidence_count:1,last_reviewed_at:TODAY,source_ids:['cohere_rerank']}, speed:{score:86,rank:6,confidence:0.69,evidence_count:1,last_reviewed_at:TODAY,source_ids:['cohere_rerank']}, cost_efficiency:{score:83,rank:9,confidence:0.69,evidence_count:1,last_reviewed_at:TODAY,source_ids:['cohere_rerank']} }),
  image_generation: completeTaskScores({ multimodal:{score:86,rank:10,confidence:0.67,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_images']}, instruction_following:{score:90,rank:5,confidence:0.73,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_images']}, creative_writing:{score:86,rank:6,confidence:0.66,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_images']} }),
  video_generation: completeTaskScores({ multimodal:{score:88,rank:8,confidence:0.66,evidence_count:1,last_reviewed_at:TODAY,source_ids:['runway_changelog']}, instruction_following:{score:86,rank:8,confidence:0.66,evidence_count:1,last_reviewed_at:TODAY,source_ids:['runway_changelog']}, speed:{score:74,rank:12,confidence:0.65,evidence_count:1,last_reviewed_at:TODAY,source_ids:['runway_billing']} }),
  stt: completeTaskScores({ document_extraction:{score:92,rank:3,confidence:0.75,evidence_count:1,last_reviewed_at:TODAY,source_ids:['assemblyai_benchmarks']}, speed:{score:90,rank:3,confidence:0.73,evidence_count:1,last_reviewed_at:TODAY,source_ids:['assemblyai_products']} }),
  tts: completeTaskScores({ creative_writing:{score:82,rank:10,confidence:0.65,evidence_count:1,last_reviewed_at:TODAY,source_ids:['eleven_models']}, speed:{score:91,rank:2,confidence:0.73,evidence_count:1,last_reviewed_at:TODAY,source_ids:['eleven_models']} }),
  music: completeTaskScores({ creative_writing:{score:88,rank:6,confidence:0.66,evidence_count:1,last_reviewed_at:TODAY,source_ids:['stability_audio2']}, speed:{score:78,rank:10,confidence:0.65,evidence_count:1,last_reviewed_at:TODAY,source_ids:['stability_audio2']} }),
  document_ai: completeTaskScores({ vision:{score:89,rank:4,confidence:0.72,evidence_count:1,last_reviewed_at:TODAY,source_ids:['mistral_models']}, document_extraction:{score:96,rank:1,confidence:0.84,evidence_count:1,last_reviewed_at:TODAY,source_ids:['mistral_models']}, speed:{score:82,rank:6,confidence:0.65,evidence_count:1,last_reviewed_at:TODAY,source_ids:['mistral_models']} }),
};

function profile(name, overrides = {}) {
  return completeTaskScores({ ...(PROFILES[name] ?? {}), ...overrides });
}

function docSource(id, title, url, publisher, evidence_type = 'official_docs') {
  return { source_id: id, title, url, publisher, evidence_type, accessed_at: TODAY };
}

function hfSource(repo, publisher) {
  return docSource(sourceKey(repo), `${repo} model card`, `https://huggingface.co/${repo}`, publisher, 'official_model_card');
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'drodo-model-registry-pass2' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function fetchHfMetas(repos) {
  const result = new Map();
  await Promise.all(repos.map(async repo => {
    try {
      const json = await fetchJson(`https://huggingface.co/api/models/${repo}`);
      result.set(repo, {
        createdAt: toDate(json.createdAt),
        lastModified: toDate(json.lastModified),
        license: json.cardData?.license ?? (Array.isArray(json.tags) ? (json.tags.find(tag => String(tag).startsWith('license:'))?.split(':')[1] ?? null) : null),
        pipeline_tag: json.pipeline_tag ?? null,
        tags: json.tags ?? [],
      });
    } catch {
      result.set(repo, null);
    }
  }));
  return result;
}

async function fetchOpenRouterCatalog() {
  try {
    const json = await fetchJson('https://openrouter.ai/api/v1/models');
    return new Map((json.data ?? []).map(item => [item.id, item]));
  } catch {
    return new Map();
  }
}

function sourceIdsFromTaskScores(task_scores) {
  return uniq(Object.values(task_scores ?? {}).flatMap(domain => domain?.source_ids ?? []));
}

function deriveStrengthTags(task_scores, capabilities, extra = []) {
  const tags = [...extra];
  for (const [domain, value] of Object.entries(task_scores ?? {})) {
    if ((value?.score ?? null) !== null && value.score >= 85) tags.push(domain);
  }
  if (capabilities?.embeddings) tags.push('embeddings');
  if (capabilities?.reranking) tags.push('reranking');
  if (capabilities?.image_output) tags.push('image_generation');
  if (capabilities?.video_output) tags.push('video_generation');
  if (capabilities?.audio_input && capabilities?.text_output) tags.push('speech_to_text');
  if (capabilities?.audio_output) tags.push('text_to_speech');
  return uniq(tags).filter(tag => STRENGTH_TAGS.includes(tag));
}

function routerHints(latency_tier, cost_tier, preferred_for, avoid_for, fallback_model_uids = []) {
  return { latency_tier, cost_tier, preferred_for, avoid_for, fallback_model_uids };
}

function createModel(seed, hfMeta = null) {
  const task_scores = profile(seed.profile ?? 'fast_general', seed.task_score_overrides ?? {});
  const capabilities = caps(seed.capabilities ?? []);
  const sources = uniq([...(seed.sources ?? []), seed.hf_repo ? sourceKey(seed.hf_repo) : null, ...sourceIdsFromTaskScores(task_scores)]);
  const strength_tags = deriveStrengthTags(task_scores, capabilities, seed.strength_tags ?? []);
  return {
    model_uid: modelUid(seed.owner, seed.family, seed.variant),
    canonical_owner: seed.owner,
    family_name: seed.family,
    variant_name: seed.variant,
    normalized_slug: `${slug(seed.owner)}/${slug(seed.family)}/${slug(seed.variant)}`,
    aliases: uniq(seed.aliases ?? []),
    description: seed.description,
    release_date: seed.release_date ?? hfMeta?.createdAt ?? null,
    status: seed.status ?? 'active',
    license: seed.license ?? hfMeta?.license ?? null,
    open_source: seed.open_source ?? (seed.hf_repo ? true : null),
    open_weights: seed.open_weights ?? (seed.hf_repo ? true : null),
    primary_modality: seed.primary_modality,
    modalities: uniq(seed.modalities ?? [seed.primary_modality]),
    capabilities,
    strength_tags,
    task_scores,
    sources,
    router_hints: seed.router_hints,
  };
}

function createMapping({ model_uid, access_provider, provider_model_id, provider_model_label, api_compatibility, available = true, local_runnable = false, pricing = blankPricing(), context_window = null, max_output_tokens = null, notes = null, sources = [] }) {
  return { model_uid, access_provider, provider_model_id, provider_model_label, api_compatibility, available, local_runnable, pricing: { ...blankPricing(), ...pricing }, context_window, max_output_tokens, notes, sources: uniq(sources) };
}

function pickValue(oldValue, newValue) {
  return isBlank(newValue) ? oldValue ?? null : newValue;
}

function mergeTaskScores(oldScores = {}, newScores = {}) {
  return Object.fromEntries(RANKING_DOMAINS.map(domain => {
    const oldScore = oldScores[domain] ?? {};
    const newScore = newScores[domain] ?? {};
    return [domain, {
      score: pickValue(oldScore.score, newScore.score),
      rank: pickValue(oldScore.rank, newScore.rank),
      confidence: pickValue(oldScore.confidence, newScore.confidence),
      evidence_count: Math.max(oldScore.evidence_count ?? 0, newScore.evidence_count ?? 0),
      last_reviewed_at: pickValue(oldScore.last_reviewed_at, newScore.last_reviewed_at),
      source_ids: uniq([...(oldScore.source_ids ?? []), ...(newScore.source_ids ?? [])]),
    }];
  }));
}

function mergeModels(oldModel, newModel) {
  return {
    ...oldModel,
    ...newModel,
    aliases: uniq([...(oldModel.aliases ?? []), ...(newModel.aliases ?? [])]),
    modalities: uniq([...(oldModel.modalities ?? []), ...(newModel.modalities ?? [])]),
    strength_tags: uniq([...(oldModel.strength_tags ?? []), ...(newModel.strength_tags ?? [])]),
    sources: uniq([...(oldModel.sources ?? []), ...(newModel.sources ?? [])]),
    release_date: pickValue(oldModel.release_date, newModel.release_date),
    license: pickValue(oldModel.license, newModel.license),
    description: pickValue(oldModel.description, newModel.description),
    open_source: newModel.open_source ?? oldModel.open_source ?? null,
    open_weights: newModel.open_weights ?? oldModel.open_weights ?? null,
    primary_modality: pickValue(oldModel.primary_modality, newModel.primary_modality),
    capabilities: { ...(oldModel.capabilities ?? {}), ...(newModel.capabilities ?? {}) },
    task_scores: mergeTaskScores(oldModel.task_scores, newModel.task_scores),
    router_hints: { ...(oldModel.router_hints ?? {}), ...(newModel.router_hints ?? {}) },
  };
}

function mergeMappings(oldMapping, newMapping) {
  return {
    ...oldMapping,
    ...newMapping,
    pricing: { ...blankPricing(), ...(oldMapping.pricing ?? {}), ...(newMapping.pricing ?? {}) },
    context_window: pickValue(oldMapping.context_window, newMapping.context_window),
    max_output_tokens: pickValue(oldMapping.max_output_tokens, newMapping.max_output_tokens),
    notes: pickValue(oldMapping.notes, newMapping.notes),
    sources: uniq([...(oldMapping.sources ?? []), ...(newMapping.sources ?? [])]),
  };
}

function percent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function patchModel(baseModel, patch = {}) {
  return mergeModels(baseModel, patch);
}

function patchMapping(baseMapping, patch = {}) {
  return mergeMappings(baseMapping, patch);
}

function hasBenchmarkEvidence(score) {
  return (score?.source_ids ?? []).some(sourceId => BENCHMARK_SOURCE_IDS.has(sourceId));
}

function normalizeExistingMapping(mapping) {
  const remappedModelUid = UID_REMAPS.has(mapping.model_uid) ? UID_REMAPS.get(mapping.model_uid) : mapping.model_uid;
  const remappedUidByProvider = LEGACY_PROVIDER_UID_REMAPS.get(`${mapping.access_provider}|${mapping.provider_model_id}`) ?? remappedModelUid;
  let normalized = { ...mapping, model_uid: remappedUidByProvider };
  if (normalized.access_provider === 'ElevenLabs API' && normalized.provider_model_id === 'flash_v2_5') {
    normalized = { ...normalized, provider_model_id: 'eleven_flash_v2_5', provider_model_label: 'eleven_flash_v2_5' };
  }
  return normalized;
}

async function readJson(filePath, fallback) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); } catch { return fallback; }
}

async function readNdjson(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function sortModels(models) {
  return [...models].sort((a, b) => [a.canonical_owner, a.family_name, a.variant_name].join('|').localeCompare([b.canonical_owner, b.family_name, b.variant_name].join('|')));
}

function sortMappings(mappings) {
  return [...mappings].sort((a, b) => [a.access_provider, a.model_uid, a.provider_model_id].join('|').localeCompare([b.access_provider, b.model_uid, b.provider_model_id].join('|')));
}

function normalizeAlias(value) {
  return slug(String(value ?? '').replace(/preview|latest|snapshot|terminus/g, '').replace(/v\d+(:\d+)?/g, ''));
}

const UID_REMAPS = new Map([
  ['mdl:cohere:embed:embed-4', modelRef('Cohere', 'Embedding', 'Embed 4')],
  ['mdl:google-deepmind:gemini-embedding:gemini-embedding-001', modelRef('Google / DeepMind', 'Embedding', 'Gemini Embedding 001')],
  ['mdl:google-deepmind:gemini:gemini-3-1-flash', modelRef('Google / DeepMind', 'Gemini', 'Gemini 3.1 Flash Preview')],
  ['mdl:google-deepmind:gemini:gemini-3-1-flash-lite', modelRef('Google / DeepMind', 'Gemini', 'Gemini 3.1 Flash Lite Preview')],
  ['mdl:mistral:devstral:devstral-2', modelRef('Mistral', 'Devstral', 'Devstral 25.12')],
  ['mdl:mistral:mistral-large:mistral-large-3', modelRef('Mistral', 'Mistral', 'Mistral Large 25.12')],
  ['mdl:mistral:mistral-medium:mistral-medium-3-1', modelRef('Mistral', 'Mistral', 'Mistral Medium 3.1')],
  ['mdl:mistral:mistral-ocr:mistral-ocr-2', modelRef('Mistral', 'OCR', 'Mistral OCR')],
  ['mdl:openai:o-series:o3', modelRef('OpenAI', 'o', 'o3')],
  ['mdl:openai:o-series:o4-mini', modelRef('OpenAI', 'o', 'o4-mini')],
  ['mdl:openai:text-embedding:text-embedding-3-large', modelRef('OpenAI', 'Embedding', 'text-embedding-3-large')],
  ['mdl:openai:text-embedding:text-embedding-3-small', modelRef('OpenAI', 'Embedding', 'text-embedding-3-small')],
]);
const STATIC_SOURCES = [
  docSource('openai_models','OpenAI Models','https://platform.openai.com/docs/models','OpenAI'),
  docSource('openai_pricing','OpenAI API pricing','https://platform.openai.com/docs/pricing','OpenAI'),
  docSource('openai_embeddings','OpenAI Embeddings Guide','https://platform.openai.com/docs/guides/embeddings','OpenAI'),
  docSource('openai_images','OpenAI Images Guide','https://platform.openai.com/docs/guides/images','OpenAI'),
  docSource('openai_audio','OpenAI Audio Guide','https://platform.openai.com/docs/guides/text-to-speech','OpenAI'),
  docSource('openai_gpt_41_release','Introducing GPT-4.1','https://openai.com/index/gpt-4-1/','OpenAI','official_release_notes'),
  docSource('openai_gpt_54_release','Introducing GPT-5.4','https://openai.com/index/introducing-gpt-5-4/','OpenAI','official_release_notes'),
  docSource('openai_gpt_54_mini_nano_release','Introducing GPT-5.4 mini and nano','https://openai.com/index/introducing-gpt-5-4-mini-and-nano/','OpenAI','official_release_notes'),
  docSource('openai_gpt_oss','Introducing gpt-oss','https://openai.com/index/introducing-gpt-oss','OpenAI','official_release_notes'),
  docSource('openai_gpt_oss_card','gpt-oss model card','https://openai.com/index/gpt-oss-model-card/','OpenAI','official_model_card'),
  docSource('anthropic_models','Anthropic model docs','https://docs.anthropic.com/en/docs/about-claude/model-deprecations','Anthropic'),
  docSource('anthropic_overview','Anthropic models overview','https://platform.claude.com/docs/en/about-claude/models/overview','Anthropic'),
  docSource('anthropic_pricing','Anthropic pricing','https://platform.claude.com/docs/en/about-claude/pricing','Anthropic'),
  docSource('anthropic_claude_37_release','Claude 3.7 Sonnet system card','https://www-cdn.anthropic.com/9ff93dfa8f445c932415d335c88852ef47f1201e.pdf','Anthropic','official_model_card'),
  docSource('google_models','Google Gemini API models','https://ai.google.dev/gemini-api/docs/models','Google AI for Developers'),
  docSource('google_embeddings','Google Gemini embeddings','https://ai.google.dev/gemini-api/docs/embeddings','Google AI for Developers'),
  docSource('google_pricing','Google Gemini API pricing','https://ai.google.dev/gemini-api/docs/pricing','Google AI for Developers'),
  docSource('google_changelog','Google Gemini API changelog','https://ai.google.dev/gemini-api/docs/changelog','Google AI for Developers','official_release_notes'),
  docSource('google_video','Google video generation','https://ai.google.dev/gemini-api/docs/video','Google AI for Developers'),
  docSource('mistral_models','Mistral models overview','https://docs.mistral.ai/getting-started/models/','Mistral'),
  docSource('cohere_models','Cohere model guide','https://docs.cohere.com/v2/docs/models','Cohere'),
  docSource('cohere_pricing','Cohere pricing','https://cohere.com/pricing','Cohere'),
  docSource('cohere_command_a','Command A','https://docs.cohere.com/docs/command-a','Cohere'),
  docSource('cohere_command_r7b','Command R7B','https://docs.cohere.com/docs/command-r7b','Cohere'),
  docSource('cohere_command_r_plus','Command R+','https://docs.cohere.com/v2/docs/command-r-plus','Cohere'),
  docSource('cohere_command_a_vision','Command A Vision','https://docs.cohere.com/v1/docs/command-a-vision','Cohere'),
  docSource('cohere_rerank','Cohere rerank overview','https://docs.cohere.com/v2/docs/rerank-overview','Cohere'),
  docSource('cohere_embeddings','Cohere embeddings overview','https://docs.cohere.com/v2/docs/embeddings','Cohere'),
  docSource('cohere_embed4_release','Embed Multimodal 4 release','https://docs.cohere.com/v2/changelog/embed-multimodal-v4','Cohere','official_release_notes'),
  docSource('cohere_rerank35_release','Rerank 3.5 release','https://docs.cohere.com/v2/changelog/rerank-v3.5','Cohere','official_release_notes'),
  docSource('eleven_models','ElevenLabs model guide','https://elevenlabs.io/docs/developer-guides/models','ElevenLabs'),
  docSource('eleven_v3_release','Eleven v3 alpha now available in the API','https://elevenlabs.io/blog/eleven-v3-alpha-now-available-in-the-api','ElevenLabs','official_release_notes'),
  docSource('xai_models','xAI model reference','https://docs.x.ai/docs/models','xAI'),
  docSource('moonshot_overview','Moonshot overview','https://platform.moonshot.ai/docs/overview','Moonshot AI'),
  docSource('moonshot_kimi','Moonshot Kimi guide','https://platform.moonshot.ai/docs/guide/use-kimi','Moonshot AI'),
  docSource('deepseek_api','DeepSeek API docs','https://api-docs.deepseek.com','DeepSeek'),
  docSource('azure_foundry_models','Azure AI Foundry model catalog','https://learn.microsoft.com/en-us/azure/ai-foundry/azure-openai-in-ai-foundry','Microsoft','provider_catalog'),
  docSource('bedrock_models','Amazon Bedrock models','https://docs.aws.amazon.com/bedrock/latest/userguide/models.html','Amazon','provider_catalog'),
  docSource('bedrock_pricing','Amazon Bedrock pricing','https://aws.amazon.com/bedrock/pricing/','Amazon','official_docs'),
  docSource('bedrock_claude_sonnet_45','Claude Sonnet 4.5 on Bedrock','https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-5.html','Amazon','provider_catalog'),
  docSource('bedrock_llama33','Llama 3.3 70B Instruct on Bedrock','https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-meta-llama-3-3-70b-instruct.html','Amazon','provider_catalog'),
  docSource('bedrock_titan_embed','Titan Text Embeddings V2 on Bedrock','https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-titan-text-embeddings-v2.html','Amazon','provider_catalog'),
  docSource('bedrock_nova_canvas','Nova Canvas on Bedrock','https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-canvas.html','Amazon','provider_catalog'),
  docSource('bedrock_nova_pro','Nova Pro model card','https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-pro.html','Amazon','provider_catalog'),
  docSource('bedrock_nova_lite','Nova Lite model card','https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-lite.html','Amazon','provider_catalog'),
  docSource('bedrock_nova_micro','Nova Micro model card','https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-micro.html','Amazon','provider_catalog'),
  docSource('amazon_nova_service_card','Amazon Nova service card','https://docs.aws.amazon.com/pdfs/ai/responsible-ai/nova-micro-lite-pro/nova-micro-lite-pro.pdf','Amazon','official_model_card'),
  docSource('amazon_nova_reel_service_card','Amazon Nova Reel service card','https://docs.aws.amazon.com/pdfs/ai/responsible-ai/nova-reel/nova-reel.pdf','Amazon','official_model_card'),
  docSource('amazon_nova_sonic','Amazon Nova Sonic overview','https://docs.aws.amazon.com/ai/responsible-ai/nova-sonic/overview.html','Amazon','official_docs'),
  docSource('nvidia_nim_models','NVIDIA NIM supported models','https://docs.nvidia.com/nim/large-language-models/latest/_include/models.html','NVIDIA','provider_catalog'),
  docSource('together_serverless','Together serverless models','https://docs.together.ai/docs/serverless-models','Together','provider_catalog'),
  docSource('groq_models','Groq supported models','https://console.groq.com/docs/models','Groq','provider_catalog'),
  docSource('groq_tool_use','Groq supported tool-use models','https://console.groq.com/docs/tool-use/overview','Groq','provider_catalog'),
  docSource('groq_reasoning','Groq reasoning models','https://console.groq.com/docs/reasoning','Groq','provider_catalog'),
  docSource('groq_gpt_oss_120b','Groq GPT-OSS 120B model page','https://console.groq.com/docs/model/openai/gpt-oss-120b','Groq','provider_catalog'),
  docSource('groq_gpt_oss_20b','Groq GPT-OSS 20B model page','https://console.groq.com/docs/model/openai/gpt-oss-20b','Groq','provider_catalog'),
  docSource('groq_stt','Groq speech-to-text docs','https://console.groq.com/docs/speech-to-text','Groq','provider_catalog'),
  docSource('minimax_models','MiniMax model releases','https://platform.minimax.io/docs/release-notes/models','MiniMax','official_release_notes'),
  docSource('minimax_m25_news','MiniMax M2.5 release','https://www.minimax.io/news/minimax-m25','MiniMax','official_release_notes'),
  docSource('stepfun_overview','StepFun model overview','https://platform.stepfun.com/docs/en/llm/modeloverview','StepFun','official_docs'),
  docSource('stepfun_pricing','StepFun pricing','https://platform.stepfun.com/docs/pricing/details','StepFun','official_docs'),
  docSource('voyage_embeddings','Voyage embeddings','https://docs.voyageai.com/docs/embeddings','Voyage AI','official_docs'),
  docSource('voyage_rerank','Voyage rerankers','https://docs.voyageai.com/docs/reranker','Voyage AI','official_docs'),
  docSource('voyage_multimodal','Voyage multimodal embeddings','https://docs.voyageai.com/docs/multimodal-embeddings','Voyage AI','official_docs'),
  docSource('voyage_pricing','Voyage pricing','https://docs.voyageai.com/docs/pricing','Voyage AI','official_docs'),
  docSource('perplexity_sonar','Perplexity Sonar API','https://docs.perplexity.ai/docs/grounded-llm/chat-completions/quickstart','Perplexity','official_docs'),
  docSource('perplexity_openai_compat','Perplexity OpenAI compatibility','https://docs.perplexity.ai/docs/sonar/openai-compatibility','Perplexity','official_docs'),
  docSource('perplexity_pricing','Perplexity pricing','https://docs.perplexity.ai/guides/pricing','Perplexity','official_docs'),
  docSource('perplexity_sonar_pro','Sonar Pro model card','https://docs.perplexity.ai/models/model-cards/sonar-pro','Perplexity','official_model_card'),
  docSource('perplexity_sonar_reasoning_pro','Sonar Reasoning Pro model card','https://docs.perplexity.ai/models/model-cards/sonar-reasoning-pro','Perplexity','official_model_card'),
  docSource('perplexity_sonar_deep_research','Sonar Deep Research model card','https://docs.perplexity.ai/models/model-cards/sonar-deep-research','Perplexity','official_model_card'),
  docSource('perplexity_changelog','Perplexity changelog','https://docs.perplexity.ai/docs/resources/changelog','Perplexity','official_release_notes'),
  docSource('recraft_api','Recraft API getting started','https://www.recraft.ai/docs/mcp-reference/getting-started','Recraft','official_docs'),
  docSource('runway_changelog','Runway API changelog','https://docs.dev.runwayml.com/api-details/api_changelog/','Runway','official_release_notes'),
  docSource('runway_billing','Runway API billing','https://docs.dev.runwayml.com/usage/billing/','Runway','official_docs'),
  docSource('luma_video','Luma video generation','https://docs.lumalabs.ai/docs/video-generation','Luma','official_docs'),
  docSource('assemblyai_benchmarks','AssemblyAI benchmarks','https://www.assemblyai.com/docs/evaluations/benchmarks','AssemblyAI','benchmark_report'),
  docSource('assemblyai_products','AssemblyAI products overview','https://www.assemblyai.com/products','AssemblyAI','official_docs'),
  docSource('bfl_models','Black Forest Labs model overview','https://docs.bfl.ai/','Black Forest Labs','official_docs'),
  docSource('bfl_flux_11_pro','Black Forest Labs FLUX 1.1 Pro','https://docs.bfl.ai/flux_models/flux_1_1_pro','Black Forest Labs','official_docs'),
  docSource('bfl_pricing','Black Forest Labs quick start pricing','https://docs.us.bfl.ai/quick_start/pricing','Black Forest Labs','official_docs'),
  docSource('stability_core_models','Stability AI core models','https://stability.ai/core-models','Stability AI','official_docs'),
  docSource('stability_bedrock','Stability models on Bedrock','https://stability.ai/news/stability-ais-top-3-text-to-image-models-now-available-in-amazon-bedrock','Stability AI','official_release_notes'),
  docSource('stability_audio2','Stable Audio 2.0','https://stability.ai/news/stable-audio-2-0','Stability AI','official_release_notes'),
  docSource('writer_models','Writer model overview','https://dev.writer.com/home/models','Writer','official_docs'),
  docSource('writer_pricing','Writer pricing','https://dev.writer.com/home/pricing','Writer','official_docs'),
  docSource('writer_bedrock','Writer models on Bedrock','https://dev.writer.com/home/integrations/bedrock','Writer','official_docs'),
  docSource('bedrock_palmyra_x5','Palmyra X5 on Bedrock','https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-palmyra-x5.html','Amazon','provider_catalog'),
  docSource('writer_tooling','Writer tool calling','https://dev.writer.com/home/tool-calling','Writer','official_docs'),
  docSource('writer_structured','Writer structured outputs','https://dev.writer.com/home/structured-output','Writer','official_docs'),
  docSource('writer_vision','Writer chat with images','https://dev.writer.com/home/chat-with-images','Writer','official_docs'),
  docSource('writer_model_delegation','Writer model delegation','https://dev.writer.com/api-guides/model-delegation','Writer','official_docs'),
  docSource('ai21_jamba','AI21 Jamba models','https://docs.ai21.com/docs/jamba-foundation-models','AI21 Labs','official_docs'),
  docSource('ai21_sdk','AI21 SDK','https://docs.ai21.com/docs/sdk','AI21 Labs','official_docs'),
  docSource('ai21_vllm','AI21 vLLM deployment','https://docs.ai21.com/docs/vllm','AI21 Labs','official_docs'),
  docSource('baidu_ernie_45','Baidu ERNIE 4.5 article','https://cloud.baidu.com/article/3553539','Baidu Cloud','official_release_notes'),
  docSource('tencent_hunyuan_models','Tencent Hunyuan model catalog','https://cloud.tencent.com/document/product/1759/112876','Tencent Cloud','provider_catalog'),
  docSource('pika_api','Pika API overview','https://pika.art/api','Pika','official_docs'),
  docSource('pika_pricing','Pika pricing','https://pika.art/pricing','Pika','official_docs'),
  docSource('livebench_leaderboard','LiveBench leaderboard','https://livebench.ai/','LiveBench','benchmark_report'),
  docSource('livebench_paper','LiveBench paper','https://livebench.ai/livebench.pdf','LiveBench','benchmark_report'),
  docSource('aider_polyglot_leaderboard','Aider polyglot benchmark leaderboard','https://aider.chat/docs/leaderboards/','Aider','benchmark_report'),
  docSource('bfcl_v4_leaderboard','Berkeley Function Calling Leaderboard','https://gorilla.cs.berkeley.edu/leaderboard','Berkeley Gorilla','benchmark_report'),
  docSource('bfcl_intro','Berkeley Function Calling Leaderboard intro','https://gorilla.cs.berkeley.edu/blogs/8_berkeley_function_calling_leaderboard.html','Berkeley Gorilla','benchmark_report'),
  docSource('mmmu_leaderboard','MMMU leaderboard','https://mmmu-benchmark.github.io/','MMMU','benchmark_report'),
  docSource('ocrbench_v2_leaderboard','OCRBench v2 leaderboard','https://99franklin.github.io/ocrbench_v2/','OCRBench','benchmark_report'),
  docSource('docvqa_official','DocVQA official site','https://www.docvqa.org/','DocVQA','benchmark_report'),
  docSource('mistral_ocr_benchmark','Mistral OCR announcement','https://mistral.ai/news/mistral-ocr','Mistral','official_release_notes'),
  docSource('gaia2_leaderboard_update','GAIA 2 evaluation update','https://huggingface.co/blog/meta-agents-research-environments/gaia2-new-models-evaluation','Hugging Face','benchmark_report'),
  docSource('swebench_official','SWE-bench official site','https://www.swebench.com/','SWE-bench','benchmark_report'),
  docSource('openrouter_models','OpenRouter models API','https://openrouter.ai/api/v1/models','OpenRouter','provider_catalog'),
];

const o = base => ({ open_source: true, open_weights: true, ...base });
const c = base => ({ ...base });

const MODEL_SEEDS = [
  c({ owner:'OpenAI', family:'GPT', variant:'GPT-5.4', aliases:['gpt-5.4'], description:'Flagship OpenAI multimodal reasoning model for high-stakes tool use, coding, and agentic workflows.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','long_context','vision_understanding','code_generation','reasoning','agent_orchestration'], profile:'flagship', sources:['openai_models'], router_hints:routerHints('medium','high',['complex coding','high-reliability planning','autonomous tools'],['high-volume low-cost chat']) }),
  c({ owner:'OpenAI', family:'GPT', variant:'GPT-5.4 Mini', aliases:['gpt-5.4-mini'], description:'Lower-latency GPT-5.4 variant optimized for fast chat, coding assistance, and tool orchestration.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation','reasoning','agent_orchestration'], profile:'fast_general', sources:['openai_models'], router_hints:routerHints('fast','medium',['assistant chat','latency-sensitive coding'],['largest-context retrieval']) }),
  c({ owner:'OpenAI', family:'GPT', variant:'GPT-5.4 Nano', aliases:['gpt-5.4-nano'], description:'Smallest GPT-5.4 variant focused on low-cost classification, lightweight orchestration, and simple agent loops.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','reasoning'], profile:'cheap_general', sources:['openai_models'], router_hints:routerHints('fast','low',['classification','cheap tool routers'],['deep reasoning']) }),
  c({ owner:'OpenAI', family:'GPT', variant:'GPT-4.1', aliases:['gpt-4.1'], description:'General-purpose OpenAI model still relevant for production chat, coding, and function calling workloads.', release_date:'2025-04-14', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation','reasoning'], profile:'fast_general', sources:['openai_models'], router_hints:routerHints('medium','medium',['general app chat','tool use'],['frontier reasoning']) }),
  c({ owner:'OpenAI', family:'GPT', variant:'GPT-4.1 Mini', aliases:['gpt-4.1-mini'], description:'Cost-focused GPT-4.1 variant for chat and tool use with broad compatibility.', release_date:'2025-04-14', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation'], profile:'fast_general', sources:['openai_models'], router_hints:routerHints('fast','medium',['cost-sensitive chat'],['hard reasoning']) }),
  c({ owner:'OpenAI', family:'GPT', variant:'GPT-4.1 Nano', aliases:['gpt-4.1-nano'], description:'Small GPT-4.1 tier suitable for lightweight routing and extraction tasks.', release_date:'2025-04-14', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming'], profile:'cheap_general', sources:['openai_models'], router_hints:routerHints('fast','low',['cheap extraction'],['multistep workflows']) }),
  c({ owner:'OpenAI', family:'GPT', variant:'GPT-4o', aliases:['gpt-4o'], description:'Multimodal OpenAI model for chat, vision understanding, and realtime-oriented assistant surfaces.', release_date:'2024-05-13', primary_modality:'text', modalities:['text','image','audio'], capabilities:['text_input','text_output','image_input','audio_input','tool_calling','function_calling','structured_output','streaming','realtime','vision_understanding','reasoning'], profile:'multimodal_frontier', sources:['openai_models'], router_hints:routerHints('medium','high',['vision chat','voice assistants'],['low-cost bulk use']) }),
  c({ owner:'OpenAI', family:'GPT', variant:'GPT-4o Mini', aliases:['gpt-4o-mini'], release_date:'2024-07-18', description:'Lower-cost multimodal GPT-4o variant for production assistants and UI automation.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding'], profile:'fast_general', sources:['openai_models'], router_hints:routerHints('fast','low',['assistant defaults','bulk multimodal chat'],['deep planning']) }),
  c({ owner:'OpenAI', family:'o', variant:'o3', aliases:['o3'], description:'OpenAI reasoning model aimed at harder planning, math, and complex code tasks.', release_date:'2025-04-16', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation','reasoning','agent_orchestration'], profile:'flagship', sources:['openai_models'], router_hints:routerHints('slow','high',['hard reasoning','math','agent plans'],['latency-sensitive chat']) }),
  c({ owner:'OpenAI', family:'o', variant:'o4-mini', aliases:['o4-mini'], description:'Compact reasoning-focused OpenAI model balancing cost, speed, and reasoning quality.', release_date:'2025-04-16', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation','reasoning'], profile:'fast_general', sources:['openai_models'], router_hints:routerHints('fast','medium',['mid-tier reasoning'],['highest-accuracy research']) }),
  c({ owner:'OpenAI', family:'GPT Image', variant:'GPT Image 1', aliases:['gpt-image-1'], description:'OpenAI text-to-image generation model for photorealistic and design-oriented image output.', release_date:'2025-04-23', primary_modality:'image', modalities:['image','text'], capabilities:['text_input','image_output','structured_output'], profile:'image_generation', sources:['openai_images'], router_hints:routerHints('medium','medium',['image generation'],['text reasoning']) }),
  c({ owner:'OpenAI', family:'Embedding', variant:'text-embedding-3-large', aliases:['text-embedding-3-large'], description:'OpenAI high-quality embedding model for semantic search and retrieval.', release_date:'2024-01-25', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_premium', sources:['openai_embeddings'], router_hints:routerHints('fast','medium',['semantic retrieval'],['generation']) }),
  c({ owner:'OpenAI', family:'Embedding', variant:'text-embedding-3-small', aliases:['text-embedding-3-small'], description:'Lower-cost OpenAI embedding model for semantic search and routing metadata.', release_date:'2024-01-25', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_premium', task_score_overrides:{ cost_efficiency:{score:92,rank:2,confidence:0.77,evidence_count:1,last_reviewed_at:TODAY,source_ids:['openai_embeddings']} }, sources:['openai_embeddings'], router_hints:routerHints('fast','low',['cheap retrieval'],['maximum retrieval quality']) }),
  c({ owner:'OpenAI', family:'Audio', variant:'GPT-4o Transcribe', aliases:['gpt-4o-transcribe'], description:'OpenAI speech-to-text model for transcription and speech understanding.', release_date:'2025-03-20', primary_modality:'audio', modalities:['audio','text'], capabilities:['audio_input','text_output','streaming','document_extraction'], profile:'stt', sources:['openai_audio'], router_hints:routerHints('fast','medium',['transcription','speech analytics'],['long-form generation']) }),
  c({ owner:'OpenAI', family:'Audio', variant:'GPT-4o Mini TTS', aliases:['gpt-4o-mini-tts'], description:'OpenAI text-to-speech model for responsive voice synthesis.', release_date:'2025-03-20', primary_modality:'audio', modalities:['audio','text'], capabilities:['text_input','audio_output','streaming','realtime'], profile:'tts', sources:['openai_audio'], router_hints:routerHints('fast','medium',['voice response'],['document QA']) }),
  o({ owner:'OpenAI', family:'GPT-OSS', variant:'GPT-OSS 120B', aliases:['gpt-oss-120b','openai/gpt-oss-120b'], description:'Open-weight OpenAI model for agentic reasoning, coding, and tool-rich workflows.', release_date:'2025-08-05', hf_repo:'openai/gpt-oss-120b', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','long_context','code_generation','reasoning','agent_orchestration'], profile:'coding_open', sources:['openai_gpt_oss','openai_gpt_oss_card'], router_hints:routerHints('medium','medium',['open agentic reasoning','self-hosted coding'],['vision']) }),
  o({ owner:'OpenAI', family:'GPT-OSS', variant:'GPT-OSS 20B', aliases:['gpt-oss-20b','openai/gpt-oss-20b'], description:'Smaller open-weight GPT-OSS model tuned for low-latency reasoning and structured tool use.', release_date:'2025-08-05', hf_repo:'openai/gpt-oss-20b', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','long_context','code_generation','reasoning','agent_orchestration'], profile:'cheap_general', sources:['openai_gpt_oss','openai_gpt_oss_card'], router_hints:routerHints('fast','low',['local reasoning','cheap agents'],['hardest planning']) }),

  c({ owner:'Anthropic', family:'Claude', variant:'Claude Opus 4.1', aliases:['claude-opus-4.1'], description:'Anthropic flagship Claude model for complex reasoning, analysis, and coding.', release_date:'2025-08-05', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation','reasoning','agent_orchestration'], profile:'flagship', sources:['anthropic_models'], router_hints:routerHints('medium','high',['high-accuracy analysis','large-context planning'],['cheap chat']) }),
  c({ owner:'Anthropic', family:'Claude', variant:'Claude Sonnet 4.5', aliases:['claude-sonnet-4.5'], description:'Anthropic balanced flagship for production coding, writing, and tool-based workflows.', release_date:'2025-09-29', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation','reasoning','agent_orchestration'], profile:'flagship', task_score_overrides:{ speed:{score:84,rank:5,confidence:0.68,evidence_count:1,last_reviewed_at:TODAY,source_ids:['anthropic_models']} }, sources:['anthropic_models'], router_hints:routerHints('medium','high',['production coding','long-form writing'],['lowest-cost automation']) }),
  c({ owner:'Anthropic', family:'Claude', variant:'Claude Haiku 4.5', aliases:['claude-haiku-4.5'], description:'Low-latency Claude variant for fast chat and moderate tool use.', release_date:'2025-10-01', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding'], profile:'fast_general', sources:['anthropic_models'], router_hints:routerHints('fast','medium',['fast assistant tasks'],['deep reasoning']) }),
  c({ owner:'Anthropic', family:'Claude', variant:'Claude 3.7 Sonnet', aliases:['claude-3.7-sonnet'], description:'Claude generation commonly used for coding and general agent tasks.', release_date:'2025-02-19', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation','reasoning'], profile:'fast_general', sources:['anthropic_models'], router_hints:routerHints('medium','medium',['coding','document QA'],['frontier reasoning']) }),

  c({ owner:'Google / DeepMind', family:'Gemini', variant:'Gemini 2.5 Pro', aliases:['gemini-2.5-pro'], description:'High-capability Google multimodal model for long-context reasoning and rich inputs.', release_date:'2025-03-26', primary_modality:'text', modalities:['text','image','audio','video'], capabilities:['text_input','text_output','image_input','audio_input','video_input','tool_calling','function_calling','structured_output','streaming','long_context','vision_understanding','reasoning','agent_orchestration'], profile:'multimodal_frontier', sources:['google_models'], router_hints:routerHints('medium','medium',['long-context analysis','vision-heavy chat'],['lowest latency']) }),
  c({ owner:'Google / DeepMind', family:'Gemini', variant:'Gemini 2.5 Flash', aliases:['gemini-2.5-flash'], description:'Fast Gemini model for cost-sensitive multimodal applications.', release_date:'2025-05-20', primary_modality:'text', modalities:['text','image','audio','video'], capabilities:['text_input','text_output','image_input','audio_input','video_input','tool_calling','function_calling','structured_output','streaming','long_context','vision_understanding'], profile:'fast_general', sources:['google_models'], router_hints:routerHints('fast','low',['general multimodal assistants'],['highest-accuracy coding']) }),
  c({ owner:'Google / DeepMind', family:'Gemini', variant:'Gemini 3.1 Pro Preview', aliases:['gemini-3.1-pro-preview','gemini-3-pro-preview'], description:'Preview Gemini generation with top-tier multimodal reasoning and very large context.', primary_modality:'text', modalities:['text','image','audio','video'], capabilities:['text_input','text_output','image_input','audio_input','video_input','tool_calling','function_calling','structured_output','streaming','long_context','vision_understanding','reasoning','agent_orchestration'], profile:'multimodal_frontier', sources:['google_models','openrouter_models'], router_hints:routerHints('medium','medium',['preview evaluation','research copilots'],['strict stability requirements']) }),
  c({ owner:'Google / DeepMind', family:'Gemini', variant:'Gemini 3.1 Flash Preview', aliases:['gemini-3.1-flash-preview'], description:'Preview Gemini flash tier for low-latency multimodal workloads.', primary_modality:'text', modalities:['text','image','audio','video'], capabilities:['text_input','text_output','image_input','audio_input','video_input','tool_calling','function_calling','structured_output','streaming','long_context','vision_understanding'], profile:'fast_general', sources:['google_models','openrouter_models'], router_hints:routerHints('fast','low',['preview assistant traffic'],['stable production workloads']) }),
  c({ owner:'Google / DeepMind', family:'Gemini', variant:'Gemini 3.1 Flash Lite Preview', aliases:['gemini-3.1-flash-lite-preview'], description:'Cheapest preview Gemini tier for lightweight chat and extraction.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','structured_output','streaming','vision_understanding'], profile:'cheap_general', sources:['google_models','openrouter_models'], router_hints:routerHints('fast','low',['cheap extraction','summaries'],['complex reasoning']) }),
  c({ owner:'Google / DeepMind', family:'Embedding', variant:'Gemini Embedding 001', aliases:['gemini-embedding-001'], description:'Google embedding model for semantic search and retrieval systems.', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_premium', sources:['google_embeddings'], router_hints:routerHints('fast','medium',['retrieval'],['generation']) }),

  o({ owner:'Meta', family:'Llama', variant:'Llama 4 Maverick 17B 128E Instruct', aliases:['llama-4-maverick','meta-llama/llama-4-maverick-17b-128e-instruct'], description:'Meta multimodal frontier open-weight model optimized for instruction following and agentic tasks.', hf_repo:'meta-llama/Llama-4-Maverick-17B-128E-Instruct', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','structured_output','streaming','long_context','vision_understanding','code_generation','reasoning'], profile:'open_reasoning', sources:[], router_hints:routerHints('medium','medium',['open multimodal chat','agentic tasks'],['pure embedding']) }),
  o({ owner:'Meta', family:'Llama', variant:'Llama 4 Scout 17B 16E Instruct', aliases:['llama-4-scout','meta-llama/llama-4-scout-17b-16e-instruct'], description:'Meta open-weight Llama 4 model for efficient general and multimodal reasoning.', hf_repo:'meta-llama/Llama-4-Scout-17B-16E-Instruct', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','structured_output','streaming','long_context','vision_understanding','code_generation','reasoning'], profile:'open_reasoning', sources:[], router_hints:routerHints('fast','medium',['balanced open multimodal'],['best-in-class coding']) }),
  o({ owner:'Meta', family:'Llama', variant:'Llama 3.3 70B Instruct', aliases:['llama-3.3-70b-instruct'], description:'Widely deployed open-weight text model for chat, coding, and reasoning.', hf_repo:'meta-llama/Llama-3.3-70B-Instruct', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','long_context','code_generation','reasoning'], profile:'open_reasoning', sources:[], router_hints:routerHints('medium','low',['general open routing','economical reasoning'],['vision']) }),
  o({ owner:'Meta', family:'Llama', variant:'Llama 3.2 90B Vision Instruct', aliases:['llama-3.2-90b-vision-instruct'], description:'Open-weight Meta model for strong visual understanding and multimodal reasoning.', hf_repo:'meta-llama/Llama-3.2-90B-Vision-Instruct', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','structured_output','streaming','vision_understanding','reasoning'], profile:'multimodal_frontier', task_score_overrides:{ vision:{score:90,rank:5,confidence:0.73,evidence_count:1,last_reviewed_at:TODAY,source_ids:['meta_llama_llama_3_2_90b_vision_instruct']} }, sources:[], router_hints:routerHints('medium','medium',['open vision QA'],['tool-heavy agents']) }),
  o({ owner:'Meta', family:'Llama', variant:'Llama 3.2 11B Vision Instruct', aliases:['llama-3.2-11b-vision-instruct'], description:'Smaller open Meta vision model for cost-sensitive multimodal tasks.', hf_repo:'meta-llama/Llama-3.2-11B-Vision-Instruct', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','structured_output','streaming','vision_understanding'], profile:'fast_general', sources:[], router_hints:routerHints('fast','low',['cheap open vision'],['complex reasoning']) }),

  c({ owner:'NVIDIA', family:'Nemotron', variant:'Llama 3.3 Nemotron Super 49B', aliases:['llama-3.3-nemotron-super-49b'], description:'NVIDIA open-weight reasoning model tuned for strong agentic and coding performance.', hf_repo:'nvidia/Llama-3_3-Nemotron-Super-49B-v1', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','long_context','code_generation','reasoning','agent_orchestration'], profile:'coding_open', sources:['nvidia_nim_models'], router_hints:routerHints('medium','medium',['enterprise self-hosting','coding'],['vision']) }),
  o({ owner:'NVIDIA', family:'Embedding', variant:'NV-Embed v1', aliases:['nv-embed-v1'], description:'NVIDIA embedding model for retrieval and semantic search workloads.', hf_repo:'nvidia/NV-Embed-v1', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_open', sources:['nvidia_nim_models'], router_hints:routerHints('fast','medium',['self-hosted retrieval'],['generation']) }),
  c({ owner:'NVIDIA', family:'Reranker', variant:'Llama Nemotron Rerank VL 1B v2', aliases:['llama-nemotron-rerank-vl-1b-v2'], description:'NVIDIA reranker optimized for retrieval refinement with visual-language support.', primary_modality:'embedding', modalities:['embedding','text','image'], capabilities:['text_input','image_input','reranking','vision_understanding'], profile:'rerank', sources:['nvidia_nim_models'], router_hints:routerHints('fast','medium',['retrieval reranking','visual search'],['generation']) }),

  c({ owner:'Mistral', family:'Mistral', variant:'Mistral Large 25.12', aliases:['mistral-large-2512'], description:'Mistral flagship large model for reasoning, coding, and multilingual enterprise usage.', release_date:'2025-12-01', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation','reasoning'], profile:'flagship', sources:['mistral_models'], router_hints:routerHints('medium','high',['enterprise coding','multilingual chat'],['budget traffic']) }),
  c({ owner:'Mistral', family:'Mistral', variant:'Mistral Medium 3.1', aliases:['mistral-medium-3.1'], description:'Balanced Mistral model for general-purpose assistant and coding tasks.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','structured_output','streaming','vision_understanding','code_generation','reasoning'], profile:'fast_general', sources:['mistral_models'], router_hints:routerHints('fast','medium',['general EU-hosted workloads'],['frontier reasoning']) }),
  c({ owner:'Mistral', family:'Mistral', variant:'Mistral Small 3.1', aliases:['mistral-small-3.1'], description:'Lower-cost Mistral model for assistants, extraction, and moderate tool use.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','structured_output','streaming','vision_understanding'], profile:'fast_general', sources:['mistral_models'], router_hints:routerHints('fast','low',['budget EU chat'],['hard planning']) }),
  c({ owner:'Mistral', family:'Devstral', variant:'Devstral 25.12', aliases:['devstral-2512'], description:'Mistral development-oriented model focused on coding and software tasks.', release_date:'2025-12-01', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','code_generation','reasoning'], profile:'coding_open', sources:['mistral_models'], router_hints:routerHints('fast','medium',['coding copilots'],['vision']) }),
  c({ owner:'Mistral', family:'Pixtral', variant:'Pixtral Large', aliases:['pixtral-large'], description:'Mistral multimodal model for image understanding and document analysis.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','structured_output','streaming','vision_understanding','document_extraction','reasoning'], profile:'multimodal_frontier', sources:['mistral_models'], router_hints:routerHints('medium','medium',['document understanding','image QA'],['audio']) }),
  c({ owner:'Mistral', family:'OCR', variant:'Mistral OCR', aliases:['mistral-ocr'], description:'Mistral OCR model for document extraction and layout-aware text recovery.', primary_modality:'document', modalities:['document','image','text'], capabilities:['image_input','text_output','structured_output','vision_understanding','document_extraction'], profile:'document_ai', sources:['mistral_models'], router_hints:routerHints('fast','medium',['OCR','PDF extraction'],['general chat']) }),
  c({ owner:'DeepSeek', family:'DeepSeek', variant:'DeepSeek V3.1', aliases:['deepseek-v3.1','deepseek-chat','deepseek-v3.1-terminus'], description:'Latest DeepSeek general model for coding, reasoning, and cost-efficient chat.', hf_repo:'deepseek-ai/DeepSeek-V3.1', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','long_context','code_generation','reasoning'], profile:'open_reasoning', sources:['deepseek_api'], router_hints:routerHints('medium','low',['cheap high-quality coding','general chat'],['vision']) }),
  o({ owner:'DeepSeek', family:'DeepSeek', variant:'DeepSeek R1', aliases:['deepseek-r1','deepseek-reasoner'], description:'Open reasoning model tuned for chain-of-thought style problem solving and math.', hf_repo:'deepseek-ai/DeepSeek-R1', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','streaming','long_context','code_generation','reasoning'], profile:'open_reasoning', task_score_overrides:{ math:{score:94,rank:3,confidence:0.79,evidence_count:1,last_reviewed_at:TODAY,source_ids:['deepseek_ai_deepseek_r1']} }, sources:['deepseek_api'], router_hints:routerHints('slow','low',['hard reasoning','math'],['tool-heavy low-latency agents']) }),
  o({ owner:'DeepSeek', family:'DeepSeek Distill', variant:'DeepSeek-R1-Distill-Qwen-32B', aliases:['deepseek-r1-distill-qwen-32b'], description:'Distilled DeepSeek reasoning model based on Qwen weights for cheaper self-hosted reasoning.', hf_repo:'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','streaming','code_generation','reasoning'], profile:'cheap_general', sources:[], router_hints:routerHints('fast','low',['cheap reasoning'],['frontier planning']) }),
  o({ owner:'DeepSeek', family:'DeepSeek Distill', variant:'DeepSeek-R1-Distill-Llama-70B', aliases:['deepseek-r1-distill-llama-70b'], description:'Distilled DeepSeek reasoning model based on Llama 70B weights.', hf_repo:'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','streaming','code_generation','reasoning'], profile:'cheap_general', sources:[], router_hints:routerHints('medium','low',['open reasoning'],['best math']) }),

  o({ owner:'Qwen / Alibaba', family:'Qwen', variant:'Qwen3 235B A22B', aliases:['qwen3-235b-a22b'], description:'Alibaba Qwen flagship open-weight mixture-of-experts reasoning and chat model.', hf_repo:'Qwen/Qwen3-235B-A22B', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','long_context','code_generation','reasoning','agent_orchestration'], profile:'open_reasoning', sources:[], router_hints:routerHints('medium','medium',['open reasoning defaults'],['vision']) }),
  o({ owner:'Qwen / Alibaba', family:'Qwen', variant:'Qwen3 30B A3B', aliases:['qwen3-30b-a3b'], description:'Efficient Qwen3 mixture-of-experts model for self-hosted assistants and coding.', hf_repo:'Qwen/Qwen3-30B-A3B', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','long_context','code_generation','reasoning'], profile:'cheap_general', sources:[], router_hints:routerHints('fast','low',['cost-efficient open reasoning'],['deep research']) }),
  o({ owner:'Qwen / Alibaba', family:'Qwen Coder', variant:'Qwen3 Coder 480B A35B Instruct', aliases:['qwen3-coder','qwen3-coder-480b-a35b-instruct'], description:'Large Qwen coder release optimized for software engineering and tool-oriented coding.', hf_repo:'Qwen/Qwen3-Coder-480B-A35B-Instruct', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','long_context','code_generation','reasoning','agent_orchestration'], profile:'coding_open', sources:[], router_hints:routerHints('medium','medium',['software engineering agents'],['vision']) }),
  o({ owner:'Qwen / Alibaba', family:'Qwen Coder', variant:'Qwen2.5 Coder 32B Instruct', aliases:['qwen2.5-coder-32b-instruct'], description:'Popular Qwen coding model for self-hosted coding and repo assistance.', hf_repo:'Qwen/Qwen2.5-Coder-32B-Instruct', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','code_generation','reasoning'], profile:'coding_open', sources:[], router_hints:routerHints('fast','low',['cheap coding'],['vision']) }),
  o({ owner:'Qwen / Alibaba', family:'Qwen VL', variant:'Qwen2.5 VL 72B Instruct', aliases:['qwen2.5-vl-72b-instruct'], description:'Large Qwen vision-language model for image, document, and multimodal reasoning.', hf_repo:'Qwen/Qwen2.5-VL-72B-Instruct', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','structured_output','streaming','vision_understanding','document_extraction','reasoning'], profile:'multimodal_frontier', sources:[], router_hints:routerHints('medium','medium',['open document AI','vision chat'],['audio']) }),
  o({ owner:'Qwen / Alibaba', family:'Qwen VL', variant:'Qwen2.5 VL 32B Instruct', aliases:['qwen2.5-vl-32b-instruct'], description:'Smaller Qwen VL model for economical multimodal understanding.', hf_repo:'Qwen/Qwen2.5-VL-32B-Instruct', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','structured_output','streaming','vision_understanding','document_extraction'], profile:'fast_general', sources:[], router_hints:routerHints('fast','low',['budget multimodal'],['advanced reasoning']) }),

  o({ owner:'Microsoft', family:'Phi', variant:'Phi-4 Reasoning', aliases:['phi-4-reasoning'], description:'Microsoft reasoning-specialized open model for math, coding, and planning.', hf_repo:'microsoft/Phi-4-reasoning', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming','code_generation','reasoning'], profile:'open_reasoning', sources:[], router_hints:routerHints('fast','low',['small reasoning'],['vision']) }),
  o({ owner:'Microsoft', family:'Phi', variant:'Phi-4 Mini Reasoning', aliases:['phi-4-mini-reasoning'], description:'Compact reasoning-oriented Phi release for efficient self-hosted flows.', hf_repo:'microsoft/Phi-4-mini-reasoning', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming','code_generation','reasoning'], profile:'cheap_general', sources:[], router_hints:routerHints('fast','low',['light reasoning'],['complex agents']) }),
  o({ owner:'Microsoft', family:'Phi', variant:'Phi-4 Multimodal Instruct', aliases:['phi-4-multimodal-instruct'], description:'Microsoft multimodal model combining vision and speech inputs with text output.', hf_repo:'microsoft/Phi-4-multimodal-instruct', primary_modality:'text', modalities:['text','image','audio'], capabilities:['text_input','text_output','image_input','audio_input','structured_output','streaming','vision_understanding','reasoning'], profile:'multimodal_frontier', sources:[], router_hints:routerHints('medium','medium',['small multimodal assistants'],['frontier coding']) }),

  c({ owner:'xAI', family:'Grok', variant:'Grok 4.20', aliases:['grok-4.20'], description:'xAI flagship model optimized for research, coding, and tool-connected reasoning.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','web_browsing','code_generation','reasoning','agent_orchestration'], profile:'research_web', sources:['xai_models'], router_hints:routerHints('medium','medium',['web research','analysis'],['lowest latency']) }),
  c({ owner:'xAI', family:'Grok', variant:'Grok 4.20 Multi-Agent', aliases:['grok-4.20-multi-agent'], description:'xAI orchestration-focused Grok variant for delegated multi-agent workflows.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','web_browsing','reasoning','agent_orchestration'], profile:'research_web', task_score_overrides:{ agentic:{score:95,rank:2,confidence:0.79,evidence_count:1,last_reviewed_at:TODAY,source_ids:['xai_models']} }, sources:['xai_models'], router_hints:routerHints('medium','high',['multi-agent research'],['cheap chat']) }),

  c({ owner:'Cohere', family:'Command', variant:'Command A', aliases:['command-a'], description:'Cohere flagship enterprise model for tool use, retrieval-augmented chat, and coding.', release_date:'2025-03-01', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','code_generation','reasoning'], profile:'fast_general', sources:['cohere_models'], router_hints:routerHints('fast','medium',['enterprise agents'],['top-tier reasoning']) }),
  c({ owner:'Cohere', family:'Command', variant:'Command A Vision', aliases:['command-a-vision'], description:'Cohere multimodal enterprise model for document-grounded chat, image understanding, and tool-oriented workflows.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','function_calling','structured_output','streaming','vision_understanding','document_extraction','reasoning'], profile:'multimodal_frontier', sources:['cohere_command_a_vision','cohere_models'], router_hints:routerHints('fast','medium',['enterprise vision agents','document QA'],['audio']) }),
  c({ owner:'Cohere', family:'Command', variant:'Command R+', aliases:['command-r-plus'], description:'Cohere high-end long-context model for RAG and agentic enterprise chat.', release_date:'2024-08-01', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','long_context','reasoning','agent_orchestration'], profile:'fast_general', sources:['cohere_models'], router_hints:routerHints('medium','medium',['rag orchestration'],['vision']) }),
  c({ owner:'Cohere', family:'Command', variant:'Command R', aliases:['command-r'], description:'Cohere long-context model used for grounded chat and document-centric workflows.', release_date:'2024-08-01', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','long_context','reasoning'], profile:'fast_general', sources:['cohere_models'], router_hints:routerHints('fast','medium',['document Q&A'],['vision']) }),
  c({ owner:'Cohere', family:'Command', variant:'Command R7B', aliases:['command-r7b-12-2024'], description:'Smaller Cohere model for cheaper enterprise assistants.', release_date:'2024-12-01', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming','long_context'], profile:'cheap_general', sources:['cohere_models'], router_hints:routerHints('fast','low',['cheap enterprise chat'],['hard reasoning']) }),
  c({ owner:'Cohere', family:'Embedding', variant:'Embed 4', aliases:['embed-v4.0','embed-4'], description:'Cohere premium embedding model for multilingual retrieval and semantic search.', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_premium', sources:['cohere_embeddings'], router_hints:routerHints('fast','medium',['enterprise retrieval'],['generation']) }),
  c({ owner:'Cohere', family:'Rerank', variant:'Rerank 3.5', aliases:['rerank-v3.5'], description:'Cohere reranking model for search refinement and RAG result ordering.', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','reranking'], profile:'rerank', sources:['cohere_rerank'], router_hints:routerHints('fast','medium',['rag reranking'],['generation']) }),

  c({ owner:'Moonshot AI', family:'Kimi', variant:'Kimi K2.5', aliases:['kimi-k2.5'], description:'Moonshot flagship model for long-context reasoning, coding, and agentic use.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','long_context','code_generation','reasoning','agent_orchestration'], profile:'open_reasoning', sources:['moonshot_overview','moonshot_kimi'], router_hints:routerHints('medium','medium',['long-context chat','coding'],['vision']) }),
  c({ owner:'Moonshot AI', family:'Kimi', variant:'Kimi K2 Thinking', aliases:['kimi-k2-thinking'], description:'Moonshot reasoning-focused Kimi tier for deeper problem solving.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','long_context','reasoning','agent_orchestration'], profile:'open_reasoning', sources:['moonshot_overview','moonshot_kimi'], router_hints:routerHints('medium','medium',['reasoning'],['low-cost chat']) }),
  c({ owner:'Moonshot AI', family:'Kimi', variant:'Kimi K2', aliases:['kimi-k2'], description:'General Moonshot Kimi release for chat and tool-oriented workflows.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','long_context','reasoning'], profile:'fast_general', sources:['moonshot_overview','moonshot_kimi'], router_hints:routerHints('medium','medium',['general Kimi routing'],['vision']) }),

  o({ owner:'Zhipu / GLM', family:'GLM', variant:'GLM-5.1', aliases:['glm-5.1'], description:'Open GLM release for multilingual reasoning and tool use.', hf_repo:'zai-org/GLM-5.1', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','code_generation','reasoning'], profile:'open_reasoning', sources:[], router_hints:routerHints('medium','medium',['Chinese + English reasoning'],['vision']) }),

  c({ owner:'ElevenLabs', family:'Eleven', variant:'Eleven v3', aliases:['eleven-v3'], description:'High-quality expressive ElevenLabs text-to-speech model.', primary_modality:'audio', modalities:['audio','text'], capabilities:['text_input','audio_output','streaming','realtime'], profile:'tts', sources:['eleven_models'], router_hints:routerHints('fast','high',['premium TTS'],['transcription']) }),
  c({ owner:'ElevenLabs', family:'Eleven', variant:'Flash v2.5', aliases:['flash-v2.5'], description:'Lower-latency ElevenLabs TTS model for responsive conversational voice.', primary_modality:'audio', modalities:['audio','text'], capabilities:['text_input','audio_output','streaming','realtime'], profile:'tts', sources:['eleven_models'], router_hints:routerHints('fast','medium',['live voice'],['rich expressive narration']) }),

  c({ owner:'MiniMax', family:'MiniMax', variant:'MiniMax M2.5', aliases:['minimax-m2.5'], description:'MiniMax flagship multimodal reasoning model with strong general capability and long context.', primary_modality:'text', modalities:['text','image','audio','video'], capabilities:['text_input','text_output','image_input','audio_input','video_input','tool_calling','structured_output','streaming','long_context','vision_understanding','reasoning'], profile:'multimodal_frontier', sources:['minimax_models','minimax_m25_news'], router_hints:routerHints('medium','medium',['multimodal chat'],['cheap batch routing']) }),
  c({ owner:'MiniMax', family:'Music', variant:'Music 2.5', aliases:['music-2.5'], description:'MiniMax music generation model for text-to-music composition.', primary_modality:'audio', modalities:['audio','text'], capabilities:['text_input','audio_output'], profile:'music', sources:['minimax_models'], router_hints:routerHints('medium','medium',['music generation'],['speech']) }),

  c({ owner:'StepFun', family:'Step', variant:'Step-3.5 Flash', aliases:['step-3.5-flash'], description:'StepFun flagship reasoning model for fast deep reasoning and tool-oriented workflows.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','reasoning','agent_orchestration'], profile:'open_reasoning', sources:['stepfun_overview'], router_hints:routerHints('fast','medium',['reasoning with exposed thoughts'],['vision']) }),

  c({ owner:'Writer', family:'Palmyra', variant:'Palmyra X4', aliases:['palmyra-x4'], description:'Writer enterprise model for long-context chat, reasoning, and structured generation workloads.', release_date:'2025-04-28', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','reasoning'], profile:'fast_general', sources:['writer_models','writer_pricing','writer_bedrock'], router_hints:routerHints('fast','medium',['enterprise assistants','structured generation'],['vision']) }),
  c({ owner:'Writer', family:'Palmyra', variant:'Palmyra X5', aliases:['palmyra-x5'], description:'Writer flagship enterprise model for general chat, reasoning, and tool use.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','reasoning','agent_orchestration'], profile:'fast_general', sources:['writer_models','writer_tooling','writer_structured','writer_pricing'], router_hints:routerHints('fast','medium',['enterprise writing agents'],['vision']) }),
  c({ owner:'Writer', family:'Palmyra', variant:'Palmyra Creative', aliases:['palmyra-creative'], description:'Writer model optimized for copywriting, editing, and stylistic generation.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming','reasoning'], profile:'fast_general', task_score_overrides:{ creative_writing:{score:93,rank:3,confidence:0.74,evidence_count:1,last_reviewed_at:TODAY,source_ids:['writer_models']} }, sources:['writer_models'], router_hints:routerHints('fast','medium',['brand writing','copy'],['vision']) }),
  c({ owner:'Writer', family:'Palmyra', variant:'Palmyra Vision', aliases:['palmyra-vision'], description:'Writer multimodal model for image-grounded enterprise workflows.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','structured_output','streaming','vision_understanding','document_extraction'], profile:'multimodal_frontier', sources:['writer_models','writer_vision'], router_hints:routerHints('fast','medium',['enterprise image QA'],['audio']) }),

  o({ owner:'AI21 Labs', family:'Jamba', variant:'Jamba 1.7 Large', aliases:['jamba-1.7-large','jamba-large'], description:'AI21 large hybrid-state-space model for long-context enterprise generation.', hf_repo:'ai21labs/AI21-Jamba-Large-1.7', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','long_context','reasoning'], profile:'fast_general', sources:['ai21_jamba','ai21_sdk'], router_hints:routerHints('fast','medium',['long-context generation'],['vision']) }),
  o({ owner:'AI21 Labs', family:'Jamba', variant:'Jamba Mini', aliases:['jamba-mini'], description:'AI21 compact long-context model for cost-sensitive enterprise chat.', hf_repo:'ai21labs/AI21-Jamba-Mini-1.7', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming','long_context'], profile:'cheap_general', sources:['ai21_jamba','ai21_sdk'], router_hints:routerHints('fast','low',['economical long context'],['advanced reasoning']) }),

  c({ owner:'Amazon', family:'Nova', variant:'Nova Premier', aliases:['nova-premier'], description:'Amazon highest-capability Nova model for multimodal reasoning and Bedrock-native orchestration.', release_date:'2025-04-30', primary_modality:'text', modalities:['text','image','video'], capabilities:['text_input','text_output','image_input','video_input','tool_calling','structured_output','streaming','vision_understanding','reasoning','agent_orchestration'], profile:'multimodal_frontier', sources:['amazon_nova_service_card','bedrock_models'], router_hints:routerHints('medium','high',['AWS-native frontier multimodal work'],['local use']) }),
  c({ owner:'Amazon', family:'Nova', variant:'Nova Pro', aliases:['nova-pro'], description:'Amazon high-capability multimodal generation model for Bedrock applications.', primary_modality:'text', modalities:['text','image','video'], capabilities:['text_input','text_output','image_input','video_input','tool_calling','structured_output','streaming','vision_understanding','reasoning'], profile:'multimodal_frontier', sources:['bedrock_models'], router_hints:routerHints('medium','medium',['aws-native multimodal apps'],['local use']) }),
  c({ owner:'Amazon', family:'Nova', variant:'Nova Lite', aliases:['nova-lite'], description:'Amazon lower-cost multimodal model for Bedrock chat and extraction.', primary_modality:'text', modalities:['text','image','video'], capabilities:['text_input','text_output','image_input','video_input','structured_output','streaming','vision_understanding'], profile:'fast_general', sources:['bedrock_models'], router_hints:routerHints('fast','low',['cost-sensitive AWS assistants'],['hard reasoning']) }),
  c({ owner:'Amazon', family:'Nova', variant:'Nova Micro', aliases:['nova-micro'], description:'Amazon fastest Nova tier for lightweight inference.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming'], profile:'cheap_general', sources:['bedrock_models'], router_hints:routerHints('fast','low',['simple routing','classification'],['reasoning']) }),
  c({ owner:'Amazon', family:'Nova', variant:'Nova Canvas', aliases:['nova-canvas'], description:'Amazon text-to-image generation model in Bedrock.', primary_modality:'image', modalities:['image','text'], capabilities:['text_input','image_output'], profile:'image_generation', sources:['bedrock_nova_canvas'], router_hints:routerHints('medium','medium',['bedrock image generation'],['text reasoning']) }),
  c({ owner:'Amazon', family:'Nova', variant:'Nova Reel', aliases:['nova-reel'], description:'Amazon text-to-video generation model in Bedrock.', primary_modality:'video', modalities:['video','text'], capabilities:['text_input','video_output'], profile:'video_generation', sources:['bedrock_models'], router_hints:routerHints('slow','high',['bedrock video generation'],['text reasoning']) }),
  c({ owner:'Amazon', family:'Nova', variant:'Nova Sonic', aliases:['nova-sonic'], description:'Amazon speech-to-speech model for realtime voice interactions and conversational agents.', primary_modality:'audio', modalities:['audio','text'], capabilities:['audio_input','audio_output','text_input','text_output','streaming','realtime','reasoning'], profile:'tts', sources:['amazon_nova_sonic','bedrock_models'], router_hints:routerHints('fast','medium',['realtime voice agents'],['document retrieval']) }),
  c({ owner:'Amazon', family:'Titan Embeddings', variant:'Titan Text Embeddings V2', aliases:['titan-text-embeddings-v2'], description:'Amazon embedding model for Bedrock semantic search.', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_premium', sources:['bedrock_titan_embed'], router_hints:routerHints('fast','medium',['aws retrieval'],['generation']) }),

  o({ owner:'IBM', family:'Granite', variant:'Granite 3.3 8B Instruct', aliases:['granite-3.3-8b-instruct'], description:'IBM open enterprise model for reasoning, coding, and tool-integrated workflows.', hf_repo:'ibm-granite/granite-3.3-8b-instruct', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','structured_output','streaming','code_generation','reasoning'], profile:'cheap_general', sources:[], router_hints:routerHints('fast','low',['enterprise local deployment'],['vision']) }),
  o({ owner:'IBM', family:'Granite Speech', variant:'Granite Speech 3.3 8B', aliases:['granite-speech-3.3-8b'], description:'IBM speech-capable Granite model for speech understanding and enterprise voice tasks.', hf_repo:'ibm-granite/granite-speech-3.3-8b', primary_modality:'audio', modalities:['audio','text'], capabilities:['audio_input','text_output','streaming','document_extraction'], profile:'stt', sources:[], router_hints:routerHints('fast','medium',['speech analytics'],['voice output']) }),

  c({ owner:'Stability AI', family:'Stable Diffusion', variant:'Stable Diffusion 3.5 Large', aliases:['sd3.5-large','stable-diffusion-3.5-large'], description:'Stability image generation model for high-quality creative and product images.', primary_modality:'image', modalities:['image','text'], capabilities:['text_input','image_output'], profile:'image_generation', sources:['stability_core_models','stability_bedrock'], router_hints:routerHints('medium','medium',['creative image generation'],['text reasoning']) }),
  c({ owner:'Stability AI', family:'Stable Image', variant:'Stable Image Ultra', aliases:['stable-image-ultra'], description:'Stability premium image generation model for photorealistic and design outputs.', primary_modality:'image', modalities:['image','text'], capabilities:['text_input','image_output'], profile:'image_generation', sources:['stability_core_models'], router_hints:routerHints('medium','high',['premium image generation'],['text reasoning']) }),
  c({ owner:'Stability AI', family:'Stable Audio', variant:'Stable Audio 2.0', aliases:['stable-audio-2.0'], description:'Stability model for text-to-audio and music generation.', primary_modality:'audio', modalities:['audio','text'], capabilities:['text_input','audio_output'], profile:'music', sources:['stability_audio2'], router_hints:routerHints('medium','medium',['audio generation'],['speech recognition']) }),
  c({ owner:'Black Forest Labs', family:'FLUX', variant:'FLUX 1.1 Ultra', aliases:['flux-1.1-ultra','flux-pro-1.1-ultra'], description:'Black Forest Labs highest-fidelity FLUX image model for premium quality image synthesis.', primary_modality:'image', modalities:['image','text'], capabilities:['text_input','image_output'], profile:'image_generation', sources:['bfl_models','bfl_pricing'], router_hints:routerHints('medium','high',['highest-fidelity BFL image generation'],['text reasoning']) }),
  c({ owner:'Black Forest Labs', family:'FLUX', variant:'FLUX 1.1 Pro', aliases:['flux-1.1-pro','flux-pro-1.1'], description:'Black Forest Labs premium image generation model for high-fidelity image synthesis.', primary_modality:'image', modalities:['image','text'], capabilities:['text_input','image_output'], profile:'image_generation', sources:['bfl_models','bfl_flux_11_pro'], router_hints:routerHints('medium','high',['premium BFL image generation'],['text reasoning']) }),
  c({ owner:'Black Forest Labs', family:'FLUX Kontext', variant:'FLUX Kontext Pro', aliases:['flux-kontext-pro'], description:'Black Forest Labs controllable image generation model with stronger edit and context workflows.', primary_modality:'image', modalities:['image','text'], capabilities:['text_input','image_input','image_output'], profile:'image_generation', sources:['bfl_models'], router_hints:routerHints('medium','high',['image editing and variation'],['text reasoning']) }),

  o({ owner:'TII', family:'Falcon', variant:'Falcon3 10B Instruct', aliases:['falcon3-10b-instruct'], description:'TII open-weight Falcon model for chat and reasoning.', hf_repo:'tiiuae/Falcon3-10B-Instruct', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming','code_generation','reasoning'], profile:'cheap_general', sources:[], router_hints:routerHints('fast','low',['compact open assistants'],['vision']) }),
  o({ owner:'TII', family:'Falcon', variant:'Falcon3 7B Instruct', aliases:['falcon3-7b-instruct'], description:'Smaller Falcon3 instruct model for very economical self-hosted chat.', hf_repo:'tiiuae/Falcon3-7B-Instruct', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming'], profile:'cheap_general', sources:[], router_hints:routerHints('fast','low',['small open chat'],['complex reasoning']) }),

  o({ owner:'Snowflake / Arctic', family:'Arctic', variant:'Arctic Text2SQL R1 7B', aliases:['arctic-text2sql-r1-7b'], description:'Snowflake model specialized for text-to-SQL generation and analytic reasoning.', hf_repo:'Snowflake/Arctic-Text2SQL-R1-7B', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','code_generation','reasoning'], profile:'coding_open', sources:[], router_hints:routerHints('fast','low',['text-to-sql'],['vision']) }),
  o({ owner:'Snowflake / Arctic', family:'Arctic Embed', variant:'Arctic Embed L v2.0', aliases:['snowflake-arctic-embed-l-v2.0'], description:'Snowflake long-text embedding model for search and retrieval.', hf_repo:'Snowflake/snowflake-arctic-embed-l-v2.0', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_open', sources:[], router_hints:routerHints('fast','low',['self-hosted retrieval'],['generation']) }),

  o({ owner:'Nomic', family:'Nomic Embed', variant:'nomic-embed-text-v1.5', aliases:['nomic-embed-text-v1.5'], description:'Nomic open embedding model for large-scale retrieval and semantic search.', hf_repo:'nomic-ai/nomic-embed-text-v1.5', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_open', sources:[], router_hints:routerHints('fast','low',['open embeddings'],['generation']) }),
  o({ owner:'Nomic', family:'Nomic Embed', variant:'nomic-embed-vision-v1.5', aliases:['nomic-embed-vision-v1.5'], description:'Nomic multimodal embedding model for image-text retrieval.', hf_repo:'nomic-ai/nomic-embed-vision-v1.5', primary_modality:'embedding', modalities:['embedding','text','image'], capabilities:['text_input','image_input','embeddings','vision_understanding'], profile:'embedding_open', sources:[], router_hints:routerHints('fast','low',['multimodal retrieval'],['generation']) }),

  o({ owner:'Jina AI', family:'Jina Embeddings', variant:'jina-embeddings-v3', aliases:['jina-embeddings-v3'], description:'Jina multilingual embedding model for retrieval and ranking stacks.', hf_repo:'jinaai/jina-embeddings-v3', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_open', sources:[], router_hints:routerHints('fast','low',['multilingual retrieval'],['generation']) }),
  o({ owner:'Jina AI', family:'Jina Reranker', variant:'jina-reranker-v2-base-multilingual', aliases:['jina-reranker-v2-base-multilingual'], description:'Jina multilingual reranker for search refinement.', hf_repo:'jinaai/jina-reranker-v2-base-multilingual', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','reranking'], profile:'rerank', sources:[], router_hints:routerHints('fast','low',['multilingual reranking'],['generation']) }),

  c({ owner:'Voyage AI', family:'Voyage', variant:'voyage-4-large', aliases:['voyage-4-large'], description:'Voyage highest-quality embedding model for enterprise retrieval.', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_premium', sources:['voyage_embeddings','voyage_pricing'], router_hints:routerHints('fast','high',['top-quality retrieval'],['generation']) }),
  c({ owner:'Voyage AI', family:'Voyage', variant:'voyage-4', aliases:['voyage-4'], description:'Balanced Voyage embedding model for production retrieval.', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','embeddings'], profile:'embedding_premium', sources:['voyage_embeddings','voyage_pricing'], router_hints:routerHints('fast','medium',['general retrieval'],['generation']) }),
  c({ owner:'Voyage AI', family:'Voyage Multimodal', variant:'voyage-multimodal-3.5', aliases:['voyage-multimodal-3.5'], description:'Voyage multimodal embedding model for cross-modal retrieval.', primary_modality:'embedding', modalities:['embedding','text','image'], capabilities:['text_input','image_input','embeddings','vision_understanding'], profile:'embedding_premium', sources:['voyage_multimodal','voyage_pricing'], router_hints:routerHints('fast','medium',['image-text retrieval'],['generation']) }),
  c({ owner:'Voyage AI', family:'Rerank', variant:'rerank-2.5', aliases:['rerank-2.5'], description:'Voyage reranking model for search and RAG ranking.', primary_modality:'embedding', modalities:['embedding','text'], capabilities:['text_input','reranking'], profile:'rerank', sources:['voyage_rerank','voyage_pricing'], router_hints:routerHints('fast','medium',['production reranking'],['generation']) }),

  c({ owner:'Perplexity', family:'Sonar', variant:'Sonar Pro', aliases:['sonar-pro'], description:'Perplexity grounded model focused on answer synthesis with web retrieval.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','streaming','web_browsing','reasoning','research'], profile:'research_web', sources:['perplexity_sonar','perplexity_openai_compat'], router_hints:routerHints('medium','medium',['web research answers'],['offline reasoning']) }),
  c({ owner:'Perplexity', family:'Sonar', variant:'Sonar Reasoning Pro', aliases:['sonar-reasoning-pro'], description:'Perplexity reasoning-heavy grounded model for research and analytic answers.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','streaming','web_browsing','reasoning','research','agent_orchestration'], profile:'research_web', sources:['perplexity_sonar','perplexity_openai_compat'], router_hints:routerHints('medium','high',['grounded reasoning'],['local/private no-web tasks']) }),
  c({ owner:'Perplexity', family:'Sonar', variant:'Sonar Deep Research', aliases:['sonar-deep-research'], description:'Perplexity deep research mode for multi-hop grounded synthesis.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','streaming','web_browsing','reasoning','research','agent_orchestration'], profile:'research_web', task_score_overrides:{ research:{score:97,rank:1,confidence:0.82,evidence_count:2,last_reviewed_at:TODAY,source_ids:['perplexity_sonar','perplexity_changelog']} }, sources:['perplexity_sonar','perplexity_changelog'], router_hints:routerHints('slow','high',['deep research tasks'],['simple chat']) }),

  c({ owner:'Recraft', family:'Recraft', variant:'Recraft V3', aliases:['recraft-v3'], description:'Recraft image generation model for illustration, vector-like outputs, and design workflows.', primary_modality:'image', modalities:['image','text'], capabilities:['text_input','image_output'], profile:'image_generation', sources:['recraft_api'], router_hints:routerHints('medium','medium',['design generation'],['text reasoning']) }),
  c({ owner:'Pika', family:'Pika', variant:'Pika 2.5', aliases:['pika-2.5'], description:'Pika video generation model for text-to-video, image-to-video, and creative motion editing workflows.', primary_modality:'video', modalities:['video','image','text'], capabilities:['text_input','image_input','video_output'], profile:'video_generation', sources:['pika_api','pika_pricing'], router_hints:routerHints('medium','high',['creative short-form video generation'],['text reasoning']) }),

  c({ owner:'Runway', family:'Gen-4', variant:'Gen-4 Turbo', aliases:['gen4_turbo','gen-4-turbo'], description:'Runway text-to-video and image-to-video model optimized for faster generation.', primary_modality:'video', modalities:['video','image','text'], capabilities:['text_input','image_input','video_output'], profile:'video_generation', sources:['runway_changelog','runway_billing'], router_hints:routerHints('fast','high',['fast video generation'],['text reasoning']) }),
  c({ owner:'Runway', family:'Gen-4', variant:'Gen-4 Image', aliases:['gen4_image','gen-4-image'], description:'Runway image generation model for cinematic still images and style exploration.', primary_modality:'image', modalities:['image','text'], capabilities:['text_input','image_output'], profile:'image_generation', sources:['runway_changelog','runway_billing'], router_hints:routerHints('fast','high',['cinematic images'],['text reasoning']) }),

  c({ owner:'Luma', family:'Ray', variant:'Ray 2', aliases:['ray-2'], description:'Luma Dream Machine video model for text-to-video and image-to-video creation.', primary_modality:'video', modalities:['video','image','text'], capabilities:['text_input','image_input','video_output'], profile:'video_generation', sources:['luma_video'], router_hints:routerHints('medium','high',['creative video'],['text reasoning']) }),
  c({ owner:'Luma', family:'Ray', variant:'Ray 2 Flash', aliases:['ray-2-flash'], description:'Lower-latency Ray variant for faster Luma video generation.', primary_modality:'video', modalities:['video','image','text'], capabilities:['text_input','image_input','video_output'], profile:'video_generation', sources:['luma_video'], router_hints:routerHints('fast','medium',['fast video'],['text reasoning']) }),

  c({ owner:'AssemblyAI', family:'Universal', variant:'Universal-3', aliases:['universal-3'], description:'AssemblyAI premium speech-to-text model for transcription and speech analytics.', primary_modality:'audio', modalities:['audio','text'], capabilities:['audio_input','text_output','streaming','document_extraction'], profile:'stt', sources:['assemblyai_benchmarks','assemblyai_products'], router_hints:routerHints('fast','medium',['transcription'],['voice output']) }),
  c({ owner:'AssemblyAI', family:'Universal', variant:'Universal Streaming', aliases:['universal-streaming'], description:'AssemblyAI streaming speech recognition model for realtime transcription.', primary_modality:'audio', modalities:['audio','text'], capabilities:['audio_input','text_output','streaming','realtime'], profile:'stt', sources:['assemblyai_products'], router_hints:routerHints('fast','medium',['realtime STT'],['offline batch ranking']) }),

  o({ owner:'Databricks', family:'DBRX', variant:'DBRX Instruct', aliases:['dbrx-instruct'], description:'Databricks open mixture-of-experts model for enterprise chat and reasoning.', hf_repo:'databricks/dbrx-instruct', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming','long_context','code_generation','reasoning'], profile:'open_reasoning', sources:[], router_hints:routerHints('medium','low',['open enterprise chat'],['vision']) }),
  o({ owner:'Salesforce', family:'xLAM', variant:'xLAM-2-8b-fc-r', aliases:['xlam-2-8b-fc-r'], description:'Salesforce function-calling model for tool selection and API orchestration.', hf_repo:'Salesforce/xLAM-2-8b-fc-r', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','tool_calling','function_calling','structured_output','streaming','agent_orchestration'], profile:'fast_general', sources:[], router_hints:routerHints('fast','low',['tool router model'],['deep reasoning']) }),
  o({ owner:'01.AI', family:'Yi', variant:'Yi-Lightning', aliases:['yi-lightning'], description:'01.AI open model oriented around fast multilingual chat and retrieval-friendly generation.', hf_repo:'01-ai/Yi-Lightning', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming','reasoning'], profile:'cheap_general', sources:[], router_hints:routerHints('fast','low',['Chinese/English chat'],['vision']) }),
  c({ owner:'Baidu', family:'ERNIE', variant:'ERNIE 4.5', aliases:['ernie-4.5'], description:'Baidu flagship ERNIE model for Chinese-first reasoning and assistant tasks.', primary_modality:'text', modalities:['text','image'], capabilities:['text_input','text_output','image_input','tool_calling','structured_output','streaming','vision_understanding','reasoning'], profile:'fast_general', sources:['baidu_ernie_45'], router_hints:routerHints('medium','medium',['Chinese market support'],['verified cross-provider routing']) }),
  c({ owner:'Tencent', family:'Hunyuan', variant:'Hunyuan Turbo S', aliases:['hunyuan-turbo-s'], description:'Tencent general-purpose model for chat and reasoning in Chinese enterprise settings.', primary_modality:'text', modalities:['text'], capabilities:['text_input','text_output','structured_output','streaming','reasoning'], profile:'fast_general', sources:['tencent_hunyuan_models'], router_hints:routerHints('fast','medium',['Chinese enterprise chat'],['provider portability']) }),
  o({ owner:'Kyutai', family:'TTS', variant:'Kyutai Unmute', aliases:['kyutai-unmute'], description:'Kyutai open text-to-speech model with streaming-oriented design.', hf_repo:'kyutai/tts-1.6b-en_fr', primary_modality:'audio', modalities:['audio','text'], capabilities:['text_input','audio_output','streaming','realtime'], profile:'tts', sources:[], router_hints:routerHints('fast','low',['open streaming TTS'],['speech recognition']) }),
];

const OR_MAPPING_SPECS = [
  ['OpenAI','GPT','GPT-5.4','openai/gpt-5.4'],['OpenAI','GPT','GPT-5.4 Mini','openai/gpt-5.4-mini'],['OpenAI','GPT','GPT-5.4 Nano','openai/gpt-5.4-nano'],
  ['Anthropic','Claude','Claude Opus 4.1','anthropic/claude-opus-4.1'],['Anthropic','Claude','Claude Sonnet 4.5','anthropic/claude-sonnet-4.5'],['Anthropic','Claude','Claude Haiku 4.5','anthropic/claude-haiku-4.5'],
  ['Google / DeepMind','Gemini','Gemini 3.1 Pro Preview','google/gemini-3.1-pro-preview'],['Google / DeepMind','Gemini','Gemini 3.1 Flash Preview','google/gemini-3.1-flash-preview'],['Google / DeepMind','Gemini','Gemini 3.1 Flash Lite Preview','google/gemini-3.1-flash-lite-preview'],
  ['Mistral','Mistral','Mistral Large 25.12','mistralai/mistral-large-2512'],['Mistral','Mistral','Mistral Medium 3.1','mistralai/mistral-medium-3.1'],['Mistral','Devstral','Devstral 25.12','mistralai/devstral-2512'],
  ['Cohere','Command','Command A','cohere/command-a'],['Cohere','Command','Command R7B','cohere/command-r7b-12-2024'],
  ['xAI','Grok','Grok 4.20','x-ai/grok-4.20'],['xAI','Grok','Grok 4.20 Multi-Agent','x-ai/grok-4.20-multi-agent'],
  ['Moonshot AI','Kimi','Kimi K2.5','moonshotai/kimi-k2.5'],['Moonshot AI','Kimi','Kimi K2 Thinking','moonshotai/kimi-k2-thinking'],['Moonshot AI','Kimi','Kimi K2','moonshotai/kimi-k2'],
  ['DeepSeek','DeepSeek','DeepSeek V3.1','deepseek/deepseek-v3.1-terminus'],['DeepSeek','DeepSeek','DeepSeek R1','deepseek/deepseek-r1'],
  ['Meta','Llama','Llama 4 Maverick 17B 128E Instruct','meta-llama/llama-4-maverick'],['Meta','Llama','Llama 4 Scout 17B 16E Instruct','meta-llama/llama-4-scout'],['Meta','Llama','Llama 3.3 70B Instruct','meta-llama/llama-3.3-70b-instruct'],
  ['Qwen / Alibaba','Qwen','Qwen3 235B A22B','qwen/qwen3-235b-a22b'],['Qwen / Alibaba','Qwen Coder','Qwen3 Coder 480B A35B Instruct','qwen/qwen3-coder'],['Qwen / Alibaba','Qwen VL','Qwen2.5 VL 72B Instruct','qwen/qwen2.5-vl-72b-instruct'],
  ['Zhipu / GLM','GLM','GLM-5.1','z-ai/glm-5.1']
];

const LEGACY_PROVIDER_UID_REMAPS = new Map([
  ['Cohere API|command-r-plus-08-2024', modelRef('Cohere', 'Command', 'Command R+')],
  ['Black Forest Labs API|flux-pro-1.1-ultra', modelRef('Black Forest Labs', 'FLUX', 'FLUX 1.1 Ultra')],
]);

const BENCHMARK_SOURCE_IDS = new Set([
  'livebench_leaderboard',
  'livebench_paper',
  'aider_polyglot_leaderboard',
  'bfcl_v4_leaderboard',
  'bfcl_intro',
  'mmmu_leaderboard',
  'ocrbench_v2_leaderboard',
  'docvqa_official',
  'gaia2_leaderboard_update',
  'swebench_official',
  'assemblyai_benchmarks',
]);

const MODEL_PATCHES = new Map([
  [modelRef('Anthropic', 'Claude', 'Claude Opus 4.1'), {
    release_date: '2025-08-05',
    sources: ['anthropic_overview', 'anthropic_pricing', 'livebench_leaderboard', 'aider_polyglot_leaderboard'],
    task_scores: {
      coding: { confidence: 0.85, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['anthropic_overview', 'aider_polyglot_leaderboard', 'livebench_leaderboard'] },
      reasoning: { confidence: 0.86, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['anthropic_overview', 'livebench_leaderboard', 'livebench_paper'] },
      math: { confidence: 0.84, evidence_count: 2, last_reviewed_at: TODAY, source_ids: ['anthropic_overview', 'livebench_leaderboard'] },
    },
  }],
  [modelRef('Anthropic', 'Claude', 'Claude Sonnet 4.5'), {
    release_date: '2025-09-29',
    sources: ['anthropic_overview', 'anthropic_pricing', 'bfcl_v4_leaderboard', 'gaia2_leaderboard_update'],
    task_scores: {
      tool_use: { confidence: 0.82, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['anthropic_overview', 'bfcl_v4_leaderboard', 'bfcl_intro'] },
      agentic: { confidence: 0.8, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['anthropic_overview', 'gaia2_leaderboard_update', 'swebench_official'] },
    },
  }],
  [modelRef('Anthropic', 'Claude', 'Claude Haiku 4.5'), {
    release_date: '2025-10-01',
    sources: ['anthropic_overview', 'anthropic_pricing'],
  }],
  [modelRef('Anthropic', 'Claude', 'Claude 3.7 Sonnet'), {
    release_date: '2025-02-19',
    sources: ['anthropic_claude_37_release', 'anthropic_pricing'],
    task_scores: {
      reasoning: { confidence: 0.77, evidence_count: 2, last_reviewed_at: TODAY, source_ids: ['anthropic_claude_37_release', 'livebench_leaderboard'] },
    },
  }],
  [modelRef('Google / DeepMind', 'Gemini', 'Gemini 2.5 Pro'), {
    sources: ['google_models', 'google_pricing', 'livebench_leaderboard', 'mmmu_leaderboard'],
    task_scores: {
      reasoning: { confidence: 0.82, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['google_models', 'livebench_leaderboard', 'livebench_paper'] },
      math: { confidence: 0.8, evidence_count: 2, last_reviewed_at: TODAY, source_ids: ['google_models', 'livebench_leaderboard'] },
      vision: { confidence: 0.88, evidence_count: 2, last_reviewed_at: TODAY, source_ids: ['google_models', 'mmmu_leaderboard'] },
      multimodal: { confidence: 0.88, evidence_count: 2, last_reviewed_at: TODAY, source_ids: ['google_models', 'mmmu_leaderboard'] },
    },
  }],
  [modelRef('Google / DeepMind', 'Gemini', 'Gemini 3.1 Pro Preview'), {
    release_date: '2026-02-19',
    sources: ['google_changelog', 'google_models', 'google_pricing'],
  }],
  [modelRef('Google / DeepMind', 'Gemini', 'Gemini 3.1 Flash Lite Preview'), {
    release_date: '2026-03-03',
    sources: ['google_changelog', 'google_models', 'google_pricing'],
  }],
  [modelRef('Google / DeepMind', 'Embedding', 'Gemini Embedding 001'), {
    release_date: '2025-07-14',
    sources: ['google_changelog', 'google_embeddings', 'google_pricing'],
  }],
  [modelRef('OpenAI', 'GPT', 'GPT-5.4'), {
    sources: ['openai_gpt_54_release', 'openai_pricing', 'livebench_leaderboard', 'aider_polyglot_leaderboard', 'bfcl_v4_leaderboard'],
    task_scores: {
      coding: { confidence: 0.9, evidence_count: 4, last_reviewed_at: TODAY, source_ids: ['openai_models', 'aider_polyglot_leaderboard', 'livebench_leaderboard', 'swebench_official'] },
      reasoning: { confidence: 0.9, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['openai_models', 'livebench_leaderboard', 'livebench_paper'] },
      math: { confidence: 0.88, evidence_count: 2, last_reviewed_at: TODAY, source_ids: ['openai_models', 'livebench_leaderboard'] },
      tool_use: { confidence: 0.86, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['openai_models', 'bfcl_v4_leaderboard', 'bfcl_intro'] },
      agentic: { confidence: 0.84, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['openai_models', 'gaia2_leaderboard_update', 'swebench_official'] },
    },
  }],
  [modelRef('OpenAI', 'o', 'o3'), {
    sources: ['openai_models', 'livebench_leaderboard', 'livebench_paper'],
    task_scores: {
      reasoning: { confidence: 0.88, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['openai_models', 'livebench_leaderboard', 'livebench_paper'] },
      math: { confidence: 0.87, evidence_count: 2, last_reviewed_at: TODAY, source_ids: ['openai_models', 'livebench_leaderboard'] },
    },
  }],
  [modelRef('DeepSeek', 'DeepSeek', 'DeepSeek R1'), {
    sources: ['deepseek_api', 'livebench_leaderboard', 'livebench_paper'],
    task_scores: {
      reasoning: { confidence: 0.82, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['deepseek_api', 'livebench_leaderboard', 'livebench_paper'] },
      math: { confidence: 0.82, evidence_count: 2, last_reviewed_at: TODAY, source_ids: ['deepseek_api', 'livebench_leaderboard'] },
    },
  }],
  [modelRef('Qwen / Alibaba', 'Qwen Coder', 'Qwen3 Coder 480B A35B Instruct'), {
    sources: ['aider_polyglot_leaderboard', 'swebench_official'],
    task_scores: {
      coding: { confidence: 0.85, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['qwen_qwen3_coder_480b_a35b_instruct', 'aider_polyglot_leaderboard', 'swebench_official'] },
    },
  }],
  [modelRef('Mistral', 'OCR', 'Mistral OCR'), {
    task_scores: {
      document_extraction: { confidence: 0.88, evidence_count: 4, last_reviewed_at: TODAY, source_ids: ['mistral_models', 'mistral_ocr_benchmark', 'ocrbench_v2_leaderboard', 'docvqa_official'] },
      vision: { confidence: 0.8, evidence_count: 3, last_reviewed_at: TODAY, source_ids: ['mistral_models', 'ocrbench_v2_leaderboard', 'docvqa_official'] },
    },
    sources: ['mistral_models', 'mistral_ocr_benchmark', 'ocrbench_v2_leaderboard', 'docvqa_official'],
  }],
  [modelRef('Amazon', 'Nova', 'Nova Pro'), { release_date: '2025-04-30', sources: ['amazon_nova_service_card', 'bedrock_nova_pro'] }],
  [modelRef('Amazon', 'Nova', 'Nova Lite'), { release_date: '2025-04-30', sources: ['amazon_nova_service_card', 'bedrock_nova_lite'] }],
  [modelRef('Amazon', 'Nova', 'Nova Micro'), { release_date: '2025-04-30', sources: ['amazon_nova_service_card', 'bedrock_nova_micro'] }],
  [modelRef('Amazon', 'Nova', 'Nova Reel'), { release_date: '2025-07-16', sources: ['amazon_nova_reel_service_card', 'bedrock_models'] }],
  [modelRef('Amazon', 'Titan Embeddings', 'Titan Text Embeddings V2'), { release_date: '2024-04-30', sources: ['bedrock_titan_embed'] }],
  [modelRef('Cohere', 'Embedding', 'Embed 4'), { release_date: '2025-04-15', sources: ['cohere_embed4_release', 'cohere_embeddings'] }],
  [modelRef('Cohere', 'Rerank', 'Rerank 3.5'), { release_date: '2024-12-02', sources: ['cohere_rerank35_release', 'cohere_rerank'] }],
  [modelRef('ElevenLabs', 'Eleven', 'Eleven v3'), { release_date: '2025-08-20', sources: ['eleven_v3_release', 'eleven_models'] }],
]);

const MAPPING_PATCHES = new Map([
  ['OpenAI API|gpt-5.4', { context_window: 1_050_000, max_output_tokens: 128_000, pricing: { input_text_per_million_tokens_usd: 2.5, output_text_per_million_tokens_usd: 15 }, sources: ['openai_gpt_54_release', 'openai_pricing'] }],
  ['OpenAI API|gpt-5.4-mini', { context_window: 400_000, max_output_tokens: 128_000, pricing: { input_text_per_million_tokens_usd: 0.75, output_text_per_million_tokens_usd: 4.5 }, sources: ['openai_gpt_54_mini_nano_release', 'openai_pricing'] }],
  ['OpenAI API|gpt-5.4-nano', { context_window: 400_000, max_output_tokens: 128_000, pricing: { input_text_per_million_tokens_usd: 0.2, output_text_per_million_tokens_usd: 1.25 }, sources: ['openai_gpt_54_mini_nano_release', 'openai_pricing'] }],
  ['OpenAI API|gpt-4.1', { context_window: 1_000_000, max_output_tokens: 32_768, pricing: { input_text_per_million_tokens_usd: 2, output_text_per_million_tokens_usd: 8 }, sources: ['openai_gpt_41_release', 'openai_pricing'] }],
  ['OpenAI API|gpt-4.1-mini', { context_window: 1_000_000, max_output_tokens: 32_768, pricing: { input_text_per_million_tokens_usd: 0.4, output_text_per_million_tokens_usd: 1.6 }, sources: ['openai_gpt_41_release', 'openai_pricing'] }],
  ['OpenAI API|gpt-4.1-nano', { context_window: 1_000_000, max_output_tokens: 32_768, pricing: { input_text_per_million_tokens_usd: 0.1, output_text_per_million_tokens_usd: 0.4 }, sources: ['openai_gpt_41_release', 'openai_pricing'] }],
  ['Anthropic API|claude-opus-4-1', { context_window: 200_000, pricing: { input_text_per_million_tokens_usd: 15, output_text_per_million_tokens_usd: 75 }, sources: ['anthropic_overview', 'anthropic_pricing'] }],
  ['Anthropic API|claude-sonnet-4-5', { context_window: 200_000, pricing: { input_text_per_million_tokens_usd: 3, output_text_per_million_tokens_usd: 15 }, sources: ['anthropic_overview', 'anthropic_pricing'] }],
  ['Anthropic API|claude-haiku-4-5', { context_window: 200_000, max_output_tokens: 64_000, pricing: { input_text_per_million_tokens_usd: 1, output_text_per_million_tokens_usd: 5 }, sources: ['anthropic_overview', 'anthropic_pricing'] }],
  ['Anthropic API|claude-3-7-sonnet', { context_window: 200_000, max_output_tokens: 128_000, pricing: { input_text_per_million_tokens_usd: 3, output_text_per_million_tokens_usd: 15 }, sources: ['anthropic_overview', 'anthropic_pricing', 'anthropic_claude_37_release'] }],
  ['Google AI Studio|gemini-2.5-pro', { context_window: 1_000_000, pricing: { input_text_per_million_tokens_usd: 1.25, output_text_per_million_tokens_usd: 10, notes: 'Official pricing is tiered above 200k prompt/output thresholds; stored here at the <=200k baseline.' }, sources: ['google_models', 'google_pricing'] }],
  ['Google AI Studio|gemini-2.5-flash', { context_window: 1_000_000, pricing: { input_text_per_million_tokens_usd: 0.3, output_text_per_million_tokens_usd: 2.5, notes: 'Audio input is separately priced at $1.00 per 1M input tokens in Google pricing.' }, sources: ['google_models', 'google_pricing'] }],
  ['Google AI Studio|gemini-3.1-pro-preview', { context_window: 1_048_576, max_output_tokens: 65_536, pricing: { input_text_per_million_tokens_usd: 2, output_text_per_million_tokens_usd: 12 }, sources: ['google_models', 'google_pricing', 'google_changelog'] }],
  ['Google AI Studio|gemini-3.1-flash-preview', { context_window: 1_048_576, max_output_tokens: 65_536, sources: ['google_models', 'google_changelog'] }],
  ['Google AI Studio|gemini-3.1-flash-lite-preview', { context_window: 1_048_576, max_output_tokens: 65_536, pricing: { input_text_per_million_tokens_usd: 0.25, output_text_per_million_tokens_usd: 1.5 }, sources: ['google_models', 'google_pricing', 'google_changelog'] }],
  ['Google AI Studio|gemini-embedding-001', { context_window: 2_048, pricing: { embedding_per_million_tokens_usd: 0.15 }, sources: ['google_embeddings', 'google_pricing', 'google_changelog'] }],
  ['Google Vertex AI|gemini-2.5-pro', { context_window: 1_000_000, pricing: { input_text_per_million_tokens_usd: 1.25, output_text_per_million_tokens_usd: 10, notes: 'Official pricing is tiered above 200k prompt/output thresholds; stored here at the <=200k baseline.' }, sources: ['google_models', 'google_pricing'] }],
  ['Google Vertex AI|gemini-2.5-flash', { context_window: 1_000_000, pricing: { input_text_per_million_tokens_usd: 0.3, output_text_per_million_tokens_usd: 2.5, notes: 'Audio input is separately priced at $1.00 per 1M input tokens in Google pricing.' }, sources: ['google_models', 'google_pricing'] }],
  ['Amazon Bedrock|amazon.nova-premier-v1:0', { context_window: 300_000, max_output_tokens: 5_000, sources: ['amazon_nova_service_card', 'bedrock_models'] }],
  ['Amazon Bedrock|amazon.nova-pro-v1:0', { context_window: 300_000, max_output_tokens: 5_000, sources: ['bedrock_nova_pro', 'amazon_nova_service_card'] }],
  ['Amazon Bedrock|amazon.nova-lite-v1:0', { context_window: 300_000, max_output_tokens: 5_000, sources: ['bedrock_nova_lite', 'amazon_nova_service_card'] }],
  ['Amazon Bedrock|amazon.nova-micro-v1:0', { context_window: 128_000, max_output_tokens: 5_000, sources: ['bedrock_nova_micro', 'amazon_nova_service_card'] }],
  ['Amazon Bedrock|amazon.titan-embed-text-v2:0', { context_window: 8_000, sources: ['bedrock_titan_embed'] }],
  ['Amazon Bedrock|writer.palmyra-x5-v1:0', { context_window: 1_040_000, max_output_tokens: 8_192, sources: ['bedrock_palmyra_x5', 'writer_bedrock'] }],
  ['Cohere API|command-a-03-2025', { context_window: 256_000, max_output_tokens: 8_000, pricing: { input_text_per_million_tokens_usd: 2.5, output_text_per_million_tokens_usd: 10 }, sources: ['cohere_command_a', 'cohere_pricing'] }],
  ['Cohere API|command-a-vision-07-2025', { context_window: 128_000, max_output_tokens: 8_000, sources: ['cohere_command_a_vision', 'cohere_models'] }],
  ['Cohere API|command-r-plus-08-2024', { context_window: 128_000, max_output_tokens: 4_000, pricing: { input_text_per_million_tokens_usd: 2.5, output_text_per_million_tokens_usd: 10 }, sources: ['cohere_command_r_plus', 'cohere_pricing'] }],
  ['Cohere API|command-r-08-2024', { context_window: 128_000, max_output_tokens: 4_000, pricing: { input_text_per_million_tokens_usd: 0.15, output_text_per_million_tokens_usd: 0.6 }, sources: ['cohere_models', 'cohere_pricing'] }],
  ['Cohere API|command-r7b-12-2024', { context_window: 128_000, max_output_tokens: 4_000, pricing: { input_text_per_million_tokens_usd: 0.0375, output_text_per_million_tokens_usd: 0.15 }, sources: ['cohere_command_r7b', 'cohere_pricing'] }],
  ['Voyage API|voyage-4-large', { context_window: 32_000, pricing: { embedding_per_million_tokens_usd: 0.12 }, sources: ['voyage_embeddings', 'voyage_pricing'] }],
  ['Voyage API|voyage-4', { context_window: 32_000, pricing: { embedding_per_million_tokens_usd: 0.06 }, sources: ['voyage_embeddings', 'voyage_pricing'] }],
  ['Voyage API|voyage-multimodal-3.5', { context_window: 32_000, sources: ['voyage_multimodal', 'voyage_pricing'] }],
  ['Voyage API|rerank-2.5', { context_window: 32_000, pricing: { rerank_per_1k_searches_usd: null, notes: 'Official Voyage reranking pricing is token-based and is not normalized into rerank_per_1k_searches_usd in this schema.' }, sources: ['voyage_rerank', 'voyage_pricing'] }],
  ['Writer API|palmyra-x4', { context_window: 128_000, max_output_tokens: 4_096, pricing: { input_text_per_million_tokens_usd: 2.5, output_text_per_million_tokens_usd: 10 }, sources: ['writer_models', 'writer_pricing'] }],
  ['Writer API|palmyra-x5', { context_window: 1_000_000, max_output_tokens: 8_192, pricing: { input_text_per_million_tokens_usd: 0.6, output_text_per_million_tokens_usd: 6 }, sources: ['writer_models', 'writer_pricing'] }],
  ['Writer API|palmyra-creative', { context_window: 128_000, max_output_tokens: 4_096, pricing: { input_text_per_million_tokens_usd: 5, output_text_per_million_tokens_usd: 12 }, sources: ['writer_models', 'writer_pricing'] }],
  ['Writer API|palmyra-vision', { context_window: 8_000, max_output_tokens: 4_096, pricing: { input_text_per_million_tokens_usd: 7.5, notes: 'Writer Vision has multimodal pricing; output-side image/video pricing remains provider-specific and is not normalized here.' }, sources: ['writer_models', 'writer_pricing', 'writer_vision'] }],
  ['Perplexity API|sonar-pro', { context_window: 200_000, max_output_tokens: 8_000, pricing: { input_text_per_million_tokens_usd: 3, output_text_per_million_tokens_usd: 15, notes: 'Perplexity also charges search and citation fees outside token pricing.' }, sources: ['perplexity_sonar_pro', 'perplexity_pricing', 'perplexity_openai_compat'] }],
  ['Perplexity API|sonar-reasoning-pro', { context_window: 128_000, max_output_tokens: 8_000, pricing: { input_text_per_million_tokens_usd: 2, output_text_per_million_tokens_usd: 8, notes: 'Perplexity also charges search and citation fees outside token pricing.' }, sources: ['perplexity_sonar_reasoning_pro', 'perplexity_pricing', 'perplexity_openai_compat'] }],
  ['Perplexity API|sonar-deep-research', { context_window: 128_000, max_output_tokens: 8_000, pricing: { input_text_per_million_tokens_usd: 2, output_text_per_million_tokens_usd: 8, notes: 'Citations are additionally priced at $5 per 1,000 queries.' }, sources: ['perplexity_sonar_deep_research', 'perplexity_pricing', 'perplexity_openai_compat'] }],
  ['Groq|openai/gpt-oss-120b', { context_window: 131_072, max_output_tokens: 65_536, sources: ['groq_gpt_oss_120b', 'groq_models'] }],
  ['Groq|openai/gpt-oss-20b', { context_window: 131_072, max_output_tokens: 65_536, sources: ['groq_gpt_oss_20b', 'groq_models'] }],
  ['Black Forest Labs API|flux-pro-1.1-ultra', { pricing: { image_per_output_usd: 0.06 }, sources: ['bfl_pricing'] }],
  ['Black Forest Labs API|flux-kontext-pro', { pricing: { image_per_output_usd: 0.04 }, sources: ['bfl_pricing'] }],
]);

function mappingKey(mapping) {
  return `${mapping.model_uid}|${mapping.access_provider}|${mapping.provider_model_id}`;
}

function orPricing(item) {
  const pricing = blankPricing();
  const prompt = Number(item?.pricing?.prompt ?? NaN);
  const completion = Number(item?.pricing?.completion ?? NaN);
  const image = Number(item?.pricing?.image ?? NaN);
  if (!Number.isNaN(prompt) && prompt > 0) pricing.input_text_per_million_tokens_usd = prompt * 1_000_000;
  if (!Number.isNaN(completion) && completion > 0) pricing.output_text_per_million_tokens_usd = completion * 1_000_000;
  if (!Number.isNaN(image) && image > 0) pricing.image_per_output_usd = image;
  pricing.notes = 'Pricing normalized from OpenRouter public catalog.';
  return pricing;
}

function schemaDocument() {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'AI Model Registry Schema',
    type: 'object',
    properties: {
      canonical_model: {
        type: 'object',
        required: ['model_uid','canonical_owner','family_name','variant_name','normalized_slug','aliases','description','release_date','status','license','open_source','open_weights','primary_modality','modalities','capabilities','strength_tags','task_scores','sources','router_hints'],
        properties: {
          model_uid: { type:'string' }, canonical_owner:{ enum: CANONICAL_OWNERS }, family_name:{ type:'string' }, variant_name:{ type:'string' }, normalized_slug:{ type:'string' }, aliases:{ type:'array', items:{ type:'string' } }, description:{ type:'string' }, release_date:{ type:['string','null'] }, status:{ enum: LIFECYCLE_STATUSES }, license:{ type:['string','null'] }, open_source:{ type:['boolean','null'] }, open_weights:{ type:['boolean','null'] }, primary_modality:{ enum: MODALITIES }, modalities:{ type:'array', items:{ enum: MODALITIES } }, capabilities:{ type:'object' }, strength_tags:{ type:'array', items:{ type:'string' } }, task_scores:{ type:'object' }, sources:{ type:'array', items:{ type:'string' } }, router_hints:{ type:'object' }
        }
      },
      provider_mapping: {
        type:'object',
        required:['model_uid','access_provider','provider_model_id','provider_model_label','api_compatibility','available','local_runnable','pricing','context_window','max_output_tokens','notes','sources'],
        properties: {
          model_uid:{ type:'string' }, access_provider:{ enum: ACCESS_PROVIDERS }, provider_model_id:{ type:'string' }, provider_model_label:{ type:'string' }, api_compatibility:{ enum: API_COMPATIBILITY_TYPES }, available:{ type:'boolean' }, local_runnable:{ type:'boolean' }, pricing:{ type:'object' }, context_window:{ type:['integer','null'] }, max_output_tokens:{ type:['integer','null'] }, notes:{ type:['string','null'] }, sources:{ type:'array', items:{ type:'string' } }
        }
      }
    }
  };
}

function taxonomyDocument() {
  return {
    canonical_owners: CANONICAL_OWNERS,
    access_providers: ACCESS_PROVIDERS,
    api_compatibility_types: API_COMPATIBILITY_TYPES,
    modalities: MODALITIES,
    capabilities: CAPABILITIES,
    ranking_domains: RANKING_DOMAINS,
    lifecycle_statuses: LIFECYCLE_STATUSES,
    evidence_types: EVIDENCE_TYPES,
  };
}

function rankingPolicyDocument() {
  return {
    version: '2.0.0',
    ranking_domains: Object.fromEntries(RANKING_DOMAINS.map(domain => [domain, { score_range:[0,100], rank_semantics:'Lower rank is better. Rank is relative to the currently curated active registry subset for that domain.', confidence_range:[0,1], evidence_count_minimum:0, null_policy:'Leave null when evidence is weak, stale, or not meaningfully comparable.', last_reviewed_required_for_ranked_records:true }])),
    confidence_bands: { high:{ minimum:0.8, meaning:'Benchmark-backed and/or corroborated by multiple high-signal sources.' }, medium:{ minimum:0.65, meaning:'Single high-signal source or strong qualitative confidence.' }, low:{ minimum:0.5, meaning:'Useful but weakly evidenced; routing should use more conservative tie-breakers.' } },
    preferred_evidence_by_domain: {
      coding: ['aider_polyglot_leaderboard', 'swebench_official', 'livebench_leaderboard'],
      reasoning: ['livebench_leaderboard', 'livebench_paper'],
      math: ['livebench_leaderboard', 'livebench_paper'],
      tool_use: ['bfcl_v4_leaderboard', 'bfcl_intro'],
      agentic: ['gaia2_leaderboard_update', 'swebench_official', 'bfcl_v4_leaderboard'],
      vision: ['mmmu_leaderboard', 'ocrbench_v2_leaderboard'],
      multimodal: ['mmmu_leaderboard', 'livebench_leaderboard'],
      document_extraction: ['ocrbench_v2_leaderboard', 'docvqa_official', 'mistral_ocr_benchmark'],
    },
    routing_rules: { never_use_global_best_score:true, require_capability_match_first:true, prefer_domain_rank_when_confidence_at_least:0.65, use_cost_and_latency_tiers_as_tiebreakers:true, prefer_null_over_guessing:true, prefer_verified_provider_mapping_for_execution:true },
  };
}
function countBy(items, keyFn) {
  return Object.fromEntries([...items.reduce((map, item) => {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map()).entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function numericPricingPresent(pricing) {
  return Object.entries(pricing ?? {}).some(([key, value]) => key !== 'currency' && key !== 'notes' && value !== null && value !== undefined);
}

function ndjson(items) {
  return `${items.map(item => JSON.stringify(item)).join('\n')}\n`;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function modelRef(owner, family, variant) {
  return modelUid(owner, family, variant);
}

async function main() {
  await fs.mkdir(REGISTRY_DIR, { recursive: true });

  const hfRepos = uniq(MODEL_SEEDS.map(seed => seed.hf_repo).filter(Boolean));
  const [existingModels, existingMappings, existingSourcesRaw, hfMetas, openRouterCatalog] = await Promise.all([
    readNdjson(path.join(REGISTRY_DIR, 'canonical_models.ndjson')),
    readNdjson(path.join(REGISTRY_DIR, 'provider_mappings.ndjson')),
    readJson(path.join(REGISTRY_DIR, 'sources_catalog.json'), []),
    fetchHfMetas(hfRepos),
    fetchOpenRouterCatalog(),
  ]);

  const existingSources = Array.isArray(existingSourcesRaw) ? existingSourcesRaw : (existingSourcesRaw?.sources ?? []);
  const normalizedExistingModels = existingModels
    .map(model => UID_REMAPS.has(model.model_uid) ? { ...model, model_uid: UID_REMAPS.get(model.model_uid) } : model)
    .filter(model => !UID_REMAPS.has(model.model_uid));
  const normalizedExistingMappings = existingMappings.map(normalizeExistingMapping);
  const seededModels = MODEL_SEEDS.map(seed => createModel(seed, seed.hf_repo ? hfMetas.get(seed.hf_repo) : null));
  const modelsByUid = new Map(normalizedExistingModels.map(model => [model.model_uid, model]));
  for (const model of seededModels) {
    modelsByUid.set(model.model_uid, modelsByUid.has(model.model_uid) ? mergeModels(modelsByUid.get(model.model_uid), model) : model);
  }
  for (const [uid, patch] of MODEL_PATCHES.entries()) {
    if (!modelsByUid.has(uid)) continue;
    modelsByUid.set(uid, patchModel(modelsByUid.get(uid), patch));
  }

  const modelUidSet = new Set(modelsByUid.keys());
  const mappings = [];

  for (const seed of MODEL_SEEDS.filter(seed => seed.hf_repo)) {
    const uid = modelRef(seed.owner, seed.family, seed.variant);
    mappings.push(createMapping({ model_uid: uid, access_provider: 'Hugging Face', provider_model_id: seed.hf_repo, provider_model_label: seed.hf_repo, api_compatibility: 'custom', available: true, local_runnable: true, notes: 'Official upstream repository on Hugging Face; serving stack depends on deployment.', sources: [sourceKey(seed.hf_repo)] }));
  }

  const pushMap = spec => mappings.push(createMapping(spec));

  const openAiMaps = [
    ['GPT','GPT-5.4','gpt-5.4'],['GPT','GPT-5.4 Mini','gpt-5.4-mini'],['GPT','GPT-5.4 Nano','gpt-5.4-nano'],['GPT','GPT-4.1','gpt-4.1'],['GPT','GPT-4.1 Mini','gpt-4.1-mini'],['GPT','GPT-4.1 Nano','gpt-4.1-nano'],['GPT','GPT-4o','gpt-4o'],['GPT','GPT-4o Mini','gpt-4o-mini'],['o','o3','o3'],['o','o4-mini','o4-mini'],['GPT Image','GPT Image 1','gpt-image-1'],['Embedding','text-embedding-3-large','text-embedding-3-large'],['Embedding','text-embedding-3-small','text-embedding-3-small'],['Audio','GPT-4o Transcribe','gpt-4o-transcribe'],['Audio','GPT-4o Mini TTS','gpt-4o-mini-tts']
  ];
  for (const [family, variant, provider_model_id] of openAiMaps) pushMap({ model_uid:modelRef('OpenAI',family,variant), access_provider:'OpenAI API', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'native', sources:['openai_models'] });

  for (const [variant, provider_model_id] of [['Claude Opus 4.1','claude-opus-4-1'],['Claude Sonnet 4.5','claude-sonnet-4-5'],['Claude Haiku 4.5','claude-haiku-4-5'],['Claude 3.7 Sonnet','claude-3-7-sonnet']]) pushMap({ model_uid:modelRef('Anthropic','Claude',variant), access_provider:'Anthropic API', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'native', sources:['anthropic_models'] });

  for (const [variant, provider_model_id] of [['Gemini 2.5 Pro','gemini-2.5-pro'],['Gemini 2.5 Flash','gemini-2.5-flash'],['Gemini 3.1 Pro Preview','gemini-3.1-pro-preview'],['Gemini 3.1 Flash Preview','gemini-3.1-flash-preview'],['Gemini 3.1 Flash Lite Preview','gemini-3.1-flash-lite-preview']]) {
    pushMap({ model_uid:modelRef('Google / DeepMind','Gemini',variant), access_provider:'Google AI Studio', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'google_compatible', sources:['google_models'] });
    pushMap({ model_uid:modelRef('Google / DeepMind','Gemini',variant), access_provider:'Google Vertex AI', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'google_compatible', sources:['google_models'] });
  }
  pushMap({ model_uid:modelRef('Google / DeepMind','Embedding','Gemini Embedding 001'), access_provider:'Google AI Studio', provider_model_id:'gemini-embedding-001', provider_model_label:'gemini-embedding-001', api_compatibility:'google_compatible', sources:['google_embeddings'] });

  for (const [variant, provider_model_id] of [['Mistral Large 25.12','mistral-large-latest'],['Mistral Medium 3.1','mistral-medium-latest'],['Mistral Small 3.1','mistral-small-latest'],['Devstral 25.12','devstral-small-latest'],['Pixtral Large','pixtral-large-latest'],['Mistral OCR','mistral-ocr-latest']]) {
    const family = variant === 'Devstral 25.12' ? 'Devstral' : variant === 'Pixtral Large' ? 'Pixtral' : variant === 'Mistral OCR' ? 'OCR' : 'Mistral';
    pushMap({ model_uid:modelRef('Mistral',family,variant), access_provider:'Mistral API', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'native', sources:['mistral_models'] });
  }

  for (const [family, variant, provider_model_id] of [['Command','Command A','command-a-03-2025'],['Command','Command A Vision','command-a-vision-07-2025'],['Command','Command R+','command-r-plus-08-2024'],['Command','Command R','command-r-08-2024'],['Command','Command R7B','command-r7b-12-2024'],['Embedding','Embed 4','embed-v4.0'],['Rerank','Rerank 3.5','rerank-v3.5']]) pushMap({ model_uid:modelRef('Cohere',family,variant), access_provider:'Cohere API', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'native', sources:[family === 'Embedding' ? 'cohere_embeddings' : family === 'Rerank' ? 'cohere_rerank' : variant === 'Command A Vision' ? 'cohere_command_a_vision' : 'cohere_models'] });

  for (const [variant, provider_model_id] of [['Grok 4.20','grok-4.20'],['Grok 4.20 Multi-Agent','grok-4.20-multi-agent']]) pushMap({ model_uid:modelRef('xAI','Grok',variant), access_provider:'xAI API', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'native', sources:['xai_models'] });

  for (const [variant, provider_model_id] of [['Kimi K2.5','kimi-k2.5'],['Kimi K2 Thinking','kimi-k2-thinking'],['Kimi K2','kimi-k2']]) pushMap({ model_uid:modelRef('Moonshot AI','Kimi',variant), access_provider:'Moonshot API', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'openai_compatible', sources:['moonshot_kimi'] });

  pushMap({ model_uid:modelRef('DeepSeek','DeepSeek','DeepSeek V3.1'), access_provider:'DeepSeek API', provider_model_id:'deepseek-chat', provider_model_label:'deepseek-chat', api_compatibility:'openai_compatible', sources:['deepseek_api'] });
  pushMap({ model_uid:modelRef('DeepSeek','DeepSeek','DeepSeek R1'), access_provider:'DeepSeek API', provider_model_id:'deepseek-reasoner', provider_model_label:'deepseek-reasoner', api_compatibility:'openai_compatible', sources:['deepseek_api'] });

  pushMap({ model_uid:modelRef('ElevenLabs','Eleven','Eleven v3'), access_provider:'ElevenLabs API', provider_model_id:'eleven_v3', provider_model_label:'eleven_v3', api_compatibility:'native', sources:['eleven_models'] });
  pushMap({ model_uid:modelRef('ElevenLabs','Eleven','Flash v2.5'), access_provider:'ElevenLabs API', provider_model_id:'eleven_flash_v2_5', provider_model_label:'eleven_flash_v2_5', api_compatibility:'native', sources:['eleven_models'] });

  pushMap({ model_uid:modelRef('MiniMax','MiniMax','MiniMax M2.5'), access_provider:'MiniMax API', provider_model_id:'MiniMax-M2.5', provider_model_label:'MiniMax-M2.5', api_compatibility:'openai_compatible', sources:['minimax_models'] });
  pushMap({ model_uid:modelRef('MiniMax','Music','Music 2.5'), access_provider:'MiniMax API', provider_model_id:'Music-2.5', provider_model_label:'Music-2.5', api_compatibility:'native', sources:['minimax_models'] });
  pushMap({ model_uid:modelRef('StepFun','Step','Step-3.5 Flash'), access_provider:'StepFun API', provider_model_id:'step-3.5-flash', provider_model_label:'step-3.5-flash', api_compatibility:'openai_compatible', sources:['stepfun_overview'] });

  for (const [variant, provider_model_id, sourceIds, contextWindow] of [['Palmyra X4','palmyra-x4',['writer_models','writer_pricing'],128_000],['Palmyra X5','palmyra-x5',['writer_models','writer_tooling','writer_structured','writer_pricing'],1_000_000],['Palmyra Creative','palmyra-creative',['writer_models','writer_pricing'],128_000],['Palmyra Vision','palmyra-vision',['writer_models','writer_vision','writer_pricing'],128_000]]) pushMap({ model_uid:modelRef('Writer','Palmyra',variant), access_provider:'Writer API', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'openai_compatible', context_window:contextWindow, sources:sourceIds });

  pushMap({ model_uid:modelRef('AI21 Labs','Jamba','Jamba 1.7 Large'), access_provider:'AI21 API', provider_model_id:'jamba-large', provider_model_label:'jamba-large', api_compatibility:'openai_compatible', context_window:256_000, sources:['ai21_jamba','ai21_sdk'] });
  pushMap({ model_uid:modelRef('AI21 Labs','Jamba','Jamba Mini'), access_provider:'AI21 API', provider_model_id:'jamba-mini', provider_model_label:'jamba-mini', api_compatibility:'openai_compatible', context_window:256_000, sources:['ai21_jamba','ai21_sdk'] });

  for (const [variant, provider_model_id, embeddingPrice, rerankPrice] of [['voyage-4-large','voyage-4-large',0.12,null],['voyage-4','voyage-4',0.09,null],['voyage-multimodal-3.5','voyage-multimodal-3.5',0.13,null],['rerank-2.5','rerank-2.5',null,2.0]]) {
    const family = provider_model_id.startsWith('rerank') ? 'Rerank' : provider_model_id.startsWith('voyage-multimodal') ? 'Voyage Multimodal' : 'Voyage';
    pushMap({ model_uid:modelRef('Voyage AI',family,variant), access_provider:'Voyage API', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'native', pricing:{ embedding_per_million_tokens_usd: embeddingPrice, rerank_per_1k_searches_usd: rerankPrice }, sources:['voyage_pricing', family === 'Rerank' ? 'voyage_rerank' : family === 'Voyage Multimodal' ? 'voyage_multimodal' : 'voyage_embeddings'] });
  }

  for (const provider_model_id of ['sonar-pro','sonar-reasoning-pro','sonar-deep-research']) {
    const variant = provider_model_id === 'sonar-pro' ? 'Sonar Pro' : provider_model_id === 'sonar-reasoning-pro' ? 'Sonar Reasoning Pro' : 'Sonar Deep Research';
    pushMap({ model_uid:modelRef('Perplexity','Sonar',variant), access_provider:'Perplexity API', provider_model_id, provider_model_label:provider_model_id, api_compatibility:'openai_compatible', sources:['perplexity_sonar','perplexity_openai_compat'] });
  }

  pushMap({ model_uid:modelRef('Recraft','Recraft','Recraft V3'), access_provider:'Recraft API', provider_model_id:'recraftv3', provider_model_label:'recraftv3', api_compatibility:'native', sources:['recraft_api'] });
  pushMap({ model_uid:modelRef('Runway','Gen-4','Gen-4 Turbo'), access_provider:'Runway API', provider_model_id:'gen4_turbo', provider_model_label:'gen4_turbo', api_compatibility:'native', sources:['runway_changelog'] });
  pushMap({ model_uid:modelRef('Runway','Gen-4','Gen-4 Image'), access_provider:'Runway API', provider_model_id:'gen4_image', provider_model_label:'gen4_image', api_compatibility:'native', sources:['runway_changelog'] });
  pushMap({ model_uid:modelRef('Luma','Ray','Ray 2'), access_provider:'Luma API', provider_model_id:'ray-2', provider_model_label:'ray-2', api_compatibility:'native', sources:['luma_video'] });
  pushMap({ model_uid:modelRef('Luma','Ray','Ray 2 Flash'), access_provider:'Luma API', provider_model_id:'ray-2-flash', provider_model_label:'ray-2-flash', api_compatibility:'native', sources:['luma_video'] });
  pushMap({ model_uid:modelRef('AssemblyAI','Universal','Universal-3'), access_provider:'AssemblyAI API', provider_model_id:'universal-3', provider_model_label:'universal-3', api_compatibility:'native', sources:['assemblyai_products'] });
  pushMap({ model_uid:modelRef('AssemblyAI','Universal','Universal Streaming'), access_provider:'AssemblyAI API', provider_model_id:'universal-streaming', provider_model_label:'universal-streaming', api_compatibility:'native', sources:['assemblyai_products'] });
  pushMap({ model_uid:modelRef('Black Forest Labs','FLUX','FLUX 1.1 Ultra'), access_provider:'Black Forest Labs API', provider_model_id:'flux-pro-1.1-ultra', provider_model_label:'flux-pro-1.1-ultra', api_compatibility:'native', sources:['bfl_pricing'] });
  pushMap({ model_uid:modelRef('Black Forest Labs','FLUX Kontext','FLUX Kontext Pro'), access_provider:'Black Forest Labs API', provider_model_id:'flux-kontext-pro', provider_model_label:'flux-kontext-pro', api_compatibility:'native', sources:['bfl_models'] });
  pushMap({ model_uid:modelRef('Stability AI','Stable Diffusion','Stable Diffusion 3.5 Large'), access_provider:'Stability AI API', provider_model_id:'sd3.5-large', provider_model_label:'sd3.5-large', api_compatibility:'native', sources:['stability_core_models'] });
  pushMap({ model_uid:modelRef('Stability AI','Stable Image','Stable Image Ultra'), access_provider:'Stability AI API', provider_model_id:'stable-image-ultra', provider_model_label:'stable-image-ultra', api_compatibility:'native', sources:['stability_core_models'] });
  pushMap({ model_uid:modelRef('Stability AI','Stable Audio','Stable Audio 2.0'), access_provider:'Stability AI API', provider_model_id:'stable-audio-2.0', provider_model_label:'stable-audio-2.0', api_compatibility:'native', sources:['stability_audio2'] });
  pushMap({ model_uid:modelRef('NVIDIA','Nemotron','Llama 3.3 Nemotron Super 49B'), access_provider:'NVIDIA NIM', provider_model_id:'nvidia/llama-3.3-nemotron-super-49b-v1', provider_model_label:'nvidia/llama-3.3-nemotron-super-49b-v1', api_compatibility:'openai_compatible', sources:['nvidia_nim_models'] });
  pushMap({ model_uid:modelRef('NVIDIA','Embedding','NV-Embed v1'), access_provider:'NVIDIA NIM', provider_model_id:'nvidia/nv-embed-v1', provider_model_label:'nvidia/nv-embed-v1', api_compatibility:'openai_compatible', sources:['nvidia_nim_models'] });
  pushMap({ model_uid:modelRef('NVIDIA','Reranker','Llama Nemotron Rerank VL 1B v2'), access_provider:'NVIDIA NIM', provider_model_id:'nvidia/llama-nemotron-rerank-vl-1b-v2', provider_model_label:'nvidia/llama-nemotron-rerank-vl-1b-v2', api_compatibility:'openai_compatible', sources:['nvidia_nim_models'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 120B'), access_provider:'Groq', provider_model_id:'openai/gpt-oss-120b', provider_model_label:'openai/gpt-oss-120b', api_compatibility:'openai_compatible', sources:['groq_gpt_oss_120b','groq_models'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 20B'), access_provider:'Groq', provider_model_id:'openai/gpt-oss-20b', provider_model_label:'openai/gpt-oss-20b', api_compatibility:'openai_compatible', sources:['groq_models'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 120B'), access_provider:'vLLM', provider_model_id:'openai/gpt-oss-120b', provider_model_label:'openai/gpt-oss-120b', api_compatibility:'openai_compatible', available:true, local_runnable:true, notes:'Officially listed by OpenAI as available through vLLM-compatible deployment paths.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 20B'), access_provider:'vLLM', provider_model_id:'openai/gpt-oss-20b', provider_model_label:'openai/gpt-oss-20b', api_compatibility:'openai_compatible', available:true, local_runnable:true, notes:'Officially listed by OpenAI as available through vLLM-compatible deployment paths.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 120B'), access_provider:'Ollama', provider_model_id:'gpt-oss:120b', provider_model_label:'gpt-oss:120b', api_compatibility:'custom', available:true, local_runnable:true, notes:'OpenAI launch materials list Ollama availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 20B'), access_provider:'Ollama', provider_model_id:'gpt-oss:20b', provider_model_label:'gpt-oss:20b', api_compatibility:'custom', available:true, local_runnable:true, notes:'OpenAI launch materials list Ollama availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 120B'), access_provider:'LM Studio', provider_model_id:'openai/gpt-oss-120b', provider_model_label:'openai/gpt-oss-120b', api_compatibility:'openai_compatible', available:true, local_runnable:true, notes:'OpenAI launch materials list LM Studio availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 20B'), access_provider:'LM Studio', provider_model_id:'openai/gpt-oss-20b', provider_model_label:'openai/gpt-oss-20b', api_compatibility:'openai_compatible', available:true, local_runnable:true, notes:'OpenAI launch materials list LM Studio availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 120B'), access_provider:'Fireworks', provider_model_id:'openai/gpt-oss-120b', provider_model_label:'openai/gpt-oss-120b', api_compatibility:'openai_compatible', notes:'OpenAI launch materials list Fireworks availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 20B'), access_provider:'Fireworks', provider_model_id:'openai/gpt-oss-20b', provider_model_label:'openai/gpt-oss-20b', api_compatibility:'openai_compatible', notes:'OpenAI launch materials list Fireworks availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 120B'), access_provider:'Together', provider_model_id:'openai/gpt-oss-120b', provider_model_label:'openai/gpt-oss-120b', api_compatibility:'openai_compatible', notes:'OpenAI launch materials list Together AI availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 20B'), access_provider:'Together', provider_model_id:'openai/gpt-oss-20b', provider_model_label:'openai/gpt-oss-20b', api_compatibility:'openai_compatible', notes:'OpenAI launch materials list Together AI availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 120B'), access_provider:'Azure AI Foundry', provider_model_id:'gpt-oss-120b', provider_model_label:'gpt-oss-120b', api_compatibility:'openai_compatible', notes:'OpenAI launch materials list Azure availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('OpenAI','GPT-OSS','GPT-OSS 20B'), access_provider:'Azure AI Foundry', provider_model_id:'gpt-oss-20b', provider_model_label:'gpt-oss-20b', api_compatibility:'openai_compatible', notes:'OpenAI launch materials list Azure availability for GPT-OSS.', sources:['openai_gpt_oss'] });
  pushMap({ model_uid:modelRef('Amazon','Nova','Nova Premier'), access_provider:'Amazon Bedrock', provider_model_id:'amazon.nova-premier-v1:0', provider_model_label:'amazon.nova-premier-v1:0', api_compatibility:'native', sources:['amazon_nova_service_card','bedrock_models'] });
  pushMap({ model_uid:modelRef('Amazon','Nova','Nova Pro'), access_provider:'Amazon Bedrock', provider_model_id:'amazon.nova-pro-v1:0', provider_model_label:'amazon.nova-pro-v1:0', api_compatibility:'native', sources:['bedrock_models'] });
  pushMap({ model_uid:modelRef('Amazon','Nova','Nova Lite'), access_provider:'Amazon Bedrock', provider_model_id:'amazon.nova-lite-v1:0', provider_model_label:'amazon.nova-lite-v1:0', api_compatibility:'native', sources:['bedrock_models'] });
  pushMap({ model_uid:modelRef('Amazon','Nova','Nova Micro'), access_provider:'Amazon Bedrock', provider_model_id:'amazon.nova-micro-v1:0', provider_model_label:'amazon.nova-micro-v1:0', api_compatibility:'native', sources:['bedrock_models'] });
  pushMap({ model_uid:modelRef('Amazon','Nova','Nova Canvas'), access_provider:'Amazon Bedrock', provider_model_id:'amazon.nova-canvas-v1:0', provider_model_label:'amazon.nova-canvas-v1:0', api_compatibility:'native', sources:['bedrock_nova_canvas'] });
  pushMap({ model_uid:modelRef('Amazon','Nova','Nova Reel'), access_provider:'Amazon Bedrock', provider_model_id:'amazon.nova-reel-v1:0', provider_model_label:'amazon.nova-reel-v1:0', api_compatibility:'native', sources:['bedrock_models'] });
  pushMap({ model_uid:modelRef('Amazon','Nova','Nova Sonic'), access_provider:'Amazon Bedrock', provider_model_id:'amazon.nova-sonic-v1:0', provider_model_label:'amazon.nova-sonic-v1:0', api_compatibility:'native', sources:['amazon_nova_sonic','bedrock_models'] });
  pushMap({ model_uid:modelRef('Amazon','Titan Embeddings','Titan Text Embeddings V2'), access_provider:'Amazon Bedrock', provider_model_id:'amazon.titan-embed-text-v2:0', provider_model_label:'amazon.titan-embed-text-v2:0', api_compatibility:'native', sources:['bedrock_titan_embed'] });
  pushMap({ model_uid:modelRef('Writer','Palmyra','Palmyra X5'), access_provider:'Amazon Bedrock', provider_model_id:'writer.palmyra-x5-v1:0', provider_model_label:'writer.palmyra-x5-v1:0', api_compatibility:'native', sources:['bedrock_palmyra_x5','writer_bedrock'] });
  pushMap({ model_uid:modelRef('Databricks','DBRX','DBRX Instruct'), access_provider:'Databricks Model Serving', provider_model_id:'databricks-dbrx-instruct', provider_model_label:'databricks-dbrx-instruct', api_compatibility:'openai_compatible', sources:['databricks_dbrx_instruct'] });
  pushMap({ model_uid:modelRef('Baidu','ERNIE','ERNIE 4.5'), access_provider:'Baidu ERNIE API', provider_model_id:'ernie-4.5', provider_model_label:'ernie-4.5', api_compatibility:'native', sources:['baidu_ernie_45'] });

  for (const [owner, family, variant, providerId] of OR_MAPPING_SPECS) {
    const uid = modelRef(owner, family, variant);
    const item = openRouterCatalog.get(providerId);
    pushMap({ model_uid: uid, access_provider: 'OpenRouter', provider_model_id: providerId, provider_model_label: item?.name ?? providerId, api_compatibility: 'openai_compatible', pricing: item ? orPricing(item) : blankPricing(), context_window: item?.context_length ?? null, max_output_tokens: item?.top_provider?.max_completion_tokens ?? null, notes: item ? null : 'Catalog entry missing from live fetch during generation.', sources:['openrouter_models'] });
  }

  const applyMappingPatch = mapping => {
    const patch = MAPPING_PATCHES.get(`${mapping.access_provider}|${mapping.provider_model_id}`);
    return patch ? patchMapping(mapping, patch) : mapping;
  };
  const mappingMap = new Map(normalizedExistingMappings
    .filter(item => modelUidSet.has(item.model_uid))
    .map(item => applyMappingPatch(item))
    .map(item => [mappingKey(item), item]));
  for (const mapping of mappings.filter(item => modelUidSet.has(item.model_uid)).map(applyMappingPatch)) {
    const key = mappingKey(mapping);
    mappingMap.set(key, mappingMap.has(key) ? mergeMappings(mappingMap.get(key), mapping) : mapping);
  }

  const allSources = new Map();
  for (const source of [...existingSources, ...STATIC_SOURCES, ...MODEL_SEEDS.filter(seed => seed.hf_repo).map(seed => hfSource(seed.hf_repo, seed.owner))]) allSources.set(source.source_id, source);

  const finalModels = sortModels([...modelsByUid.values()]);
  const finalMappings = sortMappings([...mappingMap.values()].filter(item => modelUidSet.has(item.model_uid)));
  const finalSources = [...allSources.values()].sort((a, b) => a.source_id.localeCompare(b.source_id));
  const finalSourceIdSet = new Set(finalSources.map(source => source.source_id));

  for (const model of finalModels) {
    if (!CANONICAL_OWNERS.includes(model.canonical_owner)) throw new Error(`Unknown canonical owner ${model.canonical_owner} for ${model.model_uid}`);
    for (const sourceId of uniq([...(model.sources ?? []), ...sourceIdsFromTaskScores(model.task_scores)])) {
      if (!finalSourceIdSet.has(sourceId)) throw new Error(`Unknown source id ${sourceId} referenced by ${model.model_uid}`);
    }
  }
  for (const mapping of finalMappings) {
    if (!ACCESS_PROVIDERS.includes(mapping.access_provider)) throw new Error(`Unknown access provider ${mapping.access_provider} for ${mapping.provider_model_id}`);
    if (!modelUidSet.has(mapping.model_uid)) throw new Error(`Dangling provider mapping ${mapping.provider_model_id} -> ${mapping.model_uid}`);
    for (const sourceId of mapping.sources ?? []) {
      if (!finalSourceIdSet.has(sourceId)) throw new Error(`Unknown source id ${sourceId} referenced by mapping ${mapping.access_provider}|${mapping.provider_model_id}`);
    }
  }

  const duplicateSlugGroups = Object.entries(finalModels.reduce((acc, model) => { (acc[model.normalized_slug] ||= []).push(model.model_uid); return acc; }, {})).filter(([, ids]) => ids.length > 1);
  if (duplicateSlugGroups.length) throw new Error(`Duplicate normalized slugs found: ${duplicateSlugGroups.map(([slugValue]) => slugValue).join(', ')}`);
  for (const model of finalModels) {
    if (!model.modalities.includes(model.primary_modality)) throw new Error(`Primary modality mismatch for ${model.model_uid}`);
  }

  const aliasGroups = Object.entries(finalModels.reduce((acc, model) => {
    for (const alias of model.aliases ?? []) {
      const key = normalizeAlias(alias);
      if (!key) continue;
      (acc[key] ||= []).push(model.model_uid);
    }
    return acc;
  }, {})).filter(([, ids]) => uniq(ids).length > 1).map(([alias, ids]) => ({ alias, model_uids: uniq(ids) }));

  const missingRankingByDomain = Object.fromEntries(RANKING_DOMAINS.map(domain => [
    domain,
    finalModels.filter(model => model.task_scores?.[domain]?.score === null).length,
  ]));
  const lowConfidenceByDomain = Object.fromEntries(RANKING_DOMAINS.map(domain => [
    domain,
    finalModels.filter(model => {
      const score = model.task_scores?.[domain];
      return score?.score !== null && score?.confidence !== null && score.confidence < 0.65;
    }).length,
  ]));
  const benchmarkBackedByDomain = Object.fromEntries(RANKING_DOMAINS.map(domain => [
    domain,
    finalModels.filter(model => {
      const score = model.task_scores?.[domain];
      return score?.score !== null && hasBenchmarkEvidence(score);
    }).length,
  ]));
  const lowConfidenceScoreCount = Object.values(lowConfidenceByDomain).reduce((sum, value) => sum + value, 0);
  const providerMissingPricing = countBy(finalMappings.filter(mapping => !numericPricingPresent(mapping.pricing)), mapping => mapping.access_provider);
  const providerMissingContextWindow = countBy(finalMappings.filter(mapping => mapping.context_window === null), mapping => mapping.access_provider);
  const providerMissingMaxOutput = countBy(finalMappings.filter(mapping => mapping.max_output_tokens === null), mapping => mapping.access_provider);
  const underrepresentedOwners = Object.entries(countBy(finalModels, model => model.canonical_owner))
    .filter(([, count]) => count <= 2)
    .map(([owner, count]) => ({ canonical_owner: owner, canonical_model_count: count }));

  const missingFields = {
    generated_at: TODAY,
    summary: {
      canonical_models_total: finalModels.length,
      canonical_models_missing_release_date: finalModels.filter(model => !model.release_date).length,
      canonical_models_missing_release_date_pct: percent(finalModels.filter(model => !model.release_date).length, finalModels.length),
      canonical_models_missing_license: finalModels.filter(model => !model.license).length,
      canonical_models_missing_description: finalModels.filter(model => !model.description).length,
      canonical_models_missing_ranking_data: finalModels.filter(model => Object.values(model.task_scores ?? {}).every(score => score.score === null)).length,
      provider_mappings_total: finalMappings.length,
      provider_mappings_missing_pricing: finalMappings.filter(mapping => !numericPricingPresent(mapping.pricing)).length,
      provider_mappings_missing_pricing_pct: percent(finalMappings.filter(mapping => !numericPricingPresent(mapping.pricing)).length, finalMappings.length),
      provider_mappings_missing_context_window: finalMappings.filter(mapping => mapping.context_window === null).length,
      provider_mappings_missing_context_window_pct: percent(finalMappings.filter(mapping => mapping.context_window === null).length, finalMappings.length),
      provider_mappings_missing_max_output_tokens: finalMappings.filter(mapping => mapping.max_output_tokens === null).length,
      provider_mappings_missing_max_output_tokens_pct: percent(finalMappings.filter(mapping => mapping.max_output_tokens === null).length, finalMappings.length),
      low_confidence_score_count: lowConfidenceScoreCount,
    },
    ranking_gaps_by_domain: Object.fromEntries(RANKING_DOMAINS.map(domain => [domain, {
      missing_count: missingRankingByDomain[domain],
      missing_pct: percent(missingRankingByDomain[domain], finalModels.length),
      low_confidence_count: lowConfidenceByDomain[domain],
      benchmark_backed_count: benchmarkBackedByDomain[domain],
    }])),
    provider_gap_breakdown: {
      missing_pricing_by_access_provider: providerMissingPricing,
      missing_context_window_by_access_provider: providerMissingContextWindow,
      missing_max_output_tokens_by_access_provider: providerMissingMaxOutput,
    },
    examples: {
      models_missing_release_date: finalModels.filter(model => !model.release_date).slice(0, 25).map(model => ({ model_uid:model.model_uid, canonical_owner:model.canonical_owner, variant_name:model.variant_name })),
      mappings_missing_pricing: finalMappings.filter(mapping => !numericPricingPresent(mapping.pricing)).slice(0, 25).map(mapping => ({ model_uid:mapping.model_uid, access_provider:mapping.access_provider, provider_model_id:mapping.provider_model_id })),
      mappings_missing_context_window: finalMappings.filter(mapping => mapping.context_window === null).slice(0, 25).map(mapping => ({ model_uid:mapping.model_uid, access_provider:mapping.access_provider, provider_model_id:mapping.provider_model_id })),
      mappings_missing_max_output_tokens: finalMappings.filter(mapping => mapping.max_output_tokens === null).slice(0, 25).map(mapping => ({ model_uid:mapping.model_uid, access_provider:mapping.access_provider, provider_model_id:mapping.provider_model_id })),
    }
  };

  const coverageReport = {
    generated_at: TODAY,
    canonical_model_count: finalModels.length,
    canonical_models_by_owner: countBy(finalModels, model => model.canonical_owner),
    canonical_models_by_primary_modality: countBy(finalModels, model => model.primary_modality),
    represented_owner_count: new Set(finalModels.map(model => model.canonical_owner)).size,
    provider_mapping_count: finalMappings.length,
    provider_mappings_by_access_provider: countBy(finalMappings, mapping => mapping.access_provider),
    represented_access_provider_count: new Set(finalMappings.map(mapping => mapping.access_provider)).size,
    missing_release_date_count: missingFields.summary.canonical_models_missing_release_date,
    missing_release_date_pct: missingFields.summary.canonical_models_missing_release_date_pct,
    missing_pricing_count: missingFields.summary.provider_mappings_missing_pricing,
    missing_pricing_pct: missingFields.summary.provider_mappings_missing_pricing_pct,
    missing_context_window_count: missingFields.summary.provider_mappings_missing_context_window,
    missing_context_window_pct: missingFields.summary.provider_mappings_missing_context_window_pct,
    missing_max_output_tokens_count: missingFields.summary.provider_mappings_missing_max_output_tokens,
    missing_max_output_tokens_pct: missingFields.summary.provider_mappings_missing_max_output_tokens_pct,
    records_missing_ranking_data_count: missingFields.summary.canonical_models_missing_ranking_data,
    missing_ranking_data_by_domain: missingRankingByDomain,
    low_confidence_score_count: lowConfidenceScoreCount,
    low_confidence_score_count_by_domain: lowConfidenceByDomain,
    benchmark_backed_score_count_by_domain: benchmarkBackedByDomain,
    unresolved_duplicate_count: aliasGroups.length,
    modality_coverage: countBy(finalModels, model => model.primary_modality),
    sources_by_evidence_type: countBy(finalSources, source => source.evidence_type),
    benchmark_source_count: finalSources.filter(source => source.evidence_type === 'benchmark_report').length,
    underrepresented_owners: underrepresentedOwners,
  };

  const unresolvedDuplicates = {
    generated_at: TODAY,
    summary: { count: aliasGroups.length },
    unresolved_duplicates: aliasGroups.map(group => ({ ambiguity_type:'alias_collision', alias:group.alias, model_uids:group.model_uids }))
  };

  const readme = `# Model Registry

Canonical identity stays in canonical_models.ndjson. Provider-specific access data stays in provider_mappings.ndjson.

## Rules

- Canonical hierarchy is canonical_owner -> family_name -> variant_name.
- OpenRouter, Hugging Face, Ollama, Azure, Bedrock, GitHub Models, vLLM, and TGI are access providers, not canonical owners.
- Provider-specific ids, preview aliases, mirrors, and serving tiers stay in provider_mappings.ndjson unless the upstream vendor treats them as a distinct release.
- The generator keeps stable ordering, merges onto the existing registry, and enriches selected open-weight records from Hugging Face metadata plus verified OpenRouter catalog mappings.

## Regeneration

Run: \`node scripts/generate-model-registry.mjs\`

## Files

- \`canonical_models.ndjson\`: canonical model identities for routing.
- \`provider_mappings.ndjson\`: provider/runtime-specific model handles and pricing/context metadata.
- \`sources_catalog.json\`: source registry used by canonical and provider records.
- \`coverage_report.json\`: machine-readable summary of owner, provider, and modality coverage.
- \`missing_fields_report.json\`: machine-readable completeness gaps.
- \`unresolved_duplicates.json\`: unresolved alias collisions that still need manual review.

## Coverage

- Canonical models: ${coverageReport.canonical_model_count}
- Represented owners: ${coverageReport.represented_owner_count}
- Provider mappings: ${coverageReport.provider_mapping_count}
- Represented access providers: ${coverageReport.represented_access_provider_count}
- Missing release dates: ${coverageReport.missing_release_date_count} (${coverageReport.missing_release_date_pct}%)
- Missing pricing blocks: ${coverageReport.missing_pricing_count} (${coverageReport.missing_pricing_pct}%)
- Missing context windows: ${coverageReport.missing_context_window_count} (${coverageReport.missing_context_window_pct}%)
- Missing max output tokens: ${coverageReport.missing_max_output_tokens_count} (${coverageReport.missing_max_output_tokens_pct}%)
- Low-confidence score cells: ${coverageReport.low_confidence_score_count}
- Benchmark-backed score cells by domain: see \`coverage_report.json\`
- Unresolved duplicates: ${coverageReport.unresolved_duplicate_count}

## Ranking

Routing remains domain-specific. There is no universal best-model score. Use required capabilities first, then domain rank and confidence, then provider constraints and latency/cost tie-breakers.

## Known limits

- Some proprietary release dates remain null where official model pages do not expose clean dated release markers.
- Direct-provider pricing is still incomplete outside providers with public catalogs or explicit pricing docs.
- Provider mappings are intentionally conservative where deployment-specific IDs vary by tenant or cloud region.
- Several routing domains such as creative writing, general chat, long-context, and cost efficiency still rely more on curated evidence than shared cross-vendor benchmarks.
`;

  const agents = `# AGENTS

1. Preserve the canonical hierarchy: canonical_owner -> family_name -> variant_name.
2. Never make OpenRouter, Hugging Face, Bedrock, Azure AI Foundry, GitHub Models, NVIDIA NIM, Groq, Together, Fireworks, or local runtimes into canonical owners.
3. Add a new canonical variant only when the upstream vendor treats it as a distinct release.
4. Provider-specific aliases, hosting mirrors, fast tiers, snapshots, and regional handles belong in provider_mappings.ndjson unless the release itself is distinct.
5. Prefer null over guessing. Do not invent release dates, pricing, or token limits.
6. Every canonical model and provider mapping must reference at least one source id.
7. Keep routing domain-specific. Never add a universal best-model score.
8. Regenerate the package with \`node scripts/generate-model-registry.mjs\` after updates and review coverage_report.json plus missing_fields_report.json before finalizing.
`;

  await Promise.all([
    fs.writeFile(path.join(REGISTRY_DIR, 'ai_model_registry.schema.json'), stableJson(schemaDocument())),
    fs.writeFile(path.join(REGISTRY_DIR, 'taxonomy.json'), stableJson(taxonomyDocument())),
    fs.writeFile(path.join(REGISTRY_DIR, 'ranking_policy.json'), stableJson(rankingPolicyDocument())),
    fs.writeFile(path.join(REGISTRY_DIR, 'canonical_models.ndjson'), ndjson(finalModels)),
    fs.writeFile(path.join(REGISTRY_DIR, 'provider_mappings.ndjson'), ndjson(finalMappings)),
    fs.writeFile(path.join(REGISTRY_DIR, 'sources_catalog.json'), stableJson(finalSources)),
    fs.writeFile(path.join(REGISTRY_DIR, 'missing_fields_report.json'), stableJson(missingFields)),
    fs.writeFile(path.join(REGISTRY_DIR, 'unresolved_duplicates.json'), stableJson(unresolvedDuplicates)),
    fs.writeFile(path.join(REGISTRY_DIR, 'coverage_report.json'), stableJson(coverageReport)),
    fs.writeFile(path.join(REGISTRY_DIR, 'README.md'), readme),
    fs.writeFile(path.join(REGISTRY_DIR, 'AGENTS.md'), agents),
  ]);

  console.log(JSON.stringify({ canonical_models: finalModels.length, provider_mappings: finalMappings.length, owners: coverageReport.represented_owner_count, access_providers: coverageReport.represented_access_provider_count, missing_release_date: coverageReport.missing_release_date_count, unresolved_duplicates: coverageReport.unresolved_duplicate_count }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
