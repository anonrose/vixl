import { toast } from 'vue-sonner'
import { resolveAgentDefinition } from '@/services/agents/registry'
import type { ContextMention } from '@/types/harness/context-mention'

export default async (
  mentions: ContextMention[],
  projectRoot: string | null,
): Promise<ContextMention[]> => {
  const kept: ContextMention[] = []
  for (const mention of mentions) {
    if (mention.type !== 'agent') {
      kept.push(mention)
      continue
    }
    const definition = await resolveAgentDefinition(projectRoot, mention.name)
    if (!definition) {
      toast.error('Agent not found', {
        description: `"${mention.name}" is not in the agent catalog and will not be invoked.`,
      })
      continue
    }
    kept.push(mention)
  }
  return kept
}
