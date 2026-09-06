import { describe, expect, it } from 'vitest'
import parseSkillFrontmatter, {
  MAX_SKILL_CONTENT_CHARS,
} from '@/services/skills/strip-skill-frontmatter'

describe('strip-skill-frontmatter', () => {
  it('extracts frontmatter and body', () => {
    const { frontmatter, body } = parseSkillFrontmatter(`---
name: example
description: Example skill guide
---

# Heading
`)
    expect(frontmatter.name).toBe('example')
    expect(frontmatter.description).toBe('Example skill guide')
    expect(body).toContain('# Heading')
  })

  it('exports a skill content cap', () => {
    expect(MAX_SKILL_CONTENT_CHARS).toBeGreaterThan(1000)
  })
})
