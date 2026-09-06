import { computed, ref, type ComputedRef } from 'vue'
import { toast } from 'vue-sonner'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useGitHeadSync from '@/composables/use-git-head-sync'
import { HOME_CHAT_SLUG } from '@/constants/home-chat'
import gitCheckoutBranch from '@/services/git/git-checkout-branch'
import gitListBranches from '@/services/git/git-list-branches'
import gitRepoInfo from '@/services/git/git-repo-info'
import gitBranchRefreshPlan from '@/utils/git-branch-refresh-plan'

const isRepo = ref(false)
const currentBranch = ref<string | null>(null)
const branches = ref<string[]>([])
const pending = ref(false)
const checkoutPending = ref(false)

/** When set (including `null`), overrides meta/active-project resolution. */
const workspaceRootOverride = ref<string | null | undefined>(undefined)

let refreshGeneration = 0
let pendingGeneration = 0
let rootPath: ComputedRef<string | null> | null = null

const clearState = (): void => {
  isRepo.value = false
  currentBranch.value = null
  branches.value = []
}

const refreshFrom = async (source: Parameters<typeof gitBranchRefreshPlan>[0]): Promise<void> => {
  const plan = gitBranchRefreshPlan(source)
  const path = rootPath?.value ?? null
  const generation = ++refreshGeneration

  if (!path) {
    clearState()
    pending.value = false
    return
  }

  if (plan.setPending) {
    pending.value = true
    pendingGeneration = generation
  }

  try {
    const info = await gitRepoInfo(path)
    if (generation !== refreshGeneration) {
      return
    }

    isRepo.value = info.isRepo
    currentBranch.value = info.currentBranch

    if (!info.isRepo) {
      branches.value = []
      return
    }

    if (!plan.listBranches) {
      if (info.currentBranch && !branches.value.includes(info.currentBranch)) {
        branches.value = [info.currentBranch, ...branches.value]
      }
      return
    }

    branches.value = await gitListBranches(path)
    if (generation !== refreshGeneration) {
      return
    }

    if (info.currentBranch && !branches.value.includes(info.currentBranch)) {
      branches.value = [info.currentBranch, ...branches.value]
    }
  } catch (error) {
    if (generation !== refreshGeneration) {
      return
    }
    if (!plan.toastOnError) {
      return
    }
    clearState()
    toast.error('Failed to load git branches', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    if (plan.setPending && pendingGeneration === generation) {
      pending.value = false
    }
  }
}

export default () => {
  const fleet = useFleetRegistry()
  const chatStore = useChatStore()

  if (!rootPath) {
    rootPath = computed(() => {
      if (workspaceRootOverride.value !== undefined) {
        return workspaceRootOverride.value
      }

      const meta = chatStore.meta.value
      if (meta?.projectSlug === HOME_CHAT_SLUG) {
        return null
      }
      if (meta?.projectRoot) {
        return meta.projectRoot
      }
      return fleet.activeProject.value?.rootPath ?? null
    })
  }

  const setWorkspaceRoot = (path: string | null | undefined): void => {
    workspaceRootOverride.value = path
  }

  const refresh = async (): Promise<void> => {
    await refreshFrom('dropdown')
  }

  const checkoutBranch = async (branch: string): Promise<void> => {
    const path = rootPath?.value ?? null
    if (!path || branch === currentBranch.value) {
      return
    }

    checkoutPending.value = true

    try {
      await gitCheckoutBranch(path, branch)
      await refreshFrom('checkout')
      toast.success('Switched branch', {
        description: branch,
      })
    } catch (error) {
      toast.error('Could not switch branch', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      checkoutPending.value = false
    }
  }

  useGitHeadSync({
    rootPath,
    onRootPathChange: () => refreshFrom('root'),
    onHeadChanged: () => refreshFrom('head'),
    onFocus: () => refreshFrom('focus'),
  })

  return {
    isRepo,
    currentBranch,
    branches,
    pending,
    checkoutPending,
    refresh,
    checkoutBranch,
    setWorkspaceRoot,
  }
}
