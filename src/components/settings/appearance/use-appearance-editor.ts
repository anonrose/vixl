import { computed, ref } from 'vue'
import {
  clampAngle,
  clampFontSize,
  clampStopPosition,
  cloneThemeDefinition,
  sortStops,
  isValidHexColor,
  builtInVariant,
} from './appearance-ui'
import { BUILTIN_VIXL_THEME_ID, VIXL_THEME_FORMAT_VERSION } from '@/types/appearance/theme'
import type {
  VixlThemeCanvasBackground,
  VixlThemeDefinition,
  VixlThemeSemanticTokens,
  VixlThemeTypography,
  VixlThemeVariantKind,
} from '@/types/appearance/theme'
import { THEME_NAME_MAX_LENGTH } from '@/schemas/appearance/theme'

export type AppearanceEditorMode = 'create' | 'edit' | 'duplicate' | null

const sanitizeName = (name: string): string => {
  const trimmed = name.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  return trimmed.slice(0, THEME_NAME_MAX_LENGTH)
}

/**
 * Draft state for editing one theme variant. Experimental edits stay in the
 * draft until Apply/Save commits them to the theme library, so typing never
 * writes settings. The draft also feeds the runtime live preview.
 */
export const useAppearanceEditor = () => {
  const draft = ref<VixlThemeDefinition | null>(null)
  const baseline = ref<VixlThemeDefinition | null>(null)
  const editingVariant = ref<VixlThemeVariantKind>('light')
  const mode = ref<AppearanceEditorMode>(null)

  const isEditing = computed(() => draft.value !== null)

  const isDirty = computed(() => {
    if (!draft.value || !baseline.value) {
      return false
    }
    return JSON.stringify(draft.value) !== JSON.stringify(baseline.value)
  })

  /** Draft passes the strict schema validation. */
  const isDraftValid = computed(() => {
    if (!draft.value) {
      return false
    }
    for (const variant of ['light', 'dark'] as const) {
      const variantTheme = draft.value.variants[variant]
      if (!isValidHexColor(variantTheme.colors.background)) {
        return false
      }
      if (!isValidHexColor(variantTheme.colors.foreground)) {
        return false
      }
    }
    return sanitizeName(draft.value.name).length > 0
  })

  const draftVariant = computed(() =>
    draft.value ? draft.value.variants[editingVariant.value] : null,
  )

  const begin = (
    next: VixlThemeDefinition,
    editorMode: Exclude<AppearanceEditorMode, null>,
    variant: VixlThemeVariantKind,
  ): void => {
    baseline.value = cloneThemeDefinition(next)
    draft.value = cloneThemeDefinition(next)
    editingVariant.value = variant
    mode.value = editorMode
  }

  /** Starts a fresh theme derived from an existing theme's current values. */
  const beginCreate = (
    source: VixlThemeDefinition,
    id: string,
    variant: VixlThemeVariantKind = 'light',
  ): void => {
    begin(
      { ...cloneThemeDefinition(source), id, name: 'Untitled theme', version: VIXL_THEME_FORMAT_VERSION },
      'create',
      variant,
    )
  }

  /** Edits a saved theme in place. Editing the built-in theme creates a copy. */
  const beginEdit = (
    theme: VixlThemeDefinition,
    idForCopy: string,
    variant: VixlThemeVariantKind = 'light',
  ): void => {
    if (theme.id === BUILTIN_VIXL_THEME_ID) {
      beginCreate(theme, idForCopy, variant)
      return
    }
    begin(theme, 'edit', variant)
  }

  const beginDuplicate = (
    theme: VixlThemeDefinition,
    id: string,
    variant: VixlThemeVariantKind = 'light',
  ): void => {
    const copy = cloneThemeDefinition(theme)
    copy.id = id
    copy.name = `${theme.name} copy`.slice(0, THEME_NAME_MAX_LENGTH)
    copy.version = VIXL_THEME_FORMAT_VERSION
    begin(copy, 'duplicate', variant)
  }

  const cancel = (): void => {
    draft.value = null
    baseline.value = null
    mode.value = null
  }

  const setVariant = (variant: VixlThemeVariantKind): void => {
    editingVariant.value = variant
  }

  const rename = (name: string): void => {
    if (!draft.value) {
      return
    }
    draft.value = { ...draft.value, name: sanitizeName(name) }
  }

  const setToken = (key: keyof VixlThemeSemanticTokens, value: string): void => {
    const variantTheme = draft.value?.variants[editingVariant.value]
    if (!variantTheme) {
      return
    }
    variantTheme.colors = { ...variantTheme.colors, [key]: value.trim() }
  }

  const setTypography = (patch: Partial<VixlThemeTypography>): void => {
    if (!draft.value) {
      return
    }
    const typography = draft.value.variants[editingVariant.value].typography
    draft.value.variants[editingVariant.value].typography = {
      ...typography,
      ...patch,
      uiFontSize:
        patch.uiFontSize !== undefined
          ? clampFontSize(patch.uiFontSize)
          : typography.uiFontSize,
      editorFontSize:
        patch.editorFontSize !== undefined
          ? clampFontSize(patch.editorFontSize)
          : typography.editorFontSize,
    }
  }

  const setCanvas = (canvas: VixlThemeCanvasBackground): void => {
    const variantTheme = draft.value?.variants[editingVariant.value]
    if (!variantTheme) {
      return
    }
    if (canvas.type === 'gradient') {
      canvas = {
        ...canvas,
        angle: clampAngle(canvas.angle),
        stops: sortStops(
          canvas.stops.map((stop) => ({ ...stop, position: clampStopPosition(stop.position) })),
        ),
      }
    }
    variantTheme.canvas = canvas
  }

  /** Restores one variant of the draft to the built-in defaults. */
  const resetVariant = (): void => {
    if (!draft.value) {
      return
    }
    const defaults = structuredClone(builtInVariant(editingVariant.value))
    draft.value.variants[editingVariant.value] = defaults
  }

  return {
    draft,
    baseline,
    editingVariant,
    mode,
    isEditing,
    isDirty,
    isDraftValid,
    draftVariant,
    beginCreate,
    beginEdit,
    beginDuplicate,
    begin,
    cancel,
    setVariant,
    rename,
    setToken,
    setTypography,
    setCanvas,
    resetVariant,
  }
}
