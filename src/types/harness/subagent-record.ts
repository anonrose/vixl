export type SubagentStatus = 'running' | 'completed' | 'failed' | 'aborted'

export type SubagentResult = {
  subagentId: string
  name: string
  summary: string
  description?: string
}

export type SubagentRecord = {
  subagentId: string
  chatId: string
  toolCallId: string
  agentName: string
  status: SubagentStatus
  result?: SubagentResult
  startedAt: string
}
