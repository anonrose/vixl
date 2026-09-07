import { tool } from 'ai'
import { z } from 'zod'
import loadProviderModelsCatalog from '@/services/models/catalog-cache'
import { resolveCatalogMatches } from '@/services/models/search'
import type { HarnessToolContext } from '@/types/harness/tool-context'
import type { ResolveCatalogMatchesResult } from '@/types/models/resolve-catalog-matches-result'

const resolveModels = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Look up allowed model refs by query and provider. Pass an exact ref to spawn_subagent.',
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe('Model id or name fragment to search'),
      provider: z
        .string()
        .optional()
        .describe('Provider id or name to scope the search'),
    }),
    execute: async ({
      query,
      provider,
    }): Promise<ResolveCatalogMatchesResult> => {
      const groups = await loadProviderModelsCatalog(ctx.settings)
      return resolveCatalogMatches(groups, ctx.settings, { query, provider })
    },
  })

export default resolveModels
