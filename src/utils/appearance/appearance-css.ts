import { builtInVixlTheme } from '@/constants/appearance/built-in-theme'
import type {
  VixlThemeCanvasBackground,
  VixlThemeSemanticTokens,
  VixlThemeTypography,
} from '@/types/appearance/theme'
import type { EffectiveAppearance } from '@/utils/appearance/resolve-effective-appearance'

/**
 * Runtime CSS application for the effective appearance.
 *
 * Only an allowlist of variables is ever written to
 * `document.documentElement`: the semantic shadcn/Tailwind tokens, the app
 * canvas variables, and the typography variables. Everything else in the
 * cascade is untouched, so cards, popovers, sidebars, inputs, and readable
 * workbench surfaces keep using their semantic surface tokens.
 */

/** Runtime variables for the app canvas (solid color + optional gradient). */
export const CANVAS_BACKGROUND_VARIABLE = '--vixl-canvas-background'
export const CANVAS_IMAGE_VARIABLE = '--vixl-canvas-image'

/** Runtime typography variables routed through the Tailwind font utilities. */
export const FONT_UI_VARIABLE = '--vixl-font-ui'
export const FONT_MONO_VARIABLE = '--vixl-font-mono'
export const FONT_SIZE_UI_VARIABLE = '--vixl-font-size-ui'

/** Appearance data attributes set on the document element. */
export const APPEARANCE_THEME_ATTRIBUTE = 'data-vixl-appearance-theme'
export const APPEARANCE_MODE_ATTRIBUTE = 'data-vixl-appearance-mode'
export const APPEARANCE_REVISION_ATTRIBUTE = 'data-vixl-appearance-revision'
export const APPEARANCE_PREVIEW_ATTRIBUTE = 'data-vixl-appearance-preview'

/** camelCase domain token key -> kebab-case CSS variable suffix. */
export const semanticTokenVariableName = (key: keyof VixlThemeSemanticTokens): string =>
  `--${key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])(\d)/g, '$1-$2')
    .toLowerCase()}`

export const SEMANTIC_TOKEN_VARIABLE_NAMES: readonly string[] = Object.keys(
  builtInVixlTheme.variants.light.colors,
).map((key) => semanticTokenVariableName(key as keyof VixlThemeSemanticTokens))

/** Every variable the runtime may write or clear. */
export const APPEARANCE_VARIABLE_NAMES: readonly string[] = [
  ...SEMANTIC_TOKEN_VARIABLE_NAMES,
  CANVAS_BACKGROUND_VARIABLE,
  CANVAS_IMAGE_VARIABLE,
  FONT_UI_VARIABLE,
  FONT_MONO_VARIABLE,
  FONT_SIZE_UI_VARIABLE,
]

export type ApplyAppearanceOptions = {
  revision: number
  previewing: boolean
}

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value))

const clampAngle = (value: number): number => Math.min(360, Math.max(0, value))

/**
 * Build the CSS gradient image from a structured canvas background. Returns
 * null for solid backgrounds and for degenerate gradients (fewer than two
 * stops), which callers must handle with the solid fallback color.
 */
export const buildCanvasGradientCss = (
  canvas: VixlThemeCanvasBackground,
): string | null => {
  if (canvas.type !== 'gradient') {
    return null
  }
  const stops = [...canvas.stops].sort((a, b) => a.position - b.position)
  if (stops.length < 2) {
    return null
  }
  const rendered = stops
    .map((stop) => `${stop.color} ${clampPercent(stop.position)}%`)
    .join(', ')
  return `linear-gradient(${clampAngle(canvas.angle)}deg, ${rendered})`
}

/**
 * Resolve the canvas CSS values. Gradients render over the first stop color
 * as the solid fallback so unsupported surfaces never paint transparently.
 */
export const buildCanvasCss = (
  canvas: VixlThemeCanvasBackground,
): { color: string; image: string } => {
  const gradient = buildCanvasGradientCss(canvas)
  if (canvas.type === 'gradient') {
    const stops = [...canvas.stops].sort((a, b) => a.position - b.position)
    const fallback = stops[0]?.color ?? '#ffffff'
    return { color: fallback, image: gradient ?? 'none' }
  }
  return { color: canvas.color, image: 'none' }
}

