import { getAppSettings } from './appSettings'
import { loadConnectorKeys } from './connectorKeys'
import { getN8nStatus } from './tauri'

function sanitizeErrorText(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed
}

export function getStoredN8nApiKey(): string {
  const settings = getAppSettings()
  const fromSettings = typeof settings.n8nApiKey === 'string' ? settings.n8nApiKey.trim() : ''
  if (fromSettings) return fromSettings

  const connectorKeys = loadConnectorKeys()
  const candidates = [
    connectorKeys.n8n,
    connectorKeys.n8nApiKey,
    connectorKeys['n8n-api-key'],
  ]
  return candidates.find(value => typeof value === 'string' && value.trim().length > 0)?.trim() ?? ''
}

export async function createAndActivateN8nWorkflow(workflow: unknown): Promise<{ id: string; name: string; active: boolean }> {
  const status = await getN8nStatus().catch(() => null)
  if (!status?.running) {
    throw new Error('n8n is not running. Start it from Automations, then retry workflow creation.')
  }

  const apiKey = getStoredN8nApiKey()
  if (!apiKey) {
    throw new Error('n8n API key is missing. Save it in settings (n8nApiKey) or connector keys, then retry.')
  }

  const baseUrl = (status.url || 'http://localhost:5678').replace(/\/+$/, '')
  const createResponse = await fetch(`${baseUrl}/api/v1/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(workflow),
  })

  if (!createResponse.ok) {
    const body = sanitizeErrorText(await createResponse.text().catch(() => ''))
    throw new Error(`Failed to create workflow in n8n (${createResponse.status}). ${body || 'No error details returned.'}`)
  }

  const created = await createResponse.json().catch(() => ({} as Record<string, unknown>))
  const workflowId = String((created as { id?: string | number }).id ?? '').trim()
  if (!workflowId) {
    throw new Error('n8n created the workflow but did not return an id.')
  }

  const activateResponse = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
    method: 'PATCH',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ active: true }),
  })

  if (!activateResponse.ok) {
    const body = sanitizeErrorText(await activateResponse.text().catch(() => ''))
    throw new Error(`Workflow created (${workflowId}) but activation failed (${activateResponse.status}). ${body || 'No error details returned.'}`)
  }

  const activated = await activateResponse.json().catch(() => ({} as Record<string, unknown>))
  const workflowName = String((activated as { name?: string }).name ?? (created as { name?: string }).name ?? 'workflow').trim() || 'workflow'
  const isActive = Boolean((activated as { active?: boolean }).active ?? true)

  return {
    id: workflowId,
    name: workflowName,
    active: isActive,
  }
}
