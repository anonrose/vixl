import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HarnessEvent } from '@/types/harness/harness-event'

const persistStepBoundary = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)
const persistStepText = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)
const persistTodoUpdate = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)
const persistToolRun = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)

vi.mock('@/services/harness/orchestrator/persistence', () => ({
  persistStepBoundary: (...args: unknown[]) => persistStepBoundary(...args),
  persistStepText: (...args: unknown[]) => persistStepText(...args),
  persistTodoUpdate: (...args: unknown[]) => persistTodoUpdate(...args),
  persistToolRun: (...args: unknown[]) => persistToolRun(...args),
}))

import createStreamSteps from '@/services/harness/orchestrator/stream-steps'

describe('stream-steps live workspace persist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists with the new slug after workspace.projectSlug changes', async () => {
    const workspace = {
      projectSlug: '_home_',
      projectRoot: '/home',
      projectName: 'Home',
    }
    const onEvent = vi.fn<(event: HarnessEvent) => void>()
    const steps = createStreamSteps({
      workspace,
      chatId: 'chat-1',
      onEvent,
    })

    workspace.projectSlug = 'dest'
    workspace.projectRoot = '/tmp/dest'
    workspace.projectName = 'Dest'
    await steps.beginStep()

    expect(persistStepBoundary).toHaveBeenCalledWith(
      'dest',
      'chat-1',
      expect.any(String),
      'start',
    )
    expect(persistStepBoundary).not.toHaveBeenCalledWith(
      '_home_',
      'chat-1',
      expect.anything(),
      expect.anything(),
    )
  })
})
