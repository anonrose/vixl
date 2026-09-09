import type { JSONContent } from '@tiptap/core'

export default (text: string): JSONContent => {
  const lines = text.split('\n')
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line.length > 0 ? [{ type: 'text', text: line }] : [],
    })),
  }
}
