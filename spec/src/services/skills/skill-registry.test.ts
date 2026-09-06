import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'
import type { ProjectFileEntry } from '@/services/vixl/vixl-tauri'
import type { SkillIndexEntry } from '@/types/skills/skill'

vi.mock('@/services/vixl/vixl-tauri', () => mockVixlTauri())

import { listSkillIndex, listSlashSkillIndex } from '@/services/skills/skill-registry'
import { listVixlFiles } from '@/services/vixl/vixl-tauri'

const projectA = '/tmp/project-a'
const projectB = '/tmp/project-b'

const personalSkills: ProjectFileEntry[] = [
  { name: 'personal-notes', path: 'skills/personal-notes', description: 'User notes' },
]

const projectASkills: ProjectFileEntry[] = [
  { name: 'deploy-a', path: '.vixl/skills/deploy-a', description: 'Project A deploy' },
]

const projectBSkills: ProjectFileEntry[] = [
  { name: 'deploy-b', path: '.vixl/skills/deploy-b', description: 'Project B deploy' },
]

const hasSkill = (
  index: SkillIndexEntry[],
  name: string,
  scope?: SkillIndexEntry['scope'],
): boolean =>
  index.some(
    (skill) =>
      skill.name.toLowerCase() === name.toLowerCase() &&
      (scope === undefined || skill.scope === scope),
  )

const stubSkillDisks = (options: {
  personal?: ProjectFileEntry[]
  byProject?: Record<string, ProjectFileEntry[]>
}): void => {
  vi.mocked(listVixlFiles).mockImplementation(async (scope, kind, rootPath) => {
    if (kind !== 'skills') {
      return []
    }
    if (scope === 'personal') {
      return options.personal ?? []
    }
    if (scope === 'project' && rootPath) {
      return options.byProject?.[rootPath] ?? []
    }
    return []
  })
}

beforeEach(() => {
  vi.mocked(listVixlFiles).mockReset()
  stubSkillDisks({
    personal: personalSkills,
    byProject: {
      [projectA]: projectASkills,
      [projectB]: projectBSkills,
    },
  })
})

describe('listSkillIndex', () => {
  it('unions personal skills with the current project skills', async () => {
    const index = await listSkillIndex('agent', projectA)

    expect(hasSkill(index, 'personal-notes', 'user')).toBe(true)
    expect(hasSkill(index, 'deploy-a', 'project')).toBe(true)
    expect(hasSkill(index, 'agent', 'internal')).toBe(true)
    expect(listVixlFiles).toHaveBeenCalledWith('personal', 'skills')
    expect(listVixlFiles).toHaveBeenCalledWith('project', 'skills', projectA)
  })

  it('does not include another project skills when the active root changes', async () => {
    const index = await listSkillIndex('agent', projectB)

    expect(hasSkill(index, 'personal-notes', 'user')).toBe(true)
    expect(hasSkill(index, 'deploy-b', 'project')).toBe(true)
    expect(hasSkill(index, 'deploy-a')).toBe(false)

    const projectCalls = vi
      .mocked(listVixlFiles)
      .mock.calls.filter((call) => call[0] === 'project' && call[1] === 'skills')
    expect(projectCalls).toEqual([['project', 'skills', projectB]])
  })

  it('lets a project skill win a case-insensitive name collision with a personal skill', async () => {
    stubSkillDisks({
      personal: [
        {
          name: 'shared-skill',
          path: 'skills/shared-skill',
          description: 'From personal',
        },
      ],
      byProject: {
        [projectA]: [
          {
            name: 'Shared-Skill',
            path: '.vixl/skills/Shared-Skill',
            description: 'From project',
          },
        ],
      },
    })

    const index = await listSkillIndex('agent', projectA)
    const shared = index.filter(
      (skill) => skill.name.toLowerCase() === 'shared-skill',
    )

    expect(shared).toHaveLength(1)
    expect(shared[0]).toEqual({
      name: 'Shared-Skill',
      description: 'From project',
      scope: 'project',
    })
  })
})

