import { describe, expect, it } from 'vitest'
import { builtInVixlTheme } from '@/constants/appearance/built-in-theme'
import type { VixlThemeDefinition } from '@/types/appearance/theme'
import { useAppearanceEditor } from '@/components/settings/appearance/use-appearance-editor'

const makeTheme = (overrides: Partial<VixlThemeDefinition> = {}): VixlThemeDefinition => ({
  ...structuredClone(builtInVixlTheme),
  id: 'my-theme',
  name: 'My Theme',
  version: 1,
  ...overrides,
})

describe('use-appearance-editor', () => {
  it('creates a draft from a source theme with a provided id', () => {
    const editor = useAppearanceEditor()
    editor.beginCreate(builtInVixlTheme, 'untitled-theme', 'dark')

    expect(editor.isEditing.value).toBe(true)
    expect(editor.mode.value).toBe('create')
    expect(editor.draft.value?.id).toBe('untitled-theme')
    expect(editor.draft.value?.name).toBe('Untitled theme')
    // Editing target defaults to the provided (resolved) variant.
    expect(editor.editingVariant.value).toBe('dark')
    // A create draft starts clean; typing dirties it.
    expect(editor.isDirty.value).toBe(false)
    expect(editor.isDraftValid.value).toBe(true)
  })

  it('edits saved themes in place but copies the built-in theme', () => {
    const editor = useAppearanceEditor()

    editor.beginEdit(makeTheme(), 'copy-of-my-theme')
    expect(editor.mode.value).toBe('edit')
    expect(editor.draft.value?.id).toBe('my-theme')
    editor.cancel()

    editor.beginEdit(builtInVixlTheme, 'copy-of-default')
    expect(editor.mode.value).toBe('create')
    expect(editor.draft.value?.id).toBe('copy-of-default')
  })

  it('duplicates a theme preserving values but not identity', () => {
    const editor = useAppearanceEditor()
    editor.beginDuplicate(makeTheme(), 'my-theme-copy')

    expect(editor.mode.value).toBe('duplicate')
    expect(editor.draft.value?.id).toBe('my-theme-copy')
    expect(editor.draft.value?.name).toBe('My Theme copy')
    expect(editor.draft.value?.variants.light.colors).toEqual(
      builtInVixlTheme.variants.light.colors,
    )
  })

  it('tracks dirty state against the baseline', () => {
    const editor = useAppearanceEditor()
    editor.beginEdit(makeTheme(), 'unused')

    expect(editor.isDirty.value).toBe(false)
    editor.setToken('primary', '#112233')
    expect(editor.isDirty.value).toBe(true)
    expect(editor.draft.value?.variants.light.colors.primary).toBe('#112233')
    // The stored theme is untouched while editing.
    expect(builtInVixlTheme.variants.light.colors.primary).not.toBe('#112233')
  })

  it('marks drafts with invalid colors as invalid', () => {
    const editor = useAppearanceEditor()
    editor.beginEdit(makeTheme(), 'unused')

    expect(editor.isDraftValid.value).toBe(true)
    editor.setToken('background', 'not-a-color')
    expect(editor.isDraftValid.value).toBe(false)
  })

  it('updates typography with schema-safe clamping', () => {
    const editor = useAppearanceEditor()
    editor.beginEdit(makeTheme(), 'unused')

    editor.setTypography({ uiFontSize: 40 })
    expect(editor.draft.value?.variants.light.typography.uiFontSize).toBe(32)
    editor.setTypography({ editorFontSize: 14.4 })
    expect(editor.draft.value?.variants.light.typography.editorFontSize).toBe(14.5)
  })

  it('normalizes structured gradient canvases', () => {
    const editor = useAppearanceEditor()
    editor.beginEdit(makeTheme(), 'unused')

    editor.setCanvas({
      type: 'gradient',
      angle: 450,
      stops: [
        { color: '#ffffff', position: 100 },
        { color: '#000000', position: 0 },
      ],
    })
    expect(editor.draft.value?.variants.light.canvas).toEqual({
      type: 'gradient',
      angle: 90,
      stops: [
        { color: '#000000', position: 0 },
        { color: '#ffffff', position: 100 },
      ],
    })
  })

  it('switches the editing variant and resets it to built-in defaults', () => {
    const editor = useAppearanceEditor()
    editor.beginEdit(makeTheme(), 'unused')

    // Edit the light variant, then switch targets.
    editor.setToken('primary', '#010203')
    editor.setVariant('dark')
    expect(editor.editingVariant.value).toBe('dark')

    editor.resetVariant()
    // Reset only touches the currently edited (dark) variant.
    expect(editor.draft.value?.variants.dark.colors).toEqual(
      builtInVixlTheme.variants.dark.colors,
    )
    // The untouched variant keeps its edits.
    editor.setVariant('light')
    expect(editor.draft.value?.variants.light.colors.primary).toBe('#010203')
  })

  it('renames drafts within the schema limit', () => {
    const editor = useAppearanceEditor()
    editor.beginEdit(makeTheme(), 'unused')

    editor.rename('  Night\tOwl  ')
    expect(editor.draft.value?.name).toBe('Night Owl')

    editor.rename('x'.repeat(200))
    expect((editor.draft.value?.name.length ?? 0)).toBeLessThanOrEqual(64)
  })

  it('clears draft state on cancel', () => {
    const editor = useAppearanceEditor()
    editor.beginEdit(makeTheme(), 'unused')
    editor.cancel()

    expect(editor.isEditing.value).toBe(false)
    expect(editor.draft.value).toBeNull()
    expect(editor.isDirty.value).toBe(false)
  })
})
