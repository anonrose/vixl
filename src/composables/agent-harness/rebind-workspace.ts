import { toast } from 'vue-sonner'
import type { HarnessEvent } from '@/types/harness/harness-event'
import chatRouteFor from '@/utils/chat-route-for'
import router from '@/router'
import { rekeyPlanExecutionSession } from '@/services/harness/plan-execution-session'
import { rekeyAgentHarness } from './cache'
import type { AgentHarnessState } from './types'

type WorkspaceMovedEvent = Extract<HarnessEvent, { type: 'workspace-moved' }>

export default async (
  state: AgentHarnessState,
  event: WorkspaceMovedEvent,
): Promise<void> => {
  const { options } = state
  const fromProjectSlug = event.fromProjectSlug

  options.projectSlug = event.projectSlug
  options.projectRoot = event.projectRoot
  options.projectName = event.project.name
  options.standalone = false

  state.chatStore.rekeySession(fromProjectSlug, event.chatId, {
    projectSlug: event.projectSlug,
    projectRoot: event.projectRoot,
  })
  rekeyAgentHarness(fromProjectSlug, event.chatId, event.projectSlug)
  rekeyPlanExecutionSession(fromProjectSlug, event.chatId, event.projectSlug)

  if (options.loadedThreadKey) {
    options.loadedThreadKey.value = `${event.projectSlug}:${event.chatId}`
  }

  try {
    await state.fleet.refresh()
    await state.fleet.setActiveProject(event.project.id)
    await router.replace(chatRouteFor(event.projectSlug, event.chatId))
    await state.fleetSidebar.refreshSlug(fromProjectSlug)
    await state.fleetSidebar.refreshSlug(event.projectSlug)
  } catch (error: unknown) {
    toast.error('Failed to rebind workspace', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}
