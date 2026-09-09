import { z } from 'zod'
import {
  THEME_FONT_FAMILY_MAX_LENGTH,
  THEME_FONT_FAMILY_PATTERN,
  THEME_GRADIENT_ANGLE_MAX,
  THEME_GRADIENT_POSITION_MAX,
  THEME_GRADIENT_STOP_MAX,
  THEME_GRADIENT_STOP_MIN,
  THEME_HEX_COLOR_PATTERN,
  themeFontSizeSchema,
} from './theme'

/**
 * Strict schema for shareable `.vixl-theme.json` files.
 *
 * This is intentionally separate from the runtime theme domain model: it is
 * the versioned on-disk exchange format. Unknown fields, raw CSS, URLs, font
 * sources, and image data are rejected so imported themes stay data-only.
 *
 * Value limits (hex forms, font-family rules, font sizes, gradient bounds,
 * library cap) are the authoritative limits from `./theme` so a theme created
 * in the Appearance editor can always be exported, and every imported file is
 * exactly as strict as the runtime domain schema.
 */

export const THEME_FILE_FORMAT = 'vixl-theme' as const
export const THEME_FILE_VERSION = 1
export const THEME_FILE_EXTENSION = '.vixl-theme.json'
export const THEME_FILE_MAX_BYTES = 1024 * 1024

/** Reserved id for the unstored built-in Vixl default theme. */
export const BUILT_IN_THEME_ID = 'vixl-default'

export const THEME_FILE_NAME_MAX_LENGTH = 64
export const THEME_ID_MAX_LENGTH = 64

/** Safe hex forms: #RGB, #RGBA, #RRGGBB, #RRGGBBAA (shared with the domain schema). */
export const hexColorSchema = z
  .string()
  .regex(THEME_HEX_COLOR_PATTERN, 'Expected a hex color like #1a2b3c')

export const themeIdSchema = z
  .string()
  .max(THEME_ID_MAX_LENGTH)
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'Expected a lowercase slug id like sunset-theme')

const hasControlCharOrAngleBracket = (value: string): boolean => {
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0
    if (codePoint <= 0x001f || codePoint === 0x007f || char === '<' || char === '>') {
      return true
    }
  }
  return false
}

export const themeNameSchema = z
  .string()
  .trim()
  .min(1, 'Theme name is required')
  .max(THEME_FILE_NAME_MAX_LENGTH, `Theme name must be at most ${THEME_FILE_NAME_MAX_LENGTH} characters`)
  .refine((name) => !hasControlCharOrAngleBracket(name), 'Theme name must not contain control characters or angle brackets')

/**
 * Font families are display-name lists only. Quotes, braces, semicolons,
 * `url(`, `var(`, and other CSS escape hatches are rejected.
 */
export const fontFamilySchema = z
  .string()
  .trim()
  .min(1, 'Font family is required')
  .max(THEME_FONT_FAMILY_MAX_LENGTH, `Font family must be at most ${THEME_FONT_FAMILY_MAX_LENGTH} characters`)
  .refine(
    (family) => THEME_FONT_FAMILY_PATTERN.test(family),
    'Font family may only contain letters, digits, spaces, and a small punctuation set',
  )

// Shared bounded font-size rule (8-32, half-point steps) so the Appearance
// editor's clamped values always round-trip through the file format.
export const uiFontSizeSchema = themeFontSizeSchema
export const editorFontSizeSchema = themeFontSizeSchema

export const gradientStopSchema = z
  .object({
    color: hexColorSchema,
    position: z.number().min(0).max(THEME_GRADIENT_POSITION_MAX),
  })
  .strict()

