import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCachedAgentHarness,
  rekeyAgentHarness,
  resetAgentHarnessCacheForTests,
  setCachedAgentHarness,
} from '@/composables/agent-harness/cache'

describe('rekeyAgentHarness', () => {
  beforeEach(() => {
    resetAgentHarnessCacheForTests()
  })

  it('moves the same harness instance and drops the old key', () => {
    const instance = {
      dispose: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    }
    setCachedAgentHarness('_home_', 'chat-1', instance)

    rekeyAgentHarness('_home_', 'chat-1', 'dest')

    expect(getCachedAgentHarness('_home_', 'chat-1')).toBeUndefined()
    expect(getCachedAgentHarness('dest', 'chat-1')).toBe(instance)
  })
})
