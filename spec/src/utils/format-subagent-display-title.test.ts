import { describe, expect, it } from 'vitest'
import formatSubagentDisplayTitle from '@/utils/format-subagent-display-title'

describe('formatSubagentDisplayTitle', () => {
  it('prefers description over agentName', () => {
    expect(
      formatSubagentDisplayTitle({
        name: 'generalPurpose',
        description: 'Scan auth helpers',
      }),
    ).toBe('Scan auth helpers')
  })

  it('falls back to agentName when description is missing', () => {
    expect(formatSubagentDisplayTitle({ name: 'generalPurpose' })).toBe(
      'generalPurpose',
    )
  })

  it('falls back to Sub-agent when both are empty', () => {
    expect(formatSubagentDisplayTitle({ name: '  ', description: '  ' })).toBe(
      'Sub-agent',
    )
  })
})
