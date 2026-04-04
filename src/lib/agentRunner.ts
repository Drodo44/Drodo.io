import type { Message, Provider, ToolCall, ToolExecutionResult } from '../types'
import { completeText, streamCompletion, type StreamHandle } from './streamChat'
import { executeToolCall, getToolCatalogPrompt, parseToolDecision } from './toolExecutor'

const DEFAULT_MAX_TOOL_ROUNDS = 6

const TOOL_PLANNER_PROMPT = [
  'You are Drodo, a desktop AI agent that can inspect the local filesystem and run shell commands.',
  getToolCatalogPrompt(),
  'Think in actions, not explanations. Use the smallest useful tool call, then continue until you have enough information.',
].join('\n\n')

const FINAL_RESPONSE_PROMPT = [
  'Write the final response to the user.',
  'Do not output JSON.',
  'Summarize the concrete actions you took, the outcome, and any important next step.',
  'Keep the tone direct and concise.',
].join('\n')

export interface AgentRunnerOptions {
  provider: Provider
  conversation: Message[]
  maxToolRounds?: number
  onPlanning?: (round: number) => void
  onToolStart?: (call: ToolCall, round: number) => void
  onToolResult?: (result: ToolExecutionResult, round: number) => void
  onFinalStart?: (usedTools: boolean) => void
  onFinalChunk?: (chunk: string) => void
  onFinal?: (message: string) => void
  onError?: (error: Error) => void
}

export interface AgentRunHandle {
  abort: () => void
}

function isFinalDecision(
  decision: ToolCall | { type: 'final'; message: string }
): decision is { type: 'final'; message: string } {
  return 'type' in decision && decision.type === 'final'
}

function makeSyntheticMessage(role: Message['role'], content: string): Message {
  return {
    id: `synthetic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date(),
  }
}

async function streamTextLocally(
  text: string,
  signal: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<void> {
  const chunks = text.match(/.{1,8}/gs) ?? [text]

  for (const chunk of chunks) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    onChunk?.(chunk)
    await new Promise(resolve => setTimeout(resolve, 18))
  }
}

export function runAgentSession(options: AgentRunnerOptions): AgentRunHandle {
  const abortController = new AbortController()
  let streamHandle: StreamHandle | null = null

  const abort = () => {
    abortController.abort()
    streamHandle?.abort()
  }

  const run = async () => {
    const toolTranscript: Message[] = []
    const maxToolRounds = options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS
    let usedTools = false
    let plannerFinal = ''

    for (let round = 1; round <= maxToolRounds; round += 1) {
      if (abortController.signal.aborted) return

      options.onPlanning?.(round)

      const plannerMessages = [
        makeSyntheticMessage('system', TOOL_PLANNER_PROMPT),
        ...options.conversation,
        ...toolTranscript,
      ]

      const plannerResponse = await completeText(options.provider, plannerMessages, abortController.signal)
      const decision = parseToolDecision(plannerResponse)

      if (isFinalDecision(decision)) {
        plannerFinal = decision.message.trim()
        break
      }

      usedTools = true
      options.onToolStart?.(decision, round)

      const result = await executeToolCall(decision)
      options.onToolResult?.(result, round)

      toolTranscript.push(
        makeSyntheticMessage(
          'assistant',
          `Tool request: ${decision.tool}\n${JSON.stringify(decision.arguments)}`
        ),
        makeSyntheticMessage(
          'system',
          `Tool result for ${result.tool}:\n${result.contentForModel}`
        )
      )
    }

    if (abortController.signal.aborted) return

    options.onFinalStart?.(usedTools)

    if (!usedTools) {
      const finalMessage = plannerFinal || 'I do not have a result yet.'
      await streamTextLocally(finalMessage, abortController.signal, options.onFinalChunk)
      options.onFinal?.(finalMessage)
      return
    }

    const synthesisMessages = [
      makeSyntheticMessage('system', FINAL_RESPONSE_PROMPT),
      ...options.conversation,
      ...toolTranscript,
    ]

    await new Promise<void>((resolve, reject) => {
      streamHandle = streamCompletion(
        options.provider,
        synthesisMessages,
        chunk => {
          options.onFinalChunk?.(chunk)
        },
        message => {
          options.onFinal?.(message)
          resolve()
        },
        error => {
          reject(error)
        }
      )
    })
  }

  void run().catch((error: unknown) => {
    if ((error as { name?: string })?.name === 'AbortError') return
    options.onError?.(error instanceof Error ? error : new Error(String(error)))
  })

  return { abort }
}
