import { tool } from 'ai'
import createPlan from '@/services/plans/write-plan'
import createPlanInputSchema from '@/schemas/plans/create-plan-input'
import { fsWriteFile, updateChatMeta } from '@/services/vixl/vixl-tauri'
import useWorkbenchStore from '@/composables/use-workbench-store'
import {
  assertCreatePlanNotAwaitingPlanGo,
  markCreatedPlanThisTurn,
} from '@/services/harness/plan-execution-session'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const createPlanTool = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Create a plan under .vixl/plans/. After success, stop and wait for Build or Orchestrate.',
    inputSchema: createPlanInputSchema,
    execute: async ({ title, body, todos }) => {
      assertCreatePlanNotAwaitingPlanGo(ctx.projectSlug, ctx.chatId)
      const planTodos = todos ?? []
      const plan = createPlan({ title, body, todos: planTodos, sourceChatId: ctx.chatId })
      await fsWriteFile({ projectRoot: ctx.projectRoot, path: plan.path, content: plan.content })
      const awaiting = { planPath: plan.path, planId: plan.planId }
      markCreatedPlanThisTurn(ctx.projectSlug, ctx.chatId, awaiting)
      await updateChatMeta(ctx.projectSlug, ctx.chatId, {
        awaitingPlanGo: awaiting,
      })
      const workbench = useWorkbenchStore()
      const projectId = workbench.resolveProjectIdByRoot(ctx.projectRoot)
      if (projectId) {
        workbench.openPlan(projectId, plan.planId, plan.path, title)
      }
      return {
        planId: plan.planId,
        path: plan.path,
        todos: planTodos,
        awaitingGo: true,
        message:
          'Plan created. Stop and wait for the user to click Build now or Orchestrate on the plan tab before making any further changes.',
      }
    },
  })

export default createPlanTool
