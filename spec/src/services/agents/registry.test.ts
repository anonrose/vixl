import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'
import type { ProjectFileEntry } from '@/services/vixl/vixl-tauri'
import type { AgentIndexEntry } from '@/types/agents'

vi.mock('@/services/vixl/vixl-tauri', () => mockVixlTauri())

import {
  listAgentDefinitions,
  listAgentIndex,
  resolveAgentDefinition,
} from '@/services/agents/registry'
import { fsReadFile, getVixlDir, listVixlFiles } from '@/services/vixl/vixl-tauri'

const projectA = '/tmp/project-a'
const projectB = '/tmp/project-b'
const personalDir = '/tmp/personal-vixl'

const personalAgents: ProjectFileEntry[] = [
  {
    name: 'personal-notes.md',
    path: `${personalDir}/agents/personal-notes.md`,
    description: 'User notes',
  },
]

const projectAAgents: ProjectFileEntry[] = [
  {
    name: 'deploy-a.md',
    path: `${projectA}/.vixl/agents/deploy-a.md`,
    description: 'Project A deploy',
  },
]

const projectBAgents: ProjectFileEntry[] = [
  {
    name: 'deploy-b.md',
    path: `${projectB}/.vixl/agents/deploy-b.md`,
    description: 'Project B deploy',
  },
]

const hasAgent = (
  index: AgentIndexEntry[],
  name: string,
  scope?: AgentIndexEntry['scope'],
): boolean =>
  index.some(
    (agent) =>
      agent.name.toLowerCase() === name.toLowerCase() &&
      (scope === undefined || agent.scope === scope),
  )

const agentDocument = (name: string, description: string, body: string): string => `---
name: ${JSON.stringify(name)}
description: ${JSON.stringify(description)}
---

${body}
`

