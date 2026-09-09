import {
  THEME_ID_PATTERN,
  THEME_LIBRARY_MAX_SIZE,
  parseThemeDefinition,
} from '@/schemas/appearance/theme'
import { themeFilePayloadSchema, type ThemeFilePayload } from '@/schemas/appearance/theme-file'
import {
  BUILTIN_VIXL_THEME_ID,
  type VixlThemeCanvasBackground,
  type VixlThemeDefinition,
  type VixlThemeEditorPalette,
  type VixlThemeVariant,
} from '@/types/appearance/theme'
import { builtInVixlTheme } from '@/constants/appearance/built-in-theme'

/**
 * Helpers for the personal theme library stored in settings under
 * `appearance.themeLibrary` with the active id under
 * `appearance.activeThemeId`. Both keys are personal-only: they are stripped
 * from project overrides so project config cannot embed or replace a user's
 * theme library.
 */

export const isThemeId = (value: unknown): value is string =>
  typeof value === 'string' && THEME_ID_PATTERN.test(value)

const widgetColorDefaults = (variant: 'light' | 'dark'): Pick<
  VixlThemeEditorPalette,
  | 'hoverWidgetBackground'
  | 'hoverWidgetForeground'
  | 'hoverWidgetBorder'
  | 'suggestWidgetBackground'
  | 'suggestWidgetForeground'
  | 'suggestWidgetBorder'
> => builtInVixlTheme.variants[variant].editor

const convertCanvas = (
  background: ThemeFilePayload['variants']['light']['background'],
): VixlThemeCanvasBackground => {
  if (background.kind === 'solid') {
    return { type: 'solid', color: background.color }
  }
  return {
    type: 'gradient',
    angle: background.angle,
    stops: background.stops.map((stop) => ({ color: stop.color, position: stop.position })),
    fallback: background.fallback,
  }
}

const convertVariant = (
  variant: ThemeFilePayload['variants']['light'],
  typography: ThemeFilePayload['typography'],
  kind: 'light' | 'dark',
): VixlThemeVariant => ({
  colors: {
    background: variant.tokens.background,
    foreground: variant.tokens.foreground,
    card: variant.tokens.card,
    cardForeground: variant.tokens.cardForeground,
    popover: variant.tokens.popover,
    popoverForeground: variant.tokens.popoverForeground,
    primary: variant.tokens.primary,
    primaryForeground: variant.tokens.primaryForeground,
    secondary: variant.tokens.secondary,
    secondaryForeground: variant.tokens.secondaryForeground,
    muted: variant.tokens.muted,
    mutedForeground: variant.tokens.mutedForeground,
    accent: variant.tokens.accent,
    accentForeground: variant.tokens.accentForeground,
    destructive: variant.tokens.destructive,
    border: variant.tokens.border,
    input: variant.tokens.input,
    ring: variant.tokens.ring,
    sidebar: variant.tokens.sidebar,
    sidebarForeground: variant.tokens.sidebarForeground,
    sidebarPrimary: variant.tokens.sidebarPrimary,
    sidebarPrimaryForeground: variant.tokens.sidebarPrimaryForeground,
    sidebarAccent: variant.tokens.sidebarAccent,
    sidebarAccentForeground: variant.tokens.sidebarAccentForeground,
    sidebarBorder: variant.tokens.sidebarBorder,
    sidebarRing: variant.tokens.sidebarRing,
    chart1: variant.tokens.chart1,
    chart2: variant.tokens.chart2,
    chart3: variant.tokens.chart3,
    chart4: variant.tokens.chart4,
    chart5: variant.tokens.chart5,
  },
  canvas: convertCanvas(variant.background),
  typography: {
    uiFontFamily: typography.uiFontFamily,
    uiFontFallbacks: [...builtInVixlTheme.variants[kind].typography.uiFontFallbacks],
    monoFontFamily: typography.monoFontFamily,
    monoFontFallbacks: [...builtInVixlTheme.variants[kind].typography.monoFontFallbacks],
    uiFontSize: typography.uiFontSize,
    editorFontSize: typography.editorFontSize,
  },
  editor: {
    ...variant.editor,
    ...widgetColorDefaults(kind),
  },
})

