import { describe, expect, it } from 'vitest'
import {
  buildPrefixSnapshot,
  frozenPrefixMatchesMode,
  getFrozenPrefix,
  partsFromFrozenPrefix,
} from '@/services/harness/prefix-contract'
import type { PrefixSnapshot } from '@/types/harness/prefix-snapshot'

const snapshot = (overrides: Partial<PrefixSnapshot> = {}): PrefixSnapshot => ({
  systemString: 'prefix',
  toolSchemasJson: 'tools',
  mcpCatalogSnapshot: 'mcp',
  rulesBodies: 'rules',
  hash: 'abc',
  frozenAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('prefix-contract mode freeze', () => {
  it('stores mode on buildPrefixSnapshot', () => {
    const built = buildPrefixSnapshot({
      systemString: 'sys',
      toolSchemasJson: 'tools',
      mcpCatalogSnapshot: 'mcp',
      rulesBodies: 'rules',
      mode: 'ask',
    })

    expect(built.mode).toBe('ask')
    expect(built.systemString).toBe('sys')
    expect(built.hash).toHaveLength(8)
  })

  it('round-trips mode through getFrozenPrefix', () => {
    const frozen = getFrozenPrefix({
      prefixSnapshot: snapshot({ mode: 'plan' }),
    })

    expect(frozen?.mode).toBe('plan')
  })

  it('omits invalid stored mode from getFrozenPrefix', () => {
    const frozen = getFrozenPrefix({
      prefixSnapshot: { ...snapshot(), mode: 'not-a-mode' } as unknown,
    })

    expect(frozen?.mode).toBeUndefined()
  })

  it('reuses freeze when stored mode matches', () => {
    expect(frozenPrefixMatchesMode(snapshot({ mode: 'agent' }), 'agent')).toBe(true)
  })

  it('rebuilds when stored mode differs', () => {
    expect(frozenPrefixMatchesMode(snapshot({ mode: 'agent' }), 'ask')).toBe(false)
  })

  it('rebuilds when stored mode is missing', () => {
    expect(
      frozenPrefixMatchesMode(snapshot({ mode: undefined, systemString: 'prefix' }), 'agent'),
    ).toBe(false)
  })
})

describe('prefix-contract agentsMd', () => {
  it('treats missing agentsMd as empty', () => {
    const parts = partsFromFrozenPrefix(
      snapshot({
        parts: {
          base: 'base',
          tools: 'tools',
          mcp: '',
          rules: '',
          subagents: '',
          mentions: '',
          skills: '',
        } as never,
      }),
    )
    expect(parts.agentsMd).toBe('')
  })

  it('returns empty agentsMd when reconstructing without snap.parts', () => {
    const parts = partsFromFrozenPrefix(snapshot())
    expect(parts.agentsMd).toBe('')
    expect(parts.base).toBe(snapshot().systemString)
  })
})
