import { describe, expect, it } from 'vitest'
import splitPlanBodySegments from '@/utils/plans/split-body-segments'

describe('splitPlanBodySegments', () => {
  it('extracts a closed mermaid fence', () => {
    const text = 'Before\n\n```mermaid\nflowchart TD\n  A --> B\n```\n\nAfter'
    expect(splitPlanBodySegments(text)).toEqual([
      { type: 'markdown', content: 'Before\n\n' },
      { type: 'mermaid', content: 'flowchart TD\n  A --> B\n' },
      { type: 'markdown', content: '\n\nAfter' },
    ])
  })

  it('keeps an unclosed mermaid fence as markdown', () => {
    const text = 'Before\n\n```mermaid\nflowchart TD\n  A --> B'
    expect(splitPlanBodySegments(text)).toEqual([
      { type: 'markdown', content: text },
    ])
  })
})
