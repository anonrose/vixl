import { generateText } from 'ai'
import type {
  GenerateCheckpointInput,
  GenerateCheckpointResult,
} from '@/types/harness/generate-checkpoint'
import loadPrompt from '@/services/prompts/load-prompt'
import toCachedInstructions from '@/services/models/to-cached-instructions'
import formatUnknownError from '@/utils/format-unknown-error'
import compactBudgets from './budgets'

export default async (
  input: GenerateCheckpointInput,
): Promise<GenerateCheckpointResult> => {
  const {
    model,
    modelRef,
    system,
    providerOptions,
    tools,
    messages,
    focus,
    signal,
  } = input

  try {
    const result = await generateText({
      model,
      instructions: toCachedInstructions(system, providerOptions),
      messages: [
        ...messages,
        {
          role: 'user',
          content: loadPrompt('system/compact.md', { focus }),
        },
      ],
      tools,
      toolChoice: 'none',
      maxOutputTokens: compactBudgets.COMPACT_MAX_OUTPUT_TOKENS,
      providerOptions,
      abortSignal: signal,
    })

    const summary = result.text.trim()
    if (!summary) {
      throw new Error('Compaction returned empty summary')
    }

    return {
      summary,
      usage: result.usage,
      providerMetadata: result.providerMetadata,
      responseId: result.response?.id,
      modelRef,
    }
  } catch (error) {
    throw new Error(formatUnknownError(error))
  }
}
