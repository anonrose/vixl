import {
  THEME_EDITOR_PALETTE_KEYS,
  THEME_FILE_EXTENSION,
  THEME_FILE_FORMAT,
  THEME_FILE_VERSION,
  THEME_VARIANT_TOKEN_KEYS,
  themeFilePayloadSchema,
} from '@/schemas/appearance/theme-file'
import type {
  ThemeEditorPalette,
  ThemeFilePayload,
  ThemeFileVariantKey,
  ThemeTokenMap,
} from '@/schemas/appearance/theme-file'
import type {
  VixlThemeCanvasBackground,
  VixlThemeDefinition,
  VixlThemeVariant,
} from '@/types/appearance/theme'

/**
 * Shared vocabulary and pure helpers for the shareable theme file format:
 * error/result types, canonical serialization, runtime-state stripping,
 * user-facing summaries, collision-safe ids, and sanitized export filenames.
 * No I/O — the flows live in `theme-sharing`.
 */

export class ThemeFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ThemeFileError'
  }
}

export type ThemeOperationResult<T> =
  | { status: 'canceled' }
  | { status: 'error'; message: string }
  | ({ status: 'ok' } & T)

export const formatSchemaIssue = (error: {
  issues: Array<{ message: string; path: Array<PropertyKey> }>
}): string => {
  const issue = error.issues[0]
  if (!issue) {
    return 'Theme file is invalid'
  }
  const path = issue.path.length > 0 ? ` at '${issue.path.join('.')}'` : ''
  return `Theme file is invalid${path}: ${issue.message}`
}

/**
 * Canonical serializer: fixed key order, schema-versioned envelope, no
 * runtime-only state, stable pretty printing. Export -> import round trips
 * produce byte-identical files.
 */
export const serializeThemeFile = (theme: ThemeFilePayload): string => {
  const canonicalTokenMap = (tokens: ThemeTokenMap): Record<string, string> =>
    Object.fromEntries(THEME_VARIANT_TOKEN_KEYS.map((key) => [key, tokens[key]]))

  const canonicalEditorPalette = (editor: ThemeEditorPalette): Record<string, string> =>
    Object.fromEntries(THEME_EDITOR_PALETTE_KEYS.map((key) => [key, editor[key]]))

  const canonicalBackground = (variant: ThemeFilePayload['variants'][ThemeFileVariantKey]) => {
    const background = variant.background
    if (background.kind === 'solid') {
      return { kind: 'solid', color: background.color }
    }
    return {
      kind: 'gradient',
      ...(background.fallback !== undefined ? { fallback: background.fallback } : {}),
      angle: background.angle,
      stops: background.stops.map((stop) => ({ color: stop.color, position: stop.position })),
    }
  }

  const canonicalVariant = (variant: ThemeFilePayload['variants'][ThemeFileVariantKey]) => ({
    tokens: canonicalTokenMap(variant.tokens),
    background: canonicalBackground(variant),
    editor: canonicalEditorPalette(variant.editor),
  })

  const payload = {
    format: THEME_FILE_FORMAT,
    version: THEME_FILE_VERSION,
    id: theme.id,
    name: theme.name,
    typography: {
      uiFontFamily: theme.typography.uiFontFamily,
      monoFontFamily: theme.typography.monoFontFamily,
      uiFontSize: theme.typography.uiFontSize,
      editorFontSize: theme.typography.editorFontSize,
    },
    variants: {
      light: canonicalVariant(theme.variants.light),
      dark: canonicalVariant(theme.variants.dark),
    },
  }

  return `${JSON.stringify(payload, null, 2)}\n`
}

/**
 * Validate a theme against the strict file schema and return a data-only
 * shareable copy with runtime-only state stripped.
 */
export const toShareableThemeFile = (theme: ThemeFilePayload): ThemeFilePayload => {
  // Strip runtime-only state (any non-file fields) before strict validation.
  const candidate = {
    format: THEME_FILE_FORMAT,
    version: THEME_FILE_VERSION,
    id: theme.id,
    name: theme.name,
    typography: theme.typography,
    variants: theme.variants,
  }
  const parsed = themeFilePayloadSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new ThemeFileError(formatSchemaIssue(parsed.error))
  }
  return parsed.data
}

