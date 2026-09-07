import { describe, expect, it } from 'vitest'
import loadPrompt from '@/services/prompts/load-prompt'

describe('load-prompt', () => {
  it('renders base prompt with variable substitution', () => {
    const rendered = loadPrompt('system/base.md', {
      projectName: 'vixl',
      projectRoot: '/tmp/vixl',
    })

    expect(rendered).toContain('Project: vixl (/tmp/vixl)')
    expect(rendered).not.toContain('{{projectName}}')
    expect(rendered).not.toContain('{{projectRoot}}')
    expect(rendered).toContain(
      'Workspace tools (read_file, edit_file, run_terminal, git, grep, glob, lsp, codebase_*) run only against this repo.',
    )
    expect(rendered).toContain('ask_user to confirm')
    expect(rendered).toContain('Do not silently switch projects mid-chat.')
  })

  it('renders plan-build handoff with path and title', () => {
    const rendered = loadPrompt('handoffs/plan-build.md', {
      planPath: '.vixl/plans/my-plan.md',
      planTitle: 'My plan',
    })

    expect(rendered).toBe(
      'Execute the plan in `.vixl/plans/my-plan.md` (My plan). Read the plan, work through its todos, and implement the changes.',
    )
  })
})
