import { z } from 'zod'
import { BUILTIN_VIXL_THEME_ID, VIXL_THEME_FORMAT_VERSION } from '@/types/appearance/theme'

/**
 * Strict import/export schema for shareable Vixl themes.
 *
 * Rejects unknown fields, unsupported versions, malformed identifiers, colors
 * outside the safe hex forms, unsafe font values, and out-of-range sizes,
 * angles, and gradient stops. No raw CSS, URLs, HTML, or font sources.
 */

export const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/

export const THEME_NAME_MAX_LENGTH = 64
export const THEME_FONT_FAMILY_MAX_LENGTH = 200
export const THEME_FONT_FALLBACK_MAX_COUNT = 8
export const THEME_FONT_SIZE_MIN = 8
export const THEME_FONT_SIZE_MAX = 32
export const THEME_GRADIENT_ANGLE_MAX = 360
export const THEME_GRADIENT_STOP_MIN = 2
export const THEME_GRADIENT_STOP_MAX = 5
export const THEME_GRADIENT_POSITION_MAX = 100

/**
 * Authoritative library cap. The personal theme library (`appearance.themeLibrary`)
 * never holds more themes than this, whether they were created in the editor or
 * imported from shareable files. The shareable file schema in
 * `@/schemas/appearance/theme-file` reuses these limits so imports and exports
 * accept exactly the values the runtime domain model accepts.
 */
export const THEME_LIBRARY_MAX_SIZE = 50

/** Safe hex color forms only: #RGB, #RGBA, #RRGGBB, #RRGGBBAA. */
export const THEME_HEX_COLOR_PATTERN =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/**
 * Font family names are data, not CSS: block characters that would allow
 * CSS injection (`;`, `{`, `}`, parentheses, slashes, colons, etc.).
 */
export const THEME_FONT_FAMILY_PATTERN = /^[A-Za-z0-9 _'"+.,-]+$/

const hexColorSchema = z
  .string()
  .regex(THEME_HEX_COLOR_PATTERN, 'must be a hex color (#RGB, #RGBA, #RRGGBB, or #RRGGBBAA)')

const fontFamilySchema = z
  .string()
  .min(1)
  .max(THEME_FONT_FAMILY_MAX_LENGTH)
  .regex(THEME_FONT_FAMILY_PATTERN, 'contains characters not allowed in font family names')

const fontSizeSchema = z
  .number()
  .min(THEME_FONT_SIZE_MIN)
  .max(THEME_FONT_SIZE_MAX)
  .refine((value) => Number.isFinite(value) && (value * 2) % 1 === 0, {
    message: `must be a multiple of 0.5 between ${THEME_FONT_SIZE_MIN} and ${THEME_FONT_SIZE_MAX}`,
  })

const gradientStopSchema = z
  .object({
    color: hexColorSchema,
    position: z.number().min(0).max(THEME_GRADIENT_POSITION_MAX),
  })
  .strict()

const canvasBackgroundSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('solid'),
      color: hexColorSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('gradient'),
      angle: z.number().min(0).max(THEME_GRADIENT_ANGLE_MAX),
      stops: z
        .array(gradientStopSchema)
        .min(THEME_GRADIENT_STOP_MIN)
        .max(THEME_GRADIENT_STOP_MAX)
        .refine(
          (stops) =>
            stops.every(
              (stop, index) =>
                index === 0 || stop.position >= (stops[index - 1]?.position ?? 0),
            ),
          { message: 'gradient stops must be sorted by ascending position' },
        ),
      fallback: hexColorSchema.optional(),
    })
    .strict(),
])

const typographySchema = z
  .object({
    uiFontFamily: fontFamilySchema,
    uiFontFallbacks: z.array(fontFamilySchema).max(THEME_FONT_FALLBACK_MAX_COUNT),
    monoFontFamily: fontFamilySchema,
    monoFontFallbacks: z.array(fontFamilySchema).max(THEME_FONT_FALLBACK_MAX_COUNT),
    uiFontSize: fontSizeSchema,
    editorFontSize: fontSizeSchema,
  })
  .strict()

