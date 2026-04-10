import type { Provider } from '../types'

export const PROVIDER_CATALOG: Provider[] = [
  { id: 'nvidia', name: 'NVIDIA NIM', baseUrl: 'integrate.api.nvidia.com/v1', color: '#76b900', initials: 'NV' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'openrouter.ai/api/v1', color: '#6366f1', initials: 'OR' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'api.anthropic.com', color: '#cc785c', initials: 'AN', model: 'claude-sonnet-4-6' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'api.openai.com/v1', color: '#10a37f', initials: 'OA', model: 'gpt-4o' },
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'generativelanguage.googleapis.com', color: '#4285f4', initials: 'GG', model: 'gemini-2.0-flash' },
  { id: 'mistral', name: 'Mistral', baseUrl: 'api.mistral.ai/v1', color: '#ff7000', initials: 'MI', model: 'mistral-large-latest' },
  { id: 'groq', name: 'Groq', baseUrl: 'api.groq.com/openai/v1', color: '#f55036', initials: 'GR', model: 'llama-3.3-70b-versatile' },
  { id: 'together', name: 'Together AI', baseUrl: 'api.together.xyz/v1', color: '#0ea5e9', initials: 'TA', model: 'meta-llama/Llama-3-8b-chat-hf' },
  { id: 'fireworks', name: 'Fireworks AI', baseUrl: 'api.fireworks.ai/inference/v1', color: '#f97316', initials: 'FW', model: 'accounts/fireworks/models/llama-v3-8b-instruct' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'api.deepseek.com/v1', color: '#2563eb', initials: 'DS', model: 'deepseek-chat' },
  { id: 'huggingface', name: 'Hugging Face', baseUrl: 'api-inference.huggingface.co', color: '#ffd21e', initials: 'HF' },
  { id: 'ollama', name: 'Ollama', baseUrl: 'localhost:11434/v1', color: '#7f77dd', initials: 'OL', isLocal: true, model: 'llama3.2' },
  { id: 'lmstudio', name: 'LM Studio', baseUrl: 'localhost:1234/v1', color: '#8b5cf6', initials: 'LM', isLocal: true, model: 'local-model' },
  { id: 'custom', name: 'Custom Endpoint', baseUrl: '', color: 'var(--text-secondary)', initials: 'CU' },
]

export const ACCESS_PROVIDER_BY_APP_PROVIDER_ID: Record<string, string[]> = {
  nvidia: ['NVIDIA NIM'],
  openrouter: ['OpenRouter'],
  anthropic: ['Anthropic API'],
  openai: ['OpenAI API'],
  gemini: ['Google AI Studio'],
  mistral: ['Mistral API'],
  groq: ['Groq'],
  together: ['Together'],
  fireworks: ['Fireworks'],
  deepseek: ['DeepSeek API'],
  huggingface: ['Hugging Face'],
  ollama: ['Ollama', 'Local GGUF'],
  lmstudio: ['LM Studio', 'vLLM', 'Local ONNX', 'Local MLX', 'Text Generation Inference'],
  custom: ['Custom OpenAI-compatible', 'Custom Anthropic-compatible', 'Other / Custom'],
}

export const APP_PROVIDER_ID_BY_ACCESS_PROVIDER = Object.entries(ACCESS_PROVIDER_BY_APP_PROVIDER_ID)
  .reduce<Record<string, string>>((acc, [providerId, accessProviders]) => {
    for (const accessProvider of accessProviders) {
      acc[accessProvider] = providerId
    }
    return acc
  }, {})

export function getProviderCatalogEntry(providerId: string): Provider | null {
  return PROVIDER_CATALOG.find(provider => provider.id === providerId) ?? null
}
