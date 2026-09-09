import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import type { VixlSettings } from '@/types/vixl/vixl-settings'

const { loadEffectiveSettings, personal, mergedProject } = vi.hoisted(() => {
  const personal: VixlSettings = {
    version: 1,
    'appearance.theme': 'light',
  }
  const mergedProject: VixlSettings = {
    version: 1,
    'appearance.theme': 'dark',
    'chat.autoTitle': true,
  }
  return {
    personal,
    mergedProject,
    loadEffectiveSettings: vi.fn<(rootPath: string | null) => Promise<VixlSettings>>(),
  }
})

vi.mock('@/composables/use-vixl-config', async () => {
  const { shallowRef } = await import('vue')
  const personalSettings = shallowRef<VixlSettings>(personal)
  return {
    default: () => ({
      personalSettings,
    }),
  }
})

vi.mock('@/services/config/vixl-config', () => ({
  loadEffectiveSettings,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

import useRootEffectiveSettings from '@/composables/use-root-effective-settings'

const flush = async (): Promise<void> => {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

describe('useRootEffectiveSettings', () => {
  let scope: EffectScope

  beforeEach(() => {
    loadEffectiveSettings.mockReset()
    loadEffectiveSettings.mockResolvedValue(personal)
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
  })

  it('initializes settings from personal settings before the load completes', async () => {
    let resolveLoad: (value: VixlSettings) => void = () => undefined
    loadEffectiveSettings.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve
      }),
    )

    const root = ref<string | null>('/project')
    const api = scope.run(() => useRootEffectiveSettings(() => root.value))
    if (!api) {
      throw new Error('useRootEffectiveSettings did not return')
    }

    expect(api.settings.value).toEqual(personal)

    resolveLoad(mergedProject)
    await flush()
    expect(api.settings.value).toEqual(mergedProject)
  })

  it('reloads and applies merged project settings when the root changes', async () => {
    loadEffectiveSettings.mockImplementation(async (rootPath) => {
      if (rootPath === '/project') {
        return mergedProject
      }
      return personal
    })

    const root = ref<string | null>(null)
    const api = scope.run(() => useRootEffectiveSettings(() => root.value))
    if (!api) {
      throw new Error('useRootEffectiveSettings did not return')
    }

    await flush()
    expect(loadEffectiveSettings).toHaveBeenCalledWith(null)
    expect(api.settings.value).toEqual(personal)

    root.value = '/project'
    await flush()
    expect(loadEffectiveSettings).toHaveBeenCalledWith('/project')
    expect(api.settings.value).toEqual(mergedProject)
  })

  it('yields personal settings when the root is null', async () => {
    loadEffectiveSettings.mockResolvedValue(personal)

    const root = ref<string | null>(null)
    const api = scope.run(() => useRootEffectiveSettings(() => root.value))
    if (!api) {
      throw new Error('useRootEffectiveSettings did not return')
    }

    await api.reload()
    expect(loadEffectiveSettings).toHaveBeenCalledWith(null)
    expect(api.settings.value).toEqual(personal)
  })

  it('drops a stale load when the root changes mid-flight', async () => {
    let resolveFirst: (value: VixlSettings) => void = () => undefined
    loadEffectiveSettings.mockImplementation((rootPath) => {
      if (rootPath === '/first') {
        return new Promise((resolve) => {
          resolveFirst = resolve
        })
      }
      return Promise.resolve(mergedProject)
    })

    const root = ref<string | null>('/first')
    const api = scope.run(() => useRootEffectiveSettings(() => root.value))
    if (!api) {
      throw new Error('useRootEffectiveSettings did not return')
    }

    expect(api.settings.value).toEqual(personal)

    root.value = '/second'
    await flush()
    expect(api.settings.value).toEqual(mergedProject)

    resolveFirst({
      version: 1,
      'appearance.theme': 'system',
    })
    await flush()
    expect(api.settings.value).toEqual(mergedProject)
  })
})
