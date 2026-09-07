import type {
  LanguageModel,
  LanguageModelUsage,
  ModelMessage,
  ToolSet,
} from 'ai'
import type { ModelRef } from '@/types/models/model-ref'
import type { ResolvedModelCallOptions } from '@/services/models/resolve-model-call-options'

export type GenerateCheckpointInput = {
  model: LanguageModel
  modelRef: ModelRef
  system: string
  providerOptions: ResolvedModelCallOptions['providerOptions']
  tools: ToolSet
  messages: ModelMessage[]
  focus: string
  signal: AbortSignal
}

export type GenerateCheckpointResult = {
  summary: string
  usage: LanguageModelUsage | undefined
  providerMetadata: unknown
  responseId: string | undefined
  modelRef: ModelRef
}
