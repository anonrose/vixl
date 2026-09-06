import type { AgentScope } from './agent-scope'

export type AgentIndexEntry = {
  id: string
  name: string
  description: string
  scope: AgentScope
  path: string
}
