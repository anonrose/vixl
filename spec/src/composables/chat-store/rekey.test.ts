import { beforeEach, describe, expect, it } from 'vitest'
import {
  activeKey,
  getOrCreateSession,
  makeSessionKey,
  resetChatSessionsForTests,
  sessions,
} from '@/composables/chat-store/helpers'
import rekeyChatSession from '@/composables/chat-store/rekey'
import type { ChatMeta } from '@/types/chat/chat-meta'

const metaFor = (id: string, projectSlug: string, projectRoot: string): ChatMeta => ({
  id,
  title: 'Keep this title',
  projectSlug,
  projectRoot,
  mode: 'agent',
  model: 'test/model',
  status: 'running',
  attention: null,
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
  forkedFrom: null,
  pinned: false,
  pinnedAt: null,
})

describe('rekeyChatSession', () => {
  beforeEach(() => {
    resetChatSessionsForTests()
  })

  it('moves the same session object to the new key and patches meta', () => {
    const session = getOrCreateSession('_home_', 'chat-1')
    session.meta.value = metaFor('chat-1', '_home_', '/home')
    session.messages.value = [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
    ]
    session.timeline.value = [
      {
        type: 'user',
        message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      },
    ]
    activeKey.value = session.key

    const moved = rekeyChatSession('_home_', 'chat-1', {
      projectSlug: 'dest',
      projectRoot: '/tmp/dest',
    })

    expect(moved).toBe(session)
    expect(sessions.get(makeSessionKey('_home_', 'chat-1'))).toBeUndefined()
    expect(sessions.get(makeSessionKey('dest', 'chat-1'))).toBe(session)
    expect(session.key).toBe('dest::chat-1')
    expect(session.projectSlug).toBe('dest')
    expect(activeKey.value).toBe('dest::chat-1')
    expect(session.meta.value?.projectSlug).toBe('dest')
    expect(session.meta.value?.projectRoot).toBe('/tmp/dest')
    expect(session.meta.value?.title).toBe('Keep this title')
    expect(session.messages.value).toHaveLength(1)
    expect(session.timeline.value).toHaveLength(1)
  })
})
