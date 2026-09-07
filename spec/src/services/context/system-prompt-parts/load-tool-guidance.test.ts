import { describe, expect, it } from 'vitest'
import loadToolGuidanceForMode from '@/services/context/system-prompt-parts/load-tool-guidance'

describe('loadToolGuidanceForMode', () => {
  it('always includes shared codebase and LSP guidance', () => {
    const ask = loadToolGuidanceForMode()
    expect(ask).toContain('codebase_explore')
    expect(ask).toContain('lsp')
  })

  it('loads tool-guidance.md and omits embedded browser and patch', () => {
    const text = loadToolGuidanceForMode()
    expect(text).toContain('codebase_explore')
    expect(text).not.toContain('browser_lock')
    expect(text).not.toContain('browser_cdp')
    expect(text).not.toContain('apply_patch')
  })
})
