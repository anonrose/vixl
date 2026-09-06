import { effectScope, watch, type ComputedRef, type Ref } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isTauri, watchGitHead } from '@/services/vixl/vixl-tauri'
import type { GitHeadChanged } from '@/types/git/git-head-changed'
import gitHeadRootsMatch from '@/utils/git-head-roots-match'

type GitHeadSyncOptions = {
  rootPath: ComputedRef<string | null> | Ref<string | null>
  onRootPathChange: (path: string | null) => Promise<void>
  onHeadChanged: () => Promise<void>
  onFocus: () => Promise<void>
}

let started = false
let unlisten: UnlistenFn | null = null
let stopScope: (() => void) | null = null
let handleWindowFocus: (() => void) | null = null
let handleVisibilityChange: (() => void) | null = null

const recover = (error: unknown): null => {
  if (error instanceof Error) {
    return null
  }
  return null
}

const syncWatchGitHead = async (path: string | null): Promise<void> => {
  if (!isTauri()) {
    return
  }
  try {
    await watchGitHead(path)
  } catch (error) {
    recover(error)
    return
  }
}

const bindHeadListener = async (options: GitHeadSyncOptions): Promise<void> => {
  if (!isTauri()) {
    return
  }
  try {
    unlisten = await listen<GitHeadChanged>('git-head-changed', (event) => {
      if (!gitHeadRootsMatch(event.payload.rootPath, options.rootPath.value)) {
        return
      }
      options.onHeadChanged().catch(recover)
    })
  } catch (error) {
    recover(error)
    return
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopScope?.()
    stopScope = null
    unlisten?.()
    unlisten = null
    if (handleWindowFocus) {
      window.removeEventListener('focus', handleWindowFocus)
      handleWindowFocus = null
    }
    if (handleVisibilityChange) {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      handleVisibilityChange = null
    }
    started = false
  })
}

export default (options: GitHeadSyncOptions): void => {
  if (started) {
    return
  }
  started = true

  handleWindowFocus = (): void => {
    options.onFocus().catch(recover)
  }
  handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      handleWindowFocus?.()
    }
  }

  window.addEventListener('focus', handleWindowFocus)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  const scope = effectScope(true)
  stopScope = () => {
    scope.stop()
  }
  scope.run(() => {
    watch(
      options.rootPath,
      async (path) => {
        await syncWatchGitHead(path)
        try {
          await options.onRootPathChange(path)
        } catch (error) {
          recover(error)
          return
        }
      },
      { immediate: true },
    )
  })

  bindHeadListener(options).catch(recover)
}
