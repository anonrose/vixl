import { toast } from 'vue-sonner'
import type { McpConfig } from '@/types/vixl/mcp-config'
import { parseMcpConfig } from '@/schemas/mcp-config'
import stripCodegraphMcpServer from '@/services/codegraph/strip-codegraph-mcp-server'
import mcpRuntime from '@/services/mcp/mcp-runtime'
import { isInternalMcpServer, CODEGRAPH_SERVER_ID } from '@/types/codegraph/managed-codegraph'
import { listEffectiveMcpServers } from '@/services/mcp/merge-mcp-config'
import {
  readMcpConfig,
  writeMcpConfig,
  type McpServerState,
} from '@/services/vixl/vixl-tauri'
import type { SettingsTab } from '@/composables/use-vixl-config'
import { mergeServerState } from './helpers'
import {
  bumpRefreshGeneration,
  personalMcp,
  projectMcp,
  refreshGeneration,
  serverStates,
} from './state'

const loadScopedConfig = async (
  scope: 'personal' | 'project',
  rootPath: string | null,
): Promise<{ config: McpConfig; hadCodegraph: boolean }> => {
  const raw = await readMcpConfig(scope, rootPath)
  const parsed = parseMcpConfig(raw)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  const hadCodegraph = CODEGRAPH_SERVER_ID in parsed.config.servers
  return {
    config: stripCodegraphMcpServer(parsed.config),
    hadCodegraph,
  }
}

export const loadConfigs = async (rootPath: string | null): Promise<void> => {
  const personalLoaded = await loadScopedConfig('personal', null)

  let project: McpConfig = { servers: {} }
  let projectHadCodegraph = false
  if (rootPath) {
    const projectLoaded = await loadScopedConfig('project', rootPath)
    project = projectLoaded.config
    projectHadCodegraph = projectLoaded.hadCodegraph
  }

  personalMcp.value = personalLoaded.config
  projectMcp.value = project
  if (personalLoaded.hadCodegraph) {
    await writeMcpConfig('personal', personalLoaded.config, null)
  }
  if (rootPath && projectHadCodegraph) {
    await writeMcpConfig('project', project, rootPath)
  }
}

export const saveScopedConfig = async (
  tab: SettingsTab,
  config: McpConfig,
  rootPath: string | null,
): Promise<void> => {
  const scope = tab === 'personal' ? 'personal' : 'project'
  const cleaned = stripCodegraphMcpServer(config)
  await writeMcpConfig(scope, cleaned, rootPath)
  if (scope === 'personal') {
    personalMcp.value = cleaned
  } else {
    projectMcp.value = cleaned
  }
}

export const refreshStates = async (): Promise<void> => {
  const generation = bumpRefreshGeneration()
  const effective = listEffectiveMcpServers(personalMcp.value, projectMcp.value)
  const previousIds = new Set(Object.keys(serverStates.value))

  let bulkStatuses: Record<string, McpServerState> = {}
  try {
    bulkStatuses = await mcpRuntime.listStatuses()
  } catch (error) {
    if (generation !== refreshGeneration) {
      return
    }
    toast.error('Failed to refresh MCP server status', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
    return
  }

  if (generation !== refreshGeneration) {
    return
  }

  const merged: Record<string, McpServerState> = {
    ...serverStates.value,
  }

  for (const server of effective) {
    previousIds.delete(server.id)
    merged[server.id] = mergeServerState(
      server.id,
      bulkStatuses[server.id],
      serverStates.value[server.id],
    )
  }

  // Internal CodeGraph is runtime-only (not in user MCP JSON). Keep its state.
  if (
    previousIds.has(CODEGRAPH_SERVER_ID) ||
    bulkStatuses[CODEGRAPH_SERVER_ID] ||
    serverStates.value[CODEGRAPH_SERVER_ID]
  ) {
    previousIds.delete(CODEGRAPH_SERVER_ID)
    merged[CODEGRAPH_SERVER_ID] = mergeServerState(
      CODEGRAPH_SERVER_ID,
      bulkStatuses[CODEGRAPH_SERVER_ID],
      serverStates.value[CODEGRAPH_SERVER_ID],
    )
  }

  if (generation !== refreshGeneration) {
    return
  }

  for (const removedId of previousIds) {
    if (isInternalMcpServer(removedId)) {
      continue
    }
    try {
      await mcpRuntime.stop(removedId)
    } catch (error) {
      toast.error('Failed to stop MCP server', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    if (generation !== refreshGeneration) {
      return
    }
    delete merged[removedId]
  }

  if (generation !== refreshGeneration) {
    return
  }

  serverStates.value = merged
}