const editorPaletteSchema = z
  .object({
    background: hexColorSchema,
    foreground: hexColorSchema,
    comment: hexColorSchema,
    keyword: hexColorSchema,
    keywordAccent: hexColorSchema,
    string: hexColorSchema,
    number: hexColorSchema,
    function: hexColorSchema,
    type: hexColorSchema,
    variable: hexColorSchema,
    constant: hexColorSchema,
    operator: hexColorSchema,
    invalid: hexColorSchema,
    regexp: hexColorSchema,
    attribute: hexColorSchema,
    tag: hexColorSchema,
    escape: hexColorSchema,
    hoverWidgetBackground: hexColorSchema,
    hoverWidgetForeground: hexColorSchema,
    hoverWidgetBorder: hexColorSchema,
    suggestWidgetBackground: hexColorSchema,
    suggestWidgetForeground: hexColorSchema,
    suggestWidgetBorder: hexColorSchema,
  })
  .strict()

const semanticTokensSchema = z
  .object({
    background: hexColorSchema,
    foreground: hexColorSchema,
    card: hexColorSchema,
    cardForeground: hexColorSchema,
    popover: hexColorSchema,
    popoverForeground: hexColorSchema,
    primary: hexColorSchema,
    primaryForeground: hexColorSchema,
    secondary: hexColorSchema,
    secondaryForeground: hexColorSchema,
    muted: hexColorSchema,
    mutedForeground: hexColorSchema,
    accent: hexColorSchema,
    accentForeground: hexColorSchema,
    destructive: hexColorSchema,
    border: hexColorSchema,
    input: hexColorSchema,
    ring: hexColorSchema,
    sidebar: hexColorSchema,
    sidebarForeground: hexColorSchema,
    sidebarPrimary: hexColorSchema,
    sidebarPrimaryForeground: hexColorSchema,
    sidebarAccent: hexColorSchema,
    sidebarAccentForeground: hexColorSchema,
    sidebarBorder: hexColorSchema,
    sidebarRing: hexColorSchema,
    chart1: hexColorSchema,
    chart2: hexColorSchema,
    chart3: hexColorSchema,
    chart4: hexColorSchema,
    chart5: hexColorSchema,
  })
  .strict()

const themeVariantSchema = z
  .object({
    colors: semanticTokensSchema,
    canvas: canvasBackgroundSchema,
    typography: typographySchema,
    editor: editorPaletteSchema,
  })
  .strict()

/**
 * Runtime domain schema for a theme stored in the personal settings library
 * (`appearance.themeLibrary`). The versioned shareable file format lives in
 * `@/schemas/appearance/theme-file`; imported file payloads are converted to
 * this domain shape by `themeFilePayloadToThemeDefinition`.
 */
export const themeDefinitionSchema = z
  .object({
    id: z
      .string()
      .regex(THEME_ID_PATTERN, 'must be 2-64 chars of a-z, 0-9, and hyphens, starting alphanumeric')
      .refine((id) => id !== BUILTIN_VIXL_THEME_ID, {
        message: 'the built-in theme id is reserved',
      }),
    name: z.string().min(1).max(THEME_NAME_MAX_LENGTH),
    version: z.literal(VIXL_THEME_FORMAT_VERSION),
    variants: z
      .object({
        light: themeVariantSchema,
        dark: themeVariantSchema,
      })
      .strict(),
  })
  .strict()

export type ThemeDefinitionParsed = z.infer<typeof themeDefinitionSchema>

/**
 * Shared font-size rule for both the runtime domain model and the shareable
 * file format (see `@/schemas/appearance/theme-file`).
 */
export const themeFontSizeSchema = fontSizeSchema

export const formatThemeSchemaError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'theme'
      return `${path}: ${issue.message}`
    })
    .join('; ')

export const parseThemeDefinition = (
  raw: unknown,
): { success: true; data: ThemeDefinitionParsed } | { success: false; error: string } => {
  const parsed = themeDefinitionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: formatThemeSchemaError(parsed.error) }
  }
  return { success: true, data: parsed.data }
}
