import { tool } from 'ai'
import { z } from 'zod'
import { gitCommit as gitCommitCommand } from '@/services/vixl/vixl-tauri'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const gitCommit = (ctx: HarnessToolContext) =>
  tool({
    description: 'Stage paths and commit with a message',
    inputSchema: z.object({
      message: z.string().describe('Commit message'),
      paths: z.array(z.string()).min(1).describe('Paths to stage'),
    }),
    execute: async ({ message, paths }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'git_commit',
        kind: 'git',
        action: 'git.write',
        capability: 'git.commit',
        title: `git commit: ${message}`,
      })
      if (!allowed) {
        return { rejected: true, error: 'Git commit denied' }
      }
      return gitCommitCommand({
        projectRoot: ctx.projectRoot,
        message,
        paths,
      })
    },
  })

export default gitCommit
