import { describe, expect, it } from 'vitest'
import applyHydrateHarnessEvent, {
  type HydrateAccumulator,
} from '@/composables/chat-store/hydrate-harness'

const emptyAcc = (): HydrateAccumulator => ({
  nextMessages: [],
  nextTimeline: [],
  pendingTurn: null,
  currentStepId: null,
  pendingSubagents: [],
})

describe('hydrate-harness subagent-start', () => {
  it('ignores a persisted description and keeps agentName', () => {
    const acc = emptyAcc()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-start',
        subagentId: 'sub-1',
        toolCallId: 'call-1',
        name: 'explorer',
        description: 'Scan auth helpers',
        blocking: true,
      },
      () => {},
    )
    const item = acc.nextTimeline[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.name).toBe('explorer')
    expect('description' in item).toBe(false)
  })

  it('hydrates old records without description using agentName', () => {
    const acc = emptyAcc()
    applyHydrateHarnessEvent(
      acc,
      {
        type: 'subagent-start',
        subagentId: 'sub-legacy',
        toolCallId: 'call-legacy',
        name: 'generalPurpose',
        blocking: false,
      },
      () => {},
    )
    const item = acc.nextTimeline[0]
    expect(item?.type).toBe('subagent')
    if (item?.type !== 'subagent') {
      return
    }
    expect(item.name).toBe('generalPurpose')
    expect('description' in item).toBe(false)
  })
})
