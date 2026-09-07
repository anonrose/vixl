import { toast } from 'vue-sonner'
import type { ModelMessage, UIMessage } from 'ai'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import type { GenerateCheckpointInput } from '@/types/harness/generate-checkpoint'
import type { HarnessEvent } from '@/types/harness/harness-event'
import type { HarnessWorkspace } from '@/types/harness/harness-workspace'
import type { ModelRef } from '@/types/models/model-ref'
import captureBillableUsage from '@/services/billing/capture-billable-usage'
import {
  estimatePromptTokens,
  generateCheckpoint,
  persistCompactionCheckpoint,
  rewriteModelMessages,
  resolveCompactHighWater,
} from '@/services/harness/compact'

type PrepareParentCompactStepInput = {
  settings: VixlSettings
  modelRef: ModelRef
  system: string
  signal: AbortSignal
  workspace: HarnessWorkspace
  chatId: string
  turnId: string
  messages: UIMessage[]
  onEvent: (event: HarnessEvent) => void
} & Pick<GenerateCheckpointInput, 'model' | 'tools' | 'providerOptions'>

export default (input: PrepareParentCompactStepInput) =>
  async (options: {
    messages: ModelMessage[]
  }): Promise<{ messages?: ModelMessage[] } | undefined> => {
    if (input.signal.aborted) {
      return undefined
    }

    const { settings, modelRef, system } = input
    const estimated = estimatePromptTokens(system, options.messages)
    const highWater = resolveCompactHighWater(settings, modelRef)

    if (estimated <= highWater) {
      return undefined
    }

    input.onEvent({ type: 'compaction-started' })
    try {
      const compacted = await generateCheckpoint({
        model: input.model,
        modelRef,
        system,
        providerOptions: input.providerOptions,
        tools: input.tools,
        messages: options.messages,
        focus: 'parent',
        signal: input.signal,
      })
      const rewritten = rewriteModelMessages(options.messages, compacted.summary)
      const compactedEstimate = estimatePromptTokens(system, rewritten)
      if (compactedEstimate > highWater) {
        throw new Error(
          'Parent context still exceeds the model window after compaction',
        )
      }

      const checkpoint = await persistCompactionCheckpoint({
        projectSlug: input.workspace.projectSlug,
        chatId: input.chatId,
        summary: compacted.summary,
        focus: 'parent',
        messages: input.messages,
      })

      input.onEvent({
        type: 'compaction',
        summary: compacted.summary,
        focus: 'parent',
      })
      input.onEvent({
        type: 'chat-meta-changed',
        projectSlug: input.workspace.projectSlug,
        chatId: input.chatId,
        patch: {
          activeContext: {
            checkpointLineId: checkpoint.checkpointLineId,
            includeFromCreatedAt: checkpoint.includeFromCreatedAt,
            summary: checkpoint.summary,
          },
        },
      })

      try {
        await captureBillableUsage({
          projectSlug: input.workspace.projectSlug,
          chatId: input.chatId,
          turnId: input.turnId,
          source: 'compaction',
          providerId: compacted.modelRef.providerId,
          modelId: compacted.modelRef.modelId,
          usage: compacted.usage,
          providerMetadata: compacted.providerMetadata,
          responseId: compacted.responseId,
          settings,
          onEvent: input.onEvent,
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
      input.onEvent({ type: 'compaction-ended' })
    }
  }
