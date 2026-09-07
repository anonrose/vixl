import { tool } from 'ai'
import { z } from 'zod'
import { workspaceGrep } from '@/services/vixl/vixl-tauri'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const grep = (ctx: HarnessToolContext) =>
  tool({
    description: 'Search workspace with ripgrep',
    inputSchema: z.object({
      pattern: z.string().describe('Ripgrep pattern'),
      glob: z.string().optional().describe('Optional glob filter'),
    }),
    execute: async ({ pattern, glob }) =>
      workspaceGrep({ projectRoot: ctx.projectRoot, pattern, glob }),
  })

export default grep
