import { describe, expect, it } from 'vitest'
import { CHAT_MODES, getChatModeMeta } from '@/constants/chat-modes'

describe('CHAT_MODES', () => {
  it('lists modes alphabetically by label', () => {
    const labels = CHAT_MODES.map((mode) => mode.label)
    expect(labels).toEqual([...labels].sort((left, right) => left.localeCompare(right)))
  })

  it('falls back to Agent when the mode is unknown', () => {
    expect(getChatModeMeta('agent').label).toBe('Agent')
    expect(getChatModeMeta('missing' as never).value).toBe('agent')
  })
})
