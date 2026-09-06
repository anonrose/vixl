import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import type { ChatMeta } from '@/types/chat/chat-meta'
import type { FleetProject } from '@/types/fleet/fleet-project'

type GitHeadSyncOptions = {
  rootPath: { value: string | null }
  onRootPathChange: (path: string | null) => Promise<void>
  onHeadChanged: () => Promise<void>
  onFocus: () => Promise<void>
}

const sync = vi.hoisted(() => ({
  options: null as GitHeadSyncOptions | null,
}))

const gitRepoInfo = vi.hoisted(
  () =>
    vi.fn<(rootPath: string) => Promise<{ isRepo: boolean; currentBranch: string | null }>>(
      async () => ({ isRepo: true, currentBranch: 'main' }),
    ),
)
const gitListBranches = vi.hoisted(
  () => vi.fn<(rootPath: string) => Promise<string[]>>(async () => ['main', 'dev']),
)
const gitCheckoutBranch = vi.hoisted(
  () => vi.fn<(rootPath: string, branch: string) => Promise<void>>(async () => undefined),
)

const meta = ref<ChatMeta | null>(null)
const activeProject = ref<FleetProject | null>(null)

vi.mock('@/composables/use-git-head-sync', () => ({
  default: (options: GitHeadSyncOptions) => {
    sync.options = options
  },
}))

vi.mock('@/composables/use-chat-store', () => ({
  default: () => ({
    meta,
  }),
}))

vi.mock('@/composables/use-fleet-registry', () => ({
  default: () => ({
    activeProject,
  }),
}))

vi.mock('@/services/git/git-repo-info', () => ({
  default: (rootPath: string) => gitRepoInfo(rootPath),
}))

vi.mock('@/services/git/git-list-branches', () => ({
  default: (rootPath: string) => gitListBranches(rootPath),
}))

vi.mock('@/services/git/git-checkout-branch', () => ({
  default: (rootPath: string, branch: string) => gitCheckoutBranch(rootPath, branch),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

describe('use-git-branches', () => {
  beforeEach(() => {
    vi.resetModules()
    sync.options = null
    meta.value = null
    activeProject.value = null
    gitRepoInfo.mockReset()
    gitRepoInfo.mockResolvedValue({ isRepo: true, currentBranch: 'main' })
    gitListBranches.mockReset()
    gitListBranches.mockResolvedValue(['main', 'dev'])
    gitCheckoutBranch.mockReset()
    gitCheckoutBranch.mockResolvedValue(undefined)
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
  })

  it('toasts on dropdown refresh failure and stays silent for head and focus', async () => {
    const { default: useGitBranches } = await import('@/composables/use-git-branches')
    const git = useGitBranches()
    git.setWorkspaceRoot('/repo')

    await git.refresh()
    expect(git.currentBranch.value).toBe('main')
    expect(git.branches.value).toEqual(['main', 'dev'])
    expect(gitListBranches).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()

    gitRepoInfo.mockResolvedValueOnce({ isRepo: true, currentBranch: 'dev' })
    await sync.options?.onHeadChanged()
    expect(git.currentBranch.value).toBe('dev')
    expect(gitListBranches).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()

    gitRepoInfo.mockRejectedValueOnce(new Error('head failed'))
    await sync.options?.onHeadChanged()
    expect(toast.error).not.toHaveBeenCalled()
    expect(git.currentBranch.value).toBe('dev')

    gitRepoInfo.mockRejectedValueOnce(new Error('focus failed'))
    await sync.options?.onFocus()
    expect(toast.error).not.toHaveBeenCalled()

    gitRepoInfo.mockRejectedValueOnce(new Error('dropdown failed'))
    await git.refresh()
    expect(toast.error).toHaveBeenCalledWith('Failed to load git branches', {
      description: 'dropdown failed',
    })
  })

  it('shares one-time sync setup across callers', async () => {
    const { default: useGitBranches } = await import('@/composables/use-git-branches')
    useGitBranches()
    useGitBranches()
    expect(sync.options).not.toBeNull()
  })
})
