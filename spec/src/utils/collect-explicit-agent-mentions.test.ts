import { describe, expect, it } from 'vitest'
import collectExplicitAgentMentions from '@/utils/collect-explicit-agent-mentions'
import type { AgentIndexEntry } from '@/types/agents'

const reviewer: AgentIndexEntry = {
  id: 'reviewer',
  name: 'reviewer',
  description: 'Review helper',
  scope: 'project',
  path: '/tmp/proj/.vixl/agents/reviewer.md',
}

const reservedAgent: AgentIndexEntry = {
  id: 'agent',
  name: 'agent',
  description: 'Custom agent named agent',
  scope: 'user',
  path: '/tmp/personal/.vixl/agents/agent.md',
}

describe('collectExplicitAgentMentions', () => {
  it('adds an agent mention when raw text contains a catalog /name', () => {
    expect(collectExplicitAgentMentions('/reviewer rest', [], [reviewer])).toEqual([
      { type: 'agent', name: 'reviewer' },
    ])
  })

  it('does not duplicate an existing agent mention', () => {
    expect(
      collectExplicitAgentMentions(
        '/reviewer rest',
        [{ type: 'agent', name: 'reviewer' }],
        [reviewer],
      ),
    ).toEqual([{ type: 'agent', name: 'reviewer' }])
  })

  it('leaves unknown slash tokens as plain text', () => {
    expect(collectExplicitAgentMentions('/unknown-agent rest', [], [reviewer])).toEqual(
      [],
    )
  })

  it('keeps reserved /agent as a skill even if a catalog agent reuses that name', () => {
    expect(
      collectExplicitAgentMentions(
        '/agent rest',
        [{ type: 'skill', name: 'agent' }],
        [reservedAgent],
      ),
    ).toEqual([{ type: 'skill', name: 'agent' }])
  })

  it('coerces a reserved TipTap agent mention back to a skill', () => {
    expect(
      collectExplicitAgentMentions(
        '/agent rest',
        [{ type: 'agent', name: 'agent' }],
        [reservedAgent],
      ),
    ).toEqual([{ type: 'skill', name: 'agent' }])
  })
})
