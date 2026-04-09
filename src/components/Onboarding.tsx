import { useState, useEffect } from 'react'
import {
  CheckCircle2, ChevronRight, ArrowRight,
  Bot, Search, FileText, Target, Settings2, Code2,
  LineChart, Share2, Star,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../store/appStore'
import { getAllSavedModels, getConnectedProviders } from '../lib/providerApi'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ONBOARDING_KEY = 'drodo_onboarding_complete'
const drodoLogoUrl = new URL('../assets/drodo-logo.png', import.meta.url).href

export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, '1')
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY)
}

function hasCompletedProviderSetup(): boolean {
  return getAllSavedModels().length > 0 || getConnectedProviders().length > 0
}

export function isOnboardingComplete(): boolean {
  return !!localStorage.getItem(ONBOARDING_KEY) || hasCompletedProviderSetup()
}

// ─── Step dots ────────────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === step ? 20 : 8,
            height: 8,
            background: i === step ? '#7f77dd' : i < step ? '#7f77dd60' : 'var(--border-color)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Provider quick-connect cards ─────────────────────────────────────────────

const QUICK_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', desc: 'Claude — best reasoning', color: '#cc785c', initials: 'AN' },
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o — most popular', color: '#10a37f', initials: 'OA' },
  { id: 'gemini', name: 'Google Gemini', desc: 'Fast + multimodal', color: '#4285f4', initials: 'GG' },
  { id: 'nvidia', name: 'NVIDIA NIM', desc: 'GPU-accelerated models', color: '#76b900', initials: 'NV' },
  { id: 'openrouter', name: 'OpenRouter', desc: '300+ models in one API', color: '#6366f1', initials: 'OR' },
  { id: 'ollama', name: 'Ollama', desc: 'Run locally — free', color: '#7f77dd', initials: 'OL', local: true },
]

// ─── Featured templates for step 3 ───────────────────────────────────────────

type LucideIcon = typeof Bot

const FEATURED_TEMPLATES: { id: string; name: string; desc: string; Icon: LucideIcon; color: string }[] = [
  { id: 'research-analyst', name: 'Research Analyst', desc: 'Deep research & structured reports', Icon: Search, color: '#4285f4' },
  { id: 'blog-writer', name: 'Content Writer', desc: 'Blog posts & long-form content', Icon: FileText, color: '#e1306c' },
  { id: 'sales-coach', name: 'Sales Coach', desc: 'Objection handling & deal strategy', Icon: Target, color: '#ec4899' },
  { id: 'seo-strategist', name: 'SEO Strategist', desc: 'Keywords, audits & link building', Icon: Settings2, color: '#ff7000' },
  { id: 'executive-assistant', name: 'Executive Assistant', desc: 'Tasks, comms & scheduling', Icon: Bot, color: '#8b5cf6' },
  { id: 'software-architect', name: 'Software Architect', desc: 'System design & code review', Icon: Code2, color: '#1d9e75' },
  { id: 'financial-analyst', name: 'Financial Analyst', desc: 'Valuations, models & reports', Icon: LineChart, color: '#f59e0b' },
  { id: 'social-media-manager', name: 'Social Media Manager', desc: 'Posts, captions & calendars', Icon: Share2, color: '#e1306c' },
  { id: 'life-coach', name: 'Life Coach', desc: 'Goals, mindset & development', Icon: Star, color: '#f43f5e' },
]

