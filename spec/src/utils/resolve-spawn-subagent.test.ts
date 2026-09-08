import { describe, expect, it } from 'vitest'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { ToolRun } from '@/types/harness/tool-run'
import formatSubagentDisplayTitle from '@/utils/format-subagent-display-title'
import resolveSpawnSubagent from '@/utils/resolve-spawn-subagent'

const emptyMaps = (): {
  byToolCallId: Map<string, SubagentTimelineItem>
  bySubagentId: Map<string, SubagentTimelineItem>
} => ({
  byToolCallId: new Map(),
  bySubagentId: new Map(),
})

describe('resolveSpawnSubagent description', () => {
  it('prefers description from args for the card title', () => {
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
    expect(item.description).toBe('Scan auth helpers')
    expect(formatSubagentDisplayTitle(item)).toBe('Scan auth helpers')
  })

  it('falls back to agentName when description is absent', () => {
    const run: ToolRun = {
      toolCallId: 'call-2',
      name: 'spawn_subagent',
      status: 'done',
      args: { agentName: 'generalPurpose', prompt: 'Look around' },
      result: { subagentId: 'sub-1', name: 'generalPurpose', summary: 'done' },
    }
    const item = resolveSpawnSubagent(run, emptyMaps().byToolCallId, emptyMaps().bySubagentId)
    expect(item.description).toBeUndefined()
    expect(formatSubagentDisplayTitle(item)).toBe('generalPurpose')
  })
})
