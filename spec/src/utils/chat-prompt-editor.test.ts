import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import HardBreak from '@tiptap/extension-hard-break'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'
import {
  plainTextFromEditor,
  plainTextToDoc,
  shouldApplyExternalText,
  splitOnShiftEnter,
} from '@/utils/chat-prompt-editor'

const promptEditorExtensions = [Document, Paragraph, Text]

let editor: Editor | null = null

const createEditor = (text: string, extraExtensions: typeof HardBreak[] = []): Editor => {
  editor = new Editor({
    extensions: [...promptEditorExtensions, ...extraExtensions],
    content: plainTextToDoc(text),
  })
  return editor
}

const shiftEnterEvent = (): KeyboardEvent =>
  new KeyboardEvent('keydown', {
    key: 'Enter',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  })

afterEach(() => {
  editor?.destroy()
  editor = null
})

describe('plainTextToDoc', () => {
  it('maps each line to a paragraph including a trailing newline', () => {
    expect(plainTextToDoc('hello\n')).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] },
        { type: 'paragraph', content: [] },
      ],
    })
  })
})

describe('getText round-trip', () => {
  it('round-trips through plainTextToDoc including a trailing newline', () => {
    const incoming = 'hello\nworld\n'
    const current = createEditor(incoming)
    expect(plainTextFromEditor(current)).toBe(incoming)
  })

  it('round-trips a single trailing newline', () => {
    const incoming = 'hello\n'
    const current = createEditor(incoming)
    expect(plainTextFromEditor(current)).toBe(incoming)
  })
})

describe('splitOnShiftEnter', () => {
  it('inserts a new paragraph instead of a hard break', () => {
    const current = createEditor('hello', [HardBreak])
    current.commands.focus('end')
    const event = shiftEnterEvent()

    expect(splitOnShiftEnter(current, event, false)).toBe(true)
    expect(event.defaultPrevented).toBe(true)

    const json = current.getJSON()
    expect(json.content).toHaveLength(2)
    expect(json.content?.[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'hello' }],
    })
    expect(json.content?.[1]).toEqual({ type: 'paragraph' })
    expect(JSON.stringify(json)).not.toContain('hardBreak')
  })

  it('does not split during IME composition', () => {
    const current = createEditor('hello')
    current.commands.focus('end')
    expect(splitOnShiftEnter(current, shiftEnterEvent(), true)).toBe(false)
    expect(current.getJSON().content).toHaveLength(1)
  })
})

describe('shouldApplyExternalText', () => {
  it('skips setContent when editor text already matches including a trailing newline', () => {
    const incoming = 'hello\n'
    const current = createEditor(incoming)
    expect(shouldApplyExternalText(plainTextFromEditor(current), incoming)).toBe(false)
  })

  it('does not treat editor-originated split text as an external write', () => {
    const current = createEditor('hello')
    current.commands.focus('end')
    splitOnShiftEnter(current, shiftEnterEvent(), false)
    const nextText = plainTextFromEditor(current)
    expect(nextText).toBe('hello\n')
    expect(shouldApplyExternalText(nextText, nextText)).toBe(false)
  })

  it('applies genuinely external writes', () => {
    const current = createEditor('hello')
    expect(shouldApplyExternalText(plainTextFromEditor(current), 'other')).toBe(true)
  })
})
