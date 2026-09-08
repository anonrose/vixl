import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'
import type { McpServerState } from '@/services/vixl/vixl-tauri'

const { readMcpConfig, writeMcpConfig, mcpStop, mcpListStatuses } = vi.hoisted(() => ({
  readMcpConfig: vi.fn<(scope: string, rootPath?: string | null) => Promise<unknown>>(),
  writeMcpConfig: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  mcpStop: vi.fn<(serverId: string) => Promise<void>>(async () => undefined),
  mcpListStatuses: vi.fn<() => Promise<Record<string, McpServerState>>>(async () => ({})),
}))

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    readMcpConfig,
    writeMcpConfig,
  }),
)

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('@/services/mcp/mcp-runtime', () => ({
  default: {
    listStatuses: () => mcpListStatuses(),
    stop: (serverId: string) => mcpStop(serverId),
  },
}))

import { loadConfigs, refreshStates } from '@/composables/mcp-servers/config'
import { personalMcp, projectMcp, serverStates } from '@/composables/mcp-servers/state'

const braveConfig = {
  servers: {
    brave: { command: 'npx', args: ['-y', '@brave/brave-search-mcp-server'] },
  },
}

const connectedBrave: McpServerState = {
  serverId: 'brave',
  status: 'connected',
  tools: [],
  icons: null,
}

const seedRunningBrave = (): void => {
  personalMcp.value = {
    servers: {
      brave: { command: 'npx', args: ['-y', '@brave/brave-search-mcp-server'] },
    },
  }
  projectMcp.value = { servers: {} }
  serverStates.value = { brave: connectedBrave }
  mcpListStatuses.mockResolvedValue({ brave: connectedBrave })
}

describe('mcp-servers loadConfigs and refreshStates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedRunningBrave()
    readMcpConfig.mockResolvedValue({ servers: {} })
  })

  it('does not stop running servers when mcp.json fails to parse', async () => {
    readMcpConfig.mockResolvedValue({ mcpServers: braveConfig.servers })

    await expect(loadConfigs('/project')).rejects.toThrow(/missing a servers object/)
    expect(personalMcp.value.servers.brave).toBeDefined()

    await refreshStates()

    expect(mcpStop).not.toHaveBeenCalled()
    expect(serverStates.value.brave?.status).toBe('connected')
  })

  it('does not stop running servers when the config read fails', async () => {
    readMcpConfig.mockRejectedValue(new Error('disk busy'))

    await expect(loadConfigs('/project')).rejects.toThrow('disk busy')
    expect(personalMcp.value.servers.brave).toBeDefined()

    await refreshStates()

    expect(mcpStop).not.toHaveBeenCalled()
    expect(serverStates.value.brave?.status).toBe('connected')
  })

  it('stops a running server that is genuinely absent after a successful load', async () => {
    readMcpConfig.mockResolvedValue({ servers: {} })

    await loadConfigs('/project')
    expect(personalMcp.value.servers).toEqual({})

    await refreshStates()

    expect(mcpStop).toHaveBeenCalledWith('brave')
    expect(serverStates.value.brave).toBeUndefined()
  })
})
