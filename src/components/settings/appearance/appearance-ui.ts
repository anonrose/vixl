import {
  THEME_FONT_SIZE_MAX,
  THEME_FONT_SIZE_MIN,
} from '@/schemas/appearance/theme'
import {
  BUILTIN_VIXL_THEME_ID,
  type VixlThemeCanvasBackground,
  type VixlThemeDefinition,
  type VixlThemeSemanticTokens,
  type VixlThemeTypography,
  type VixlThemeVariantKind,
} from '@/types/appearance/theme'
import { builtInVixlTheme } from '@/constants/appearance/built-in-theme'

/**
 * UI helpers for the Appearance settings section, layered on the appearance
 * domain model (types, built-in theme, strict schema, theme-library service).
 */

export type { VixlThemeVariantKind as AppearanceVariant }

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export const isValidHexColor = (value: string): boolean => HEX_COLOR_PATTERN.test(value.trim())

export const isBuiltInTheme = (theme: VixlThemeDefinition): boolean =>
  theme.id === BUILTIN_VIXL_THEME_ID

export const cloneThemeDefinition = (theme: VixlThemeDefinition): VixlThemeDefinition =>
  structuredClone(theme)

export const MIN_FONT_SIZE = THEME_FONT_SIZE_MIN
export const MAX_FONT_SIZE = THEME_FONT_SIZE_MAX

export const clampFontSize = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 13
  }
  const snapped = Math.round(value * 2) / 2
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, snapped))
}

export const clampAngle = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return ((Math.round(value) % 360) + 360) % 360
}

export const clampStopPosition = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round(value)))
}

export const sortStops = (stops: Array<{ color: string; position: number }>) =>
  [...stops].sort((a, b) => a.position - b.position)

/** Renders the structured canvas as a CSS background value for previews. */
export const canvasToCss = (canvas: VixlThemeCanvasBackground, fallbackColor: string): string => {
  if (canvas.type === 'solid') {
    return canvas.color
  }
  if (canvas.stops.length < 2) {
    return fallbackColor
  }
  const parts = sortStops(canvas.stops).map((stop) => `${stop.color} ${stop.position}%`)
  return `linear-gradient(${clampAngle(canvas.angle)}deg, ${parts.join(', ')})`
}

export type TokenFieldMeta = {
  key: keyof VixlThemeSemanticTokens
  label: string
}

export const CORE_TOKEN_FIELDS: TokenFieldMeta[] = [
  { key: 'background', label: 'Background' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'primary', label: 'Primary' },
  { key: 'primaryForeground', label: 'Primary foreground' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'secondaryForeground', label: 'Secondary foreground' },
  { key: 'muted', label: 'Muted' },
  { key: 'mutedForeground', label: 'Muted foreground' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentForeground', label: 'Accent foreground' },
  { key: 'destructive', label: 'Destructive' },
  { key: 'card', label: 'Card' },
  { key: 'cardForeground', label: 'Card foreground' },
  { key: 'popover', label: 'Popover' },
  { key: 'popoverForeground', label: 'Popover foreground' },
  { key: 'border', label: 'Border' },
  { key: 'input', label: 'Input border' },
  { key: 'ring', label: 'Focus ring' },
]

export const ADVANCED_TOKEN_FIELDS: TokenFieldMeta[] = [
  { key: 'chart1', label: 'Chart 1' },
  { key: 'chart2', label: 'Chart 2' },
  { key: 'chart3', label: 'Chart 3' },
  { key: 'chart4', label: 'Chart 4' },
  { key: 'chart5', label: 'Chart 5' },
  { key: 'sidebar', label: 'Sidebar' },
  { key: 'sidebarForeground', label: 'Sidebar foreground' },
  { key: 'sidebarPrimary', label: 'Sidebar primary' },
  { key: 'sidebarPrimaryForeground', label: 'Sidebar primary foreground' },
  { key: 'sidebarAccent', label: 'Sidebar accent' },
  { key: 'sidebarAccentForeground', label: 'Sidebar accent foreground' },
  { key: 'sidebarBorder', label: 'Sidebar border' },
  { key: 'sidebarRing', label: 'Sidebar ring' },
]

/** Semantic background that a foreground token is paired with. */
export const contrastTargetFor = (
  key: keyof VixlThemeSemanticTokens,
  tokens: VixlThemeSemanticTokens,
): string | undefined => {
  const map: Partial<Record<keyof VixlThemeSemanticTokens, keyof VixlThemeSemanticTokens>> = {
    foreground: 'background',
    cardForeground: 'card',
    popoverForeground: 'popover',
    primaryForeground: 'primary',
    secondaryForeground: 'secondary',
    mutedForeground: 'background',
    accentForeground: 'accent',
    sidebarForeground: 'sidebar',
    sidebarPrimaryForeground: 'sidebarPrimary',
    sidebarAccentForeground: 'sidebarAccent',
  }
  const target = map[key]
  return target ? tokens[target] : undefined
}

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.trim()
  const channel = (raw: string): number => {
    const parsed = Number.parseInt(raw, 16)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value.length === 4) {
    return [
      channel(`${value[1] ?? '0'}${value[1] ?? '0'}`),
      channel(`${value[2] ?? '0'}${value[2] ?? '0'}`),
      channel(`${value[3] ?? '0'}${value[3] ?? '0'}`),
    ]
  }
  return [
    channel(value.slice(1, 3)),
    channel(value.slice(3, 5)),
    channel(value.slice(5, 7)),
  ]
}

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const scaled = channel / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

