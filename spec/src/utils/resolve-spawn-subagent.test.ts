import { describe, expect, it } from 'vitest'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { ToolRun } from '@/types/harness/tool-run'
import resolveSpawnSubagent from '@/utils/resolve-spawn-subagent'

const emptyMaps = (): {
  byToolCallId: Map<string, SubagentTimelineItem>
  bySubagentId: Map<string, SubagentTimelineItem>
} => ({
  byToolCallId: new Map(),
  bySubagentId: new Map(),
})

describe('resolveSpawnSubagent', () => {
  it('uses agentName and ignores a persisted description arg', () => {
    const run: ToolRun = {
      toolCallId: 'call-1',
      name: 'spawn_subagent',
      status: 'running',
      args: {
        agentName: 'generalPurpose',
        description: 'Scan auth helpers',
        prompt: 'Look around',
      },
    }
    const item = resolveSpawnSubagent(run, emptyMaps().byToolCallId, emptyMaps().bySubagentId)
    expect(item.name).toBe('generalPurpose')
    expect('description' in item).toBe(false)
  })

  it('uses agentName from the result when description is absent', () => {
    const run: ToolRun = {
      toolCallId: 'call-2',
      name: 'spawn_subagent',
      status: 'done',
      args: { agentName: 'generalPurpose', prompt: 'Look around' },
      result: { subagentId: 'sub-1', name: 'generalPurpose', summary: 'done' },
    }
    const item = resolveSpawnSubagent(run, emptyMaps().byToolCallId, emptyMaps().bySubagentId)
    expect(item.name).toBe('generalPurpose')
    expect('description' in item).toBe(false)
  })
})
