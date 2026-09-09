import {
  BUILTIN_VIXL_THEME_ID,
  type VixlThemeDefinition,
  type VixlThemeEditorPalette,
  type VixlThemeSemanticTokens,
  type VixlThemeTypography,
} from '@/types/appearance/theme'

/**
 * Built-in Vixl default theme.
 *
 * These values mirror the hard-coded palettes shipped before custom themes
 * existed (tailwind.css shadcn tokens, vixl-code-theme.ts syntax palettes,
 * monaco-theme.ts widget colors, Inter/JetBrains Mono at 13px) so existing
 * users see pixel-identical results when no custom theme is selected.
 *
 * The built-in theme is never stored in settings or in the theme library.
 */

export const BUILTIN_VIXL_THEME_NAME = 'Vixl Default'

export const BUILTIN_UI_TYPOGRAPHY: VixlThemeTypography = {
  uiFontFamily: 'Inter Variable',
  uiFontFallbacks: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  monoFontFamily: 'JetBrains Mono',
  monoFontFallbacks: ['ui-monospace', 'Menlo', 'monospace'],
  uiFontSize: 13,
  editorFontSize: 13,
}

const lightSemanticTokens: VixlThemeSemanticTokens = {
  background: '#ffffff',
  foreground: '#0a0a0a',
  card: '#ffffff',
  cardForeground: '#0a0a0a',
  popover: '#ffffff',
  popoverForeground: '#0a0a0a',
  primary: '#171717',
  primaryForeground: '#fafafa',
  secondary: '#f5f5f5',
  secondaryForeground: '#171717',
  muted: '#f5f5f5',
  mutedForeground: '#737373',
  accent: '#f5f5f5',
  accentForeground: '#171717',
  destructive: '#dc2626',
  border: '#e5e5e5',
  input: '#e5e5e5',
  ring: '#a3a3a3',
  sidebar: '#fafafa',
  sidebarForeground: '#0a0a0a',
  sidebarPrimary: '#171717',
  sidebarPrimaryForeground: '#fafafa',
  sidebarAccent: '#f5f5f5',
  sidebarAccentForeground: '#171717',
  sidebarBorder: '#e5e5e5',
  sidebarRing: '#a3a3a3',
  chart1: '#f97316',
  chart2: '#0d9488',
  chart3: '#1e40af',
  chart4: '#facc15',
  chart5: '#fb923c',
}

const darkSemanticTokens: VixlThemeSemanticTokens = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  card: '#171717',
  cardForeground: '#fafafa',
  popover: '#171717',
  popoverForeground: '#fafafa',
  primary: '#e5e5e5',
  primaryForeground: '#171717',
  secondary: '#262626',
  secondaryForeground: '#fafafa',
  muted: '#262626',
  mutedForeground: '#a3a3a3',
  accent: '#262626',
  accentForeground: '#fafafa',
  destructive: '#f87171',
  border: '#333333',
  input: '#333333',
  ring: '#737373',
  sidebar: '#171717',
  sidebarForeground: '#fafafa',
  sidebarPrimary: '#e5e5e5',
  sidebarPrimaryForeground: '#171717',
  sidebarAccent: '#262626',
  sidebarAccentForeground: '#fafafa',
  sidebarBorder: '#333333',
  sidebarRing: '#737373',
  chart1: '#1d4ed8',
  chart2: '#10b981',
  chart3: '#fb923c',
  chart4: '#a855f7',
  chart5: '#f43f5e',
}

const lightEditorPalette: VixlThemeEditorPalette = {
  background: '#ffffff',
  foreground: '#252525',
  comment: '#737373',
  keyword: '#5a6a9e',
  keywordAccent: '#7a5a8a',
  string: '#3d7358',
  number: '#4a704a',
  function: '#6b6b4a',
  type: '#3d6b62',
  variable: '#4a5568',
  constant: '#5a6a8a',
  operator: '#404040',
  invalid: '#b04a3a',
  regexp: '#6a5a7a',
  attribute: '#4a5568',
  tag: '#5a6a9e',
  escape: '#6b5a4a',
  hoverWidgetBackground: '#f3f3f3',
  hoverWidgetForeground: '#252525',
  hoverWidgetBorder: '#c8c8c8',
  suggestWidgetBackground: '#f3f3f3',
  suggestWidgetForeground: '#252525',
  suggestWidgetBorder: '#c8c8c8',
}

const darkEditorPalette: VixlThemeEditorPalette = {
  background: '#252525',
  foreground: '#d4d4d4',
  comment: '#707070',
  keyword: '#7a8abf',
  keywordAccent: '#9a85b0',
  string: '#6b9a8a',
  number: '#8aaa8a',
  function: '#b8b8a0',
  type: '#6a9e95',
  variable: '#a8b4c0',
  constant: '#8a9ec4',
  operator: '#c8c8c8',
  invalid: '#c4756a',
  regexp: '#8a7a9e',
  attribute: '#a8b4c0',
  tag: '#7a8abf',
  escape: '#a8a090',
  hoverWidgetBackground: '#1e1e1e',
  hoverWidgetForeground: '#d4d4d4',
  hoverWidgetBorder: '#3c3c3c',
  suggestWidgetBackground: '#1e1e1e',
  suggestWidgetForeground: '#d4d4d4',
  suggestWidgetBorder: '#3c3c3c',
}

export const builtInVixlTheme: VixlThemeDefinition = {
  id: BUILTIN_VIXL_THEME_ID,
  name: BUILTIN_VIXL_THEME_NAME,
  version: 1,
  variants: {
    light: {
      colors: lightSemanticTokens,
      canvas: { type: 'solid', color: '#ffffff' },
      typography: BUILTIN_UI_TYPOGRAPHY,
      editor: lightEditorPalette,
    },
    dark: {
      colors: darkSemanticTokens,
      canvas: { type: 'solid', color: '#0a0a0a' },
      typography: BUILTIN_UI_TYPOGRAPHY,
      editor: darkEditorPalette,
    },
  },
}
