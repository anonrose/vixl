import { chatMetaSchema } from '@/schemas/chat-meta'
import { activeKey, makeSessionKey, sessions } from './helpers'
import type { ChatSession } from './types'

type RekeyChatSessionTo = {
  projectSlug: string
  projectRoot: string
}

const rekeyChatSession = (
  fromProjectSlug: string,
  chatId: string,
  to: RekeyChatSessionTo,
): ChatSession | null => {
  const fromKey = makeSessionKey(fromProjectSlug, chatId)
  const toKey = makeSessionKey(to.projectSlug, chatId)
  const session = sessions.get(fromKey)
  if (!session) {
    return null
  }

  if (fromKey !== toKey) {
    sessions.delete(fromKey)
    const occupying = sessions.get(toKey)
    if (occupying && occupying !== session) {
      sessions.delete(toKey)
    }
    session.key = toKey
    session.projectSlug = to.projectSlug
    sessions.set(toKey, session)
    if (activeKey.value === fromKey) {
      activeKey.value = toKey
    }
  } else {
    session.projectSlug = to.projectSlug
  }

  if (session.meta.value) {
    session.meta.value = chatMetaSchema.parse({
      ...session.meta.value,
      projectSlug: to.projectSlug,
      projectRoot: to.projectRoot,
    })
  }

  return session
}

export default rekeyChatSession
