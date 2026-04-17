import { useState, useMemo, useEffect } from 'react'
import {
  BookMarked, Plus, Copy, Check, Edit3, Trash2, ArrowRight, Search, X, ChevronDown,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useShallow } from 'zustand/react/shallow'
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
  // Business
  {
    title: 'Business Plan One-Pager',
    content: 'Draft a one-page business plan for [business idea]. Include: target customer, core problem, proposed solution, business model, pricing, go-to-market channel, first 90-day milestones, and top 3 risks with mitigation.',
    tags: ['business-plan', 'strategy', 'founder'],
    category: 'Business',
  },
  {
    title: 'Competitive Positioning Brief',
    content: 'Create a positioning brief for [product] against [competitor 1], [competitor 2], and [competitor 3]. Output: comparison table, unique value proposition, messaging pillars, objections and responses, and recommended positioning statement.',
    tags: ['positioning', 'competition', 'messaging'],
    category: 'Business',
  },
  {
    title: 'Partnership Evaluation Memo',
    content: 'Evaluate a potential partnership with [company]. Include strategic fit, revenue upside, integration effort, legal/compliance concerns, execution dependencies, and a go/no-go recommendation with confidence level.',
    tags: ['partnership', 'memo', 'decision'],
    category: 'Business',
  },
  {
    title: 'SOP Draft Generator',
    content: 'Write a standard operating procedure for [process]. Format: purpose, scope, roles/responsibilities, prerequisites, step-by-step workflow, quality checks, escalation path, and KPI measures.',
    tags: ['sop', 'operations', 'process'],
    category: 'Business',
  },
  {
    title: 'Quarterly Business Review Outline',
    content: 'Build a QBR outline for [team or business unit]. Include goals vs actuals, win/loss highlights, operating metrics, customer feedback, key lessons, next-quarter priorities, and decisions needed from leadership.',
    tags: ['qbr', 'operations', 'leadership'],
    category: 'Business',
  },

  // Marketing
  {
    title: 'Campaign Strategy Blueprint',
    content: 'Design a campaign strategy for [offer] targeting [audience]. Include campaign objective, core angle, channel mix, creative concepts, budget split, launch timeline, success metrics, and optimization plan after week 1.',
    tags: ['campaign', 'marketing-strategy', 'growth'],
    category: 'Marketing',
  },
  {
    title: 'Product Launch GTM Plan',
    content: 'Create a go-to-market plan for launching [product/feature]. Include audience segments, value messaging by segment, channel plan, pre-launch checklist, launch-day assets, and post-launch measurement framework.',
    tags: ['gtm', 'launch', 'product-marketing'],
    category: 'Marketing',
  },
  {
    title: 'Ad Creative Brief Pack',
    content: 'Generate 10 paid ad concepts for [product], each with: hook, headline, primary text, CTA, creative direction, and the problem-awareness level it targets.',
    tags: ['ads', 'creative-brief', 'paid-media'],
    category: 'Marketing',
  },
  {
    title: 'Email Nurture Sequence',
    content: 'Write a 5-email nurture sequence for leads from [source]. Include email goal, subject line options, body copy, CTA, timing cadence, and fallback copy for non-openers.',
    tags: ['email-marketing', 'nurture', 'conversion'],
    category: 'Marketing',
  },
  {
    title: 'Conversion Funnel Audit',
    content: 'Audit this funnel: [funnel description or URL flow]. Identify drop-off points, friction causes, message mismatches, and produce prioritized fixes with expected impact and effort level.',
    tags: ['funnel', 'cro', 'audit'],
    category: 'Marketing',
  },

  // Engineering
  {
    title: 'Implementation Plan with Risks',
    content: 'Create an implementation plan for [feature]. Include architecture notes, file/module impact, migration needs, test strategy, rollout strategy, observability updates, and top risks with mitigations.',
    tags: ['implementation', 'architecture', 'delivery'],
    category: 'Engineering',
  },
  {
    title: 'Code Review Deep Pass',
    content: 'Review the following code: [paste code or diff]. Identify correctness issues, regressions, performance risks, security concerns, and maintainability problems. Provide concrete code-level fixes.',
    tags: ['code-review', 'quality', 'bugs'],
    category: 'Engineering',
  },
  {
    title: 'Bug Reproduction + Patch',
    content: 'Given this bug report: [report], produce reproducible steps, probable root causes, instrumentation to confirm cause, patch proposal, and a verification checklist for staging and production.',
    tags: ['debugging', 'incident', 'patch'],
    category: 'Engineering',
  },
  {
    title: 'API Contract Design',
    content: 'Design an API contract for [use case]. Include endpoint list, request/response schema, validation rules, auth model, error codes, idempotency strategy, and versioning approach.',
    tags: ['api', 'backend', 'design'],
    category: 'Engineering',
  },
  {
    title: 'Test Plan Generator',
    content: 'Generate a complete test plan for [feature/system]. Include unit, integration, and end-to-end coverage; edge cases; failure-path tests; data setup; and release-blocking criteria.',
    tags: ['testing', 'qa', 'release'],
    category: 'Engineering',
  },

  // Research
  {
    title: 'Research Synthesis Memo',
    content: 'Synthesize findings from these sources: [sources]. Output: key insights, evidence quality, points of disagreement, implications for [decision], and open questions requiring more data.',
    tags: ['research', 'synthesis', 'analysis'],
    category: 'Research',
  },
  {
    title: 'User Interview Script',
    content: 'Write a semi-structured interview guide for [research goal]. Include screener criteria, warm-up questions, problem-discovery prompts, concept testing prompts, and debrief coding framework.',
    tags: ['ux-research', 'interviews', 'qualitative'],
    category: 'Research',
  },
  {
    title: 'Literature Review Scaffold',
    content: 'Build a literature review structure for [topic]. Include major themes, key papers to prioritize, conflict mapping, methodological limitations, and where evidence is weak or outdated.',
    tags: ['literature-review', 'academic', 'evidence'],
    category: 'Research',
  },
  {
    title: 'Survey Design + Bias Check',
    content: 'Design a survey for [objective]. Provide question set, scale choices, sampling plan, anti-bias checks, data-cleaning rules, and a plan for interpreting results.',
    tags: ['survey', 'methodology', 'data-quality'],
    category: 'Research',
  },
  {
    title: 'Decision Brief from Research',
    content: 'Turn this research input into an executive decision brief: [input]. Include decision statement, options, evidence summary, confidence level, recommendation, and follow-up experiments.',
    tags: ['decision-support', 'brief', 'insights'],
    category: 'Research',
  },

  // Finance
  {
    title: 'Budget Variance Analysis',
    content: 'Analyze actuals vs budget for [period] using this data: [data]. Output: variance table, key drivers, controllable vs uncontrollable factors, and corrective actions for next period.',
    tags: ['budget', 'variance', 'fp-and-a'],
    category: 'Finance',
  },
  {
    title: 'Cash Flow Forecast',
    content: 'Create a rolling 13-week cash flow forecast for [business]. Include assumptions, inflow/outflow categories, sensitivity scenarios, covenant risk flags, and immediate liquidity actions.',
    tags: ['cash-flow', 'forecast', 'treasury'],
    category: 'Finance',
  },
  {
    title: 'Unit Economics Breakdown',
    content: 'Calculate and explain unit economics for [product/service]. Include CAC, LTV, gross margin, payback period, break-even volume, and levers to improve profitability.',
    tags: ['unit-economics', 'profitability', 'metrics'],
    category: 'Finance',
  },
  {
    title: 'Investment Memo Draft',
    content: 'Draft an investment memo for [company/opportunity]. Include business model, market size, traction, risk factors, valuation rationale, downside case, and recommendation.',
    tags: ['investment', 'memo', 'valuation'],
    category: 'Finance',
  },
  {
    title: 'Financial KPI Dashboard Spec',
    content: 'Define a finance KPI dashboard for [company stage]. Include metric definitions, formulas, data sources, refresh cadence, and threshold alerts for management review.',
    tags: ['kpi', 'dashboard', 'reporting'],
    category: 'Finance',
  },

  // Legal
  {
    title: 'Contract Risk Spotter',
    content: 'Review this contract text: [text]. Flag risky clauses, missing protections, ambiguous language, and negotiation priorities. Provide a redline-style summary and fallback language.',
    tags: ['contract', 'risk', 'negotiation'],
    category: 'Legal',
  },
  {
    title: 'Privacy Policy Gap Check',
    content: 'Assess this privacy policy: [policy] against [jurisdiction(s)]. Identify compliance gaps, unclear consent language, retention issues, and concrete wording updates.',
    tags: ['privacy', 'compliance', 'policy'],
    category: 'Legal',
  },
  {
    title: 'Vendor MSA Review Checklist',
    content: 'Create a review checklist for a vendor MSA in [industry]. Include IP ownership, confidentiality, security obligations, SLA, liability caps, termination rights, and data processing terms.',
    tags: ['msa', 'vendor', 'procurement'],
    category: 'Legal',
  },
  {
    title: 'Terms of Service Draft',
    content: 'Draft Terms of Service for [product type]. Include acceptable use, payment terms, suspension/termination, warranty disclaimer, limitation of liability, and dispute resolution.',
    tags: ['terms', 'tos', 'saas'],
    category: 'Legal',
  },
  {
    title: 'Regulatory Impact Summary',
    content: 'Summarize regulatory implications of [new rule/law] for [business]. Include impacted processes, compliance deadlines, implementation workstreams, and legal-risk prioritization.',
    tags: ['regulation', 'risk', 'compliance'],
    category: 'Legal',
  },

  // HR & Recruiting
  {
    title: 'Role Scorecard Builder',
    content: 'Create a hiring scorecard for [role]. Include must-have competencies, weighted evaluation criteria, sample interview questions, disqualifiers, and final decision rubric.',
    tags: ['hiring', 'scorecard', 'interview'],
    category: 'HR & Recruiting',
  },
  {
    title: 'Structured Interview Kit',
    content: 'Design a structured interview process for [role] with stages, interviewer responsibilities, calibration guidance, and anti-bias safeguards. Include scoring template.',
    tags: ['interview', 'recruiting', 'process'],
    category: 'HR & Recruiting',
  },
  {
    title: '30-60-90 Onboarding Plan',
    content: 'Build a 30-60-90 day onboarding plan for [role]. Include goals by phase, stakeholder meetings, training modules, deliverables, and manager check-in cadence.',
    tags: ['onboarding', 'new-hire', 'enablement'],
    category: 'HR & Recruiting',
  },
  {
    title: 'Performance Feedback Draft',
    content: 'Draft clear and fair performance feedback for [employee role] based on [evidence]. Include strengths, improvement areas, behavior examples, and a measurable development plan.',
    tags: ['performance', 'feedback', 'management'],
    category: 'HR & Recruiting',
  },
  {
    title: 'Compensation Benchmark Summary',
    content: 'Prepare a compensation benchmark summary for [role] in [location]. Include market range, internal equity considerations, level calibration, and offer recommendation.',
    tags: ['compensation', 'benchmark', 'offers'],
    category: 'HR & Recruiting',
  },

  // Sales
  {
    title: 'Discovery Call Framework',
    content: 'Create a discovery call framework for [ICP]. Include opening script, qualification questions, pain discovery flow, budget/timeline probes, and next-step close language.',
    tags: ['discovery', 'qualification', 'sales-call'],
    category: 'Sales',
  },
  {
    title: 'Outbound Sequence Builder',
    content: 'Write a multichannel outbound sequence (email + LinkedIn + call) for [target persona]. Provide message copy by touchpoint, timing cadence, and personalization placeholders.',
    tags: ['outbound', 'sequence', 'prospecting'],
    category: 'Sales',
  },
  {
    title: 'Objection Handling Playbook',
    content: 'Build an objection handling playbook for [product]. Include common objections, diagnostic questions, concise responses, proof points, and when to walk away.',
    tags: ['objections', 'playbook', 'closing'],
    category: 'Sales',
  },
  {
    title: 'Proposal Draft Assistant',
    content: 'Draft a client proposal for [client] based on [requirements]. Include scope, assumptions, timeline, pricing options, deliverables, acceptance criteria, and approval steps.',
    tags: ['proposal', 'b2b', 'deal-desk'],
    category: 'Sales',
  },
  {
    title: 'Pipeline Review Prep',
    content: 'Prepare a pipeline review summary from this deal list: [deals]. Include stage health, risk flags, next action by deal, forecast confidence, and manager escalation asks.',
    tags: ['pipeline', 'forecast', 'revops'],
    category: 'Sales',
  },

  // Content & Creative
  {
    title: 'Long-Form Article Draft',
    content: 'Write a 1,500-word article on [topic] for [audience]. Include strong introduction, structured sections with examples, actionable takeaways, and a conclusion CTA.',
    tags: ['article', 'writing', 'content'],
    category: 'Content & Creative',
  },
  {
    title: 'Brand Voice Rewrite',
    content: 'Rewrite this content in our brand voice: [voice description + text]. Preserve meaning, improve clarity, and provide 3 variants: concise, balanced, and bold.',
    tags: ['brand-voice', 'editing', 'copywriting'],
    category: 'Content & Creative',
  },
  {
    title: 'Video Script Package',
    content: 'Create a short-form video script package for [topic]. Include hook options, full script, on-screen text cues, shot suggestions, and CTA variations.',
    tags: ['video', 'script', 'social'],
    category: 'Content & Creative',
  },
  {
    title: 'Newsletter Edition Builder',
    content: 'Draft a newsletter edition for [audience] covering [theme]. Include subject lines, intro, 3 featured sections, links, and end-of-email CTA.',
    tags: ['newsletter', 'email', 'editorial'],
    category: 'Content & Creative',
  },
  {
    title: 'Creative Brief Generator',
    content: 'Generate a creative brief for [campaign/project]. Include objective, audience, key message, mandatory elements, visual direction, deliverables, and success criteria.',
    tags: ['creative-brief', 'design', 'campaign'],
    category: 'Content & Creative',
  },

  // Data & Analytics
  {
    title: 'Metric Definition Sheet',
    content: 'Define a clean metric dictionary for [team/product]. Include metric name, formula, business meaning, owner, source tables, update cadence, and caveats.',
    tags: ['metrics', 'governance', 'analytics'],
    category: 'Data & Analytics',
  },
  {
    title: 'SQL Analysis Request',
    content: 'Given this question [question] and schema [schema], produce SQL queries, explain logic, note assumptions, and include data-quality checks before final interpretation.',
    tags: ['sql', 'analysis', 'data-quality'],
    category: 'Data & Analytics',
  },
  {
    title: 'Experiment Readout Template',
    content: 'Create an A/B test readout for [experiment]. Include hypothesis, success metrics, sample sizing notes, results summary, confidence assessment, and ship/iterate decision.',
    tags: ['ab-test', 'experimentation', 'readout'],
    category: 'Data & Analytics',
  },
  {
    title: 'Dashboard Requirement Spec',
    content: 'Draft dashboard requirements for [stakeholders]. Include primary questions, KPI hierarchy, drill-down requirements, filters, alert conditions, and ownership model.',
    tags: ['dashboard', 'bi', 'requirements'],
    category: 'Data & Analytics',
  },
  {
    title: 'Root Cause Analysis Data Pass',
    content: 'Perform a root cause analysis plan for [metric anomaly]. Include segmentation approach, confound checks, validation steps, and a ranked list of likely drivers.',
    tags: ['root-cause', 'anomaly', 'investigation'],
    category: 'Data & Analytics',
  },

  // Productivity
  {
    title: 'Weekly Planning Sprint',
    content: 'Plan my week from this context: [tasks/meetings/goals]. Output: top priorities, calendar blocks, deep-work windows, admin batching, and must-not-slip tasks.',
    tags: ['planning', 'weekly', 'focus'],
    category: 'Productivity',
  },
  {
    title: 'Meeting Agenda + Notes Template',
    content: 'Create a reusable template for [meeting type] including agenda, decision log, action items table (owner + due date), and follow-up email draft.',
    tags: ['meetings', 'template', 'execution'],
    category: 'Productivity',
  },
  {
    title: 'Decision Journal Entry',
    content: 'Turn this decision context into a journal entry: [context]. Include decision statement, options considered, assumptions, expected outcomes, and revisit date.',
    tags: ['decision-making', 'journal', 'clarity'],
    category: 'Productivity',
  },
  {
    title: 'Inbox Zero Triage Rules',
    content: 'Design a triage workflow for [email/task inbox]. Include rule set for delete/defer/delegate/do, labels, SLA expectations, and daily maintenance routine.',
    tags: ['inbox', 'workflow', 'systems'],
    category: 'Productivity',
  },
  {
    title: 'Project Kickoff Checklist',
    content: 'Build a kickoff checklist for [project]. Include scope lock, stakeholders, timeline, dependencies, risk register, communication plan, and first-week actions.',
    tags: ['project-management', 'kickoff', 'checklist'],
    category: 'Productivity',
  },
]

