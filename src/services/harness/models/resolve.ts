import { tool } from 'ai'
import { z } from 'zod'
import loadProviderModelsCatalog from '@/services/models/catalog-cache'
import { resolveCatalogMatches } from '@/services/models/search'
import type { HarnessToolContext } from '@/types/harness/tool-context'
import type { ResolveCatalogMatchesResult } from '@/types/models/resolve-catalog-matches-result'

const resolveModels = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Look up allowed model refs by query. Results are exact provider::modelId refs for spawn_subagent. If the same model appears from multiple providers, ask the user which to use.',
    inputSchema: z.object({
      query: z.string().describe('Model id or name fragment to search'),
    }),
    execute: async ({ query }): Promise<ResolveCatalogMatchesResult> => {
      const groups = await loadProviderModelsCatalog(ctx.settings)
      return resolveCatalogMatches(groups, ctx.settings, { query })
    },
  })

export default resolveModels
