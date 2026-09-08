import { describe, expect, it } from 'vitest'
import applyHydrateHarnessEvent, {
  type HydrateAccumulator,
} from '@/composables/chat-store/hydrate-harness'
import formatSubagentDisplayTitle from '@/utils/format-subagent-display-title'

const emptyAcc = (): HydrateAccumulator => ({
  nextMessages: [],
  nextTimeline: [],
  pendingTurn: null,
  currentStepId: null,
  pendingSubagents: [],
})

describe('hydrate-harness subagent-start description', () => {
  it('stores description from subagent-start', () => {
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
    expect(item.description).toBe('Scan auth helpers')
    expect(formatSubagentDisplayTitle(item)).toBe('Scan auth helpers')
  })

  it('hydrates old records without description and falls back to agentName', () => {
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
    expect(item.description).toBeUndefined()
    expect(formatSubagentDisplayTitle(item)).toBe('generalPurpose')
  })
})
