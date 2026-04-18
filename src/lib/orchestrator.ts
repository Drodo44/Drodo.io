import type { Message, OrchestrationPlan, OrchestrationRun, OrchestrationStep, Provider } from '../types'
import { completeText, streamCompletion } from './streamChat'
import { injectSkills } from './skillsInjector'
import { getAppSettings } from './appSettings'
import {
  ensureSkillsCatalogLoaded,
  getAllSkillCategories,
  getAllSkillDomains,
  getSkillCatalogSummary,
} from './skills'
import { getToolCatalogPrompt } from './toolExecutor'
import { ensureWorkflowCatalogLoaded, findWorkflowForTask } from './workflows'

function msg(role: Message['role'], content: string): Message {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    timestamp: new Date(),
  }
}

// Fallback model scorer used only when a step has no model field set by the LLM
function scoreModelForTask(model: string, task: string): number {
  const m = model.toLowerCase()
  const t = task.toLowerCase()
  let score = 0

  const codingTask = /(code|implement|bug|debug|refactor|typescript|javascript|python|test|build)/.test(t)
  const analysisTask = /(analy|research|review|plan|design|architecture|strategy)/.test(t)
  const speedTask = /(quick|fast|short|brief|summarize|summary)/.test(t)

  if (codingTask && /(code|coder|sonnet|gpt-4\.1|gpt-5|o1|o3|gemini-2\.5)/.test(m)) score += 6
  if (analysisTask && /(sonnet|opus|gpt-5|gpt-4|reason|gemini-2\.5)/.test(m)) score += 5
  if (speedTask && /(mini|haiku|flash|lite|small|gemini-flash)/.test(m)) score += 4

  if (/(mini|haiku|flash|lite|small)/.test(m)) score += 1
  if (/(sonnet|opus|gpt|o1|o3|reason)/.test(m)) score += 2

  return score
}

function pickBestModel(task: string, savedModels: string[], usedModels: Set<string>): string {
  const unusedModels = savedModels.filter(model => !usedModels.has(model))
  const candidates = unusedModels.length > 0 ? unusedModels : savedModels

  let best = candidates[0]
  let bestScore = Number.NEGATIVE_INFINITY
  let allZero = true
  for (const model of candidates) {
    const score = scoreModelForTask(model, task)
    if (score > 0) allZero = false
    if (score > bestScore) {
      best = model
      bestScore = score
    }
  }

  // Round-robin when scoring is uninformative — distribute models evenly across agents
  if (allZero && candidates.length > 1) {
    const rrIndex = usedModels.size % candidates.length
    best = candidates[rrIndex]
  }

  usedModels.add(best)
  return best
}

export async function buildOrchestrationPlan(
  task: string,
  provider: Provider,
  availableTemplates: string[],
  templateDetails?: Array<{ name: string; category: string; systemPrompt?: string }>,
  savedModels?: string[],
): Promise<OrchestrationPlan> {
  await Promise.all([
    ensureSkillsCatalogLoaded(),
    ensureWorkflowCatalogLoaded(),
  ])

  const model = provider.model ?? 'claude-sonnet-4-6'
  const matchedWorkflow = findWorkflowForTask(task)
  const workflowHintSection = matchedWorkflow && matchedWorkflow.confidence > 0.7
    ? `\nA pre-built n8n workflow template exists for this task: ${matchedWorkflow.workflow.name}. The agent should use this as the foundation and adapt it rather than building from scratch.\nTemplate category: ${matchedWorkflow.workflow.category}\nRequired services: ${matchedWorkflow.workflow.required_services.join(', ') || 'None listed'}`
    : ''

  const modelsSection = savedModels && savedModels.length > 0
    ? `\nAvailable models (use the exact string in the "model" field — pick the best fit per agent):\n${savedModels.join('\n')}`
    : ''

  const templatesSection = templateDetails && templateDetails.length > 0
    ? `\nAgent template details by category:\n${templateDetails.map(t => `- ${t.name} [${t.category}]`).join('\n')}`
    : ''

  const skillsSection = `\nBundled skill intelligence summary:\n${getSkillCatalogSummary()}\nRelevant skill content will be prepended automatically to each agent system prompt based on its specific task.`
  const skillCategoriesSection = `\nAvailable skill categories: ${getAllSkillCategories().join(', ')}\nAvailable capability domains: ${getAllSkillDomains().join(', ')}`
  const toolsSection = `\nAgents can use these tools while executing:\n${getToolCatalogPrompt()}`

  const extendedFields = (savedModels || templateDetails)
    ? `
Extended agent fields to include in each agent object:
- "systemPrompt": if the template has a known system prompt, copy it here; otherwise omit
- "skills": array of skill ids most relevant to this agent's role (e.g. researcher → ["web-search","memory"], coder → ["code-execution","file-reader"])
- "model": choose from the available models list using one exact model id per agent`
    : ''

  const systemPrompt = `You are an AI orchestration engine. Your job is to analyze a user task and decide which specialist AI agents are needed to complete it optimally. You must respond with ONLY valid JSON, no other text.

Available agent templates: ${availableTemplates.join(', ')}
${modelsSection}${templatesSection}${skillsSection}${skillCategoriesSection}${toolsSection}
${workflowHintSection}

Respond with this exact JSON structure:
{
  "taskSummary": "brief description of what needs to be done",
  "agents": [
    {
      "id": "step_1",
      "templateName": "exact template name from available list",
      "templateTask": "the template role description",
      "model": "${savedModels?.[0] ?? model}",
      "specificTask": "specific instruction for this agent for THIS task",
      "outputVar": "step_1_output"
    }
  ]
}
${extendedFields}

Rules:
- Use 2-5 agents maximum. Never more.
- Only use templates from the available list
- Each agent should have a focused, specific sub-task
- Order agents logically — research before writing, writing before editing
- For simple tasks that only need one agent, return just one agent
- The specificTask must be concrete and actionable
- Choose the best model for each agent from the available list independently and use the exact model id string`

  try {
    const response = await completeText(provider, [
      msg('system', systemPrompt),
      msg('user', `Task: ${task}`),
    ])

    const normalized = response
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')

    const parsed = JSON.parse(normalized) as OrchestrationPlan
    if (!Array.isArray(parsed.agents) || parsed.agents.length === 0) {
      throw new Error('Invalid plan shape')
    }
    // Clamp to 5 agents
    parsed.agents = parsed.agents.slice(0, 5)

    if (savedModels && savedModels.length > 0) {
      const used = new Set<string>()
      parsed.agents = parsed.agents.map(agent => {
        const llmModel = agent.model?.trim()
        if (llmModel && savedModels.includes(llmModel)) {
          used.add(llmModel)
          return agent
        }
        return {
          ...agent,
          model: pickBestModel(agent.specificTask, savedModels, used),
        }
      })
    }
    return parsed
  } catch {
    // Fallback: single agent using first available template
    return {
      taskSummary: task,
      agents: [
        {
          id: 'step_1',
          templateName: availableTemplates[0] ?? 'Research Analyst',
          templateTask: `specialist agent`,
          model: savedModels?.[0] ?? model,
          specificTask: task,
          outputVar: 'step_1_output',
        },
      ],
    }
  }
}

