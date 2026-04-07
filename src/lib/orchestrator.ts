import type { Message, OrchestrationPlan, OrchestrationRun, OrchestrationStep, Provider } from '../types'
import { completeText, streamCompletion } from './streamChat'

function msg(role: Message['role'], content: string): Message {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    timestamp: new Date(),
  }
}

export async function buildOrchestrationPlan(
  task: string,
  provider: Provider,
  availableTemplates: string[]
): Promise<OrchestrationPlan> {
  const model = provider.model ?? 'claude-sonnet-4-6'

  const systemPrompt = `You are an AI orchestration engine. Your job is to analyze a user task and decide which specialist AI agents are needed to complete it optimally. You must respond with ONLY valid JSON, no other text.

Available agent templates: ${availableTemplates.join(', ')}

Respond with this exact JSON structure:
{
  "taskSummary": "brief description of what needs to be done",
  "agents": [
    {
      "id": "step_1",
      "templateName": "exact template name from available list",
      "templateTask": "the template role description",
      "model": "${model}",
      "specificTask": "specific instruction for this agent for THIS task",
      "outputVar": "step_1_output"
    }
  ]
}

Rules:
- Use 2-5 agents maximum. Never more.
- Only use templates from the available list
- Each agent should have a focused, specific sub-task
- Order agents logically — research before writing, writing before editing
- For simple tasks that only need one agent, return just one agent
- The specificTask must be concrete and actionable`

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
          model,
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

        const messages: Message[] = [
          msg(
            'system',
            `You are a ${step.templateName}. ${step.templateTask}. Focus only on your specific assigned task and produce high quality output.`,
          ),
          msg('user', `${context}Your specific task: ${step.specificTask}`),
        ]
        const stepProvider = resolveProvider?.(step) ?? provider

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
              const output = fullText || accumulated
              run.stepOutputs[step.outputVar] = output
              onStepComplete(step.id, output)
              resolve()
            },
            err => reject(err),
          )
          currentAbort = handle.abort
        })

        currentAbort = null
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
