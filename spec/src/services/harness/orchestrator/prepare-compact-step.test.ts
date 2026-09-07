import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LanguageModel, ModelMessage, ToolSet } from 'ai'
import type { ModelRef } from '@/types/models/model-ref'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import type { HarnessEvent } from '@/types/harness/harness-event'

const generateCheckpoint = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(),
)
const rewriteModelMessages = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => ModelMessage[]>(),
)
const persistCompactionCheckpoint = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(),
)
const captureBillableUsage = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>(),
)

vi.mock('@/services/harness/compact/generate-checkpoint', () => ({
  default: (...args: unknown[]) => generateCheckpoint(...args),
}))

vi.mock('@/services/harness/compact/rewrite-model-messages', () => ({
  default: (...args: unknown[]) => rewriteModelMessages(...args),
}))

vi.mock('@/services/harness/compact/persist-checkpoint', () => ({
  default: (...args: unknown[]) => persistCompactionCheckpoint(...args),
}))

vi.mock('@/services/billing/capture-billable-usage', () => ({
  default: (...args: unknown[]) => captureBillableUsage(...args),
}))

import prepareParentCompactStep from '@/services/harness/orchestrator/prepare-compact-step'

const parentModelRef: ModelRef = {
  providerId: 'local',
  modelId: 'qwen',
}

const stubModel = { id: 'chat-model' } as unknown as LanguageModel
const stubTools: ToolSet = {}
const stubProviderOptions = {
  anthropic: { cacheControl: { type: 'ephemeral' } },
}

const settings = {
  version: 1,
  'models.default': 'local::qwen',
  'providers.custom.local': {
    type: 'openai-compatible',
    name: 'Local',
    baseURL: 'http://127.0.0.1:11434/v1',
    models: [{ id: 'qwen', contextWindow: 262144 }],
  },
} as VixlSettings

const hugeContent = 'x'.repeat(800_000)

const compactedResult = {
  summary: 'Parent recap of the debugging so far.',
  usage: { inputTokens: 12, outputTokens: 5 },
  providerMetadata: { test: true },
  responseId: 'resp-compact-parent',
  modelRef: { providerId: 'openai', modelId: 'gpt-4o' },
}

const baseInput = () => {
  const onEvent = vi.fn<(event: HarnessEvent) => void>()
  return {
    onEvent,
    input: {
      settings,
      model: stubModel,
      modelRef: parentModelRef,
      system: 'You are the parent agent.',
      providerOptions: stubProviderOptions,
      tools: stubTools,
      signal: new AbortController().signal,
      workspace: { projectSlug: 'demo', projectRoot: '/tmp/demo', projectName: 'demo' },
      chatId: 'chat-1',
      turnId: 'turn-1',
      messages: [],
      onEvent,
    },
  }
}

describe('prepareParentCompactStep', () => {
  beforeEach(() => {
    generateCheckpoint.mockReset()
    rewriteModelMessages.mockReset()
    persistCompactionCheckpoint.mockReset()
    captureBillableUsage.mockReset()
    generateCheckpoint.mockResolvedValue(compactedResult)
    rewriteModelMessages.mockReturnValue([
      { role: 'user', content: 'rewritten' },
    ])
    persistCompactionCheckpoint.mockResolvedValue({
      summary: compactedResult.summary,
      includeFromCreatedAt: '2026-01-01T00:00:00.000Z',
      checkpointLineId: 'cp-parent',
    })
    captureBillableUsage.mockResolvedValue(undefined)
  })

  it('returns undefined under high-water and does not persist', async () => {
    const { onEvent, input } = baseInput()
    const prepareStep = prepareParentCompactStep(input)

    const result = await prepareStep({
      messages: [{ role: 'user', content: 'short task' }],
    })

    expect(result).toBeUndefined()
    expect(generateCheckpoint).not.toHaveBeenCalled()
    expect(persistCompactionCheckpoint).not.toHaveBeenCalled()
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('compacts over high-water, persists a checkpoint, and rewrites messages', async () => {
    const { onEvent, input } = baseInput()
    const prepareStep = prepareParentCompactStep(input)
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Find the auth bug.' },
      { role: 'assistant', content: hugeContent },
    ]

    const result = await prepareStep({ messages })

    expect(generateCheckpoint).toHaveBeenCalledTimes(1)
    expect(generateCheckpoint).toHaveBeenCalledWith({
      model: stubModel,
      modelRef: parentModelRef,
      system: 'You are the parent agent.',
      providerOptions: stubProviderOptions,
      tools: stubTools,
      messages,
      focus: 'parent',
      signal: input.signal,
    })
    expect(persistCompactionCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        projectSlug: 'demo',
        chatId: 'chat-1',
        summary: compactedResult.summary,
        focus: 'parent',
      }),
    )
    expect(captureBillableUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'compaction',
        providerId: compactedResult.modelRef.providerId,
        modelId: compactedResult.modelRef.modelId,
      }),
    )
    expect(onEvent).toHaveBeenCalledWith({
      type: 'compaction-started',
    })
    expect(onEvent).toHaveBeenCalledWith({
      type: 'compaction',
      summary: compactedResult.summary,
      focus: 'parent',
    })
    expect(onEvent).toHaveBeenCalledWith({
      type: 'compaction-ended',
    })
    expect(onEvent.mock.calls[0]?.[0]).toEqual({ type: 'compaction-started' })
    expect(onEvent.mock.calls.at(-1)?.[0]).toEqual({ type: 'compaction-ended' })
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'chat-meta-changed',
        patch: expect.objectContaining({
          activeContext: expect.objectContaining({
            checkpointLineId: 'cp-parent',
            summary: compactedResult.summary,
          }),
        }),
      }),
    )
    expect(result).toEqual({
      messages: [{ role: 'user', content: 'rewritten' }],
    })
  })

  it('still rewrites when billing fails after a successful compaction', async () => {
    captureBillableUsage.mockRejectedValue(new Error('billing network failed'))
    const { onEvent, input } = baseInput()
    const prepareStep = prepareParentCompactStep(input)
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Find the auth bug.' },
      { role: 'assistant', content: hugeContent },
    ]

    const result = await prepareStep({ messages })

    expect(result).toEqual({
      messages: [{ role: 'user', content: 'rewritten' }],
    })
    expect(onEvent).toHaveBeenCalledWith({ type: 'compaction-ended' })
  })

  it('emits compaction-ended when rewritten messages still exceed the window', async () => {
    rewriteModelMessages.mockReturnValue([
      { role: 'user', content: hugeContent },
    ])
    const { onEvent, input } = baseInput()
    const prepareStep = prepareParentCompactStep(input)

    await expect(
      prepareStep({
        messages: [{ role: 'assistant', content: hugeContent }],
      }),
    ).rejects.toThrow(
      'Parent context still exceeds the model window after compaction',
    )
    expect(onEvent).toHaveBeenCalledWith({ type: 'compaction-started' })
    expect(onEvent).toHaveBeenCalledWith({ type: 'compaction-ended' })
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'compaction', focus: 'parent' }),
    )
  })
})
