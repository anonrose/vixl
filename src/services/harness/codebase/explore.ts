import { tool } from 'ai'
import { z } from 'zod'
import callManagedCodegraphTool from '@/services/harness/codebase/call-managed'
import normalizeCodegraphResult from '@/services/codegraph/normalize-codegraph-result'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const codebaseExplore = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Explore the CodeGraph index for architecture, flows, and where-is-X questions.',
    inputSchema: z.object({
      query: z.string().describe('Question or symbol/file names'),
    }),
    execute: async ({ query }, { toolCallId }) => {
      const called = await callManagedCodegraphTool(ctx, {
        toolCallId,
        firstPartyName: 'codebase_explore',
        mcpToolName: 'codegraph_explore',
        toolArgs: { query },
      })
      if (!called.ok) {
        if ('rejected' in called.payload) {
          return called.payload
        }
        return {
          summary:
            typeof called.payload.error === 'string'
              ? called.payload.error
              : 'CodeGraph explore failed',
          results: [],
        }
      }
      return normalizeCodegraphResult.tool(called.result)
    },
  })

export default codebaseExplore