export const themeBackgroundSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('solid'),
      color: hexColorSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('gradient'),
      // The runtime canvas treats the fallback as optional; keep both sides
      // identical so editor-created gradients export unchanged.
      fallback: hexColorSchema.optional(),
      angle: z.number().min(0).max(THEME_GRADIENT_ANGLE_MAX),
      stops: z
        .array(gradientStopSchema)
        .min(THEME_GRADIENT_STOP_MIN, `Gradient needs at least ${THEME_GRADIENT_STOP_MIN} stops`)
        .max(THEME_GRADIENT_STOP_MAX, `Gradient supports at most ${THEME_GRADIENT_STOP_MAX} stops`)
        .refine(
          (stops) =>
            stops.every(
              (stop, index) => index === 0 || stop.position >= (stops[index - 1]?.position ?? 0),
            ),
          'Gradient stops must be sorted by ascending position',
        ),
    })
    .strict(),
])

/** Semantic shadcn-style tokens required for every variant. */
export const THEME_VARIANT_TOKEN_KEYS = [
  'background',
  'foreground',
  'card',
  'cardForeground',
  'popover',
  'popoverForeground',
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'muted',
  'mutedForeground',
  'accent',
  'accentForeground',
  'destructive',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebarForeground',
  'sidebarPrimary',
  'sidebarPrimaryForeground',
  'sidebarAccent',
  'sidebarAccentForeground',
  'sidebarBorder',
  'sidebarRing',
  'chart1',
  'chart2',
  'chart3',
  'chart4',
  'chart5',
] as const

export type ThemeVariantTokenKey = (typeof THEME_VARIANT_TOKEN_KEYS)[number]

const tokenEntries = Object.fromEntries(
  THEME_VARIANT_TOKEN_KEYS.map((key) => [key, hexColorSchema]),
) as Record<ThemeVariantTokenKey, typeof hexColorSchema>

export const themeTokenMapSchema = z.object(tokenEntries).strict()

export type ThemeTokenMap = z.infer<typeof themeTokenMapSchema>

/** Monaco/Shiki editor palette keys matching `VixlSyntaxPalette`. */
export const THEME_EDITOR_PALETTE_KEYS = [
  'background',
  'foreground',
  'comment',
  'keyword',
  'keywordAccent',
  'string',
  'number',
  'function',
  'type',
  'variable',
  'constant',
  'operator',
  'invalid',
  'regexp',
  'attribute',
  'tag',
  'escape',
] as const

export type ThemeEditorPaletteKey = (typeof THEME_EDITOR_PALETTE_KEYS)[number]

const editorPaletteEntries = Object.fromEntries(
  THEME_EDITOR_PALETTE_KEYS.map((key) => [key, hexColorSchema]),
) as Record<ThemeEditorPaletteKey, typeof hexColorSchema>

export const themeEditorPaletteSchema = z.object(editorPaletteEntries).strict()

export type ThemeEditorPalette = z.infer<typeof themeEditorPaletteSchema>

export const themeTypographySchema = z
  .object({
    uiFontFamily: fontFamilySchema,
    monoFontFamily: fontFamilySchema,
    uiFontSize: uiFontSizeSchema,
    editorFontSize: editorFontSizeSchema,
  })
  .strict()

export type ThemeTypography = z.infer<typeof themeTypographySchema>

const themeVariantSchema = z
  .object({
    tokens: themeTokenMapSchema,
    background: themeBackgroundSchema,
    editor: themeEditorPaletteSchema,
  })
  .strict()

export type ThemeVariant = z.infer<typeof themeVariantSchema>

export const themeFilePayloadSchema = z
  .object({
    format: z.literal(THEME_FILE_FORMAT),
    version: z.literal(THEME_FILE_VERSION),
    id: themeIdSchema,
    name: themeNameSchema,
    typography: themeTypographySchema,
    variants: z
      .object({
        light: themeVariantSchema,
        dark: themeVariantSchema,
      })
      .strict(),
  })
  .strict()

export type ThemeFilePayload = z.infer<typeof themeFilePayloadSchema>

export type ThemeFileVariantKey = keyof ThemeFilePayload['variants']