// ─── Main component ───────────────────────────────────────────────────────────

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { setView, spawnAgent, setProviderHubOpen } = useAppStore(useShallow(s => ({
    setView: s.setView,
    spawnAgent: s.spawnAgent,
    setProviderHubOpen: s.setProviderHubOpen,
  })))

  const [step, setStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const hasProvider = hasCompletedProviderSetup()

  // If any saved model or connected provider already exists, skip onboarding immediately
  useEffect(() => {
    if (isOnboardingComplete()) {
      onComplete()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = () => {
    markOnboardingComplete()
    onComplete()
    setView('agent')
  }

  const deployAndFinish = () => {
    if (selectedTemplate) {
      const tpl = FEATURED_TEMPLATES.find(t => t.id === selectedTemplate)
      if (tpl) {
        void spawnAgent(`You are a ${tpl.name}. ${tpl.desc}. Help me with anything related to your specialty.`, undefined, tpl.name)
        setView('swarm')
      }
    }
    markOnboardingComplete()
    onComplete()
  }

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-6 py-10"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Step dots */}
      <div className="mb-8">
        <StepDots step={step} total={4} />
      </div>

      {/* ── Step 0: Welcome ────────────────────────────── */}
      {step === 0 && (
        <div className="flex flex-col items-center gap-6 text-center" style={{ maxWidth: 480 }}>
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: '#7f77dd18', border: '2px solid #7f77dd30' }}
          >
            <img src={drodoLogoUrl} alt="Drodo" style={{ width: 48, height: 48 }} />
          </div>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Welcome to Drodo.
            </h1>
            <p className="mt-4 text-base text-[var(--text-muted)] leading-relaxed">
              The AI agent platform built for everyone. Connect any model, deploy any agent,
              automate anything — no technical knowledge required.
            </p>
          </div>
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: '#7f77dd', boxShadow: '0 4px 20px rgba(127,119,221,0.35)' }}
          >
            Let's get started
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── Step 1: Connect model ──────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-6" style={{ width: '100%', maxWidth: 560 }}>
          <div className="text-center">
            <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Connect Additional AI Model
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Drodo works with any AI provider. Use your own API key — your data never touches our servers.
            </p>
          </div>

          {/* Provider grid */}
          <div className="grid grid-cols-2 gap-3">
            {QUICK_PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setProviderHubOpen(true)}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--border-color)] transition-all duration-200 text-left"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: p.color + '22', color: p.color }}
                >
                  {p.initials}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{p.name}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Connected banner */}
          {hasProvider && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: '#1d9e7512', border: '1px solid #1d9e7530' }}
            >
              <CheckCircle2 size={16} style={{ color: '#1d9e75' }} />
              <span className="text-sm font-medium" style={{ color: '#1d9e75' }}>
                Model connected — you're ready to continue
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-muted)] transition-colors underline"
            >
              I'll do this later →
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!hasProvider}
              className={clsx(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all',
                hasProvider ? 'hover:opacity-90 active:scale-[0.98]' : 'opacity-40 cursor-not-allowed'
              )}
              style={{ background: '#7f77dd' }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Choose template ────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-5" style={{ width: '100%', maxWidth: 600 }}>
          <div className="text-center">
            <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              What do you want to accomplish?
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Pick a starting point. You can always change this later.
            </p>
          </div>

          {/* 3×3 grid */}
          <div className="grid grid-cols-3 gap-3">
            {FEATURED_TEMPLATES.map(t => {
              const isSelected = selectedTemplate === t.id
              const { Icon } = t
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(isSelected ? null : t.id)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-150 text-center"
                  style={{
                    background: isSelected ? t.color + '12' : 'var(--bg-secondary)',
                    borderColor: isSelected ? t.color + '50' : 'var(--border-color)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: t.color + '20', color: t.color }}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)] leading-tight">{t.name}</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-tight">{t.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={finish}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-muted)] transition-colors underline"
            >
              Start with a blank agent →
            </button>
            <button
              onClick={selectedTemplate ? deployAndFinish : () => setStep(3)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98] transition-all"
              style={{ background: selectedTemplate ? '#1d9e75' : '#7f77dd' }}
            >
              {selectedTemplate ? 'Deploy Selected Agent →' : 'Skip'}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: You're ready ───────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col items-center gap-6 text-center" style={{ maxWidth: 440 }}>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: '#1d9e7520', border: '2px solid #1d9e7540' }}
          >
            <CheckCircle2 size={40} style={{ color: '#1d9e75' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              You're all set.
            </h2>
            <p className="mt-3 text-base text-[var(--text-muted)] leading-relaxed">
              Your agent is ready. Start a conversation, explore templates, or connect more models anytime.
            </p>
          </div>
          <button
            onClick={finish}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ background: '#1d9e75', boxShadow: '0 4px 20px rgba(29,158,117,0.3)' }}
          >
            Open Drodo →
          </button>
        </div>
      )}
    </div>
  )
}
