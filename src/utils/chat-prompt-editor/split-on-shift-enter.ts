import type { Editor } from '@tiptap/core'

export default (
  editor: Editor,
  event: KeyboardEvent,
  isComposing: boolean,
): boolean => {
  if (event.key !== 'Enter' || !event.shiftKey || isComposing) {
    return false
  }
  event.preventDefault()
  return editor.commands.splitBlock()
}
