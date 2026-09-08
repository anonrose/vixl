import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import type { AgentHarnessState, AttentionHelpers } from '@/composables/agent-harness/types'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'

const clearPendingBackgroundResume = vi.hoisted(() =>
  vi.fn<(chatId: string) => void>(),
)
const clearTurnResponseMessages = vi.hoisted(() =>
  vi.fn<(chatId: string) => void>(),
)
const listDeliverableBackgroundResults = vi.hoisted(() =>
  vi.fn<() => Array<{ toolCallId: string; result: { subagentId: string; name: string; summary: string } }>>(
    () => [],
  ),
)
const resumeOrchestrator = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)
const shouldFlushBackgroundSubagentResume = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => 'resume' | 'clear' | 'noop'>(),
)
const updateChatMeta = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined),
)
const toastError = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    updateChatMeta: (...args: unknown[]) => updateChatMeta(...args),
  }),
)

vi.mock('@/services/harness/subagent/registry', () => ({
  clearPendingBackgroundResume: (chatId: string) =>
    clearPendingBackgroundResume(chatId),
  clearTurnResponseMessages: (chatId: string) =>
    clearTurnResponseMessages(chatId),
  hasPendingBackgroundResume: () => true,
  hasRunningSubagentsForChat: () => false,
  listDeliverableBackgroundResults: () => listDeliverableBackgroundResults(),
}))

vi.mock('@/utils/should-flush-background-subagent-resume', () => ({
  default: (...args: unknown[]) => shouldFlushBackgroundSubagentResume(...args),
}))

vi.mock('@/services/harness/orchestrator', () => ({
  resumeOrchestrator: (...args: unknown[]) => resumeOrchestrator(...args),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}))

import createTurnLoop from '@/composables/agent-harness/turn-loop'

const buildState = (): AgentHarnessState =>
  ({
    options: {
      projectSlug: 'proj',
      chatId: 'chat-1',
      projectRoot: '/tmp/proj',
      projectName: 'proj',
      standalone: false,
    },
    session: {
      patchMeta: vi.fn<(patch: unknown) => void>(),
      startAgentTurn: vi.fn<(turnId: string) => void>(),
      finishAgentTurn: vi.fn<() => void>(),
      messages: ref([]),
      timeline: ref([]),
    },
    status: ref('ready'),
    error: ref(null),
    abortController: ref(null),
    lastRunConfig: ref(null),
    resumingBackgroundBatch: ref(false),
    sessionPermissionLevel: ref(null),
    sessionAllows: new Set<string>(),
    sessionDenies: new Set<string>(),
    fleetSidebar: {
      refreshSlug: vi.fn<(slug: string) => Promise<void>>(),
    },
    messageQueue: {
      take: vi.fn<() => undefined>(),
    },
    toolRuns: shallowRef([]),
    subagents: shallowRef([]),
    config: {
      hydrated: computed(() => true),
    },
  }) as unknown as AgentHarnessState

const buildAttention = (): AttentionHelpers =>
  ({
    isFullyIdle: () => true,
    refreshSidebar: vi.fn<() => void>(),
    applyTurnEndAttention: vi.fn<() => void>(),
  }) as unknown as AttentionHelpers

describe('maybeFlushBackgroundSubagentResume', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateChatMeta.mockResolvedValue(undefined)
    shouldFlushBackgroundSubagentResume.mockReturnValue('noop')
  })

  it('clears pending resume state when flush is clear', () => {
    shouldFlushBackgroundSubagentResume.mockReturnValue('clear')
    const { maybeFlushBackgroundSubagentResume } = createTurnLoop(
      buildState(),
      buildAttention(),
      {
        handleEvent: vi.fn<() => void>(),
        persistPermission: vi
          .fn<() => Promise<void>>()
          .mockResolvedValue(undefined),
      },
    )

    maybeFlushBackgroundSubagentResume()

    expect(clearPendingBackgroundResume).toHaveBeenCalledWith('chat-1')
    expect(clearTurnResponseMessages).toHaveBeenCalledWith('chat-1')
    expect(updateChatMeta).toHaveBeenCalledWith('proj', 'chat-1', { status: 'idle' })
  })

  it('does not clear pending resume when flush is a noop', () => {
    const { maybeFlushBackgroundSubagentResume } = createTurnLoop(
      buildState(),
      buildAttention(),
      {
        handleEvent: vi.fn<() => void>(),
        persistPermission: vi
          .fn<() => Promise<void>>()
          .mockResolvedValue(undefined),
      },
    )

    maybeFlushBackgroundSubagentResume()

    expect(clearPendingBackgroundResume).not.toHaveBeenCalled()
    expect(updateChatMeta).not.toHaveBeenCalled()
  })
})

describe('resumeAfterBackgroundSubagents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resumeOrchestrator.mockResolvedValue(undefined)
    listDeliverableBackgroundResults.mockReturnValue([
      {
        toolCallId: 'tc-1',
        result: { subagentId: 'sub-1', name: 'explorer', summary: 'done' },
      },
    ])
  })

  it('clears pending resume state when resume throws', async () => {
    resumeOrchestrator.mockRejectedValue(
      new Error('No pending subagent turn to resume'),
    )
    const state = buildState()
    state.lastRunConfig.value = {
      mode: 'agent',
      model: 'openai::gpt-4o',
      mentions: [],
      effectiveSettings: { version: 1 },
    }
    const { resumeAfterBackgroundSubagents } = createTurnLoop(
      state,
      buildAttention(),
      {
        handleEvent: vi.fn<() => void>(),
        persistPermission: vi
          .fn<() => Promise<void>>()
          .mockResolvedValue(undefined),
      },
    )

    await resumeAfterBackgroundSubagents()

    expect(clearPendingBackgroundResume).toHaveBeenCalledWith('chat-1')
    expect(clearTurnResponseMessages).toHaveBeenCalledWith('chat-1')
    expect(toastError).toHaveBeenCalledWith('Agent resume failed', {
      description: 'No pending subagent turn to resume',
    })
    expect(state.status.value).toBe('error')
    expect(state.resumingBackgroundBatch.value).toBe(false)
  })
})

