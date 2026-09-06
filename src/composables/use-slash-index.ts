import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { vixlFileChangeToken } from '@/composables/use-vixl-live-sync'
import { listAgentIndex } from '@/services/agents/registry'
import isReservedSlashName from '@/services/skills/is-reserved-slash-name'
import { listSlashSkillIndex } from '@/services/skills/skill-registry'
import formatUnknownError from '@/utils/format-unknown-error'
import type { SlashIndexEntry } from '@/types/chat/slash-index-entry'

export default (projectRoot: () => string | null) => {
  const entries = ref<SlashIndexEntry[]>([])

  const refresh = async (): Promise<void> => {
    const root = projectRoot()
    let skills: SlashIndexEntry[] = []
    let agents: SlashIndexEntry[] = []
    try {
      skills = (await listSlashSkillIndex(root)).map((skill) => ({
        kind: 'skill' as const,
        name: skill.name,
        description: skill.description,
        scope: skill.scope,
      }))
    } catch (error) {
      toast.error('Failed to load skills', {
        description: formatUnknownError(error),
      })
    }
    try {
      agents = (await listAgentIndex(root))
        .filter(
          (agent) =>
            !isReservedSlashName(agent.name) && !isReservedSlashName(agent.id),
        )
        .map((agent) => ({
          kind: 'agent' as const,
          name: agent.name,
          description: agent.description,
          scope: agent.scope,
        }))
    } catch (error) {
      toast.error('Failed to load agents', {
        description: formatUnknownError(error),
      })
    }
    entries.value = [...skills, ...agents]
  }

  watch(
    [projectRoot, vixlFileChangeToken],
    () => {
      refresh().catch((error) => {
        toast.error('Failed to load slash commands', {
          description: formatUnknownError(error),
        })
      })
    },
    { immediate: true },
  )

  const filterEntries = (query: string): SlashIndexEntry[] => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return entries.value
    }
    return entries.value.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        entry.description.toLowerCase().includes(needle),
    )
  }

  return {
    entries,
    filterEntries,
    refresh,
  }
}
