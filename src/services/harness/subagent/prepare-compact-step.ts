import { toast } from 'vue-sonner'
import type { ModelMessage } from 'ai'
import type { ModelRef } from '@/types/models/model-ref'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import type { GenerateCheckpointInput } from '@/types/harness/generate-checkpoint'
import type { HarnessEvent } from '@/types/harness/harness-event'
import captureBillableUsage from '@/services/billing/capture-billable-usage'
import {
  estimatePromptTokens,
  generateCheckpoint,
  rewriteModelMessages,
  resolveCompactHighWater,
} from '@/services/harness/compact'

type PrepareCompactStepInput = {
  settings: VixlSettings
  modelRef: ModelRef
  system: string
  signal: AbortSignal
  projectSlug: string
  chatId: string
  turnId: string
  subagentId: string
  emitNestedEvent: (event: HarnessEvent) => void
  onBillEvent: (event: HarnessEvent) => void
} & Pick<GenerateCheckpointInput, 'model' | 'tools' | 'providerOptions'>

export default (input: PrepareCompactStepInput) =>
  async (options: {
    messages: ModelMessage[]
  }): Promise<{ messages?: ModelMessage[] } | undefined> => {
    const { settings, modelRef, system } = input
    const estimated = estimatePromptTokens(system, options.messages)
    const highWater = resolveCompactHighWater(settings, modelRef)

    if (estimated <= highWater) {
      return undefined
    }

    input.emitNestedEvent({ type: 'compaction-started' })
    try {
      const compacted = await generateCheckpoint({
        model: input.model,
        modelRef,
        system,
        providerOptions: input.providerOptions,
        tools: input.tools,
        messages: options.messages,
        focus: 'subagent',
        signal: input.signal,
      })
      const rewritten = rewriteModelMessages(options.messages, compacted.summary)
      const compactedEstimate = estimatePromptTokens(system, rewritten)
      if (compactedEstimate > highWater) {
        throw new Error(
          'Subagent context still exceeds the model window after compaction',
        )
      }

      input.emitNestedEvent({
        type: 'compaction',
        summary: compacted.summary,
        focus: 'subagent',
      })

      try {
        await captureBillableUsage({
          projectSlug: input.projectSlug,
          chatId: input.chatId,
          turnId: input.turnId,
          source: 'compaction',
          providerId: compacted.modelRef.providerId,
          modelId: compacted.modelRef.modelId,
          usage: compacted.usage,
          providerMetadata: compacted.providerMetadata,
          responseId: compacted.responseId,
          subagentId: input.subagentId,
          settings,
          onEvent: input.onBillEvent,
        })
      } catch (error) {
        // The rewrite is already applied, so an unexpected billing failure must
        // not abort the turn. captureBillableUsage toasts its own known
        // persist/enrich failures, so anything reaching here is unexpected:
        // surface it once and keep going.
        toast.error('Failed to record compaction usage', {
          description:
            error instanceof Error ? error.message : 'Unknown error',
        })
      }

      return { messages: rewritten }
    } finally {
      input.emitNestedEvent({ type: 'compaction-ended' })
    }
  }
