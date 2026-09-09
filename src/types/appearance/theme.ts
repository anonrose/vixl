/**
 * Versioned appearance theme domain model.
 *
 * Themes are data-only: semantic colors, canvas backgrounds, typography, and
 * editor palettes. No raw CSS, URLs, remote assets, or font sources.
 */

/** Version of the shareable theme file format. Bumped on breaking changes. */
export const VIXL_THEME_FORMAT_VERSION = 1

/** Reserved id for the unstored built-in Vixl default theme. */
export const BUILTIN_VIXL_THEME_ID = 'vixl-default'

export type VixlThemeVariantKind = 'light' | 'dark'

export type VixlThemeSemanticTokens = {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  border: string
  input: string
  ring: string
  sidebar: string
  sidebarForeground: string
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  sidebarAccent: string
  sidebarAccentForeground: string
  sidebarBorder: string
  sidebarRing: string
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string
}

/** App canvas backdrop. Every variant requires a solid fallback color. */
export type VixlThemeCanvasBackground =
  | { type: 'solid'; color: string }
  | {
      type: 'gradient'
      /** CSS gradient angle in degrees, 0-360. */
      angle: number
      /** 2-5 stops with positions in 0-100, sorted ascending. */
      stops: Array<{ color: string; position: number }>
      /** Solid color used when gradients are not renderable. */
      fallback?: string
    }

export type VixlThemeTypography = {
  /** Primary UI font family name, e.g. "Inter Variable". */
  uiFontFamily: string
  /** Explicit system/bundled fallback stacks applied after uiFontFamily. */
  uiFontFallbacks: string[]
  monoFontFamily: string
  monoFontFallbacks: string[]
  uiFontSize: number
  editorFontSize: number
}

/** Editor/code colors shared by Monaco and Shiki for one variant. */
export type VixlThemeEditorPalette = {
  background: string
  foreground: string
  comment: string
  keyword: string
  keywordAccent: string
  string: string
  number: string
  function: string
  type: string
  variable: string
  constant: string
  operator: string
  invalid: string
  regexp: string
  attribute: string
  tag: string
  escape: string
  hoverWidgetBackground: string
  hoverWidgetForeground: string
  hoverWidgetBorder: string
  suggestWidgetBackground: string
  suggestWidgetForeground: string
  suggestWidgetBorder: string
}

export type VixlThemeVariant = {
  colors: VixlThemeSemanticTokens
  canvas: VixlThemeCanvasBackground
  typography: VixlThemeTypography
  editor: VixlThemeEditorPalette
}

export type VixlThemeDefinition = {
  /** Stable identifier. The built-in id is reserved and never stored. */
  id: string
  /** User-facing display name. */
  name: string
  version: number
  variants: {
    light: VixlThemeVariant
    dark: VixlThemeVariant
  }
}

/** A theme as stored in the personal settings theme library. */
export type VixlThemeLibraryEntry = VixlThemeDefinition
