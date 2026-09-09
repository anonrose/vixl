import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockTauriCore } from '../../test-utils/mocks/tauri-core'
import {
  describeThemeFile,
  exportThemeToFile,
  importThemeFromFile,
  parseThemeFileText,
  resolveThemeIdCollision,
  sanitizeThemeFilename,
  serializeThemeFile,
  themeDefinitionToThemeFilePayload,
  ThemeFileError,
  toShareableThemeFile,
} from '@/services/appearance/theme-sharing'
import { builtInVixlTheme } from '@/constants/appearance/built-in-theme'
import type { VixlThemeDefinition } from '@/types/appearance/theme'
import {
  ACTIVE_THEME_SETTINGS_KEY,
  buildThemeImportSettingsPatch,
  defaultThemePersistenceAdapter,
  importAndPersistTheme,
  persistThemeImport,
  THEME_LIBRARY_SETTINGS_KEY,
} from '@/services/appearance/theme-persistence'
import type { ThemeFilePayload } from '@/schemas/appearance/theme-file'
import {
  THEME_FILE_EXTENSION,
  THEME_FILE_MAX_BYTES,
  THEME_VARIANT_TOKEN_KEYS,
} from '@/schemas/appearance/theme-file'

const { invoke, openDialog, saveDialog } = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>(),
  openDialog: vi.fn<() => Promise<unknown>>(),
  saveDialog: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openDialog,
  save: saveDialog,
}))

vi.mock('@tauri-apps/api/core', () => mockTauriCore({ invoke }))

const setTauriWindow = (): void => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: {},
    configurable: true,
  })
}

