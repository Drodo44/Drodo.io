import { supabase } from './supabase'

const STORAGE_TO_TABLE = [
  { key: 'drodo_workflow_defs', table: 'workflows' },
  { key: 'drodo_prompt_library', table: 'prompts' },
  { key: 'drodo_sessions', table: 'sessions' },
] as const

function loadStoredRows(key: string): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : []
  } catch {
    return []
  }
}

export async function syncUserData(userId: string) {
  for (const { key, table } of STORAGE_TO_TABLE) {
    const rows = loadStoredRows(key)
    if (rows.length === 0) continue

    const payload = rows.map(row => ({
      ...row,
      user_id: userId,
    }))

    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' })
    if (error) throw error
  }
}