type PromptExpansionSpec = {
  category: string
  role: string
  tags: string[]
  themes: string[]
}

const PROMPT_FORMATS = [
  { label: 'Strategy Brief', tag: 'strategy', output: 'executive summary, recommended direction, tradeoffs, risks, and first actions' },
  { label: 'Audit Checklist', tag: 'audit', output: 'checklist, scoring rubric, issue severity, and prioritized fixes' },
  { label: 'Operating Plan', tag: 'planning', output: 'goals, workstreams, owners, timeline, dependencies, and success metrics' },
  { label: 'Decision Memo', tag: 'decision', output: 'context, options, evaluation criteria, recommendation, and confidence level' },
  { label: 'Playbook', tag: 'playbook', output: 'repeatable steps, templates, examples, quality checks, and escalation rules' },
  { label: 'Experiment Plan', tag: 'experiment', output: 'hypothesis, method, sample, measurement plan, and decision thresholds' },
  { label: 'Stakeholder Update', tag: 'communication', output: 'summary, progress, blockers, risks, asks, and next milestones' },
  { label: 'Requirements Pack', tag: 'requirements', output: 'requirements, constraints, acceptance criteria, dependencies, and open questions' },
  { label: 'Risk Review', tag: 'risk', output: 'risk register, likelihood, impact, mitigations, owners, and monitoring plan' },
  { label: 'KPI Framework', tag: 'metrics', output: 'metric definitions, formulas, targets, data sources, and reporting cadence' },
  { label: 'Training Guide', tag: 'enablement', output: 'learning objectives, modules, exercises, examples, and assessment criteria' },
  { label: 'Launch Plan', tag: 'launch', output: 'launch phases, assets, timeline, owners, readiness checks, and rollback plan' },
]

