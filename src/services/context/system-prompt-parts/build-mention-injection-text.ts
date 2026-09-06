import type { ContextMention } from '@/types/harness/context-mention'
import { formatMentionsAsText } from './format-mentions'
import formatExplicitAgentInvocation from './format-explicit-agent-invocation'

export default (mentions: ContextMention[]): string => {
  const invocation = formatExplicitAgentInvocation(mentions)
  const contextBody = formatMentionsAsText(mentions)
  return [invocation, contextBody ? `Context:\n${contextBody}` : '']
    .filter(Boolean)
    .join('\n\n')
}