/** Quote a font family for CSS; bare identifiers stay unquoted. */
const cssFontFamily = (family: string): string => {
  const trimmed = family.trim()
  if (trimmed.length === 0) {
    return ''
  }
  if (/^-?[A-Za-z][A-Za-z0-9-]*$/.test(trimmed)) {
    return trimmed
  }
  return `"${trimmed.replace(/"/g, '\\"')}"`
}

/** Full font-family value: primary family plus explicit fallback stack. */
export const buildFontFamilyCss = (
  typography: Pick<VixlThemeTypography, 'uiFontFamily' | 'uiFontFallbacks'>,
): string =>
  [cssFontFamily(typography.uiFontFamily), ...typography.uiFontFallbacks.map(cssFontFamily)]
    .filter((family) => family.length > 0)
    .join(', ')

const setSemanticTokenVariables = (
  root: HTMLElement,
  colors: VixlThemeSemanticTokens,
): void => {
  for (const key of Object.keys(colors) as Array<keyof VixlThemeSemanticTokens>) {
    root.style.setProperty(semanticTokenVariableName(key), colors[key])
  }
}

const setAppearanceAttributes = (
  root: HTMLElement,
  appearance: EffectiveAppearance,
  options: ApplyAppearanceOptions,
): void => {
  root.setAttribute(APPEARANCE_THEME_ATTRIBUTE, appearance.themeId)
  root.setAttribute(APPEARANCE_MODE_ATTRIBUTE, appearance.variant)
  root.setAttribute(APPEARANCE_REVISION_ATTRIBUTE, String(options.revision))
  if (options.previewing) {
    root.setAttribute(APPEARANCE_PREVIEW_ATTRIBUTE, 'true')
  } else {
    root.removeAttribute(APPEARANCE_PREVIEW_ATTRIBUTE)
  }
}

/**
 * Apply the effective appearance: semantic token variables, typography
 * variables, canvas background/gradient, and the appearance data attributes.
 *
 * When the built-in theme is active (and not previewing), every runtime-owned
 * variable is cleared instead so the CSS-cascade defaults — which match the
 * shipped palette exactly — remain authoritative and no stale custom values
 * survive. Data attributes are still maintained in both cases.
 */
export const applyEffectiveAppearance = (
  root: HTMLElement,
  appearance: EffectiveAppearance,
  options: ApplyAppearanceOptions,
): void => {
  if (appearance.builtIn && !options.previewing) {
    clearAppearanceVariables(root)
  } else {
    setSemanticTokenVariables(root, appearance.colors)

    const canvas = buildCanvasCss(appearance.canvas)
    root.style.setProperty(CANVAS_BACKGROUND_VARIABLE, canvas.color)
    root.style.setProperty(CANVAS_IMAGE_VARIABLE, canvas.image)

    root.style.setProperty(FONT_UI_VARIABLE, buildFontFamilyCss(appearance.typography))
    root.style.setProperty(FONT_MONO_VARIABLE, buildFontFamilyCss({
      uiFontFamily: appearance.typography.monoFontFamily,
      uiFontFallbacks: appearance.typography.monoFontFallbacks,
    }))
    root.style.setProperty(FONT_SIZE_UI_VARIABLE, `${appearance.typography.uiFontSize}px`)
  }

  setAppearanceAttributes(root, appearance, options)
}

/**
 * Clear every runtime-owned variable. Used when returning to the built-in
 * theme so the CSS-cascade defaults (which match the shipped palette exactly)
 * remain authoritative and no stale custom values survive.
 */
export const clearAppearanceVariables = (root: HTMLElement): void => {
  for (const variable of APPEARANCE_VARIABLE_NAMES) {
    root.style.removeProperty(variable)
  }
}

/** Remove the appearance data attributes (runtime teardown). */
export const clearAppearanceAttributes = (root: HTMLElement): void => {
  root.removeAttribute(APPEARANCE_THEME_ATTRIBUTE)
  root.removeAttribute(APPEARANCE_MODE_ATTRIBUTE)
  root.removeAttribute(APPEARANCE_REVISION_ATTRIBUTE)
  root.removeAttribute(APPEARANCE_PREVIEW_ATTRIBUTE)
}
