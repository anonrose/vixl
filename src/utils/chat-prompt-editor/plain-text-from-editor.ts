import type { Editor } from '@tiptap/core'

export default (editor: Editor): string =>
  editor.getText({ blockSeparator: '\n' })
