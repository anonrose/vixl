import isReservedSlashName from '@/services/skills/is-reserved-slash-name'
import type { AgentIndexEntry } from '@/types/agents'
import type { ContextMention } from '@/types/harness/context-mention'
import findSlashToken from '@/utils/find-slash-token'

export default (
  text: string,
  mentions: ContextMention[],
  agents: AgentIndexEntry[],
): ContextMention[] => {
  const next: ContextMention[] = mentions.map((mention) => {
    if (mention.type === 'agent' && isReservedSlashName(mention.name)) {
      return { type: 'skill', name: mention.name }
    }
    return mention
  })
  const existing = new Set(
    next
      .filter((mention) => mention.type === 'agent')
      .map((mention) => mention.name.trim().toLowerCase()),
  )
  const catalogNames = [
    ...new Set(
      agents.flatMap((agent) => [agent.id, agent.name].map((value) => value.trim())),
    ),
  ]
    .filter((name) => name && !isReservedSlashName(name))
    .sort((left, right) => right.length - left.length)

  for (const name of catalogNames) {
    const key = name.toLowerCase()
    if (existing.has(key)) {
      continue
    }
    if (!findSlashToken(text, name)) {
      continue
    }
    next.push({ type: 'agent', name })
    existing.add(key)
  }

  return next
}
