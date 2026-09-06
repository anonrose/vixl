import type { MentionHighlight } from '@/types/chat/mention-highlight'
import type { ContextMention } from '@/types/harness/context-mention'
import contextMentionDisplayToken from '@/utils/context-mention-display-token'
import findSlashToken from '@/utils/find-slash-token'
import isReservedSlashName from '@/services/skills/is-reserved-slash-name'

export default (
  text: string,
  mentions: ContextMention[],
  skillNames: string[],
  agentNames: string[] = [],
): MentionHighlight[] => {
  const byToken = new Map<string, MentionHighlight>()

  for (const mention of mentions) {
    const highlight = contextMentionDisplayToken(mention)
    byToken.set(highlight.token, highlight)
  }

  const skills = [...skillNames].sort((left, right) => right.length - left.length)
  for (const name of skills) {
    const token = findSlashToken(text, name)
    if (token) {
      byToken.set(token, { kind: 'skill', token })
    }
  }

  const agents = [...agentNames].sort((left, right) => right.length - left.length)
  for (const name of agents) {
    if (isReservedSlashName(name)) {
      continue
    }
    const token = findSlashToken(text, name)
    if (!token || byToken.has(token)) {
      continue
    }
    byToken.set(token, { kind: 'agent', token })
  }

  return [...byToken.values()]
}
