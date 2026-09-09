import { describe, expect, it } from 'vitest'
import {
  THEME_GRADIENT_STOP_MAX,
  parseThemeDefinition,
  themeDefinitionSchema,
} from '@/schemas/appearance/theme'
import { builtInVixlTheme } from '@/constants/appearance/built-in-theme'
import { BUILTIN_VIXL_THEME_ID, type VixlThemeDefinition } from '@/types/appearance/theme'

const validTheme = (): VixlThemeDefinition => ({
  ...structuredClone(builtInVixlTheme),
  id: 'my-theme',
  name: 'My Theme',
})

describe('themeDefinitionSchema', () => {
  it('accepts a complete valid two-variant theme', () => {
    const parsed = parseThemeDefinition(validTheme())
    expect(parsed.success).toBe(true)
  })

  it('accepts short and long hex color forms', () => {
    const theme = validTheme()
    theme.variants.light.colors.background = '#abc'
    theme.variants.light.colors.foreground = '#112233'
    theme.variants.light.colors.border = '#11223344'

    expect(parseThemeDefinition(theme).success).toBe(true)
  })

  it('rejects unknown top-level keys', () => {
    const raw = { ...validTheme(), customCss: 'body { background: red }' }
    expect(themeDefinitionSchema.safeParse(raw).success).toBe(false)
  })

  it('rejects unknown variant keys', () => {
    const theme = validTheme()
    ;(theme.variants.light as Record<string, unknown>).remoteFontUrl = 'https://example.com/f.woff'
    expect(parseThemeDefinition(theme).success).toBe(false)
  })

  it('rejects unsupported versions', () => {
    expect(
      themeDefinitionSchema.safeParse({ ...validTheme(), version: 2 }).success,
    ).toBe(false)
    expect(
      themeDefinitionSchema.safeParse({ ...validTheme(), version: '1' }).success,
    ).toBe(false)
  })

  it('rejects invalid ids', () => {
    const theme = validTheme()
    expect(
      themeDefinitionSchema.safeParse({ ...theme, id: 'Vixl Default' }).success,
    ).toBe(false)
    expect(themeDefinitionSchema.safeParse({ ...theme, id: 'x' }).success).toBe(false)
    expect(
      themeDefinitionSchema.safeParse({ ...theme, id: '-leading-hyphen' }).success,
    ).toBe(false)
  })

  it('rejects the reserved built-in id', () => {
    const theme = { ...validTheme(), id: BUILTIN_VIXL_THEME_ID }
    expect(themeDefinitionSchema.safeParse(theme).success).toBe(false)
  })

  it('rejects unsafe colors', () => {
    const theme = validTheme()
    theme.variants.light.colors.background = 'oklch(0.145 0 0)'
    expect(parseThemeDefinition(theme).success).toBe(false)

    const urlTheme = validTheme()
    urlTheme.variants.dark.canvas = {
      type: 'solid',
      color: 'url(https://example.com/bg.png)',
    }
    expect(parseThemeDefinition(urlTheme).success).toBe(false)

    const shortHexTheme = validTheme()
    shortHexTheme.variants.light.colors.border = '#12345'
    expect(parseThemeDefinition(shortHexTheme).success).toBe(false)
  })

  it('rejects unsafe font family values', () => {
    const theme = validTheme()
    theme.variants.light.typography.uiFontFamily = 'Inter; } * { color: red }'
    expect(parseThemeDefinition(theme).success).toBe(false)

    const parenTheme = validTheme()
    parenTheme.variants.dark.typography.monoFontFamily = 'url(evil)'
    expect(parseThemeDefinition(parenTheme).success).toBe(false)
  })

  it('rejects out-of-range font sizes', () => {
    const tooSmall = validTheme()
    tooSmall.variants.light.typography.uiFontSize = 7.5
    expect(parseThemeDefinition(tooSmall).success).toBe(false)

    const tooBig = validTheme()
    tooBig.variants.dark.typography.editorFontSize = 32.5
    expect(parseThemeDefinition(tooBig).success).toBe(false)

    const offStep = validTheme()
    offStep.variants.light.typography.editorFontSize = 13.3
    expect(parseThemeDefinition(offStep).success).toBe(false)
  })

  it('accepts gradient canvases and rejects invalid gradients', () => {
    const theme = validTheme()
    theme.variants.light.canvas = {
      type: 'gradient',
      angle: 135,
      stops: [
        { color: '#ff0000', position: 0 },
        { color: '#00ff00', position: 50 },
        { color: '#0000ff', position: 100 },
      ],
    }
    expect(parseThemeDefinition(theme).success).toBe(true)

    const tooFewStops = validTheme()
    tooFewStops.variants.light.canvas = {
      type: 'gradient',
      angle: 0,
      stops: [{ color: '#ff0000', position: 0 }],
    }
    expect(parseThemeDefinition(tooFewStops).success).toBe(false)

    const tooManyStops = validTheme()
    tooManyStops.variants.light.canvas = {
      type: 'gradient',
      angle: 0,
      stops: Array.from({ length: THEME_GRADIENT_STOP_MAX + 1 }, (_, index) => ({
        color: '#ff0000',
        position: (index * 100) / THEME_GRADIENT_STOP_MAX,
      })),
    }
    expect(parseThemeDefinition(tooManyStops).success).toBe(false)

    const unsorted = validTheme()
    unsorted.variants.light.canvas = {
      type: 'gradient',
      angle: 0,
      stops: [
        { color: '#ff0000', position: 60 },
        { color: '#00ff00', position: 20 },
      ],
    }
    expect(parseThemeDefinition(unsorted).success).toBe(false)

    const outOfRange = validTheme()
    outOfRange.variants.light.canvas = {
      type: 'gradient',
      angle: 0,
      stops: [
        { color: '#ff0000', position: 0 },
        { color: '#00ff00', position: 150 },
      ],
    }
    expect(parseThemeDefinition(outOfRange).success).toBe(false)

    const badAngle = validTheme()
    badAngle.variants.light.canvas = {
      type: 'gradient',
      angle: 400,
      stops: [
        { color: '#ff0000', position: 0 },
        { color: '#00ff00', position: 100 },
      ],
    }
    expect(parseThemeDefinition(badAngle).success).toBe(false)
  })
})