const fileBackgroundFromCanvas = (
  canvas: VixlThemeCanvasBackground,
): ThemeFilePayload['variants']['light']['background'] => {
  if (canvas.type === 'solid') {
    return { kind: 'solid', color: canvas.color }
  }
  return {
    kind: 'gradient',
    angle: canvas.angle,
    stops: canvas.stops.map((stop) => ({ color: stop.color, position: stop.position })),
    ...(canvas.fallback !== undefined ? { fallback: canvas.fallback } : {}),
  }
}

const fileVariantFromDomain = (
  variant: VixlThemeVariant,
): ThemeFilePayload['variants']['light'] => ({
  tokens: { ...variant.colors },
  background: fileBackgroundFromCanvas(variant.canvas),
  // Widget colors are runtime-only and restored from the built-in theme on import.
  editor: Object.fromEntries(
    THEME_EDITOR_PALETTE_KEYS.map((key) => [key, variant.editor[key]]),
  ) as ThemeEditorPalette,
})

/**
 * Explicit adapter from the runtime domain model (`VixlThemeDefinition`) to the
 * shareable file payload so any theme saved in the Appearance editor can be
 * exported. Runtime-only state the file format does not carry (font fallback
 * stacks and editor widget colors) is dropped; the inverse adapter
 * (`themeFilePayloadToThemeDefinition`) restores it from the built-in theme.
 * The file format carries one shared typography block, so the light variant's
 * stack is authoritative.
 */
export const themeDefinitionToThemeFilePayload = (
  theme: VixlThemeDefinition,
): ThemeFilePayload => {
  const { uiFontFamily, monoFontFamily, uiFontSize, editorFontSize } =
    theme.variants.light.typography

  return {
    format: THEME_FILE_FORMAT,
    version: THEME_FILE_VERSION,
    id: theme.id,
    name: theme.name,
    typography: { uiFontFamily, monoFontFamily, uiFontSize, editorFontSize },
    variants: {
      light: fileVariantFromDomain(theme.variants.light),
      dark: fileVariantFromDomain(theme.variants.dark),
    },
  }
}

/** User-facing import/export summary used by the confirmation UI. */
export type ThemeFileSummary = {
  id: string
  name: string
  version: number
  variants: ThemeFileVariantKey[]
  backgrounds: Record<ThemeFileVariantKey, 'solid' | 'gradient'>
  uiFontFamily: string
  monoFontFamily: string
  uiFontSize: number
  editorFontSize: number
  tokenCount: number
}

export const describeThemeFile = (theme: ThemeFilePayload): ThemeFileSummary => {
  const backgroundKind = (variant: ThemeFilePayload['variants'][ThemeFileVariantKey]) =>
    variant.background.kind

  return {
    id: theme.id,
    name: theme.name,
    version: theme.version,
    variants: Object.keys(theme.variants) as ThemeFileVariantKey[],
    backgrounds: {
      light: backgroundKind(theme.variants.light),
      dark: backgroundKind(theme.variants.dark),
    },
    uiFontFamily: theme.typography.uiFontFamily,
    monoFontFamily: theme.typography.monoFontFamily,
    uiFontSize: theme.typography.uiFontSize,
    editorFontSize: theme.typography.editorFontSize,
    tokenCount: THEME_VARIANT_TOKEN_KEYS.length * 2,
  }
}

/**
 * Normalize an imported id on collision while preserving the display name:
 * `sunset` -> `sunset-2`, `sunset-3`, ... (never the reserved built-in id).
 */
export const resolveThemeIdCollision = (
  requestedId: string,
  existingIds: ReadonlySet<string>,
): { id: string; renamedFromId: string | null } => {
  if (!existingIds.has(requestedId)) {
    return { id: requestedId, renamedFromId: null }
  }

  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const suffixText = `-${suffix}`
    const base = requestedId.slice(0, 64 - suffixText.length)
    const candidate = `${base}${suffixText}`
    if (!existingIds.has(candidate)) {
      return { id: candidate, renamedFromId: requestedId }
    }
  }

  throw new ThemeFileError('Could not find a free id for the imported theme')
}

/** Sanitized, cross-platform-safe default filename for theme exports. */
export const sanitizeThemeFilename = (name: string): string => {
  const base = name
    .normalize('NFKD')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 64)
    .trim()
    // Drop control characters by code point so exported filenames stay
    // safe on every platform without a literal control-character regex.
    .split('')
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0
      return codePoint > 0x001f && codePoint !== 0x007f
    })
    .join('')

  const safeBase = base.length > 0 ? base : 'vixl-theme'
  return `${safeBase}${THEME_FILE_EXTENSION}`
}
