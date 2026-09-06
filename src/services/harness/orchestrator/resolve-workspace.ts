import type { HarnessWorkspace } from '@/types/harness/harness-workspace'

const resolveLiveWorkspace = (input: {
  workspace?: HarnessWorkspace
  projectSlug: string
  projectRoot: string
  projectName: string
  standalone?: boolean
}): HarnessWorkspace => input.workspace ?? input

export default resolveLiveWorkspace
