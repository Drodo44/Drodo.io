import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

export const TUTORIAL_KEY = 'drodo_tutorial_complete'

export function isTutorialComplete(): boolean {
  return !!localStorage.getItem(TUTORIAL_KEY)
}

export function resetTutorial() {
  localStorage.removeItem(TUTORIAL_KEY)
}

// ─── Step definitions ─────────────────────────────────────────────────────────

interface TutorialStep {
  target?: string // data-tutorial attribute value; undefined = center modal
  title: string
  body: string
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to Drodo 👋',
    body: "Let's take 60 seconds to show you where everything is. You can skip this anytime.",
  },
  {
    target: 'sidebar',
    title: 'Your Command Center',
    body: 'Every feature lives here in the sidebar. Click any item to switch views instantly. Press Cmd+K or Ctrl+K to search everything.',
  },
  {
    target: 'nav-agent',
    title: 'Agent Chat',
    body: 'This is your main AI conversation. Connect any model and start chatting — or enable Multi-Agent mode to automatically spawn a team of specialists for complex tasks.',
  },
  {
    target: 'chat-input',
    title: 'Multi-Agent Mode',
    body: "Click the 'Multi-Agent' button next to the send button to let Drodo automatically build a team of specialist agents for your task. Perfect for complex, multi-step work.",
  },
  {
    target: 'nav-templates',
    title: '70+ Agent Templates',
    body: 'Deploy a pre-built expert in one click. Research Analyst, Sales Coach, Software Architect, Content Writer — any role, instantly ready. Templates give each agent the right expertise for the job.',
  },
  {
    target: 'nav-swarm',
    title: 'Live Mission Control',
    body: 'Watch all your agents work in real time. See exactly what each agent is doing, every tool call, every step. When Multi-Agent mode is active, your orchestrated team appears here.',
  },
  {
    target: 'nav-skills',
    title: 'Skills & Connectors',
    body: 'Give your agents superpowers. Enable Web Search, Persistent Memory, and Code Execution. Install skill packages from the open-source community. Connect third-party services.',
  },
  {
    target: 'nav-workflows',
    title: 'Workflow Builder',
    body: 'Build multi-step workflows that run automatically. Each step uses a different model and passes its output to the next. Results are logged in Run History.',
  },
  {
    target: 'nav-automations',
    title: 'n8n Automation Engine',
    body: 'Launch n8n and your agents can build permanent, repeatable workflows that run forever — even when Drodo is closed. The most powerful automation tool, built right in.',
  },
  {
    target: 'nav-messaging',
    title: 'Control from Anywhere',
    body: 'Connect Telegram, Slack, or Discord and talk to your agents from your phone, from any device, from anywhere in the world. Your agents respond in real time.',
  },
  {
    target: 'nav-mcp',
    title: 'MCP Integrations',
    body: 'Connect Model Context Protocol servers to give agents direct access to GitHub, databases, Google Workspace, browser automation, and more. One-click featured integrations included.',
  },
  {
    title: "You're all set 🚀",
    body: "You now know where everything is. Drodo is the most powerful AI agent platform ever built — and the easiest to use. Start a conversation, deploy an agent, or explore on your own.",
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = 'right' | 'left' | 'top' | 'bottom' | 'center'

interface TargetInfo {
  rect: DOMRect
  side: Side
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARD_W = 300
const CARD_H_EST = 180 // estimated height for positioning
const GAP = 14

function detectSide(rect: DOMRect): Side {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const ww = window.innerWidth
  const wh = window.innerHeight

  // Elements in the left third → tooltip to the right
  if (cx < ww * 0.35) return 'right'
  // Elements in the right third → tooltip to the left
  if (cx > ww * 0.65) return 'left'
  // Elements in the bottom third → tooltip above
  if (cy > wh * 0.6) return 'top'
  return 'bottom'
}

function tooltipPosition(rect: DOMRect, side: Side): React.CSSProperties {
  const ww = window.innerWidth
  const wh = window.innerHeight

  if (side === 'right') {
    const left = Math.min(rect.right + GAP, ww - CARD_W - 8)
    const top = Math.max(8, Math.min(rect.top + rect.height / 2 - CARD_H_EST / 2, wh - CARD_H_EST - 8))
    return { left, top }
  }
  if (side === 'left') {
    const left = Math.max(8, rect.left - CARD_W - GAP)
    const top = Math.max(8, Math.min(rect.top + rect.height / 2 - CARD_H_EST / 2, wh - CARD_H_EST - 8))
    return { left, top }
  }
  if (side === 'top') {
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - CARD_W / 2, ww - CARD_W - 8))
    const top = Math.max(8, rect.top - CARD_H_EST - GAP)
    return { left, top }
  }
  // bottom
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - CARD_W / 2, ww - CARD_W - 8))
  const top = Math.min(rect.bottom + GAP, wh - CARD_H_EST - 8)
  return { left, top }
}

// ─── Arrow ────────────────────────────────────────────────────────────────────

