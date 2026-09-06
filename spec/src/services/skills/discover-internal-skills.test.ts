import { describe, expect, it } from 'vitest'
import { listInternalSkillIndex, loadInternalSkill } from '@/services/skills/discover-internal-skills'

describe('discover-internal-skills', () => {
  it('indexes ask skill only in ask mode', () => {
    expect(listInternalSkillIndex('ask').some((skill) => skill.name === 'ask')).toBe(true)
    expect(listInternalSkillIndex('agent').some((skill) => skill.name === 'ask')).toBe(false)
  })

  it('indexes plan skill only in plan mode', () => {
    expect(listInternalSkillIndex('plan').some((skill) => skill.name === 'plan')).toBe(true)
    expect(listInternalSkillIndex('ask').some((skill) => skill.name === 'plan')).toBe(false)
  })

  it('indexes agent skill only in agent mode', () => {
    expect(listInternalSkillIndex('agent').some((skill) => skill.name === 'agent')).toBe(true)
    expect(listInternalSkillIndex('plan').some((skill) => skill.name === 'agent')).toBe(false)
  })

  it('indexes orchestrator skill only in orchestrator mode', () => {
    expect(
      listInternalSkillIndex('orchestrator').some((skill) => skill.name === 'orchestrator'),
    ).toBe(true)
    expect(
      listInternalSkillIndex('agent').some((skill) => skill.name === 'orchestrator'),
    ).toBe(false)
  })

  it('loads ask skill content', () => {
    const loaded = loadInternalSkill('ask')
    expect(loaded).not.toBeNull()
    expect(loaded?.content).toContain('Ask mode')
  })

  it('loads plan skill content', () => {
    const loaded = loadInternalSkill('plan')
    expect(loaded).not.toBeNull()
    expect(loaded?.content).toContain('Plan mode')
  })

  it('loads agent skill content', () => {
    const loaded = loadInternalSkill('agent')
    expect(loaded).not.toBeNull()
    expect(loaded?.content).toContain('Agent mode')
  })

  it('loads orchestrator skill content', () => {
    const loaded = loadInternalSkill('orchestrator')
    expect(loaded).not.toBeNull()
    expect(loaded?.content).toContain('Orchestrator mode')
  })
})