const PROMPT_EXPANSION_SPECS: PromptExpansionSpec[] = [
  { category: 'Business', role: 'business strategy operator', tags: ['business', 'strategy'], themes: ['market entry', 'pricing reset', 'board narrative', 'operating cadence', 'partnership pipeline', 'customer segmentation', 'new business line', 'vendor consolidation', 'executive offsite', 'business continuity', 'franchise model', 'strategic moat'] },
  { category: 'Marketing', role: 'growth marketing lead', tags: ['marketing', 'growth'], themes: ['campaign calendar', 'brand positioning', 'lead magnet', 'lifecycle marketing', 'paid social testing', 'customer advocacy', 'product launch', 'retention campaign', 'webinar funnel', 'event marketing', 'referral program', 'message testing'] },
  { category: 'Content & Creative', role: 'creative content director', tags: ['content', 'creative'], themes: ['editorial calendar', 'thought leadership', 'video series', 'newsletter relaunch', 'case study library', 'brand voice', 'podcast season', 'creative concept', 'landing page copy', 'visual storytelling', 'pillar article', 'community content'] },
  { category: 'Research', role: 'research analyst', tags: ['research', 'insights'], themes: ['literature review', 'competitor scan', 'customer interview', 'survey program', 'trend analysis', 'source synthesis', 'expert panel', 'market sizing', 'policy scan', 'evidence map', 'benchmark study', 'decision research'] },
  { category: 'Engineering', role: 'senior engineering lead', tags: ['engineering', 'delivery'], themes: ['architecture review', 'incident follow-up', 'API design', 'data migration', 'release readiness', 'security hardening', 'test coverage', 'technical debt', 'observability', 'performance tuning', 'developer experience', 'integration rollout'] },
  { category: 'Finance', role: 'finance and FP&A lead', tags: ['finance', 'fp-and-a'], themes: ['cash forecast', 'budget reset', 'board reporting', 'unit economics', 'pricing sensitivity', 'fundraising model', 'department planning', 'margin improvement', 'scenario planning', 'investment case', 'runway extension', 'working capital'] },
  { category: 'Legal', role: 'legal operations reviewer', tags: ['legal', 'compliance'], themes: ['contract review', 'privacy compliance', 'vendor terms', 'employment policy', 'data processing', 'IP protection', 'regulatory update', 'risk register', 'terms update', 'procurement clause', 'incident response', 'records retention'] },
  { category: 'Sales', role: 'sales enablement leader', tags: ['sales', 'revenue'], themes: ['discovery motion', 'enterprise deal', 'objection handling', 'renewal save', 'pipeline hygiene', 'territory planning', 'demo narrative', 'proposal strategy', 'account expansion', 'sales coaching', 'competitive battlecard', 'forecast review'] },
  { category: 'HR & Recruiting', role: 'people operations partner', tags: ['hr', 'recruiting'], themes: ['role scorecard', 'interview loop', 'onboarding journey', 'manager training', 'performance cycle', 'compensation review', 'employee survey', 'retention risk', 'policy rollout', 'talent pipeline', 'career ladder', 'workforce plan'] },
  { category: 'Customer Support', role: 'customer support operations lead', tags: ['support', 'customer'], themes: ['ticket triage', 'help center', 'escalation policy', 'CSAT recovery', 'support macros', 'incident communication', 'refund workflow', 'VIP support', 'voice of customer', 'agent coaching', 'queue staffing', 'self-serve deflection'] },
  { category: 'Education', role: 'instructional designer', tags: ['education', 'learning'], themes: ['lesson plan', 'course outline', 'assessment rubric', 'student feedback', 'curriculum map', 'learning objective', 'study guide', 'teacher training', 'workshop agenda', 'microlearning module', 'peer review', 'capstone project'] },
  { category: 'Health & Wellness', role: 'health education planner', tags: ['health', 'wellness'], themes: ['habit program', 'wellness workshop', 'patient education', 'fitness routine', 'sleep improvement', 'nutrition planning', 'stress reduction', 'care coordination', 'preventive health', 'workplace wellness', 'behavior change', 'resource guide'] },
  { category: 'Real Estate', role: 'real estate strategy advisor', tags: ['real-estate', 'property'], themes: ['listing strategy', 'deal underwriting', 'rental analysis', 'neighborhood research', 'buyer consultation', 'seller prep', 'open house', 'investment memo', 'property management', 'lead nurture', 'market update', 'renovation scope'] },
  { category: 'E-commerce', role: 'e-commerce growth operator', tags: ['ecommerce', 'commerce'], themes: ['product listing', 'conversion audit', 'inventory planning', 'review mining', 'bundle strategy', 'marketplace launch', 'retention email', 'checkout recovery', 'category expansion', 'pricing test', 'supplier review', 'holiday plan'] },
  { category: 'Social Media', role: 'social media strategist', tags: ['social', 'community'], themes: ['content calendar', 'reels series', 'LinkedIn authority', 'community prompts', 'creator collaboration', 'platform audit', 'launch countdown', 'engagement recovery', 'social listening', 'short-form hooks', 'profile optimization', 'comment strategy'] },
  { category: 'SEO', role: 'SEO strategist', tags: ['seo', 'search'], themes: ['keyword cluster', 'technical audit', 'content refresh', 'internal linking', 'backlink outreach', 'local SEO', 'SERP analysis', 'programmatic SEO', 'site migration', 'schema markup', 'topic authority', 'content gap'] },
  { category: 'Data & Analytics', role: 'analytics lead', tags: ['analytics', 'data'], themes: ['metric dictionary', 'dashboard design', 'SQL analysis', 'experiment readout', 'root cause analysis', 'data quality', 'segmentation', 'forecast model', 'attribution report', 'cohort analysis', 'anomaly review', 'tracking plan'] },
  { category: 'Productivity', role: 'productivity systems coach', tags: ['productivity', 'systems'], themes: ['weekly planning', 'meeting rhythm', 'task triage', 'project kickoff', 'decision journal', 'knowledge base', 'focus routine', 'handoff process', 'goal review', 'email workflow', 'delegation plan', 'personal operating system'] },
  { category: 'Personal', role: 'personal planning coach', tags: ['personal', 'planning'], themes: ['career move', 'resume refresh', 'travel itinerary', 'budget reset', 'learning plan', 'personal brand', 'home project', 'habit tracker', 'decision clarity', 'life admin', 'shopping comparison', 'goal setting'] },
]

