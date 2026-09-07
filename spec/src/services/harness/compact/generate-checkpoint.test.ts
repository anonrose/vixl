import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LanguageModel, ModelMessage, ToolSet } from 'ai'
import type { ModelRef } from '@/types/models/model-ref'
import toCachedInstructions from '@/services/models/to-cached-instructions'
import { compactBudgets } from '@/services/harness/compact'

const generateText = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<{ text: string; usage?: unknown }>>(),
)
const loadPrompt = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => string>(() => 'compact prompt'),
)

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateText(...args),
}))

vi.mock('@/services/prompts/load-prompt', () => ({
  default: (...args: unknown[]) => loadPrompt(...args),
}))

import generateCheckpoint from '@/services/harness/compact/generate-checkpoint'

const model = { id: 'chat-model' } as unknown as LanguageModel
const modelRef: ModelRef = { providerId: 'local', modelId: 'qwen' }
const tools: ToolSet = {}
const providerOptions = {
  anthropic: { cacheControl: { type: 'ephemeral' } },
}
const messages: ModelMessage[] = [
  { role: 'user', content: 'Find the auth bug.' },
  { role: 'assistant', content: 'Looking at the token refresh path.' },
]
const signal = new AbortController().signal
const system = 'You are the parent agent.'

describe('generateCheckpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadPrompt.mockReturnValue('compact prompt')
  })

  it('calls generateText with the native prefix and compact user instruction', async () => {
    generateText.mockResolvedValueOnce({
      text: '  Auth is broken at token refresh.  ',
      usage: { inputTokens: 10, outputTokens: 4 },
    })

    const result = await generateCheckpoint({
      model,
      modelRef,
      system,
      providerOptions,
      tools,
      messages,
      focus: 'parent',
      signal,
    })

    expect(result.summary).toBe('Auth is broken at token refresh.')
    expect(result.modelRef).toEqual(modelRef)
    expect(loadPrompt).toHaveBeenCalledWith('system/compact.md', {
      focus: 'parent',
    })
    expect(generateText).toHaveBeenCalledWith({
      model,
      instructions: toCachedInstructions(system, providerOptions),
      messages: [
        ...messages,
        { role: 'user', content: 'compact prompt' },
      ],
      tools,
      toolChoice: 'none',
      maxOutputTokens: compactBudgets.COMPACT_MAX_OUTPUT_TOKENS,
      providerOptions,
      abortSignal: signal,
    })
  })

  it('throws when compaction returns empty text', async () => {
    generateText.mockResolvedValueOnce({ text: '   ' })

    await expect(
      generateCheckpoint({
        model,
        modelRef,
        system,
        providerOptions,
        tools,
        messages,
        focus: 'parent',
        signal,
      }),
    ).rejects.toThrow('Compaction returned empty summary')
  })
})
