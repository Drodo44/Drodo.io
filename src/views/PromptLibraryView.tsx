import { useState, useMemo, useEffect } from 'react'
import {
  BookMarked, Plus, Copy, Check, Edit3, Trash2, ArrowRight, Search, X, ChevronDown,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../store/appStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedPrompt {
  id: string
  title: string
  content: string
  tags: string[]
  category: string
  createdAt: number
  usageCount: number
}

// ─── Categories (same as templates) ──────────────────────────────────────────

const PROMPT_CATEGORIES = [
  'All',
  'Business', 'Marketing', 'Content & Creative', 'Research', 'Engineering',
  'Finance', 'Legal', 'Sales', 'HR & Recruiting', 'Customer Support',
  'Education', 'Health & Wellness', 'Real Estate', 'E-commerce',
  'Social Media', 'SEO', 'Data & Analytics', 'Productivity', 'Personal',
]

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'drodo_prompt_library'

function loadPrompts(): SavedPrompt[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') }
  catch { return [] }
}

function savePrompts(prompts: SavedPrompt[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
}

function createId(): string {
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Default prompts (seeded on first load) ───────────────────────────────────

const DEFAULT_PROMPTS: Omit<SavedPrompt, 'id' | 'createdAt' | 'usageCount'>[] = [
  {
    title: 'Summarize This',
    content: 'Summarize the following in 5 bullet points, focusing on the most important takeaways: [paste content here]',
    tags: ['summarize', 'bullets'],
    category: 'Productivity',
  },
  {
    title: 'Cold Email',
    content: 'Write a personalized cold email to [Name] at [Company] about [your offer]. Keep it under 100 words. Focus on their pain point: [pain point]. CTA: schedule a 15-minute call.',
    tags: ['email', 'outreach', 'cold'],
    category: 'Sales',
  },
  {
    title: 'Blog Post Outline',
    content: 'Create a detailed blog post outline for the topic: [topic]. Include: hook, 5 main sections with subpoints, and a conclusion with CTA. Target keyword: [keyword].',
    tags: ['blog', 'outline', 'seo'],
    category: 'Content & Creative',
  },
  {
    title: 'Code Review',
    content: 'Review the following code for bugs, security issues, performance problems, and style improvements. Be specific and actionable: [paste code]',
    tags: ['code', 'review', 'security'],
    category: 'Engineering',
  },
  {
    title: 'Meeting Agenda',
    content: 'Create a structured meeting agenda for a [duration] meeting about [topic]. Include: objectives, agenda items with time allocations, pre-read materials, and expected outcomes.',
    tags: ['meeting', 'agenda', 'planning'],
    category: 'Productivity',
  },
  {
    title: 'Job Description',
    content: 'Write a compelling job description for a [role] at a [company type] company. Include: role summary, responsibilities, requirements, nice-to-haves, and company culture section.',
    tags: ['hiring', 'job', 'recruiting'],
    category: 'HR & Recruiting',
  },
  {
    title: 'Weekly Report',
    content: 'Write a professional weekly status report covering: accomplishments this week, blockers encountered, plan for next week, and any decisions needed from leadership.',
    tags: ['report', 'weekly', 'status'],
    category: 'Productivity',
  },
  {
    title: 'Competitor Analysis',
    content: 'Analyze [competitor name] across these dimensions: product features, pricing, target market, strengths, weaknesses, and how we can position against them.',
    tags: ['competitor', 'analysis', 'strategy'],
    category: 'Business',
  },
]

function seedDefaultPrompts(): SavedPrompt[] {
  const now = Date.now()
  const seeded = DEFAULT_PROMPTS.map((p, i) => ({
    ...p,
    id: createId(),
    createdAt: now - i * 60000, // stagger timestamps
    usageCount: 0,
  }))
  savePrompts(seeded)
  return seeded
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortMode = 'newest' | 'most-used' | 'az'

// ─── Prompt Card ─────────────────────────────────────────────────────────────

function PromptCard({
  prompt,
  onEdit,
  onDelete,
  onUseInChat,
  onCopy,
}: {
  prompt: SavedPrompt
  onEdit: () => void
  onDelete: () => void
  onUseInChat: () => void
  onCopy: () => void
}) {
  const [copied, setCopied] = useState(false)
  const catColor = (() => {
    const map: Record<string, string> = {
      Business: '#7f77dd', Marketing: '#f97316', 'Content & Creative': '#e1306c',
      Research: '#4285f4', Engineering: '#1d9e75', Finance: '#f59e0b',
      Legal: '#6366f1', Sales: '#ec4899', 'HR & Recruiting': '#a855f7',
      'Customer Support': '#229ed9', Education: '#0ea5e9', 'Health & Wellness': '#22c55e',
      'Real Estate': '#84cc16', 'E-commerce': '#635bff', 'Social Media': '#e1306c',
      SEO: '#ff7000', 'Data & Analytics': '#06b6d4', Productivity: '#8b5cf6',
      Personal: '#f43f5e',
    }
    return map[prompt.category] ?? '#7f77dd'
  })()

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col gap-3 hover:border-[var(--border-color)] transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{prompt.title}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: catColor + '18', color: catColor, border: `1px solid ${catColor}28` }}
            >
              {prompt.category}
            </span>
            {prompt.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Edit"
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#e05050] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Content preview */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3 flex-1 font-mono">
        {prompt.content.slice(0, 180)}{prompt.content.length > 180 ? '…' : ''}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-color)]">
        <span className="text-xs text-[var(--text-muted)]">Used {prompt.usageCount}×</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {copied ? <Check size={11} style={{ color: '#1d9e75' }} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onUseInChat}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: '#7f77dd' }}
          >
            <ArrowRight size={11} />
            Use in Chat
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Prompt Form ──────────────────────────────────────────────────────────────

function PromptForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SavedPrompt | null
  onSave: (data: { title: string; content: string; tags: string[]; category: string }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [tagsRaw, setTagsRaw] = useState(initial?.tags.join(', ') ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'Productivity')
  const [titleError, setTitleError] = useState('')
  const [contentError, setContentError] = useState('')

  const canSave = title.trim() && content.trim()

  const handleSave = () => {
    const nextTitle = title.trim()
    const nextContent = content.trim()
    let hasError = false

    if (!nextTitle) {
      setTitleError('Title is required.')
      hasError = true
    }
    if (!nextContent) {
      setContentError('Prompt content is required.')
      hasError = true
    }
    if (hasError) return

    onSave({
      title: nextTitle,
      content: nextContent,
      tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
      category,
    })
  }

  return (
    <div className="p-5 rounded-xl border border-[#7f77dd]/30 bg-[var(--bg-secondary)] space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{initial ? 'Edit Prompt' : 'New Prompt'}</span>
        <button onClick={onCancel} className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => {
            setTitle(e.target.value)
            if (e.target.value.trim()) setTitleError('')
          }}
          placeholder="e.g. Cold Email Template"
          className="w-full bg-[var(--bg-primary)] border rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors"
          style={{ borderColor: titleError ? '#e05050' : 'var(--border-color)' }}
        />
        {titleError && <p className="mt-2 text-xs text-[#e05050]">{titleError}</p>}
      </div>

      {/* Category */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Category</label>
          <div className="relative">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors appearance-none pr-8"
            >
              {PROMPT_CATEGORIES.slice(1).map(cat => (
                <option key={cat} value={cat} style={{ background: 'var(--bg-secondary)' }}>{cat}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Tags (comma separated)</label>
          <input
            type="text"
            value={tagsRaw}
            onChange={e => setTagsRaw(e.target.value)}
            placeholder="email, outreach, sales"
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div>
        <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Prompt content</label>
        <textarea
          value={content}
          onChange={e => {
            setContent(e.target.value)
            if (e.target.value.trim()) setContentError('')
          }}
          placeholder="Write your prompt here. Use [brackets] for variables."
          rows={5}
          className="w-full bg-[var(--bg-primary)] border rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 transition-colors resize-none font-mono"
          style={{ borderColor: contentError ? '#e05050' : 'var(--border-color)' }}
        />
        {contentError && <p className="mt-2 text-xs text-[#e05050]">{contentError}</p>}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: '#7f77dd' }}
        >
          {initial ? 'Save Changes' : 'Save Prompt'}
        </button>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function PromptLibraryView() {
  const { setView, setChatDraft } = useAppStore(s => ({ setView: s.setView, setChatDraft: s.setChatDraft }))

  const [prompts, setPrompts] = useState<SavedPrompt[]>(() => {
    const loaded = loadPrompts()
    if (loaded.length === 0) return seedDefaultPrompts()
    return loaded
  })

  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('newest')
  const [showForm, setShowForm] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null)

  useEffect(() => { savePrompts(prompts) }, [prompts])

  const handleSave = (data: { title: string; content: string; tags: string[]; category: string }) => {
    if (editingPrompt) {
      setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? { ...p, ...data } : p))
      setEditingPrompt(null)
    } else {
      const newPrompt: SavedPrompt = {
        id: createId(),
        ...data,
        createdAt: Date.now(),
        usageCount: 0,
      }
      setPrompts(prev => [newPrompt, ...prev])
      setShowForm(false)
    }
  }

  const handleDelete = (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id))
  }

  const handleUseInChat = (prompt: SavedPrompt) => {
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, usageCount: p.usageCount + 1 } : p))
    setChatDraft(prompt.content)
    setView('agent')
  }

  const handleCopy = (prompt: SavedPrompt) => {
    void navigator.clipboard.writeText(prompt.content)
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, usageCount: p.usageCount + 1 } : p))
  }

  const filtered = useMemo(() => {
    let list = [...prompts]
    if (activeCategory !== 'All') list = list.filter(p => p.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    if (sort === 'newest') list.sort((a, b) => b.createdAt - a.createdAt)
    else if (sort === 'most-used') list.sort((a, b) => b.usageCount - a.usageCount)
    else list.sort((a, b) => a.title.localeCompare(b.title))
    return list
  }, [prompts, activeCategory, search, sort])

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    prompts.forEach(p => { counts[p.category] = (counts[p.category] ?? 0) + 1 })
    return counts
  }, [prompts])

  const CAT_COLORS: Record<string, string> = {
    Business: '#7f77dd', Marketing: '#f97316', 'Content & Creative': '#e1306c',
    Research: '#4285f4', Engineering: '#1d9e75', Finance: '#f59e0b',
    Legal: '#6366f1', Sales: '#ec4899', 'HR & Recruiting': '#a855f7',
    'Customer Support': '#229ed9', Education: '#0ea5e9', 'Health & Wellness': '#22c55e',
    'Real Estate': '#84cc16', 'E-commerce': '#635bff', 'Social Media': '#e1306c',
    SEO: '#ff7000', 'Data & Analytics': '#06b6d4', Productivity: '#8b5cf6',
    Personal: '#f43f5e',
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Left: Category filter (180px) ─── */}
      <div
        className="flex-shrink-0 flex flex-col min-h-0 overflow-hidden"
        style={{ width: 180, borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Categories</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {PROMPT_CATEGORIES.map(cat => {
            const isActive = activeCategory === cat
            const count = cat === 'All' ? prompts.length : (catCounts[cat] ?? 0)
            const color = CAT_COLORS[cat] ?? '#7f77dd'
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={clsx(
                  'w-full flex items-center justify-between px-4 py-2 text-xs font-medium transition-colors text-left',
                  isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-muted)]'
                )}
                style={isActive
                  ? { background: color + '15', borderLeft: `2px solid ${color}` }
                  : { borderLeft: '2px solid transparent' }
                }
              >
                <span className="truncate">{cat}</span>
                {count > 0 && (
                  <span
                    className="flex-shrink-0 text-[10px] ml-1 px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isActive ? color + '25' : 'var(--bg-tertiary)',
                      color: isActive ? color : 'var(--text-muted)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right: Main area ─────────────── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
            <BookMarked size={18} style={{ color: '#7f77dd' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-[var(--text-primary)] text-lg">Prompt Library</h1>
            <p className="text-xs text-[var(--text-secondary)]">{prompts.length} saved prompts</p>
          </div>

          {/* Search */}
          <div className="relative flex-shrink-0" style={{ width: 200 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search prompts…"
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl pl-8 pr-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[#7f77dd]/60 placeholder:text-[var(--text-muted)] transition-colors"
            />
          </div>

          {/* Sort */}
          <div className="relative flex-shrink-0">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortMode)}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] outline-none focus:border-[#7f77dd]/60 transition-colors appearance-none pr-8"
            >
              <option value="newest">Newest</option>
              <option value="most-used">Most Used</option>
              <option value="az">A–Z</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
          </div>

          {/* New Prompt */}
          <button
            onClick={() => { setShowForm(true); setEditingPrompt(null) }}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all active:scale-95"
            style={{ background: '#7f77dd' }}
          >
            <Plus size={14} />
            New Prompt
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Create / Edit form */}
          {(showForm || editingPrompt) && (
            <PromptForm
              initial={editingPrompt}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingPrompt(null) }}
            />
          )}

          {/* Empty state */}
          {filtered.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                <BookMarked size={28} className="text-[var(--text-secondary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  {search || activeCategory !== 'All' ? 'No prompts match your filters.' : 'No prompts saved yet.'}
                </h2>
                {!search && activeCategory === 'All' && (
                  <p className="text-sm text-[var(--text-secondary)] max-w-md">
                    Create your first prompt to reuse it across any agent or workflow.
                  </p>
                )}
                {(search || activeCategory !== 'All') && (
                  <p className="text-sm text-[var(--text-secondary)] max-w-md">
                    Try a different search or category to find saved prompts faster.
                  </p>
                )}
              </div>
              {!search && activeCategory === 'All' && (
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                  style={{ background: '#7f77dd' }}
                >
                  <Plus size={14} className="inline mr-1" />
                  Create Prompt
                </button>
              )}
            </div>
          )}

          {/* Prompt cards */}
          {filtered.length > 0 && (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {filtered.map(prompt => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onEdit={() => { setEditingPrompt(prompt); setShowForm(false) }}
                  onDelete={() => handleDelete(prompt.id)}
                  onUseInChat={() => handleUseInChat(prompt)}
                  onCopy={() => handleCopy(prompt)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
