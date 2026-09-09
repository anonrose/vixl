import { beforeEach, describe, expect, it } from 'vitest'
import { builtInVixlTheme } from '@/constants/appearance/built-in-theme'
import {
  APPEARANCE_MODE_ATTRIBUTE,
  APPEARANCE_PREVIEW_ATTRIBUTE,
  APPEARANCE_REVISION_ATTRIBUTE,
  APPEARANCE_THEME_ATTRIBUTE,
  CANVAS_BACKGROUND_VARIABLE,
  CANVAS_IMAGE_VARIABLE,
  FONT_SIZE_UI_VARIABLE,
  FONT_UI_VARIABLE,
  applyEffectiveAppearance,
  buildCanvasCss,
  buildCanvasGradientCss,
  buildFontFamilyCss,
  clearAppearanceAttributes,
  clearAppearanceVariables,
  semanticTokenVariableName,
} from '@/utils/appearance/appearance-css'
import { resolveEffectiveAppearance } from '@/utils/appearance/resolve-effective-appearance'
import type { VixlThemeDefinition } from '@/types/appearance/theme'
import { BUILTIN_VIXL_THEME_ID } from '@/types/appearance/theme'

const customTheme: VixlThemeDefinition = {
  id: 'mint-panel',
  name: 'Mint Panel',
  version: 1,
  variants: {
    light: {
      colors: {
        ...builtInVixlTheme.variants.light.colors,
        background: '#f0fff8',
        cardForeground: '#123322',
      },
      canvas: {
        type: 'gradient',
        angle: 45,
        stops: [
          { color: '#e2ffe0', position: 100 },
          { color: '#ffffff', position: 0 },
        ],
      },
      typography: {
        ...builtInVixlTheme.variants.light.typography,
        uiFontFamily: 'Atkinson Hyperlegible',
        uiFontSize: 14.5,
      },
      editor: builtInVixlTheme.variants.light.editor,
    },
    dark: builtInVixlTheme.variants.dark,
  },
}

describe('semanticTokenVariableName', () => {
  it('maps camelCase tokens to kebab-case CSS variables', () => {
    expect(semanticTokenVariableName('background')).toBe('--background')
    expect(semanticTokenVariableName('cardForeground')).toBe('--card-foreground')
    expect(semanticTokenVariableName('sidebarPrimaryForeground')).toBe(
      '--sidebar-primary-foreground',
    )
    expect(semanticTokenVariableName('chart1')).toBe('--chart-1')
    expect(semanticTokenVariableName('chart5')).toBe('--chart-5')
  })
})

describe('buildCanvasCss', () => {
  it('renders structured gradients sorted by position', () => {
    const gradient = buildCanvasGradientCss({
      type: 'gradient',
      angle: 45,
      stops: [
        { color: '#e2ffe0', position: 100 },
        { color: '#ffffff', position: 0 },
      ],
    })
    expect(gradient).toBe('linear-gradient(45deg, #ffffff 0%, #e2ffe0 100%)')
  })

  it('clamps angle and stop positions into the allowed range', () => {
    const gradient = buildCanvasGradientCss({
      type: 'gradient',
      angle: 420,
      stops: [
        { color: '#000000', position: -10 },
        { color: '#ffffff', position: 140 },
      ],
    })
    expect(gradient).toBe('linear-gradient(360deg, #000000 0%, #ffffff 100%)')
  })

  it('falls back to the solid color for solid canvases', () => {
    expect(buildCanvasCss({ type: 'solid', color: '#101010' })).toEqual({
      color: '#101010',
      image: 'none',
    })
  })

  it('paints gradients over the first stop as the solid fallback', () => {
    expect(
      buildCanvasCss({
        type: 'gradient',
        angle: 90,
        stops: [
          { color: '#111111', position: 0 },
          { color: '#222222', position: 100 },
        ],
      }),
    ).toEqual({
      color: '#111111',
      image: 'linear-gradient(90deg, #111111 0%, #222222 100%)',
    })
  })

  it('treats degenerate gradients as solid canvases', () => {
    expect(buildCanvasGradientCss({ type: 'solid', color: '#000000' })).toBeNull()
    expect(
      buildCanvasCss({
        type: 'gradient',
        angle: 0,
        stops: [{ color: '#333333', position: 50 }],
      }),
    ).toEqual({ color: '#333333', image: 'none' })
  })
})

describe('buildFontFamilyCss', () => {
  it('quotes families with spaces and appends fallbacks', () => {
    expect(
      buildFontFamilyCss({
        uiFontFamily: 'Atkinson Hyperlegible',
        uiFontFallbacks: ['Inter', 'system-ui'],
      }),
    ).toBe('"Atkinson Hyperlegible", Inter, system-ui')
  })

  it('keeps bare identifiers unquoted and skips empty families', () => {
    expect(
      buildFontFamilyCss({ uiFontFamily: 'Inter', uiFontFallbacks: ['', 'monospace'] }),
    ).toBe('Inter, monospace')
  })
})