function Arrow({ side }: { side: Side }) {
  if (side === 'center') return null

  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    pointerEvents: 'none',
  }

  const arrowColor = '#7f77dd'

  if (side === 'right') {
    // Arrow points left (toward sidebar)
    return (
      <div
        style={{
          ...base,
          left: -10,
          top: '50%',
          transform: 'translateY(-50%)',
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderRight: `10px solid ${arrowColor}`,
        }}
      />
    )
  }
  if (side === 'left') {
    // Arrow points right
    return (
      <div
        style={{
          ...base,
          right: -10,
          top: '50%',
          transform: 'translateY(-50%)',
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderLeft: `10px solid ${arrowColor}`,
        }}
      />
    )
  }
  if (side === 'top') {
    // Arrow points down
    return (
      <div
        style={{
          ...base,
          bottom: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: `10px solid ${arrowColor}`,
        }}
      />
    )
  }
  // bottom — arrow points up
  return (
    <div
      style={{
        ...base,
        top: -10,
        left: '50%',
        transform: 'translateX(-50%)',
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderBottom: `10px solid ${arrowColor}`,
      }}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TutorialProps {
  onComplete: () => void
}

export function Tutorial({ onComplete }: TutorialProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [visible, setVisible] = useState(false)
  const [targetInfo, setTargetInfo] = useState<TargetInfo | null>(null)
  const [animating, setAnimating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const step = STEPS[stepIdx]
  const isCenter = !step.target
  const total = STEPS.length

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [])

  // Resolve target element position whenever step changes
  useEffect(() => {
    if (!step.target) {
      setTargetInfo(null)
      return
    }
    const el = document.querySelector<HTMLElement>(`[data-tutorial="${step.target}"]`)
    if (!el) {
      setTargetInfo(null)
      return
    }
    const rect = el.getBoundingClientRect()
    const side = detectSide(rect)
    setTargetInfo({ rect, side })
  }, [step])

  const complete = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, '1')
    onComplete()
  }, [onComplete])

  const goTo = useCallback((idx: number) => {
    if (animating) return
    setAnimating(true)
    setVisible(false)
    setTimeout(() => {
      setStepIdx(idx)
      setVisible(true)
      setAnimating(false)
    }, 180)
  }, [animating])

  const handleNext = () => {
    if (stepIdx < total - 1) {
      goTo(stepIdx + 1)
    } else {
      complete()
    }
  }

  const handleSkip = () => complete()

  // Tooltip card position
  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    width: CARD_W,
    zIndex: 10000,
    transition: 'opacity 0.18s ease, transform 0.18s ease',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(6px)',
  }

  let side: Side = 'center'

  if (isCenter) {
    cardStyle = {
      ...cardStyle,
      top: '50%',
      left: '50%',
      transform: visible
        ? 'translate(-50%, -50%)'
        : 'translate(-50%, calc(-50% + 8px))',
    }
  } else if (targetInfo) {
    side = targetInfo.side
    const pos = tooltipPosition(targetInfo.rect, side)
    cardStyle = { ...cardStyle, ...pos }
  } else {
    // Target not found — fallback to center
    cardStyle = {
      ...cardStyle,
      top: '50%',
      left: '50%',
      transform: visible
        ? 'translate(-50%, -50%)'
        : 'translate(-50%, calc(-50% + 8px))',
    }
  }

  const isLastStep = stepIdx === total - 1

  return (
    <>
      {/* Dim overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          transition: 'opacity 0.18s ease',
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Highlight ring over target */}
      {targetInfo && (
        <div
          style={{
            position: 'fixed',
            top: targetInfo.rect.top - 4,
            left: targetInfo.rect.left - 4,
            width: targetInfo.rect.width + 8,
            height: targetInfo.rect.height + 8,
            borderRadius: 10,
            boxShadow: '0 0 0 3px #7f77dd, 0 0 0 6px rgba(127,119,221,0.3)',
            zIndex: 10000,
            pointerEvents: 'none',
            transition: 'opacity 0.18s ease',
            opacity: visible ? 1 : 0,
          }}
        />
      )}

      {/* Tooltip card */}
      <div ref={cardRef} style={cardStyle}>
        <div
          style={{
            background: '#141418',
            border: '1px solid #7f77dd',
            borderRadius: 16,
            padding: '20px 24px',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(127,119,221,0.15)',
          }}
        >
          <Arrow side={side} />

          {/* Title */}
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: '#fff',
              marginBottom: 8,
              lineHeight: 1.3,
            }}
          >
            {step.title}
          </div>

          {/* Body */}
          <div
            style={{
              fontSize: 13,
              color: '#9898a8',
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            {step.body}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#9898a8', flexShrink: 0 }}>
              Step {stepIdx + 1} of {total}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isLastStep && (
                <button
                  onClick={handleSkip}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '6px 10px',
                    fontSize: 12,
                    color: '#9898a8',
                    cursor: 'pointer',
                    borderRadius: 8,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c8c8d4')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9898a8')}
                >
                  Skip
                </button>
              )}
              <button
                onClick={handleNext}
                style={{
                  background: '#7f77dd',
                  border: 'none',
                  borderRadius: 10,
                  padding: '7px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {isLastStep ? 'Start using Drodo' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
