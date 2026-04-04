import { invoke } from '@tauri-apps/api/core'
import type { CommandExecutionResult, FileSystemEntry } from '../types'

export async function readFile(path: string): Promise<string> {
  return invoke<string>('read_file', { path })
}

export async function writeFile(path: string, content: string): Promise<void> {
  await invoke('write_file', { path, content })
}

export async function listDirectory(path: string): Promise<FileSystemEntry[]> {
  return invoke<FileSystemEntry[]>('list_directory', { path })
}

export async function executeCommand(command: string): Promise<CommandExecutionResult> {
  return invoke<CommandExecutionResult>('execute_command', { command })
}

export async function getHomeDir(): Promise<string> {
  return invoke<string>('get_home_dir')
}