describe('applyEffectiveAppearance / clearAppearanceVariables', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style')
    clearAppearanceAttributes(document.documentElement)
  })

  it('applies tokens, canvas, typography, and data attributes', () => {
    const appearance = resolveEffectiveAppearance({
      colorMode: 'light',
      theme: customTheme,
    })
    applyEffectiveAppearance(document.documentElement, appearance, {
      revision: 3,
      previewing: false,
    })

    const style = document.documentElement.style
    expect(style.getPropertyValue('--background')).toBe('#f0fff8')
    expect(style.getPropertyValue('--card-foreground')).toBe('#123322')
    expect(style.getPropertyValue('--chart-1')).toBe(
      builtInVixlTheme.variants.light.colors.chart1,
    )
    expect(style.getPropertyValue(CANVAS_BACKGROUND_VARIABLE)).toBe('#ffffff')
    expect(style.getPropertyValue(CANVAS_IMAGE_VARIABLE)).toBe(
      'linear-gradient(45deg, #ffffff 0%, #e2ffe0 100%)',
    )
    expect(style.getPropertyValue(FONT_UI_VARIABLE)).toBe(
      '"Atkinson Hyperlegible", Inter, ui-sans-serif, system-ui, sans-serif',
    )
    expect(style.getPropertyValue(FONT_SIZE_UI_VARIABLE)).toBe('14.5px')

    expect(document.documentElement.getAttribute(APPEARANCE_THEME_ATTRIBUTE)).toBe('mint-panel')
    expect(document.documentElement.getAttribute(APPEARANCE_MODE_ATTRIBUTE)).toBe('light')
    expect(document.documentElement.getAttribute(APPEARANCE_REVISION_ATTRIBUTE)).toBe('3')
    expect(document.documentElement.hasAttribute(APPEARANCE_PREVIEW_ATTRIBUTE)).toBe(false)
  })

  it('marks preview applications with the preview attribute', () => {
    const appearance = resolveEffectiveAppearance({
      colorMode: 'light',
      theme: customTheme,
    })
    applyEffectiveAppearance(document.documentElement, appearance, {
      revision: 4,
      previewing: true,
    })
    expect(document.documentElement.getAttribute(APPEARANCE_PREVIEW_ATTRIBUTE)).toBe('true')
  })

  it('clears every allowlisted variable but keeps data attributes intact', () => {
    const appearance = resolveEffectiveAppearance({
      colorMode: 'light',
      theme: customTheme,
    })
    applyEffectiveAppearance(document.documentElement, appearance, {
      revision: 1,
      previewing: false,
    })
    clearAppearanceVariables(document.documentElement)

    const style = document.documentElement.style
    expect(style.getPropertyValue('--background')).toBe('')
    expect(style.getPropertyValue('--sidebar-ring')).toBe('')
    expect(style.getPropertyValue(CANVAS_IMAGE_VARIABLE)).toBe('')
    expect(style.getPropertyValue(FONT_UI_VARIABLE)).toBe('')
    expect(document.documentElement.getAttribute(APPEARANCE_THEME_ATTRIBUTE)).toBe('mint-panel')
  })

  it('removes data attributes on teardown', () => {
    const appearance = resolveEffectiveAppearance({
      colorMode: 'light',
      theme: customTheme,
    })
    applyEffectiveAppearance(document.documentElement, appearance, {
      revision: 1,
      previewing: true,
    })
    clearAppearanceAttributes(document.documentElement)
    expect(document.documentElement.getAttribute(APPEARANCE_THEME_ATTRIBUTE)).toBeNull()
    expect(document.documentElement.getAttribute(APPEARANCE_MODE_ATTRIBUTE)).toBeNull()
    expect(document.documentElement.getAttribute(APPEARANCE_REVISION_ATTRIBUTE)).toBeNull()
    expect(document.documentElement.hasAttribute(APPEARANCE_PREVIEW_ATTRIBUTE)).toBe(false)
  })

  it('clears overrides when the built-in theme is applied', () => {
    const custom = resolveEffectiveAppearance({ colorMode: 'light', theme: customTheme })
    applyEffectiveAppearance(document.documentElement, custom, {
      revision: 1,
      previewing: false,
    })
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('#f0fff8')

    const builtIn = resolveEffectiveAppearance({ colorMode: 'light' })
    expect(builtIn.themeId).toBe(BUILTIN_VIXL_THEME_ID)
    applyEffectiveAppearance(document.documentElement, builtIn, {
      revision: 2,
      previewing: false,
    })
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('')
    expect(document.documentElement.getAttribute(APPEARANCE_THEME_ATTRIBUTE)).toBe(
      BUILTIN_VIXL_THEME_ID,
    )
  })
})
