import type { Ref } from 'vue'

export type AgentHarnessOptions = {
  projectSlug: string
  chatId: string
  projectRoot: string
  projectName: string
  standalone?: boolean
  loadedThreadKey?: Ref<string | null>
}