const stubAgentDisks = (options: {
  personal?: ProjectFileEntry[]
  byProject?: Record<string, ProjectFileEntry[]>
  contents?: Record<string, string>
}): void => {
  vi.mocked(listVixlFiles).mockImplementation(async (scope, kind, rootPath) => {
    if (kind !== 'agents') {
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
  vi.mocked(fsReadFile).mockImplementation(async ({ path }) => {
    const content = options.contents?.[path]
    if (content === undefined) {
      throw new Error(`missing agent file: ${path}`)
    }
    return {
      path,
      content,
      totalLines: content.split('\n').length,
      offset: 0,
      limit: 0,
    }
  })
}

beforeEach(() => {
  vi.mocked(listVixlFiles).mockReset()
  vi.mocked(fsReadFile).mockReset()
  vi.mocked(getVixlDir).mockReset()
  vi.mocked(getVixlDir).mockResolvedValue(personalDir)
  stubAgentDisks({
    personal: personalAgents,
    byProject: {
      [projectA]: projectAAgents,
      [projectB]: projectBAgents,
    },
    contents: {
      'agents/personal-notes.md': agentDocument(
        'personal-notes',
        'User notes',
        'Personal agent body.',
      ),
      '.vixl/agents/deploy-a.md': agentDocument(
        'deploy-a',
        'Project A deploy',
        'Project A body.',
      ),
      '.vixl/agents/deploy-b.md': agentDocument(
        'deploy-b',
        'Project B deploy',
        'Project B body.',
      ),
    },
  })
})

describe('listAgentIndex', () => {
  it('unions personal agents with the current project agents', async () => {
    const index = await listAgentIndex(projectA)

    expect(hasAgent(index, 'personal-notes', 'user')).toBe(true)
    expect(hasAgent(index, 'deploy-a', 'project')).toBe(true)
    expect(listVixlFiles).toHaveBeenCalledWith('personal', 'agents')
    expect(listVixlFiles).toHaveBeenCalledWith('project', 'agents', projectA)
  })

  it('does not include another project agents when the active root changes', async () => {
    const index = await listAgentIndex(projectB)

    expect(hasAgent(index, 'personal-notes', 'user')).toBe(true)
    expect(hasAgent(index, 'deploy-b', 'project')).toBe(true)
    expect(hasAgent(index, 'deploy-a')).toBe(false)

    const projectCalls = vi
      .mocked(listVixlFiles)
      .mock.calls.filter((call) => call[0] === 'project' && call[1] === 'agents')
    expect(projectCalls).toEqual([['project', 'agents', projectB]])
  })

  it('lets a project agent win a case-insensitive name collision with a personal agent', async () => {
    stubAgentDisks({
      personal: [
        {
          name: 'shared-agent.md',
          path: `${personalDir}/agents/shared-agent.md`,
          description: 'From personal',
        },
      ],
      byProject: {
        [projectA]: [
          {
            name: 'Shared-Agent.md',
            path: `${projectA}/.vixl/agents/Shared-Agent.md`,
            description: 'From project',
          },
        ],
      },
    })

    const index = await listAgentIndex(projectA)
    const shared = index.filter((agent) => agent.name.toLowerCase() === 'shared-agent')

    expect(shared).toHaveLength(1)
    expect(shared[0]).toEqual({
      id: 'Shared-Agent',
      name: 'Shared-Agent',
      description: 'From project',
      scope: 'project',
      path: `${projectA}/.vixl/agents/Shared-Agent.md`,
    })
  })

  it('returns personal agents only when projectRoot is null', async () => {
    const index = await listAgentIndex(null)

    expect(hasAgent(index, 'personal-notes', 'user')).toBe(true)
    expect(hasAgent(index, 'deploy-a')).toBe(false)
    expect(listVixlFiles).toHaveBeenCalledWith('personal', 'agents')
    expect(listVixlFiles).not.toHaveBeenCalledWith('project', 'agents', expect.anything())
  })
})

describe('listAgentDefinitions', () => {
  it('loads markdown bodies for the merged index', async () => {
    const definitions = await listAgentDefinitions(projectA)

    expect(definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'personal-notes',
          name: 'personal-notes',
          scope: 'user',
          body: 'Personal agent body.',
        }),
        expect.objectContaining({
          id: 'deploy-a',
          name: 'deploy-a',
          scope: 'project',
          body: 'Project A body.',
        }),
      ]),
    )
    expect(fsReadFile).toHaveBeenCalledWith({
      projectRoot: personalDir,
      path: 'agents/personal-notes.md',
    })
    expect(fsReadFile).toHaveBeenCalledWith({
      projectRoot: projectA,
      path: '.vixl/agents/deploy-a.md',
    })
  })
})

describe('resolveAgentDefinition', () => {
  beforeEach(() => {
    stubAgentDisks({
      personal: [
        {
          name: 'code-reviewer.md',
          path: `${personalDir}/agents/code-reviewer.md`,
          description: 'Reviews diffs',
        },
      ],
      byProject: {
        [projectA]: [],
      },
      contents: {
        'agents/code-reviewer.md': agentDocument(
          'Code Reviewer',
          'Reviews diffs',
          'Review the diff carefully.',
        ),
      },
    })
  })

  it('resolves by filename stem, frontmatter name, and slug', async () => {
    const byTitle = await resolveAgentDefinition(projectA, 'Code Reviewer')
    const bySlug = await resolveAgentDefinition(projectA, 'code-reviewer')
    const bySpaces = await resolveAgentDefinition(projectA, 'code reviewer')

    expect(byTitle?.id).toBe('code-reviewer')
    expect(byTitle?.name).toBe('Code Reviewer')
    expect(byTitle?.body).toContain('Review the diff carefully.')
    expect(bySlug?.id).toBe('code-reviewer')
    expect(bySpaces?.id).toBe('code-reviewer')
  })

  it('resolves personal agents when projectRoot is null', async () => {
    const resolved = await resolveAgentDefinition(null, 'code-reviewer')

    expect(resolved?.id).toBe('code-reviewer')
    expect(resolved?.scope).toBe('user')
    expect(listVixlFiles).not.toHaveBeenCalledWith('project', 'agents', expect.anything())
  })
})
