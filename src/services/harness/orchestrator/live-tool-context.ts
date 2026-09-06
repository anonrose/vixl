import type { HarnessToolContext } from '@/types/harness/tool-context'
import type { HarnessWorkspace } from '@/types/harness/harness-workspace'

const bindLiveToolContext = (
  workspace: HarnessWorkspace,
  rest: Omit<HarnessToolContext, 'projectRoot' | 'projectSlug'>,
): HarnessToolContext => ({
  ...rest,
  get projectRoot() {
    return workspace.projectRoot
  },
  set projectRoot(value: string) {
    workspace.projectRoot = value
  },
  get projectSlug() {
    return workspace.projectSlug
  },
  set projectSlug(value: string) {
    workspace.projectSlug = value
  },
})

export default bindLiveToolContext