function toTag(value: string): string {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function generatePromptExpansion(): Omit<SavedPrompt, 'id' | 'createdAt' | 'usageCount'>[] {
  return PROMPT_EXPANSION_SPECS.flatMap(spec => spec.themes.map((theme, index) => {
    const format = PROMPT_FORMATS[index % PROMPT_FORMATS.length]
    const themeTag = toTag(theme)

    return {
      title: `${theme.replace(/\b\w/g, char => char.toUpperCase())} ${format.label}`,
      content: `Act as a ${spec.role} for [context]. Build a ${format.label.toLowerCase()} for ${theme}. Output: ${format.output}. Include assumptions, recommended next steps, likely failure modes, and the 3 questions you need answered before execution.`,
      tags: [...spec.tags, themeTag, format.tag],
      category: spec.category,
    }
  }))
}

const COMPREHENSIVE_PROMPTS: Omit<SavedPrompt, 'id' | 'createdAt' | 'usageCount'>[] = [
  ...DEFAULT_PROMPTS,
  ...generatePromptExpansion(),
]

function seedDefaultPrompts(): SavedPrompt[] {
  const now = Date.now()
  const seeded = COMPREHENSIVE_PROMPTS.map((p, i) => ({
    ...p,
    id: createId(),
    createdAt: now - i * 60000, // stagger timestamps
    usageCount: 0,
  }))
  savePrompts(seeded)
  return seeded
}

function mergeMissingDefaults(existing: SavedPrompt[]): SavedPrompt[] {
  const existingKeys = new Set(existing.map(prompt => `${prompt.category}::${prompt.title}`))
  const now = Date.now()
  const missing = COMPREHENSIVE_PROMPTS
    .filter(prompt => !existingKeys.has(`${prompt.category}::${prompt.title}`))
    .map((prompt, index) => ({
      ...prompt,
      id: createId(),
      createdAt: now - index * 60000,
      usageCount: 0,
    }))

  if (missing.length === 0) return existing
  const merged = [...missing, ...existing]
  savePrompts(merged)
  return merged
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
      Business: '#3b82f6', Marketing: '#f59e0b', 'Content & Creative': '#ec4899',
      Research: '#8b5cf6', Engineering: '#22c55e', Finance: '#14b8a6',
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
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col hover:border-[var(--border-color)] transition-all duration-200">
      {/* Colored accent bar */}
      <div className="h-1 w-full" style={{ background: catColor }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
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

        {/* Content preview — full text with scroll safety */}
        <p className="text-xs text-[var(--text-muted)] leading-relaxed flex-1 font-mono max-h-60 overflow-y-auto">
          {prompt.content}
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
              style={{ background: catColor }}
            >
              <ArrowRight size={11} />
              Use in Chat
            </button>
          </div>
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
  const { setView, setChatDraft } = useAppStore(useShallow(s => ({ setView: s.setView, setChatDraft: s.setChatDraft })))

  const [prompts, setPrompts] = useState<SavedPrompt[]>(() => {
    const loaded = loadPrompts()
    if (loaded.length === 0) return seedDefaultPrompts()
    return mergeMissingDefaults(loaded)
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
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden flex-col md:flex-row" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Left: Category filter ─── */}
      <div
        className="w-full md:w-auto flex-shrink-0 flex flex-col min-h-0 min-w-0 overflow-hidden md:basis-[clamp(12rem,18vw,16rem)] border-b md:border-b-0 border-r-0 md:border-r border-[var(--border-color)]"
        style={{ background: 'var(--bg-secondary)' }}
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
          className="flex items-center gap-3 px-6 py-4 flex-shrink-0 flex-wrap"
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
          <div className="relative flex-1 min-w-[12rem] max-w-xs">
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
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))' }}>
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