export async function runOrchestration(
  run: OrchestrationRun,
  provider: Provider,
  onStepStart: (stepId: string, agentName: string) => void,
  onStepChunk: (stepId: string, chunk: string) => void,
  onStepReviewing: (stepId: string) => void,
  onStepComplete: (stepId: string, output: string) => void,
  onComplete: (run: OrchestrationRun) => void,
  onError: (error: string) => void,
  resolveProvider?: (step: OrchestrationStep) => Provider,
): Promise<() => void> {
  let aborted = false
  let currentAbort: (() => void) | null = null

  const abort = () => {
    aborted = true
    currentAbort?.()
  }

  const execute = async () => {
    try {
      for (const step of run.plan.agents) {
        if (aborted) return

        onStepStart(step.id, step.templateName)

        const prevOutput = step.dependsOnStep
          ? getPrevOutput(run, step)
          : ''
        const context = prevOutput ? `Previous step output:\n${prevOutput}\n\n` : ''

        const systemMsg = step.systemPrompt
          ? `${step.systemPrompt}\n\nYou must complete the task autonomously. Make reasonable assumptions. Never ask the user for clarification. Deliver finished output only.`
          : `You are a ${step.templateName}. ${step.templateTask}. Focus only on your specific assigned task and produce high quality output. You must complete the task autonomously. Make reasonable assumptions. Never ask the user for clarification. Deliver finished output only.`

        const stepProvider = resolveProvider?.(step) ?? provider

        const enabledSkillsForStep = Object.fromEntries((step.skills ?? []).map(s => [s, true]))
        const baseMessages: Message[] = [
          msg('system', systemMsg),
          msg('user', `${context}Your specific task: ${step.specificTask}`),
        ]

        let messages: Message[]
        try {
          messages = await injectSkills(baseMessages, step.specificTask, enabledSkillsForStep, getAppSettings())
        } catch {
          messages = baseMessages
        }

        let accumulated = ''

        await new Promise<void>((resolve, reject) => {
          const handle = streamCompletion(
            stepProvider,
            messages,
            chunk => {
              accumulated += chunk
              run.stepOutputs[step.outputVar] = accumulated
              onStepChunk(step.id, chunk)
            },
            fullText => {
              accumulated = fullText || accumulated
              resolve()
            },
            err => reject(err),
          )
          currentAbort = handle.abort
        })

        currentAbort = null

        if (aborted) return

        // ── Self-review pass ──────────────────────────────────────────────────
        onStepReviewing(step.id)

        let finalOutput = accumulated
        try {
          const reviewMessages: Message[] = [
            msg('system', 'You are a quality reviewer. Evaluate the following agent response.'),
            msg(
              'user',
              `Task: ${step.specificTask}\n\nResponse to review:\n${accumulated}\n\nIs this response complete, accurate, and fully addressing the task? If yes, respond with exactly "APPROVED". If no, provide an improved version.`,
            ),
          ]
          const reviewResult = await completeText(stepProvider, reviewMessages)
          finalOutput = reviewResult.trim() === 'APPROVED' ? accumulated : reviewResult
        } catch {
          // review failed — use original output
        }

        run.stepOutputs[step.outputVar] = finalOutput
        onStepComplete(step.id, finalOutput)
      }

      if (!aborted) {
        onComplete(run)
      }
    } catch (err: unknown) {
      if (!aborted) {
        const message = err instanceof Error ? err.message : String(err)
        onError(message)
      }
    }
  }

  void execute()
  return abort
}

function getPrevOutput(run: OrchestrationRun, step: OrchestrationStep): string {
  const prevStep = run.plan.agents.find(s => s.id === step.dependsOnStep)
  if (!prevStep) return ''
  return run.stepOutputs[prevStep.outputVar] ?? ''
}
