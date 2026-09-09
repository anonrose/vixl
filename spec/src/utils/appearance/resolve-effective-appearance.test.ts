import { describe, expect, it } from 'vitest'
import { builtInVixlTheme } from '@/constants/appearance/built-in-theme'
import {
  getEffectiveAppearanceSignature,
  resolveEffectiveAppearance,
  resolveAppearanceVariant,
  type AppearancePreviewDraft,
} from '@/utils/appearance/resolve-effective-appearance'
import { BUILTIN_VIXL_THEME_ID } from '@/types/appearance/theme'
import type { VixlThemeDefinition } from '@/types/appearance/theme'

const customTheme: VixlThemeDefinition = {
  id: 'midnight-run',
  name: 'Midnight Run',
  version: 1,
  variants: {
    light: {
      colors: {
        ...builtInVixlTheme.variants.light.colors,
        background: '#f7f7f2',
        primary: '#2244aa',
      },
      canvas: {
        type: 'gradient',
        angle: 135,
        stops: [
          { color: '#101018', position: 0 },
          { color: '#1c1c2a', position: 100 },
        ],
      },
      typography: {
        ...builtInVixlTheme.variants.light.typography,
        uiFontSize: 14,
      },
      editor: { ...builtInVixlTheme.variants.light.editor, background: '#f0f0ea' },
    },
    dark: {
      colors: {
        ...builtInVixlTheme.variants.dark.colors,
        background: '#050508',
        primary: '#88aaff',
      },
      canvas: { type: 'solid', color: '#050508' },
      typography: builtInVixlTheme.variants.dark.typography,
      editor: builtInVixlTheme.variants.dark.editor,
    },
  },
}

describe('resolveAppearanceVariant', () => {
  it('resolves system mode from the OS preference', () => {
    expect(resolveAppearanceVariant('system', true)).toBe('dark')
    expect(resolveAppearanceVariant('system', false)).toBe('light')
  })

  it('respects forced light/dark color modes', () => {
    expect(resolveAppearanceVariant('dark', false)).toBe('dark')
    expect(resolveAppearanceVariant('light', true)).toBe('light')
  })

  it('lets a preview variant override the resolved mode', () => {
    expect(resolveAppearanceVariant('light', false, 'dark')).toBe('dark')
  })
})

describe('resolveEffectiveAppearance', () => {
  it('resolves the built-in theme for light and dark modes', () => {
    const light = resolveEffectiveAppearance({ colorMode: 'light' })
    expect(light.themeId).toBe(BUILTIN_VIXL_THEME_ID)
    expect(light.builtIn).toBe(true)
    expect(light.variant).toBe('light')
    expect(light.colors).toEqual(builtInVixlTheme.variants.light.colors)
    expect(light.editor).toEqual(builtInVixlTheme.variants.light.editor)

    const dark = resolveEffectiveAppearance({ colorMode: 'dark' })
    expect(dark.variant).toBe('dark')
    expect(dark.colors).toEqual(builtInVixlTheme.variants.dark.colors)
  })

  it('resolves system mode via systemDark', () => {
    expect(resolveEffectiveAppearance({ colorMode: 'system', systemDark: true }).variant).toBe(
      'dark',
    )
    expect(resolveEffectiveAppearance({ colorMode: 'system', systemDark: false }).variant).toBe(
      'light',
    )
  })

  it('applies the active saved theme for the resolved variant', () => {
    const dark = resolveEffectiveAppearance({
      colorMode: 'dark',
      theme: customTheme,
    })
    expect(dark.builtIn).toBe(false)
    expect(dark.themeId).toBe('midnight-run')
    expect(dark.themeName).toBe('Midnight Run')
    expect(dark.colors.background).toBe('#050508')
    expect(dark.canvas).toEqual({ type: 'solid', color: '#050508' })

    const light = resolveEffectiveAppearance({ colorMode: 'light', theme: customTheme })
    expect(light.colors.background).toBe('#f7f7f2')
    expect(light.typography.uiFontSize).toBe(14)
  })

  it('falls back to the built-in theme when the selection is missing or malformed', () => {
    const fallback = resolveEffectiveAppearance({ colorMode: 'dark', theme: null })
    expect(fallback.builtIn).toBe(true)
    expect(fallback.themeId).toBe(BUILTIN_VIXL_THEME_ID)

    const malformed = { id: 'broken' } as unknown as VixlThemeDefinition
    expect(
      resolveEffectiveAppearance({ colorMode: 'dark', theme: malformed }).themeId,
    ).toBe(BUILTIN_VIXL_THEME_ID)
  })

  it('preview drafts win over the selection and the resolved mode', () => {
    const preview: AppearancePreviewDraft = {
      theme: customTheme,
      variant: 'light',
    }
    const effective = resolveEffectiveAppearance({
      colorMode: 'dark',
      theme: null,
      preview,
    })
    expect(effective.themeId).toBe('midnight-run')
    expect(effective.builtIn).toBe(false)
    expect(effective.variant).toBe('light')
    expect(effective.colors.background).toBe('#f7f7f2')
  })

  it('previewing only a variant keeps the selected theme', () => {
    const effective = resolveEffectiveAppearance({
      colorMode: 'light',
      theme: customTheme,
      preview: { variant: 'dark' },
    })
    expect(effective.variant).toBe('dark')
    expect(effective.themeId).toBe('midnight-run')
    expect(effective.colors.background).toBe('#050508')
  })

  it('produces stable signatures for identical appearances', () => {
    const appearance = resolveEffectiveAppearance({ colorMode: 'dark' })
    const a = getEffectiveAppearanceSignature(appearance, { previewing: false })
    const b = getEffectiveAppearanceSignature(appearance, { previewing: false })
    expect(a).toBe(b)
    expect(
      getEffectiveAppearanceSignature(appearance, { previewing: true }),
    ).not.toBe(a)
  })
})
