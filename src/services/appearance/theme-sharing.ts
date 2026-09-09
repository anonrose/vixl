import {
  BUILT_IN_THEME_ID,
  THEME_FILE_MAX_BYTES,
  themeFilePayloadSchema,
} from '@/schemas/appearance/theme-file'
import type { ThemeFilePayload } from '@/schemas/appearance/theme-file'
import { pickThemeFile, pickThemeSavePath, readThemeFile, writeThemeFile } from '@/services/vixl/vixl-tauri/theme-files'
import {
  describeThemeFile,
  formatSchemaIssue,
  resolveThemeIdCollision,
  sanitizeThemeFilename,
  serializeThemeFile,
  themeDefinitionToThemeFilePayload,
  ThemeFileError,
  toShareableThemeFile,
} from './theme-file-utils'
import type { ThemeFileSummary, ThemeOperationResult } from './theme-file-utils'

// Re-export the shared file-format helpers so callers keep a single entry
// point for the import/export surface.
export {
  describeThemeFile,
  resolveThemeIdCollision,
  sanitizeThemeFilename,
  serializeThemeFile,
  themeDefinitionToThemeFilePayload,
  toShareableThemeFile,
  ThemeFileError,
}
export type { ThemeFileSummary, ThemeOperationResult }

/**
 * Shareable theme import/export flows.
 *
 * Import: pick file -> pre-parse size cap -> JSON.parse -> strict schema
 * validation -> collision-safe id normalization -> summary preview. The
 * picked file's raw text is read through a Tauri command that enforces the
 * size cap in Rust before any content reaches the webview.
 *
 * Export: validate the saved theme -> strip runtime-only state -> canonical
 * serialize -> save dialog with a sanitized filename -> atomic write.
 *
 * Dialog cancellation is always a no-op result, never an error. Persistence
 * into the personal theme library lives in `theme-persistence`.
 */

const textEncoder = new TextEncoder()

const themeTextByteLength = (text: string): number => textEncoder.encode(text).length

export const assertThemeFileSize = (text: string): void => {
  if (themeTextByteLength(text) > THEME_FILE_MAX_BYTES) {
    throw new ThemeFileError(`Theme file is too large (limit is ${THEME_FILE_MAX_BYTES} bytes)`)
  }
}

/**
 * Parse raw theme file text: enforce the size cap before parsing, then apply
 * the strict versioned schema (unknown keys, unsafe colors/fonts/values and
 * unsupported versions are rejected).
 */
export const parseThemeFileText = (text: string): ThemeFilePayload => {
  assertThemeFileSize(text)

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ThemeFileError('Theme file is not valid JSON')
  }

  const parsed = themeFilePayloadSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ThemeFileError(formatSchemaIssue(parsed.error))
  }

  if (parsed.data.id === BUILT_IN_THEME_ID) {
    throw new ThemeFileError(`'${BUILT_IN_THEME_ID}' is reserved for the built-in Vixl theme`)
  }

  return parsed.data
}

const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(String(reason))

export type ImportedTheme = {
  theme: ThemeFilePayload
  summary: ThemeFileSummary
  /** Original id when a collision forced a rename, otherwise `null`. */
  renamedFromId: string | null
  path: string
}

/**
 * Import flow up to (but not including) persistence: pick a file, read it
 * (Rust enforces the pre-parse size cap), validate strictly, resolve id
 * collisions against the current library, and produce a summary preview.
 * Canceling the dialog returns `{ status: 'canceled' }` without side effects.
 */
export const importThemeFromFile = async (options: {
  existingThemeIds: ReadonlySet<string>
}): Promise<ThemeOperationResult<ImportedTheme>> => {
  let path: string | null
  try {
    path = await pickThemeFile()
  } catch (reason) {
    return { status: 'error', message: toError(reason).message }
  }

  if (path === null) {
    return { status: 'canceled' }
  }

  let content: string
  try {
    const file = await readThemeFile(path)
    content = file.content
  } catch (reason) {
    return { status: 'error', message: toError(reason).message }
  }

  try {
    const parsed = parseThemeFileText(content)
    const { id, renamedFromId } = resolveThemeIdCollision(parsed.id, options.existingThemeIds)
    const theme: ThemeFilePayload = renamedFromId === null ? parsed : { ...parsed, id }

    return {
      status: 'ok',
      theme,
      summary: describeThemeFile(theme),
      renamedFromId,
      path,
    }
  } catch (reason) {
    if (reason instanceof ThemeFileError) {
      return { status: 'error', message: reason.message }
    }
    return { status: 'error', message: toError(reason).message }
  }
}

export type ExportedTheme = {
  path: string
  theme: ThemeFilePayload
}

/**
 * Export flow: validate the saved theme, canonicalize the versioned payload,
 * ask for a destination with a sanitized default filename, and write it
 * atomically. Canceling the save dialog is a no-op.
 */
export const exportThemeToFile = async (
  theme: ThemeFilePayload,
): Promise<ThemeOperationResult<ExportedTheme>> => {
  let shareable: ThemeFilePayload
  let content: string
  try {
    shareable = toShareableThemeFile(theme)
    content = serializeThemeFile(shareable)
  } catch (reason) {
    return { status: 'error', message: toError(reason).message }
  }

  let path: string | null
  try {
    path = await pickThemeSavePath(sanitizeThemeFilename(shareable.name))
  } catch (reason) {
    return { status: 'error', message: toError(reason).message }
  }

  if (path === null) {
    return { status: 'canceled' }
  }

  try {
    await writeThemeFile(path, content)
  } catch (reason) {
    return { status: 'error', message: toError(reason).message }
  }

  return { status: 'ok', path, theme: shareable }
}
