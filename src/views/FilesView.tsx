import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileText,
  Files,
  FolderClosed,
  FolderOpen,
  Home,
  Loader,
  RefreshCw,
  ArrowUp,
} from 'lucide-react'
import { clsx } from 'clsx'
import { getHomeDir, listDirectory } from '../lib/tauri'
import { useAppStore } from '../store/appStore'
import { useShallow } from 'zustand/react/shallow'
import type { FileSystemEntry } from '../types'

function formatSize(size?: number | null) {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getParentPath(path: string) {
  const normalized = path.replace(/[\\/]+$/, '')
  const lastSlash = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
  if (lastSlash <= 0) return path
  if (/^[A-Za-z]:$/.test(normalized.slice(0, 2)) && lastSlash < 3) {
    return `${normalized.slice(0, 2)}\\`
  }
  return normalized.slice(0, lastSlash)
}

function FileIcon({ entry }: { entry: FileSystemEntry }) {
  if (entry.isDirectory) {
    return <FolderClosed size={14} className="text-[#d4a227]" />
  }

  const lower = entry.name.toLowerCase()
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.rs')) {
    return <FileCode size={14} className="text-[#7f77dd]" />
  }
  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    return <FileText size={14} className="text-[var(--text-muted)]" />
  }
  return <File size={14} className="text-[var(--text-secondary)]" />
}

interface TreeItemProps {
  entry: FileSystemEntry
  depth: number
  expandedPaths: Record<string, boolean>
  loadingPaths: Record<string, boolean>
  entriesByPath: Record<string, FileSystemEntry[]>
  activeDocumentPath: string | null
  onToggle: (entry: FileSystemEntry) => void
  onSelect: (entry: FileSystemEntry) => void
}