/**
 * Convert a validated shareable file payload (`@/schemas/appearance/theme-file`)
 * into the runtime domain definition used by the resolver and CSS runtime.
 * Widget colors and font fallback stacks are filled from the built-in theme
 * because the shareable format does not carry them.
 */
export const themeFilePayloadToThemeDefinition = (
  payload: ThemeFilePayload,
): VixlThemeDefinition => ({
  id: payload.id,
  name: payload.name,
  version: payload.version,
  variants: {
    light: convertVariant(payload.variants.light, payload.typography, 'light'),
    dark: convertVariant(payload.variants.dark, payload.typography, 'dark'),
  },
})

/** Parse one untrusted library entry in either accepted storage shape. */
const parseLibraryEntry = (entry: unknown): VixlThemeDefinition | null => {
  const domain = parseThemeDefinition(entry)
  if (domain.success) {
    return domain.data
  }

  // Interop: entries persisted by the shareable-file pipeline use the file
  // format shape; convert them instead of dropping them.
  const file = themeFilePayloadSchema.safeParse(entry)
  if (file.success && file.data.id !== BUILTIN_VIXL_THEME_ID) {
    return themeFilePayloadToThemeDefinition(file.data)
  }

  return null
}

/**
 * Defensively sanitize an untrusted theme library value: drop invalid or
 * duplicate entries, cap the library size, and keep the original order.
 * Invalid entries are removed rather than failing the whole settings parse.
 */
export const sanitizeThemeLibrary = (raw: unknown): VixlThemeDefinition[] => {
  if (!Array.isArray(raw)) {
    return []
  }

  const seen = new Set<string>()
  const library: VixlThemeDefinition[] = []

  for (const entry of raw) {
    if (library.length >= THEME_LIBRARY_MAX_SIZE) {
      break
    }
    const theme = parseLibraryEntry(entry)
    if (!theme) {
      continue
    }
    if (seen.has(theme.id)) {
      continue
    }
    seen.add(theme.id)
    library.push(theme)
  }

  return library
}

export const resolveThemeById = (
  library: readonly VixlThemeDefinition[],
  themeId: string | undefined,
): VixlThemeDefinition | null => {
  if (!themeId || themeId === BUILTIN_VIXL_THEME_ID) {
    return null
  }
  return library.find((theme) => theme.id === themeId) ?? null
}

/**
 * Resolve the active custom theme definition, falling back to the built-in
 * theme when the stored active id is missing, malformed, or dangling
 * (for example after the active theme was deleted elsewhere).
 */
export const resolveActiveCustomTheme = (
  library: readonly VixlThemeDefinition[],
  activeThemeId: unknown,
): VixlThemeDefinition | null => {
  if (typeof activeThemeId !== 'string' || activeThemeId.length === 0) {
    return null
  }
  return resolveThemeById(library, activeThemeId)
}

/** Normalize a user-facing theme name into a valid theme id slug. */
export const slugifyThemeName = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return slug.length > 0 ? slug : 'custom-theme'
}

/**
 * Return a collision-safe id for a theme being added to the library.
 * The display name is preserved; only the id is rewritten on collision.
 */
export const resolveCollisionSafeThemeId = (
  desiredId: string,
  existingIds: readonly string[],
): string => {
  const taken = new Set(existingIds)
  taken.add(BUILTIN_VIXL_THEME_ID)
  if (!taken.has(desiredId)) {
    return desiredId
  }
  const base = desiredId.slice(0, 56).replace(/-+$/g, '')
  if (base !== desiredId && !taken.has(base)) {
    return base
  }

  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!taken.has(candidate)) {
      return candidate
    }
  }

  return `${base}-${Date.now().toString(36)}`
}

/**
 * Clean stored appearance theme state: drop invalid library entries, cap the
 * library, and remove a dangling active id so the resolver falls back to the
 * built-in theme. Returns the cleaned values to write back into settings.
 */
export const cleanAppearanceThemeState = (
  rawLibrary: unknown,
  rawActiveId: unknown,
): { themeLibrary: VixlThemeDefinition[]; activeThemeId: string | undefined } => {
  const themeLibrary = sanitizeThemeLibrary(rawLibrary)
  const activeId = resolveActiveCustomTheme(themeLibrary, rawActiveId)
  return {
    themeLibrary,
    activeThemeId: activeId?.id,
  }
}
