import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { GitHeadChanged } from '@/types/git/git-head-changed'
import { mockTauriEvent } from '../test-utils/mocks/tauri-event'
import { mockVixlTauri } from '../test-utils/mocks/vixl-tauri'

type HeadHandler = (event: { payload: GitHeadChanged }) => void
type AsyncHandler = () => Promise<void>

const isTauri = vi.hoisted(() => vi.fn<() => boolean>(() => true))
const watchGitHead = vi.hoisted(
  () => vi.fn<(rootPath?: string | null) => Promise<void>>(async () => undefined),
)
const listen = vi.hoisted(
  () =>
    vi.fn<
      (event: string, handler: HeadHandler) => Promise<() => void>
    >(async () => () => {}),
)

vi.mock('@tauri-apps/api/event', () => mockTauriEvent({ listen }))

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    isTauri: () => isTauri(),
    watchGitHead: (rootPath?: string | null) => watchGitHead(rootPath),
  }),
)

const asyncHandler = (): ReturnType<typeof vi.fn<AsyncHandler>> =>
  vi.fn<AsyncHandler>(async () => undefined)

let headHandler: HeadHandler | null = null
let focusHandler: (() => void) | null = null
let visibilityHandler: (() => void) | null = null

const resetDomListeners = (): void => {
  focusHandler = null
  visibilityHandler = null
  vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'focus' && typeof handler === 'function') {
      focusHandler = handler as () => void
    }
  })
  vi.spyOn(document, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'visibilitychange' && typeof handler === 'function') {
      visibilityHandler = handler as () => void
    }
  })
  vi.spyOn(window, 'removeEventListener').mockImplementation(() => undefined)
  vi.spyOn(document, 'removeEventListener').mockImplementation(() => undefined)
}

describe('use-git-head-sync', () => {
  beforeEach(() => {
    vi.resetModules()
    isTauri.mockReset()
    isTauri.mockReturnValue(true)
    watchGitHead.mockReset()
    watchGitHead.mockResolvedValue(undefined)
    listen.mockReset()
    headHandler = null
    listen.mockImplementation(async (event, handler) => {
      if (event === 'git-head-changed') {
        headHandler = handler
      }
      return () => {}
    })
    resetDomListeners()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers watchers once across multiple calls', async () => {
    const { default: useGitHeadSync } = await import(
      '@/composables/use-git-head-sync'
    )
    const rootPath = ref<string | null>('/repo')
    const onRootPathChange = asyncHandler()
    const onHeadChanged = asyncHandler()
    const onFocus = asyncHandler()
    const options = { rootPath, onRootPathChange, onHeadChanged, onFocus }

    useGitHeadSync(options)
    useGitHeadSync(options)
    await vi.waitFor(() => {
      expect(listen).toHaveBeenCalledTimes(1)
    })

    expect(window.addEventListener).toHaveBeenCalledTimes(1)
    expect(document.addEventListener).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      expect(watchGitHead).toHaveBeenCalledWith('/repo')
    })
    expect(onRootPathChange).toHaveBeenCalledTimes(1)
  })

  it('refreshes current branch only when the event root matches', async () => {
    const { default: useGitHeadSync } = await import(
      '@/composables/use-git-head-sync'
    )
    const rootPath = ref<string | null>('/repo')
    const onRootPathChange = asyncHandler()
    const onHeadChanged = asyncHandler()
    const onFocus = asyncHandler()

    useGitHeadSync({ rootPath, onRootPathChange, onHeadChanged, onFocus })
    await vi.waitFor(() => {
      expect(headHandler).not.toBeNull()
    })

    headHandler?.({ payload: { rootPath: '/other' } })
    headHandler?.({ payload: { rootPath: '/repo' } })
    await vi.waitFor(() => {
      expect(onHeadChanged).toHaveBeenCalledTimes(1)
    })
  })

  it('refreshes on focus and visible tab, not when hidden', async () => {
    const { default: useGitHeadSync } = await import(
      '@/composables/use-git-head-sync'
    )
    const rootPath = ref<string | null>('/repo')
    const onRootPathChange = asyncHandler()
    const onHeadChanged = asyncHandler()
    const onFocus = asyncHandler()

    useGitHeadSync({ rootPath, onRootPathChange, onHeadChanged, onFocus })
    await vi.waitFor(() => {
      expect(focusHandler).not.toBeNull()
      expect(visibilityHandler).not.toBeNull()
    })

    focusHandler?.()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    visibilityHandler?.()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    visibilityHandler?.()

    expect(onFocus).toHaveBeenCalledTimes(2)
  })

  it('skips tauri watch and listen when not in tauri', async () => {
    isTauri.mockReturnValue(false)
    const { default: useGitHeadSync } = await import(
      '@/composables/use-git-head-sync'
    )
    const rootPath = ref<string | null>('/repo')
    const onRootPathChange = asyncHandler()
    const onHeadChanged = asyncHandler()
    const onFocus = asyncHandler()

    useGitHeadSync({ rootPath, onRootPathChange, onHeadChanged, onFocus })
    await vi.waitFor(() => {
      expect(onRootPathChange).toHaveBeenCalledTimes(1)
    })
    expect(watchGitHead).not.toHaveBeenCalled()
    expect(listen).not.toHaveBeenCalled()
  })

  it('passes null to drop the head watcher when the root clears', async () => {
    const { default: useGitHeadSync } = await import(
      '@/composables/use-git-head-sync'
    )
    const rootPath = ref<string | null>('/repo')
    const onRootPathChange = asyncHandler()
    const onHeadChanged = asyncHandler()
    const onFocus = asyncHandler()

    useGitHeadSync({ rootPath, onRootPathChange, onHeadChanged, onFocus })
    await vi.waitFor(() => {
      expect(watchGitHead).toHaveBeenCalledWith('/repo')
    })

    rootPath.value = null
    await vi.waitFor(() => {
      expect(watchGitHead).toHaveBeenCalledWith(null)
    })
  })
})