/** WCAG contrast ratio between two colors (1 to 21). */
export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a.trim())
  const lb = relativeLuminance(b.trim())
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export const hasInsufficientContrast = (foreground: string, background: string): boolean =>
  isValidHexColor(foreground) &&
  isValidHexColor(background) &&
  contrastRatio(foreground, background) < 4.5

export type ContrastWarning = {
  label: string
  ratio: number
}

export const contrastWarnings = (
  tokens: VixlThemeSemanticTokens,
): ContrastWarning[] => {
  const pairs: Array<[string, keyof VixlThemeSemanticTokens]> = [
    ['Text on background', 'foreground'],
    ['Text on card', 'cardForeground'],
    ['Text on primary', 'primaryForeground'],
    ['Muted text on background', 'mutedForeground'],
    ['Sidebar text', 'sidebarForeground'],
  ]
  return pairs
    .filter(([, key]) => hasInsufficientContrast(tokens[key], contrastTargetFor(key, tokens) ?? tokens.background))
    .map(([label, key]) => ({
      label,
      ratio: contrastRatio(tokens[key], contrastTargetFor(key, tokens) ?? tokens.background),
    }))
}

export type FontPreset = {
  label: string
  family: string
  fallbacks: string[]
}

/** Bundled/system-safe font presets; no remote or user-supplied fonts. */
export const UI_FONT_PRESETS: FontPreset[] = [
  {
    label: 'Inter (bundled)',
    family: 'Inter Variable',
    fallbacks: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  },
  { label: 'System UI', family: 'system-ui', fallbacks: ['sans-serif'] },
  { label: 'Serif', family: 'Georgia', fallbacks: ['serif'] },
  {
    label: 'Monospace',
    family: 'JetBrains Mono',
    fallbacks: ['ui-monospace', 'monospace'],
  },
]

export const MONO_FONT_PRESETS: FontPreset[] = [
  {
    label: 'JetBrains Mono (bundled)',
    family: 'JetBrains Mono',
    fallbacks: ['ui-monospace', 'Menlo', 'monospace'],
  },
  { label: 'System mono', family: 'ui-monospace', fallbacks: ['monospace'] },
  {
    label: 'Menlo / Consolas',
    family: 'Menlo',
    fallbacks: ['Consolas', 'DejaVu Sans Mono', 'monospace'],
  },
]

export const typographyPresetValue = (
  typography: VixlThemeTypography,
  kind: 'ui' | 'mono',
): string => {
  const presets = kind === 'ui' ? UI_FONT_PRESETS : MONO_FONT_PRESETS
  const family = kind === 'ui' ? typography.uiFontFamily : typography.monoFontFamily
  const fallbacks = kind === 'ui' ? typography.uiFontFallbacks : typography.monoFontFallbacks
  const match = presets.find((preset) => preset.family === family)
  if (match) {
    return `${match.family}|${match.fallbacks.join(',')}`
  }
  return `${family}|${fallbacks.join(',')}`
}

export const fontStackCss = (typography: VixlThemeTypography, kind: 'ui' | 'mono'): string => {
  const family = kind === 'ui' ? typography.uiFontFamily : typography.monoFontFamily
  const fallbacks = kind === 'ui' ? typography.uiFontFallbacks : typography.monoFontFallbacks
  return [family, ...fallbacks].map((name) => (/^[A-Za-z0-9 _-]+$/.test(name) ? name : `'${name}'`)).join(', ')
}

/** Draft helpers ----------------------------------------------------------- */

export const builtInVariant = (variant: VixlThemeVariantKind) =>
  builtInVixlTheme.variants[variant]
