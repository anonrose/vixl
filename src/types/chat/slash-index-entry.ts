import type { AgentScope } from '@/types/agents'
import type { SkillScope } from '@/types/skills/skill'

export type SlashIndexEntry =
  | {
      kind: 'skill'
      name: string
      description: string
      scope: SkillScope
    }
  | {
      kind: 'agent'
      name: string
      description: string
      scope: AgentScope
    }
