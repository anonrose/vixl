import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import { defaultVixlSettings } from '@/schemas/vixl-settings'
import type { VixlThemeDefinition } from '@/types/appearance/theme'
import { builtInVixlTheme } from '@/constants/appearance/built-in-theme'

const hydrated = ref(false)
const effectiveSettings = shallowRef<VixlSettings>(defaultVixlSettings())

vi.mock('@/composables/use-vixl-config', () => ({
  default: () => ({
    hydrated,
    effectiveSettings,
  }),
}))

const sampleCustomTheme = (): VixlThemeDefinition => ({
  id: 'midnight-run',
  name: 'Midnight Run',
  version: 1,
  variants: {
    light: {
      ...builtInVixlTheme.variants.light,
      colors: {
        ...builtInVixlTheme.variants.light.colors,
        background: '#f7f7f2',
      },
      canvas: {
        type: 'gradient',
        angle: 135,
        stops: [
          { color: '#101018', position: 0 },
          { color: '#1c1c2a', position: 100 },
        ],
      },
      typography: builtInVixlTheme.variants.light.typography,
      editor: builtInVixlTheme.variants.light.editor,
    },
    dark: {
      ...builtInVixlTheme.variants.dark,
      colors: {
        ...builtInVixlTheme.variants.dark.colors,
        background: '#050508',
      },
      canvas: { type: 'solid', color: '#050508' },
    },
  },
})

const mountAppearance = async (): Promise<{
  api: Awaited<ReturnType<typeof import('@/composables/use-appearance').default>>
  wrapper: ReturnType<typeof mount>
}> => {
  const { default: useAppearance } = await import('@/composables/use-appearance')
  let api: Awaited<ReturnType<typeof import('@/composables/use-appearance').default>> | null = null
  const TestHost = defineComponent({
    setup() {
      api = useAppearance() as never
      return () => h('div')
    },
  })
  const wrapper = mount(TestHost)
  await nextTick()
  return { api: api as never, wrapper }
}

const flushAppearance = async (): Promise<void> => {
  await nextTick()
  await nextTick()
}

