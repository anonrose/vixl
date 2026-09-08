import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResumeOrchestratorInput } from '@/types/harness/orchestrator-input'
import { mockVixlTauri } from '../../../test-utils/mocks/vixl-tauri'

const runHarnessStream = vi.hoisted(() =>
  vi.fn<(input: { captureTurnMessages: boolean; chatId: string; modelMessages: unknown[] }) => Promise<void>>(),
)

vi.mock('ai', () => ({
  convertToModelMessages: vi.fn<(messages: unknown) => Promise<unknown[]>>(
    async () => [],
  ),
}))

vi.mock('@/services/providers/create-model', () => ({
  default: vi.fn<() => Promise<unknown>>(async () => ({})),
}))

vi.mock('@/services/harness/resolve-model-vision', () => ({
  default: vi.fn<() => Promise<boolean>>(async () => false),
}))

vi.mock('@/services/context/filter-messages-for-active-context', () => ({
  default: (messages: unknown[]) => ({ messages, checkpointText: undefined }),
}))

vi.mock('@/utils/drop-trailing-assistant-messages', () => ({
  default: (messages: unknown[]) => messages,
}))

vi.mock('@/utils/prepare-messages-for-model-vision', () => ({
  default: async (messages: unknown[]) => messages,
}))

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    readChatMeta: vi.fn<() => Promise<null>>().mockResolvedValue(null),
  }),
)

vi.mock('@/services/harness/orchestrator/persistence', () => ({
  persistToolRun: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('@/services/harness/orchestrator/stream', () => ({
  default: (
    input: {
      captureTurnMessages: boolean
      chatId: string
      modelMessages: unknown[]
    },
  ) => runHarnessStream(input),
}))

import resumeOrchestrator from '@/services/harness/orchestrator/resume'
import {
  hasPendingBackgroundResume,
  listDeliverableBackgroundResults,
  register,
  resetSubagentRegistryForTests,
  resolve,
  setTurnResponseMessages,
} from '@/services/harness/subagent/registry'

const wave1Messages = [{ role: 'assistant' as const, content: 'wave-1' }]
const wave2Messages = [{ role: 'assistant' as const, content: 'wave-2' }]

const buildInput = (
  completedResults: ResumeOrchestratorInput['completedResults'],
): ResumeOrchestratorInput =>
  ({
    workspace: {
      projectSlug: 'proj',
      projectRoot: '/tmp/proj',
      projectName: 'proj',
    },
    projectSlug: 'proj',
    chatId: 'chat-1',
    projectRoot: '/tmp/proj',
    projectName: 'proj',
    mode: 'agent',
    modelId: 'gpt-4o',
    providerId: 'openai',
    settings: { version: 1 },
    messages: [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'orchestrate this' }],
      },
    ],
    mentions: [],
    signal: new AbortController().signal,
    onEvent: vi.fn<() => void>(),
    completedResults,
    skipUserPersist: true,
    sessionAllows: new Set<string>(),
    sessionDenies: new Set<string>(),
  }) as ResumeOrchestratorInput

describe('resumeOrchestrator background waves', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    resetSubagentRegistryForTests()
    runHarnessStream.mockResolvedValue(undefined)
  })

  it('recaptures turn messages when a resume turn spawns a second wave', async () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
    })
    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'mapped the repo',
    })
    setTurnResponseMessages('chat-1', wave1Messages)

    runHarnessStream.mockImplementation(async (input) => {
      register('chat-1', 'sub-2', new AbortController(), {
        toolCallId: 'tc-2',
        agentName: 'writer',
      })
      if (input.captureTurnMessages && hasPendingBackgroundResume(input.chatId)) {
        setTurnResponseMessages(input.chatId, wave2Messages)
      }
    })

    const firstResults = listDeliverableBackgroundResults('chat-1')
    await resumeOrchestrator(buildInput(firstResults))

    expect(runHarnessStream).toHaveBeenCalledWith(
      expect.objectContaining({ captureTurnMessages: true }),
    )

    resolve('sub-2', {
      subagentId: 'sub-2',
      name: 'writer',
      summary: 'drafted the patch',
    })
    const secondResults = listDeliverableBackgroundResults('chat-1')
    expect(secondResults).toEqual([
      {
        toolCallId: 'tc-2',
        result: {
          subagentId: 'sub-2',
          name: 'writer',
          summary: 'drafted the patch',
        },
      },
    ])

    runHarnessStream.mockResolvedValue(undefined)
    await expect(resumeOrchestrator(buildInput(secondResults))).resolves.toBeUndefined()
    expect(runHarnessStream).toHaveBeenCalledTimes(2)
  })

  it('includes each finished subagent name and summary in the wake nudge', async () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
    })
    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'mapped the repo',
    })
    setTurnResponseMessages('chat-1', wave1Messages)

    await resumeOrchestrator(
      buildInput(listDeliverableBackgroundResults('chat-1')),
    )

    const streamInput = runHarnessStream.mock.calls[0]?.[0]
    const modelMessages = streamInput?.modelMessages as Array<{
      role: string
      content: string
    }>
    const wakeNudge = modelMessages[modelMessages.length - 1]
    expect(wakeNudge).toBeDefined()
    if (!wakeNudge) {
      throw new Error('Expected a wake nudge message')
    }
    expect(wakeNudge.role).toBe('user')
    expect(wakeNudge.content).toContain('explorer: mapped the repo')
    expect(wakeNudge.content).toContain('Completed:')
  })

  it('does not deliver the same background results twice', async () => {
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
    })
    register('chat-1', 'sub-2', new AbortController(), {
      toolCallId: 'tc-2',
      agentName: 'writer',
    })
    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'mapped the repo',
    })
    setTurnResponseMessages('chat-1', wave1Messages)

    const firstResults = listDeliverableBackgroundResults('chat-1')
    expect(firstResults).toHaveLength(1)

    await resumeOrchestrator(buildInput(firstResults))

    expect(listDeliverableBackgroundResults('chat-1')).toEqual([])
    expect(listDeliverableBackgroundResults('chat-1')).toEqual([])

    resolve('sub-2', {
      subagentId: 'sub-2',
      name: 'writer',
      summary: 'still running during first resume',
    })
    expect(listDeliverableBackgroundResults('chat-1')).toEqual([
      {
        toolCallId: 'tc-2',
        result: {
          subagentId: 'sub-2',
          name: 'writer',
          summary: 'still running during first resume',
        },
      },
    ])
  })
})
