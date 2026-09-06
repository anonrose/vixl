import type { ReasoningLevel } from '@/types/models/reasoning-level'
import type { AgentScope } from './agent-scope'

export type ResolvedAgentDefinition = {
  id: string
  name: string
  description: string
  model?: string
  reasoning?: ReasoningLevel
  tools?: string[]
  body: string
  path: string
  scope: AgentScope
}