describe('use-appearance runtime', () => {
  beforeEach(() => {
    vi.resetModules()
    hydrated.value = false
    effectiveSettings.value = defaultVixlSettings()
    document.documentElement.removeAttribute('style')
    document.documentElement.className = ''
    for (const attribute of [
      'data-vixl-appearance-theme',
      'data-vixl-appearance-mode',
      'data-vixl-appearance-revision',
      'data-vixl-appearance-preview',
    ]) {
      document.documentElement.removeAttribute(attribute)
    }
    localStorage.clear()
  })

  it('applies color-mode authority and built-in state after hydration', async () => {
    effectiveSettings.value = { ...defaultVixlSettings(), 'appearance.theme': 'dark' }
    hydrated.value = true

    const events: Array<CustomEvent['detail']> = []
    const listener = (event: Event): void => {
      events.push((event as CustomEvent).detail)
    }
    window.addEventListener('vixl:appearance-change', listener)

    try {
      const { api, wrapper } = await mountAppearance()
      await flushAppearance()

      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.getAttribute('data-vixl-appearance-theme')).toBe(
        'vixl-default',
      )
      expect(document.documentElement.getAttribute('data-vixl-appearance-mode')).toBe('dark')
      expect(document.documentElement.getAttribute('data-vixl-appearance-revision')).toBe('1')
      // Built-in theme: runtime variables are cleared, CSS defaults rule.
      expect(document.documentElement.style.getPropertyValue('--background')).toBe('')
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        themeId: 'vixl-default',
        builtIn: true,
        variant: 'dark',
        colorMode: 'dark',
        revision: 1,
        previewing: false,
      })

      api.syncTheme()
      await flushAppearance()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      wrapper.unmount()
    } finally {
      window.removeEventListener('vixl:appearance-change', listener)
    }
  })

  it('applies semantic variables and canvas for an active custom theme', async () => {
    const theme = sampleCustomTheme()
    effectiveSettings.value = {
      ...defaultVixlSettings(),
      'appearance.theme': 'dark',
      'appearance.activeThemeId': theme.id,
      'appearance.themeLibrary': [theme],
    }
    hydrated.value = true

    await mountAppearance()
    await flushAppearance()

    const style = document.documentElement.style
    expect(style.getPropertyValue('--background')).toBe('#050508')
    expect(style.getPropertyValue('--vixl-canvas-background')).toBe('#050508')
    expect(style.getPropertyValue('--vixl-canvas-image')).toBe('none')
    expect(document.documentElement.getAttribute('data-vixl-appearance-theme')).toBe(
      'midnight-run',
    )
  })

  it('falls back to the built-in theme when the active id is dangling or malformed', async () => {
    effectiveSettings.value = {
      ...defaultVixlSettings(),
      'appearance.theme': 'light',
      'appearance.activeThemeId': 'gone-theme',
      'appearance.themeLibrary': [{ id: 42 } as unknown as VixlThemeDefinition],
    }
    hydrated.value = true

    await mountAppearance()
    await flushAppearance()

    expect(document.documentElement.getAttribute('data-vixl-appearance-theme')).toBe(
      'vixl-default',
    )
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('')
  })

  it('previews a draft, then cancels back to the saved appearance', async () => {
    const theme = sampleCustomTheme()
    effectiveSettings.value = {
      ...defaultVixlSettings(),
      'appearance.theme': 'dark',
      'appearance.activeThemeId': theme.id,
      'appearance.themeLibrary': [theme],
    }
    hydrated.value = true

    const { api, wrapper } = await mountAppearance()
    await flushAppearance()
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    api.beginPreview({ theme, variant: 'light' })
    await flushAppearance()

    expect(api.isPreviewing.value).toBe(true)
    expect(document.documentElement.getAttribute('data-vixl-appearance-preview')).toBe('true')
    expect(document.documentElement.getAttribute('data-vixl-appearance-mode')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('#f7f7f2')
    expect(document.documentElement.style.getPropertyValue('--vixl-canvas-image')).toBe(
      'linear-gradient(135deg, #101018 0%, #1c1c2a 100%)',
    )

    api.cancelPreview()
    await flushAppearance()

    expect(api.isPreviewing.value).toBe(false)
    expect(document.documentElement.hasAttribute('data-vixl-appearance-preview')).toBe(false)
    expect(document.documentElement.getAttribute('data-vixl-appearance-mode')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('#050508')
    wrapper.unmount()
  })

  it('clears stale variables when returning to the built-in theme', async () => {
    const theme = sampleCustomTheme()
    effectiveSettings.value = {
      ...defaultVixlSettings(),
      'appearance.theme': 'light',
      'appearance.activeThemeId': theme.id,
      'appearance.themeLibrary': [theme],
    }
    hydrated.value = true

    const { wrapper } = await mountAppearance()
    await flushAppearance()
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('#f7f7f2')

    effectiveSettings.value = {
      ...defaultVixlSettings(),
      'appearance.theme': 'light',
    }
    await flushAppearance()

    expect(document.documentElement.getAttribute('data-vixl-appearance-theme')).toBe(
      'vixl-default',
    )
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--vixl-canvas-image')).toBe('')
    wrapper.unmount()
  })

  it('does not apply settings-derived state before hydration', async () => {
    effectiveSettings.value = { ...defaultVixlSettings(), 'appearance.theme': 'dark' }
    hydrated.value = false

    const { wrapper } = await mountAppearance()
    await flushAppearance()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-vixl-appearance-theme')).toBeNull()

    hydrated.value = true
    await flushAppearance()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-vixl-appearance-theme')).toBe(
      'vixl-default',
    )
    wrapper.unmount()
  })
})