function TreeItem(props: TreeItemProps) {
  const {
    entry,
    depth,
    expandedPaths,
    loadingPaths,
    entriesByPath,
    activeDocumentPath,
    onToggle,
    onSelect,
  } = props

  const isOpen = !!expandedPaths[entry.path]
  const isLoading = !!loadingPaths[entry.path]
  const children = entriesByPath[entry.path] ?? []
  const isActive = activeDocumentPath === entry.path

  return (
    <div>
      <button
        onClick={() => (entry.isDirectory ? onToggle(entry) : onSelect(entry))}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors',
          isActive
            ? 'bg-[#7f77dd]/12 text-[var(--text-primary)]'
            : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
        )}
        style={{ paddingLeft: 10 + depth * 16 }}
      >
        {entry.isDirectory ? (
          <>
            {isLoading ? (
              <Loader size={11} className="text-[var(--text-secondary)] animate-spin" />
            ) : isOpen ? (
              <ChevronDown size={11} className="text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight size={11} className="text-[var(--text-secondary)]" />
            )}
            {isOpen ? (
              <FolderOpen size={14} className="text-[#d4a227]" />
            ) : (
              <FolderClosed size={14} className="text-[#d4a227]" />
            )}
          </>
        ) : (
          <>
            <span className="w-[11px]" />
            <FileIcon entry={entry} />
          </>
        )}
        <span className="truncate flex-1">{entry.name}</span>
        {!entry.isDirectory && <span className="text-[10px] text-[var(--text-secondary)]">{formatSize(entry.size)}</span>}
      </button>

      {entry.isDirectory && isOpen && children.map(child => (
        <TreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          expandedPaths={expandedPaths}
          loadingPaths={loadingPaths}
          entriesByPath={entriesByPath}
          activeDocumentPath={activeDocumentPath}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export function FilesView() {
  const {
    openDocument,
    activeDocumentPath,
    activeDocumentLoading,
    liveOutputContent,
    liveOutputTitle,
  } = useAppStore(
    useShallow(state => ({
      openDocument: state.openDocument,
      activeDocumentPath: state.activeDocumentPath,
      activeDocumentLoading: state.activeDocumentLoading,
      liveOutputContent: state.liveOutputContent,
      liveOutputTitle: state.liveOutputTitle,
    }))
  )

  const [rootPath, setRootPath] = useState('')
  const [pathInput, setPathInput] = useState('')
  const [entriesByPath, setEntriesByPath] = useState<Record<string, FileSystemEntry[]>>({})
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({})
  const [loadingPaths, setLoadingPaths] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const loadDirectory = async (path: string, open = true) => {
    setLoadingPaths(current => ({ ...current, [path]: true }))
    setError(null)

    try {
      const entries = await listDirectory(path)
      setEntriesByPath(current => ({ ...current, [path]: entries }))
      if (open) {
        setExpandedPaths(current => ({ ...current, [path]: true }))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingPaths(current => ({ ...current, [path]: false }))
    }
  }

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const home = await getHomeDir()
        if (!mounted) return
        setRootPath(home)
        setPathInput(home)
        await loadDirectory(home)
      } catch (err: unknown) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleToggle = async (entry: FileSystemEntry) => {
    if (!entry.isDirectory) return
    const isOpen = !!expandedPaths[entry.path]
    if (isOpen) {
      setExpandedPaths(current => ({ ...current, [entry.path]: false }))
      return
    }
    if (!entriesByPath[entry.path]) {
      await loadDirectory(entry.path)
      return
    }
    setExpandedPaths(current => ({ ...current, [entry.path]: true }))
  }

  const handleNavigate = async (path: string) => {
    setRootPath(path)
    setPathInput(path)
    await loadDirectory(path)
  }

  const rootEntries = entriesByPath[rootPath] ?? []

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#1d9e7522' }}>
          <Files size={18} style={{ color: '#1d9e75' }} />
        </div>
        <div>
          <h1 className="font-bold text-[var(--text-primary)] text-lg">Files</h1>
          <p className="text-xs text-[var(--text-secondary)]">Real filesystem browser</p>
        </div>
      </div>

      <div className="px-6 py-3 flex items-center gap-2 border-b border-[var(--border-color)] bg-[#101013]">
        <button
          onClick={() => void getHomeDir().then(home => handleNavigate(home))}
          className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Home"
        >
          <Home size={14} />
        </button>
        <button
          onClick={() => void handleNavigate(getParentPath(rootPath))}
          className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Up one level"
          disabled={!rootPath}
        >
          <ArrowUp size={14} />
        </button>
        <button
          onClick={() => void loadDirectory(rootPath)}
          className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Refresh"
          disabled={!rootPath}
        >
          <RefreshCw size={14} />
        </button>
        <form
          className="flex-1"
          onSubmit={event => {
            event.preventDefault()
            if (pathInput.trim()) {
              void handleNavigate(pathInput.trim())
            }
          }}
        >
          <input
            value={pathInput}
            onChange={event => setPathInput(event.target.value)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60"
            placeholder="Enter a folder path"
          />
        </form>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[360px_1fr]">
        <div className="border-r border-[var(--border-color)] overflow-y-auto p-4">
          {error && (
            <div className="mb-3 text-xs text-[#e05050] bg-[#e05050]/10 border border-[#e05050]/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-2">
            {rootPath ? (
              <>
                <button
                  onClick={() => void handleNavigate(rootPath)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-xs text-[var(--text-primary)] bg-[var(--bg-tertiary)]"
                >
                  <FolderOpen size={14} className="text-[#d4a227]" />
                  <span className="truncate">{rootPath}</span>
                </button>
                <div className="mt-2">
                  {rootEntries.map(entry => (
                    <TreeItem
                      key={entry.path}
                      entry={entry}
                      depth={0}
                      expandedPaths={expandedPaths}
                      loadingPaths={loadingPaths}
                      entriesByPath={entriesByPath}
                      activeDocumentPath={activeDocumentPath}
                      onToggle={entryToToggle => void handleToggle(entryToToggle)}
                      onSelect={entryToSelect => void openDocument(entryToSelect.path)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="p-4 text-xs text-[var(--text-secondary)]">Loading home directory…</div>
            )}
          </div>
        </div>

        <div className="min-h-0 overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--border-color)] bg-[#101013]">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Preview</div>
            <div className="text-sm text-[var(--text-primary)] truncate mt-1">
              {activeDocumentPath || liveOutputTitle}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5">
            {activeDocumentLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Loader size={14} className="animate-spin" />
                Loading file…
              </div>
            ) : (
              <pre className="text-xs leading-6 text-[var(--text-primary)] whitespace-pre-wrap break-words font-mono">
                {liveOutputContent}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
