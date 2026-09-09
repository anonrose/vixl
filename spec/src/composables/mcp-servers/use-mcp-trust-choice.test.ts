import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'vue-sonner'
import { sessionTrusts } from '@/services/mcp/mcp-trust'
import type { VixlSettings } from '@/types/vixl/vixl-settings'

const { updateSetting, clearMcpToolBaseline } = vi.hoisted(() => ({
  updateSetting: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  clearMcpToolBaseline: vi.fn<(serverId: string) => Promise<void>>(async () => {}),
}))

const settings = vi.hoisted(() => ({
  personal: { version: 1 } as VixlSettings,
  project: { version: 1 } as VixlSettings,
  effective: { version: 1 } as VixlSettings,
  rootPath: '/tmp/project' as string | null,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('@/composables/use-vixl-config', () => ({
  default: () => ({
    personalSettings: {
      get value() {
        return settings.personal
      },
    },
    projectSettings: {
      get value() {
        return settings.project
      },
    },
    effectiveSettings: {
      get value() {
        return settings.effective
      },
    },
    activeRootPath: {
      get value() {
        return settings.rootPath
      },
    },
    updateSetting,
  }),
}))

vi.mock('@/services/mcp/mcp-tool-baseline', () => ({
  clearMcpToolBaseline,
}))

import useMcpTrustChoice from '@/composables/mcp-servers/use-mcp-trust-choice'

const deferred = (): {
  promise: Promise<void>
  resolve: () => void
} => {
  let resolve = (): void => {}
  const promise = new Promise<void>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('useMcpTrustChoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionTrusts.clear()
    settings.personal = { version: 1 }
    settings.project = { version: 1 }
    settings.effective = { version: 1 }
    settings.rootPath = '/tmp/project'
  })

  it('re-enables trust buttons while the start action is still pending', async () => {
    const firstStart = deferred()
    const secondStart = deferred()
    const firstAction = vi.fn<() => Promise<void>>(async () => firstStart.promise)
    const secondAction = vi.fn<() => Promise<void>>(async () => secondStart.promise)
    const choice = useMcpTrustChoice()

    choice.trustPending.value = {
      serverId: 'server-a',
      fingerprint: 'fp-a',
      action: firstAction,
    }

    const firstChoice = choice.handleTrustChoice('session')
    await vi.waitFor(() => {
      expect(choice.trustSaving.value).toBe(false)
    })
    expect(firstAction).toHaveBeenCalledTimes(1)
    expect(choice.trustPending.value).toBeNull()

    choice.trustPending.value = {
      serverId: 'server-b',
      fingerprint: 'fp-b',
      action: secondAction,
    }
    const secondChoice = choice.handleTrustChoice('session')
    await vi.waitFor(() => {
      expect(secondAction).toHaveBeenCalledTimes(1)
    })
    expect(choice.trustSaving.value).toBe(false)

    firstStart.resolve()
    secondStart.resolve()
    await firstChoice
    await secondChoice
  })

  it('does not run the action when persisting trust fails', async () => {
    clearMcpToolBaseline.mockRejectedValueOnce(new Error('baseline write failed'))
    const action = vi.fn<() => Promise<void>>(async () => {})
    const choice = useMcpTrustChoice()
    choice.trustPending.value = {
      serverId: 'server-a',
      fingerprint: 'fp-a',
      action,
    }

    await choice.handleTrustChoice('session')

    expect(action).not.toHaveBeenCalled()
    expect(choice.trustSaving.value).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('Failed to trust server', {
      description: 'baseline write failed',
    })
  })

  it('toasts a start failure separately from trust persistence', async () => {
    const action = vi.fn<() => Promise<void>>(async () => {
      throw new Error('npx spawn failed')
    })
    const choice = useMcpTrustChoice()
    choice.trustPending.value = {
      serverId: 'server-a',
      fingerprint: 'fp-a',
      action,
    }

    await choice.handleTrustChoice('session')

    expect(toast.error).toHaveBeenCalledWith('Failed to start server', {
      description: 'npx spawn failed',
    })
    expect(toast.error).not.toHaveBeenCalledWith('Failed to trust server', expect.anything())
  })
})
