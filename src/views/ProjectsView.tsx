import { FolderOpen, Plus, Clock, MessageSquare, Search, Trash2, Bot } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import {
  cycleProjectStatus,
  deleteProject,
  formatRelativeTime,
  loadProjects,
  saveProjects,
} from '../lib/dashboardData'
import type { Project } from '../types'

const STATUS_CFG = {
  active: { color: '#1d9e75', bg: '#1d9e7515', label: 'Active' },
  paused: { color: '#d4a227', bg: '#d4a22715', label: 'Paused' },
  complete: { color: 'var(--text-secondary)', bg: 'var(--text-secondary)15', label: 'Complete' },
}

export function ProjectsView() {
  const setView = useAppStore(s => s.setView)
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>(() => loadProjects())
  const [showForm, setShowForm] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const syncProjects = () => setProjects(loadProjects())
    window.addEventListener('storage', syncProjects)
    return () => window.removeEventListener('storage', syncProjects)
  }, [])

  const filteredProjects = useMemo(
    () => projects.filter(project => project.name.toLowerCase().includes(query.toLowerCase())),
    [projects, query]
  )

  const resetForm = () => {
    setShowForm(false)
    setNameInput('')
    setDescriptionInput('')
  }

  const handleCreateProject = () => {
    const name = nameInput.trim()
    const description = descriptionInput.trim()
    if (!name) return

    const nextProjects = [
      {
        id: crypto.randomUUID(),
        name,
        description,
        createdAt: new Date().toISOString(),
        sessionsCount: 0,
        status: 'active' as const,
        agentCount: 0,
      },
      ...projects,
    ]

    saveProjects(nextProjects)
    setProjects(loadProjects())
    resetForm()
  }

  const handleToggleStatus = (projectId: string) => {
    const nextProjects = projects.map(project =>
      project.id === projectId ? { ...project, status: cycleProjectStatus(project.status) } : project
    )
    saveProjects(nextProjects)
    setProjects(loadProjects())
  }

  const handleDelete = (projectId: string) => {
    setProjects(deleteProject(projectId))
    setPendingDeleteId(current => (current === projectId ? null : current))
  }

  const hasProjects = projects.length > 0
  const hasMatches = filteredProjects.length > 0

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#d4a22722' }}>
            <FolderOpen size={18} style={{ color: '#d4a227' }} />
          </div>
          <div>
            <h1 className="font-bold text-[var(--text-primary)] text-lg">Projects</h1>
            <p className="text-xs text-[var(--text-secondary)]">{projects.length} projects</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7f77dd' }}
        >
          <Plus size={14} />
          New Project
        </button>
      </div>

      <div className="px-6 py-3 space-y-3" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <Search size={14} className="text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
          />
        </div>

        {showForm && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
            <div className="grid gap-3 md:grid-cols-[1fr,1.2fr,auto]">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Project name"
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
              />
              <input
                value={descriptionInput}
                onChange={e => setDescriptionInput(e.target.value)}
                placeholder="Description"
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateProject}
                  disabled={!nameInput.trim()}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: '#7f77dd' }}
                >
                  Save
                </button>
                <button
                  onClick={resetForm}
                  className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm font-medium text-[var(--text-muted)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!hasProjects ? (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No projects yet. Create one to organize future work.</p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: '#7f77dd' }}
              >
                <Plus size={14} />
                Create Project
              </button>
            )}
          </div>
        ) : !hasMatches ? (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No projects match your search.</p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {filteredProjects.map(project => {
              const statusConfig = STATUS_CFG[project.status]

              return (
                <div
                  key={project.id}
                  onClick={() => setView('sessions')}
                  className="rounded-xl border border-[var(--border-color)] p-5 bg-[var(--bg-secondary)] hover:border-[var(--border-color)] transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[var(--text-primary)] text-sm group-hover:text-[#a09ae8] transition-colors truncate">
                        {project.name}
                      </h3>
                      <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">{project.description}</p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                      style={{ color: statusConfig.color, background: statusConfig.bg }}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <MessageSquare size={11} />
                      {project.sessionsCount} sessions
                    </span>
                    <span className="flex items-center gap-1">
                      <Bot size={11} />
                      {project.agentCount} agents
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatRelativeTime(project.createdAt)}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      onClick={event => {
                        event.stopPropagation()
                        handleToggleStatus(project.id)
                      }}
                      className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      Cycle Status
                    </button>

                    {pendingDeleteId === project.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)]">Delete?</span>
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            handleDelete(project.id)
                          }}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
                          style={{ background: '#e05050' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            setPendingDeleteId(null)
                          }}
                          className="rounded-lg border border-[var(--border-color)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={event => {
                          event.stopPropagation()
                          setPendingDeleteId(project.id)
                        }}
                        className="rounded-lg border border-[var(--border-color)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[#e05050]"
                        aria-label={`Delete ${project.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