// Deterministic theme factory: every color slot gets a unique 6-digit hex.
const validTheme = (): ThemeFilePayload => {
  const color = (index: number): string =>
    `#${(0x100000 + index).toString(16).slice(-6).padStart(6, '0')}`

  const tokenKeys = [
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

  const editorKeys = [
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

  const makeVariant = (offset: number) => ({
    tokens: Object.fromEntries(
      tokenKeys.map((key, i) => [key, color(offset + i)]),
    ) as ThemeFilePayload['variants']['light']['tokens'],
    background: {
      kind: 'gradient' as const,
      fallback: color(offset + 40),
      angle: 135,
      stops: [
        { color: color(offset + 41), position: 0 },
        { color: color(offset + 42), position: 50 },
        { color: color(offset + 43), position: 100 },
      ],
    },
    editor: Object.fromEntries(
      editorKeys.map((key, i) => [key, color(offset + 100 + i)]),
    ) as ThemeFilePayload['variants']['light']['editor'],
  })

  return {
    format: 'vixl-theme',
    version: 1,
    id: 'sunset',
    name: 'Sunset',
    typography: {
      uiFontFamily: 'Inter Variable, system-ui',
      monoFontFamily: 'JetBrains Mono, monospace',
      uiFontSize: 13,
      editorFontSize: 13,
    },
    variants: {
      light: makeVariant(0),
      dark: makeVariant(200),
    },
  }
}

const serializeForTest = (theme: ThemeFilePayload): string =>
  JSON.stringify(
    {
      ...theme,
      variants: Object.fromEntries(
        Object.entries(theme.variants).map(([key, variant]) => [
          key,
          { ...variant, tokens: { ...variant.tokens }, editor: { ...variant.editor } },
        ]),
      ),
    },
    null,
    2,
  )

type GradientBackground = Extract<
  ThemeFilePayload['variants']['light']['background'],
  { kind: 'gradient' }
>

const withMutatedGradient = (
  mutate: (gradient: GradientBackground) => void,
): ThemeFilePayload => {
  const theme = validTheme()
  const gradient = theme.variants.light.background as GradientBackground
  mutate(gradient)
  return theme
}

describe('theme-sharing filename sanitization', () => {
  it('appends the shareable extension to plain names', () => {
    expect(sanitizeThemeFilename('Sunset')).toBe('Sunset.vixl-theme.json')
  })

  it('strips path separators, illegal characters, and control characters', () => {
    expect(sanitizeThemeFilename('../../etc/passwd')).toBe('etcpasswd.vixl-theme.json')
    expect(sanitizeThemeFilename('my:theme*name?')).toBe('mythemename.vixl-theme.json')
    expect(sanitizeThemeFilename('bad\u0000name\u001f')).toBe('badname.vixl-theme.json')
  })

  it('trims leading/trailing dots and whitespace (Windows-safe)', () => {
    expect(sanitizeThemeFilename('  ..hidden theme.. ')).toBe('hidden theme.vixl-theme.json')
  })

  it('falls back when nothing remains and caps the length', () => {
    expect(sanitizeThemeFilename('///')).toBe('vixl-theme.vixl-theme.json')
    const long = sanitizeThemeFilename('x'.repeat(200))
    expect(long.length).toBe(64 + THEME_FILE_EXTENSION.length)
    expect(long.startsWith('x')).toBe(true)
  })
})

describe('theme id collision handling', () => {
  it('keeps the id when free', () => {
    expect(resolveThemeIdCollision('sunset', new Set())).toEqual({
      id: 'sunset',
      renamedFromId: null,
    })
  })

  it('suffices -2, -3 on collision and reports the rename', () => {
    const existing = new Set(['sunset', 'sunset-2'])
    expect(resolveThemeIdCollision('sunset', existing)).toEqual({
      id: 'sunset-3',
      renamedFromId: 'sunset',
    })
  })

  it('never produces ids longer than 64 characters', () => {
    const longId = 'a'.repeat(64)
    const existing = new Set([longId])
    const resolved = resolveThemeIdCollision(longId, existing)
    expect(resolved.id.length).toBeLessThanOrEqual(64)
    expect(resolved.id.endsWith('-2')).toBe(true)
  })
})

describe('strict theme file validation', () => {
  it('accepts a complete valid two-variant theme', () => {
    const parsed = parseThemeFileText(JSON.stringify(validTheme()))
    expect(parsed.id).toBe('sunset')
    expect(parsed.variants.light.tokens.ring).toBeDefined()
  })

  it('rejects invalid JSON and unknown/missing fields', () => {
    expect(() => parseThemeFileText('{not json')).toThrow(ThemeFileError)
    expect(() => parseThemeFileText('[]')).toThrow(/Theme file is invalid/)

    const withUnknownKey = { ...validTheme(), extra: true } as Record<string, unknown>
    expect(() => parseThemeFileText(JSON.stringify(withUnknownKey))).toThrow(/extra/)

    const missingToken = validTheme()
    delete (missingToken.variants.light.tokens as Record<string, unknown>).ring
    expect(() => parseThemeFileText(JSON.stringify(missingToken))).toThrow(/ring/)
  })

  it('rejects wrong format, unsupported versions, and the reserved built-in id', () => {
    const wrongFormat = { ...validTheme(), format: 'theme' }
    expect(() => parseThemeFileText(JSON.stringify(wrongFormat))).toThrow(/Theme file is invalid/)

    const wrongVersion = { ...validTheme(), version: 2 }
    expect(() => parseThemeFileText(JSON.stringify(wrongVersion))).toThrow(/Theme file is invalid/)

    const builtIn = { ...validTheme(), id: 'vixl-default' }
    expect(() => parseThemeFileText(JSON.stringify(builtIn))).toThrow(/reserved/)
  })

  it('rejects malformed colors, unsafe font values, and out-of-range sizes', () => {
    const badColor = validTheme()
    badColor.variants.light.tokens.ring = '#12345'
    expect(() => parseThemeFileText(JSON.stringify(badColor))).toThrow(/hex/)

    const cssInjection = validTheme()
    cssInjection.typography.uiFontFamily = 'Inter); url(http://evil)'
    expect(() => parseThemeFileText(JSON.stringify(cssInjection))).toThrow(/Font family/)

    const hugeFont = validTheme()
    hugeFont.typography.uiFontSize = 72
    expect(() => parseThemeFileText(JSON.stringify(hugeFont))).toThrow(/Theme file is invalid/)
  })

  it('rejects invalid gradients: too few/many stops, unsorted positions, bad angle', () => {
    const fewStops = withMutatedGradient((gradient) => {
      gradient.stops = [{ color: '#111111', position: 0 }]
    })
    expect(() => parseThemeFileText(JSON.stringify(fewStops))).toThrow(/at least 2 stops/)

    const manyStops = withMutatedGradient((gradient) => {
      gradient.stops = [
        { color: '#111111', position: 0 },
        { color: '#222222', position: 20 },
        { color: '#333333', position: 40 },
        { color: '#444444', position: 60 },
        { color: '#555555', position: 80 },
        { color: '#666666', position: 100 },
      ]
    })
    expect(() => parseThemeFileText(JSON.stringify(manyStops))).toThrow(/at most 5 stops/)

    const unsorted = withMutatedGradient((gradient) => {
      gradient.stops = [
        { color: '#111111', position: 50 },
        { color: '#222222', position: 20 },
      ]
    })
    expect(() => parseThemeFileText(JSON.stringify(unsorted))).toThrow(/sorted/)

    const badAngle = withMutatedGradient((gradient) => {
      gradient.angle = 400
    })
    expect(() => parseThemeFileText(JSON.stringify(badAngle))).toThrow(/Theme file is invalid/)
  })

  it('rejects oversized files before parsing', () => {
    const oversized = `{"pad":"${'x'.repeat(THEME_FILE_MAX_BYTES + 1)}"}`
    expect(() => parseThemeFileText(oversized)).toThrow(/too large/)
  })
})

describe('canonical serialization', () => {
  it('round trips byte-identically through export/parse', () => {
    const theme = validTheme()
    const exported = serializeThemeFile(theme)
    const parsed = parseThemeFileText(exported)
    expect(serializeThemeFile(parsed)).toBe(exported)
    expect(exported.endsWith('\n')).toBe(true)
  })

  it('emits a stable canonical key order regardless of input order', () => {
    const theme = validTheme() as Record<string, unknown>
    const reordered = Object.fromEntries(Object.entries(theme).reverse())
    expect(serializeThemeFile(reordered as ThemeFilePayload)).toBe(
      serializeThemeFile(validTheme()),
    )
  })

  it('strips runtime-only state through the shareable projection', () => {
    const theme = validTheme() as ThemeFilePayload & { previewing?: boolean }
    theme.previewing = true
    const shareable = toShareableThemeFile(theme)
    expect('previewing' in shareable).toBe(false)
    expect(() =>
      toShareableThemeFile({ ...theme, typography: undefined } as unknown as ThemeFilePayload),
    ).toThrow(ThemeFileError)
  })
})

describe('theme summary', () => {
  it('describes the imported theme for the confirmation preview', () => {
    const summary = describeThemeFile(validTheme())
    expect(summary).toMatchObject({
      id: 'sunset',
      name: 'Sunset',
      version: 1,
      variants: ['light', 'dark'],
      backgrounds: { light: 'gradient', dark: 'gradient' },
      uiFontSize: 13,
      editorFontSize: 13,
      tokenCount: THEME_VARIANT_TOKEN_KEYS.length * 2,
    })
  })
})

describe('domain → file export adapter', () => {
  const domainTheme = (): VixlThemeDefinition => {
    const theme = structuredClone(builtInVixlTheme)
    theme.id = 'my-export'
    theme.name = 'My Export'
    // Values the Appearance editor produces: half-step sizes, short hex,
    // gradient without an explicit fallback.
    theme.variants.light.typography.uiFontSize = 12.5
    theme.variants.light.colors.border = '#abc'
    theme.variants.light.canvas = {
      type: 'gradient',
      angle: 180,
      stops: [
        { color: '#fafafa', position: 0 },
        { color: '#e4e4e7', position: 100 },
      ],
    }
    return theme
  }

  it('converts a runtime theme into a valid shareable payload', () => {
    const payload = themeDefinitionToThemeFilePayload(domainTheme())
    const parsed = parseThemeFileText(JSON.stringify(payload))
    expect(parsed.id).toBe('my-export')
    expect(parsed.typography.uiFontSize).toBe(12.5)
    expect(parsed.variants.light.tokens.border).toBe('#abc')
    // Runtime-only state is stripped: no font fallbacks or widget colors.
    expect('uiFontFallbacks' in parsed.typography).toBe(false)
    expect('hoverWidgetBackground' in parsed.variants.light.editor).toBe(false)
  })

  it('round trips an editor-created gradient without a fallback', () => {
    const payload = themeDefinitionToThemeFilePayload(domainTheme())
    const exported = serializeThemeFile(toShareableThemeFile(payload))
    const reparsed = parseThemeFileText(exported)
    expect(serializeThemeFile(reparsed)).toBe(exported)
    // Absence (not just undefined) proves the adapter injected no fallback.
    expect('fallback' in reparsed.variants.light.background).toBe(false)
    expect(reparsed.variants.light.background).toMatchObject({
      kind: 'gradient',
      angle: 180,
      stops: [
        { color: '#fafafa', position: 0 },
        { color: '#e4e4e7', position: 100 },
      ],
    })
  })
})

describe('import flow', () => {
  beforeEach(() => {
    invoke.mockReset()
    openDialog.mockReset()
    setTauriWindow()
  })

  it('treats dialog cancellation as a no-op', async () => {
    openDialog.mockResolvedValueOnce(null)

    const result = await importThemeFromFile({ existingThemeIds: new Set() })

    expect(result).toEqual({ status: 'canceled' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('imports, validates, and renames on id collision while preserving the name', async () => {
    openDialog.mockResolvedValueOnce('/Downloads/sunset.vixl-theme.json')
    invoke.mockResolvedValueOnce({ content: JSON.stringify(validTheme()), sizeBytes: 10 })

    const result = await importThemeFromFile({
      existingThemeIds: new Set(['sunset']),
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(invoke).toHaveBeenCalledWith('read_theme_file', {
      path: '/Downloads/sunset.vixl-theme.json',
    })
    expect(result.theme.id).toBe('sunset-2')
    expect(result.theme.name).toBe('Sunset')
    expect(result.renamedFromId).toBe('sunset')
    expect(result.summary.name).toBe('Sunset')
  })

  it('surfaces filesystem failures and schema failures without persisting', async () => {
    openDialog.mockResolvedValueOnce('/Downloads/broken.vixl-theme.json')
    invoke.mockRejectedValueOnce(new Error('Permission denied'))
    const fsFailure = await importThemeFromFile({ existingThemeIds: new Set() })
    expect(fsFailure).toEqual({ status: 'error', message: 'Permission denied' })

    openDialog.mockResolvedValueOnce('/Downloads/broken.vixl-theme.json')
    invoke.mockResolvedValueOnce({ content: '{not json', sizeBytes: 9 })
    const parseFailure = await importThemeFromFile({ existingThemeIds: new Set() })
    expect(parseFailure).toMatchObject({
      status: 'error',
      message: expect.stringMatching(/not valid JSON/),
    })
  })
})

describe('export flow', () => {
  beforeEach(() => {
    saveDialog.mockReset()
    invoke.mockReset()
    setTauriWindow()
  })

  it('treats save-dialog cancellation as a no-op and writes nothing', async () => {
    saveDialog.mockResolvedValueOnce(null)

    const result = await exportThemeToFile(validTheme())

    expect(result).toEqual({ status: 'canceled' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('suggests a sanitized filename and writes canonical JSON', async () => {
    saveDialog.mockResolvedValueOnce('/Downloads/sunset.vixl-theme.json')

    const theme = validTheme()
    const result = await exportThemeToFile(theme)

    expect(result.status).toBe('ok')
    expect(saveDialog).toHaveBeenCalledWith({
      defaultPath: 'Sunset.vixl-theme.json',
      filters: [{ name: 'Vixl Theme (JSON)', extensions: ['json'] }],
    })
    expect(invoke).toHaveBeenCalledTimes(1)
    const [command, args] = invoke.mock.calls[0]
    expect(command).toBe('write_theme_file')
    const written = (args as { content: string }).content
    expect(JSON.parse(written)).toEqual(JSON.parse(serializeThemeFile(theme)))
  })

  it('surfaces write failures as errors', async () => {
    saveDialog.mockResolvedValueOnce('/Downloads/sunset.vixl-theme.json')
    invoke.mockRejectedValueOnce(new Error('Disk full'))

    const result = await exportThemeToFile(validTheme())

    expect(result).toEqual({ status: 'error', message: 'Disk full' })
  })
})

describe('theme library persistence', () => {
  it('keeps editor-saved domain entries and drops malformed ones when importing', () => {
    const domainEntry = {
      ...structuredClone(builtInVixlTheme),
      id: 'editor-theme',
      name: 'Editor Theme',
    }
    const fileEntry = validTheme()
    const patch = buildThemeImportSettingsPatch({
      importedTheme: validTheme(),
      currentLibrary: [domainEntry, fileEntry, { nope: true }, 'junk'],
    })

    const library = patch[THEME_LIBRARY_SETTINGS_KEY] ?? []
    expect(library).toHaveLength(3)
    // Existing domain entries survive untouched; file-shape entries are converted.
    expect(library[0]).toMatchObject({ id: 'editor-theme' })
    expect(library[0].variants.light.colors).toBeDefined()
    expect(library[1].id).toBe('sunset')
    expect(library[1].variants.light.colors).toBeDefined()
    // The imported theme lands in the runtime domain shape.
    expect(library[2].variants.light.colors).toBeDefined()
  })

  it('drops built-in entries and rejects a non-array library', () => {
    const patch = buildThemeImportSettingsPatch({
      importedTheme: validTheme(),
      currentLibrary: [{ ...validTheme(), id: 'vixl-default' }],
    })
    const library = patch[THEME_LIBRARY_SETTINGS_KEY] ?? []
    expect(library).toHaveLength(1)

    const emptyPatch = buildThemeImportSettingsPatch({
      importedTheme: validTheme(),
      currentLibrary: 'not an array',
    })
    expect(emptyPatch[THEME_LIBRARY_SETTINGS_KEY]).toHaveLength(1)
  })

  it('builds a patch appending the theme and optionally activating it', () => {
    const patch = buildThemeImportSettingsPatch({
      importedTheme: validTheme(),
      currentLibrary: [],
      activate: true,
    })
    expect(patch[THEME_LIBRARY_SETTINGS_KEY]).toHaveLength(1)
    expect(patch[ACTIVE_THEME_SETTINGS_KEY]).toBe('sunset')

    const noActivation = buildThemeImportSettingsPatch({
      importedTheme: validTheme(),
      currentLibrary: [],
    })
    expect(noActivation[ACTIVE_THEME_SETTINGS_KEY]).toBeUndefined()
  })

  it('persists library and activation in ONE atomic settings write', async () => {
    const writes: Array<Record<string, unknown>> = []
    const adapter = {
      readPersonalSettings: async () => ({
        version: 1,
        'appearance.theme': 'system',
        [THEME_LIBRARY_SETTINGS_KEY]: [],
      }),
      writePersonalSettings: async (settings: Record<string, unknown>) => {
        writes.push(settings)
      },
    }

    const result = await persistThemeImport({
      importedTheme: validTheme(),
      activate: true,
      adapter,
    })

    expect(writes).toHaveLength(1)
    const written = writes[0]
    expect(written['appearance.theme']).toBe('system')
    expect(written[THEME_LIBRARY_SETTINGS_KEY]).toHaveLength(1)
    expect(written[ACTIVE_THEME_SETTINGS_KEY]).toBe('sunset')
    expect(result).toEqual({ themeId: 'sunset', library: expect.any(Array), activated: true })
  })

  it('leaves settings untouched when the write fails (atomicity)', async () => {
    const adapter = {
      readPersonalSettings: async () => ({ version: 1 }),
      writePersonalSettings: async () => {
        throw new Error('Disk full')
      },
    }

    await expect(
      persistThemeImport({ importedTheme: validTheme(), adapter }),
    ).rejects.toThrow('Disk full')
  })

  it('rejects imports when the library is full', () => {
    expect(() =>
      buildThemeImportSettingsPatch({
        importedTheme: validTheme(),
        currentLibrary: Array.from({ length: 100 }, (_, i) => ({
          ...validTheme(),
          id: `theme-${i}`,
        })),
      }),
    ).toThrow(/full/)
  })

  it('routes the default adapter through the existing settings IPC commands', async () => {
    setTauriWindow()
    invoke.mockImplementation((command: string) => {
      if (command === 'read_settings') return Promise.resolve({ version: 1 })
      return Promise.resolve()
    })

    await defaultThemePersistenceAdapter.readPersonalSettings()
    await defaultThemePersistenceAdapter.writePersonalSettings({ version: 1 })

    expect(invoke).toHaveBeenCalledWith('read_settings', { scope: 'personal', rootPath: null })
    expect(invoke).toHaveBeenCalledWith('write_settings', {
      scope: 'personal',
      rootPath: null,
      settings: { version: 1 },
    })
  })
})

describe('full import + persistence flow', () => {
  beforeEach(() => {
    invoke.mockReset()
    openDialog.mockReset()
    setTauriWindow()
  })

  it('cancels cleanly before any persistence when the dialog is dismissed', async () => {
    openDialog.mockResolvedValueOnce(null)

    const result = await importThemeFromFile({
      existingThemeIds: new Set(),
    })

    expect(result).toEqual({ status: 'canceled' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('imports and persists atomically when the user confirms with activation', async () => {
    openDialog.mockResolvedValueOnce('/Downloads/sunset.vixl-theme.json')
    invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === 'read_theme_file') {
        return Promise.resolve({ content: JSON.stringify(validTheme()), sizeBytes: 1 })
      }
      if (command === 'read_settings') {
        return Promise.resolve({ version: 1, [THEME_LIBRARY_SETTINGS_KEY]: [] })
      }
      expect(command).toBe('write_settings')
      expect(args?.scope).toBe('personal')
      return Promise.resolve()
    })

    const result = await importAndPersistTheme({
      existingThemeIds: new Set(),
      activate: true,
    })

    expect(result).toMatchObject({
      status: 'ok',
      themeId: 'sunset',
      activated: true,
    })
    const writeCall = invoke.mock.calls.find(([command]) => command === 'write_settings')
    if (!writeCall) {
      throw new Error('expected a write_settings call')
    }
    const written = (writeCall[1] as { settings: Record<string, unknown> }).settings
    expect(written[ACTIVE_THEME_SETTINGS_KEY]).toBe('sunset')
    expect(written[THEME_LIBRARY_SETTINGS_KEY]).toHaveLength(1)
  })

  it('keeps serialized round trips byte-stable end to end', () => {
    const theme = validTheme()
    const first = serializeThemeFile(theme)
    const reparsed = parseThemeFileText(first)
    // Canonical output ignores input key order: compare canonicalized forms.
    expect(serializeThemeFile(reparsed)).toBe(first)
    expect(JSON.parse(serializeForTest(theme)).id).toBe('sunset')
  })
})
