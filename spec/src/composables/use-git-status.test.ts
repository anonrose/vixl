import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import type { GitHeadChanged } from '@/types/git/git-head-changed'
import type { GitStatusResult } from '@/types/git/git-status-result'
import { mockTauriEvent } from '../test-utils/mocks/tauri-event'
import { mockVixlTauri } from '../test-utils/mocks/vixl-tauri'

type HeadHandler = (event: { payload: GitHeadChanged }) => void

const isTauri = vi.hoisted(() => vi.fn<() => boolean>(() => true))
const gitStatus = vi.hoisted(
  () =>
    vi.fn<(root: string) => Promise<GitStatusResult>>(async () => ({
      branch: 'main',
      entries: [],
    })),
)
const listen = vi.hoisted(
  () =>
    vi.fn<(event: string, handler: HeadHandler) => Promise<() => void>>(
      async () => () => {},
    ),
)

vi.mock('@tauri-apps/api/event', () => mockTauriEvent({ listen }))

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    isTauri: () => isTauri(),
  }),
)

vi.mock('@/services/git/git-status', () => ({
  default: (root: string) => gitStatus(root),
}))

let headHandler: HeadHandler | null = null
let unlisten = vi.fn<() => void>()
let wrapper: VueWrapper | undefined

const flush = async (): Promise<void> => {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

const mountStatus = async (
  projectRoot: Ref<string | null>,
): Promise<{
  wrapper: VueWrapper
  error: Ref<string | null>
}> => {
  const { default: useGitStatus } = await import('@/composables/use-git-status')
  const captured: { error: Ref<string | null> | null } = { error: null }
  const Host = defineComponent({
    setup() {
      const status = useGitStatus(projectRoot)
      captured.error = status.error
      return {}
    },
    template: '<div />',
  })
  wrapper = mount(Host)
  if (!captured.error) {
    throw new Error('useGitStatus did not return error')
  }
  return { wrapper, error: captured.error }
}

describe('use-git-status git-head-changed', () => {
  beforeEach(() => {
    headHandler = null
    unlisten = vi.fn<() => void>()
    isTauri.mockReset()
    isTauri.mockReturnValue(true)
    gitStatus.mockReset()
    gitStatus.mockResolvedValue({ branch: 'main', entries: [] })
    listen.mockReset()
    listen.mockImplementation(async (event, handler) => {
      if (event === 'git-head-changed') {
        headHandler = handler
      }
      return unlisten
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    wrapper?.unmount()
    wrapper = undefined
  })

  it('skips listen outside Tauri', async () => {
    isTauri.mockReturnValue(false)
    await mountStatus(ref('/repo'))
    await flush()
    expect(listen).not.toHaveBeenCalled()
  })

  it('listens per instance and unlistens on unmount', async () => {
    const { default: useGitStatus } = await import('@/composables/use-git-status')
    const first = await mountStatus(ref('/repo'))
    await flush()
    expect(listen).toHaveBeenCalledTimes(1)
    expect(listen.mock.calls[0]?.[0]).toBe('git-head-changed')

    const secondRoot = ref<string | null>('/other')
    const SecondHost = defineComponent({
      setup() {
        useGitStatus(secondRoot)
        return {}
      },
      template: '<div />',
    })
    const second = mount(SecondHost)
    await flush()
    expect(listen).toHaveBeenCalledTimes(2)

    first.wrapper.unmount()
    expect(unlisten).toHaveBeenCalledTimes(1)
    second.unmount()
    expect(unlisten).toHaveBeenCalledTimes(2)
  })

  it('refreshes when the head event root matches', async () => {
    await mountStatus(ref('/repo'))
    await flush()
    expect(gitStatus).toHaveBeenCalledTimes(1)
    expect(headHandler).toBeTruthy()

    vi.useFakeTimers()
    headHandler?.({ payload: { rootPath: '/repo' } })
    await vi.advanceTimersByTimeAsync(400)

    expect(gitStatus).toHaveBeenCalledTimes(2)
    expect(gitStatus).toHaveBeenLastCalledWith('/repo')
  })

  it('ignores head events for a different root', async () => {
    await mountStatus(ref('/repo'))
    await flush()
    expect(gitStatus).toHaveBeenCalledTimes(1)

    vi.useFakeTimers()
    headHandler?.({ payload: { rootPath: '/other' } })
    await vi.advanceTimersByTimeAsync(400)

    expect(gitStatus).toHaveBeenCalledTimes(1)
  })

  it('sets error when listen fails', async () => {
    gitStatus.mockImplementation(() => new Promise(() => {}))
    listen.mockRejectedValue(new Error('subscribe failed'))
    const { error } = await mountStatus(ref('/repo'))
    await flush()
    expect(error.value).toBe('subscribe failed')
  })

  it('unlistens if unmounted before listen resolves', async () => {
    let resolveListen: ((fn: () => void) => void) | undefined
    listen.mockImplementation(
      () =>
        new Promise<() => void>((resolve) => {
          resolveListen = resolve
        }),
    )
    const lateUnlisten = vi.fn<() => void>()
    const mounted = await mountStatus(ref('/repo'))
    await nextTick()
    mounted.wrapper.unmount()
    wrapper = undefined

    if (!resolveListen) {
      throw new Error('listen was not called')
    }
    resolveListen(lateUnlisten)
    await Promise.resolve()
    expect(lateUnlisten).toHaveBeenCalledTimes(1)
  })
})
