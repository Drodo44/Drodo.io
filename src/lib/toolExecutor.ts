import type {
  CommandExecutionResult,
  FileSystemEntry,
  ToolCall,
  ToolExecutionResult,
  ToolName,
} from '../types'
import { executeCommand, getHomeDir, listDirectory, readFile, writeFile } from './tauri'

const TOOL_NAMES: ToolName[] = [
  'read_file',
  'write_file',
  'list_directory',
  'execute_command',
  'get_home_dir',
]

const MAX_MODEL_PAYLOAD = 12000

function trimForModel(value: string): string {
  if (value.length <= MAX_MODEL_PAYLOAD) return value
  return `${value.slice(0, MAX_MODEL_PAYLOAD)}\n\n[truncated ${value.length - MAX_MODEL_PAYLOAD} characters]`
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function requireStringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Tool argument "${key}" must be a non-empty string.`)
  }
  return value
}

function summarizeDirectory(entries: FileSystemEntry[]) {
  if (entries.length === 0) return 'Directory is empty.'

  return entries
    .slice(0, 40)
    .map(entry => `${entry.isDirectory ? '[dir]' : '[file]'} ${entry.path}`)
    .join('\n')
}

function summarizeCommand(result: CommandExecutionResult) {
  const output = result.combined.trim() || '(no output)'
  return trimForModel(
    `Command: ${result.command}\nExit code: ${result.exitCode}\nSuccess: ${result.success}\nWorking directory: ${result.workingDirectory}\n\n${output}`
  )
}

export function getToolCatalogPrompt(): string {
  return [
    'You can request one tool call at a time by responding with JSON only.',
    'Valid response shapes:',
    stringifyJson({
      type: 'tool',
      tool: 'read_file',
      arguments: { path: 'C:\\Users\\name\\file.txt' },
    }),
    stringifyJson({
      type: 'final',
      message: 'Short answer to the user summarizing what you did and what happened.',
    }),
    'Available tools:',
    '- read_file(path): Read a text file from disk.',
    '- write_file(path, content): Create or overwrite a file on disk.',
    '- list_directory(path): List files and folders in a directory.',
    '- execute_command(command): Run a shell command and return stdout, stderr, and exit code.',
    '- get_home_dir(): Return the current user home directory.',
    'Rules:',
    '- Respond with raw JSON and nothing else.',
    '- Use tools when you need file contents, filesystem state, or shell output.',
    '- Prefer list_directory before reading unknown paths.',
    '- Prefer read_file before modifying an existing file.',
    '- When you have enough information, return {"type":"final","message":"..."}.',
  ].join('\n')
}

export function parseToolDecision(raw: string): ToolCall | { type: 'final'; message: string } {
  const normalized = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')

  const firstBrace = normalized.indexOf('{')
  const lastBrace = normalized.lastIndexOf('}')
  const candidate = firstBrace >= 0 && lastBrace > firstBrace
    ? normalized.slice(firstBrace, lastBrace + 1)
    : normalized

  try {
    const parsed = JSON.parse(candidate) as {
      type?: string
      tool?: ToolName
      arguments?: Record<string, unknown>
      message?: string
    }

    if (parsed.type === 'tool' && parsed.tool && TOOL_NAMES.includes(parsed.tool)) {
      return {
        tool: parsed.tool,
        arguments: parsed.arguments ?? {},
      }
    }

    if (parsed.type === 'final' && typeof parsed.message === 'string') {
      return {
        type: 'final',
        message: parsed.message,
      }
    }
  } catch {
    // Fall back to treating the raw response as a final answer.
  }

  return {
    type: 'final',
    message: raw.trim(),
  }
}

export async function executeToolCall(call: ToolCall): Promise<ToolExecutionResult> {
  switch (call.tool) {
    case 'read_file': {
      const path = requireStringArg(call.arguments, 'path')
      const content = await readFile(path)
      return {
        tool: call.tool,
        arguments: { path },
        summary: `Read ${path}`,
        contentForModel: trimForModel(content),
        raw: content,
      }
    }

    case 'write_file': {
      const path = requireStringArg(call.arguments, 'path')
      const content = requireStringArg(call.arguments, 'content')
      await writeFile(path, content)
      return {
        tool: call.tool,
        arguments: { path },
        summary: `Wrote ${path} (${content.length} characters)`,
        contentForModel: `Wrote ${path} with ${content.length} characters.`,
        raw: { path, content, contentLength: content.length },
      }
    }

    case 'list_directory': {
      const path = requireStringArg(call.arguments, 'path')
      const entries = await listDirectory(path)
      return {
        tool: call.tool,
        arguments: { path },
        summary: `Listed ${path} (${entries.length} entries)`,
        contentForModel: summarizeDirectory(entries),
        raw: entries,
      }
    }

    case 'execute_command': {
      const command = requireStringArg(call.arguments, 'command')
      const result = await executeCommand(command)
      return {
        tool: call.tool,
        arguments: { command },
        summary: `Executed "${command}" (exit ${result.exitCode})`,
        contentForModel: summarizeCommand(result),
        raw: result,
      }
    }

    case 'get_home_dir': {
      const path = await getHomeDir()
      return {
        tool: call.tool,
        arguments: {},
        summary: `Resolved home directory: ${path}`,
        contentForModel: path,
        raw: path,
      }
    }
  }
}