describe('listSlashSkillIndex', () => {
  it('unions personal skills with the current project skills and omits internals', async () => {
    const index = await listSlashSkillIndex(projectA)

    expect(hasSkill(index, 'personal-notes', 'user')).toBe(true)
    expect(hasSkill(index, 'deploy-a', 'project')).toBe(true)
    expect(hasSkill(index, 'agent')).toBe(false)
    expect(hasSkill(index, 'ask')).toBe(false)
    expect(hasSkill(index, 'plan')).toBe(false)
    expect(hasSkill(index, 'orchestrator')).toBe(false)
    expect(listVixlFiles).toHaveBeenCalledWith('personal', 'skills')
    expect(listVixlFiles).toHaveBeenCalledWith('project', 'skills', projectA)
  })

  it('does not include another project skills when the active root changes', async () => {
    const index = await listSlashSkillIndex(projectB)

    expect(hasSkill(index, 'personal-notes', 'user')).toBe(true)
    expect(hasSkill(index, 'deploy-b', 'project')).toBe(true)
    expect(hasSkill(index, 'deploy-a')).toBe(false)

    const projectCalls = vi
      .mocked(listVixlFiles)
      .mock.calls.filter((call) => call[0] === 'project' && call[1] === 'skills')
    expect(projectCalls).toEqual([['project', 'skills', projectB]])
  })

  it('lets a project skill win a case-insensitive name collision with a personal skill', async () => {
    stubSkillDisks({
      personal: [
        {
          name: 'shared-skill',
          path: 'skills/shared-skill',
          description: 'From personal',
        },
      ],
      byProject: {
        [projectA]: [
          {
            name: 'Shared-Skill',
            path: '.vixl/skills/Shared-Skill',
            description: 'From project',
          },
        ],
      },
    })

    const index = await listSlashSkillIndex(projectA)
    const shared = index.filter(
      (skill) => skill.name.toLowerCase() === 'shared-skill',
    )

    expect(shared).toHaveLength(1)
    expect(shared[0]).toEqual({
      name: 'Shared-Skill',
      description: 'From project',
      scope: 'project',
    })
  })

  it('omits reserved slash names even when a user or project skill uses them', async () => {
    stubSkillDisks({
      personal: [
        ...personalSkills,
        {
          name: 'plan',
          path: 'skills/plan',
          description: 'User plan skill',
        },
        {
          name: 'ask',
          path: 'skills/ask',
          description: 'User ask skill',
        },
      ],
      byProject: {
        [projectA]: [
          ...projectASkills,
          {
            name: 'agent',
            path: '.vixl/skills/agent',
            description: 'Project agent skill',
          },
          {
            name: 'orchestrator',
            path: '.vixl/skills/orchestrator',
            description: 'Project orchestrator skill',
          },
        ],
      },
    })

    const index = await listSlashSkillIndex(projectA)

    expect(hasSkill(index, 'personal-notes', 'user')).toBe(true)
    expect(hasSkill(index, 'deploy-a', 'project')).toBe(true)
    expect(hasSkill(index, 'plan')).toBe(false)
    expect(hasSkill(index, 'ask')).toBe(false)
    expect(hasSkill(index, 'agent')).toBe(false)
    expect(hasSkill(index, 'orchestrator')).toBe(false)
  })

  it('lists personal skills and no internals when projectRoot is null', async () => {
    const index = await listSlashSkillIndex(null)

    expect(hasSkill(index, 'personal-notes', 'user')).toBe(true)
    expect(hasSkill(index, 'deploy-a')).toBe(false)
    expect(hasSkill(index, 'deploy-b')).toBe(false)
    expect(hasSkill(index, 'agent')).toBe(false)
    expect(hasSkill(index, 'ask')).toBe(false)
    expect(hasSkill(index, 'plan')).toBe(false)
    expect(hasSkill(index, 'orchestrator')).toBe(false)
    expect(listVixlFiles).toHaveBeenCalledWith('personal', 'skills')
    expect(listVixlFiles).not.toHaveBeenCalledWith(
      'project',
      'skills',
      expect.anything(),
    )
  })
})
