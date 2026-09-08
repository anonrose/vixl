import { describe, expect, it } from 'vitest'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import { resolveCatalogMatches } from '@/services/models/search'
import serializeModelRef from '@/utils/serialize-model-ref'

const catalog: ProviderModelGroup[] = [
  {
    providerId: 'openai',
    providerName: 'OpenAI',
    models: [
      { providerId: 'openai', modelId: 'gpt-4o' },
      { providerId: 'openai', modelId: 'gpt-4o-mini' },
      { providerId: 'openai', modelId: 'o3-mini' },
      { providerId: 'openai', modelId: 'gpt-4.1' },
      { providerId: 'openai', modelId: 'gpt-4.1-mini' },
      { providerId: 'openai', modelId: 'o1' },
      { providerId: 'openai', modelId: 'o1-mini' },
      { providerId: 'openai', modelId: 'gpt-3.5-turbo' },
      { providerId: 'openai', modelId: 'text-embedding-3-small' },
    ],
  },
  {
    providerId: 'anthropic',
    providerName: 'Anthropic',
    models: [
      { providerId: 'anthropic', modelId: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
      { providerId: 'anthropic', modelId: 'claude-opus-4' },
      {
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4-disabled',
        name: 'Disabled Top Hit',
      },
    ],
  },
  {
    providerId: 'small',
    providerName: 'Small Provider',
    models: [
      { providerId: 'small', modelId: 'one' },
      { providerId: 'small', modelId: 'two' },
    ],
  },
]

const baseSettings = {
  version: 1,
} as VixlSettings

describe('resolveCatalogMatches', () => {
  it('rejects a missing query', () => {
    const result = resolveCatalogMatches(catalog, baseSettings, { query: '' })
    expect(result).toEqual({
      matches: [],
      error: 'Provide a query',
    })
  })

  it('rejects a whitespace-only query', () => {
    const result = resolveCatalogMatches(catalog, baseSettings, {
      query: '  ',
    })
    expect(result).toEqual({
      matches: [],
      error: 'Provide a query',
    })
  })

  it('caps matches at 8', () => {
    const wide: ProviderModelGroup[] = [
      {
        providerId: 'openai',
        providerName: 'OpenAI',
        models: Array.from({ length: 10 }, (_, index) => ({
          providerId: 'openai',
          modelId: `gpt-extra-${index}`,
        })),
      },
    ]
    const result = resolveCatalogMatches(wide, baseSettings, {
      query: 'gpt',
    })
    expect('matches' in result && result.matches).toBeTruthy()
    if (!('matches' in result)) {
      return
    }
    expect(result.matches.length).toBeLessThanOrEqual(8)
    expect(result.matches.length).toBe(8)
  })

  it('sets best for an exact id or name match', () => {
    const result = resolveCatalogMatches(catalog, baseSettings, {
      query: 'claude-sonnet-4',
    })
    expect('matches' in result).toBe(true)
    if ('error' in result || !('matches' in result)) {
      return
    }
    expect(result.best).toBe('anthropic::claude-sonnet-4')
    expect(result.matches[0]?.ref).toBe('anthropic::claude-sonnet-4')
  })

  it('adds a note and leaves best unset when the same modelId is on two providers', () => {
    const duplicate: ProviderModelGroup[] = [
      {
        providerId: 'openai',
        providerName: 'OpenAI',
        models: [{ providerId: 'openai', modelId: 'gpt-4o' }],
      },
      {
        providerId: 'openrouter',
        providerName: 'OpenRouter',
        models: [{ providerId: 'openrouter', modelId: 'gpt-4o' }],
      },
    ]
    const result = resolveCatalogMatches(duplicate, baseSettings, {
      query: 'gpt-4o',
    })
    expect('error' in result).toBe(false)
    if ('error' in result) {
      return
    }
    expect(result.best).toBeUndefined()
    expect(result.note).toBe(
      'Same model from multiple providers; ask the user which to use',
    )
    expect(result.matches.map((match) => match.ref)).toEqual([
      'openai::gpt-4o',
      'openrouter::gpt-4o',
    ])
  })

  it('omits allowed:false models from matches and best', () => {
    const disabledRef = serializeModelRef({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-disabled',
    })
    const settings = {
      version: 1,
      'models.subagent': disabledRef,
      'models.catalogOptions': {
        [disabledRef]: { allowed: false },
        [serializeModelRef({
          providerId: 'anthropic',
          modelId: 'claude-sonnet-4',
        })]: { allowed: false },
      },
    } as VixlSettings

    const byName = resolveCatalogMatches(catalog, settings, {
      query: 'Disabled Top Hit',
    })
    expect(byName).toEqual({ matches: [] })

    const byOpus = resolveCatalogMatches(catalog, settings, {
      query: 'claude-opus-4',
    })
    expect(byOpus).toEqual({
      matches: [
        {
          ref: 'anthropic::claude-opus-4',
          name: 'Claude Opus 4',
          providerId: 'anthropic',
          providerName: 'Anthropic',
          score: 100,
        },
      ],
      best: 'anthropic::claude-opus-4',
    })
  })
})
