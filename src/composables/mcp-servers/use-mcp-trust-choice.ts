import { ref } from 'vue'
import { toast } from 'vue-sonner'
import useVixlConfig from '@/composables/use-vixl-config'
import type { McpTrustScope } from '@/types/harness/permission'
import type { McpServerConfig } from '@/types/vixl/mcp-config'
import {
  isMcpTrusted,
  sessionTrusts,
  upsertMcpTrustRecord,
  clearSessionTrust,
} from '@/services/mcp/mcp-trust'
import { mcpServerFingerprint } from '@/services/mcp/mcp-server-fingerprint'
import { clearMcpToolBaseline } from '@/services/mcp/mcp-tool-baseline'

type TrustPending = {
  serverId: string
  fingerprint: string
  action: () => Promise<void>
}

type TrustConfig = ReturnType<typeof useVixlConfig>

const persistTrustRecord = async (
  config: TrustConfig,
  pending: TrustPending,
  scope: McpTrustScope,
): Promise<void> => {
  if (scope === 'never') {
    clearSessionTrust(pending.serverId)
    const existing = config.personalSettings.value['agent.mcp.trust'] ?? []
    await config.updateSetting(
      'personal',
      'agent.mcp.trust',
      upsertMcpTrustRecord(existing, pending.serverId, 'never', pending.fingerprint),
    )
    return
  }

  if (scope === 'session') {
    sessionTrusts.set(pending.serverId, pending.fingerprint)
    return
  }

  if (scope === 'workspace') {
    const rootPath = config.activeRootPath.value
    if (rootPath) {
      const existing = config.projectSettings.value['agent.mcp.trust'] ?? []
      await config.updateSetting(
        'project',
        'agent.mcp.trust',
        upsertMcpTrustRecord(existing, pending.serverId, 'workspace', pending.fingerprint),
      )
    } else {
      const existing = config.personalSettings.value['agent.mcp.trust'] ?? []
      await config.updateSetting(
        'personal',
        'agent.mcp.trust',
        upsertMcpTrustRecord(existing, pending.serverId, 'always', pending.fingerprint),
      )
    }
    sessionTrusts.set(pending.serverId, pending.fingerprint)
    return
  }

  const existing = config.personalSettings.value['agent.mcp.trust'] ?? []
  await config.updateSetting(
    'personal',
    'agent.mcp.trust',
    upsertMcpTrustRecord(existing, pending.serverId, 'always', pending.fingerprint),
  )
  sessionTrusts.set(pending.serverId, pending.fingerprint)
}

export default () => {
  const config = useVixlConfig()
  const trustPending = ref<TrustPending | null>(null)
  const trustSaving = ref(false)

  const requireTrust = async (
    id: string,
    serverConfig: McpServerConfig,
    action: () => Promise<void>,
  ): Promise<void> => {
    const fingerprint = mcpServerFingerprint(serverConfig)
    if (isMcpTrusted(config.effectiveSettings.value, id, fingerprint, sessionTrusts)) {
      await action()
      return
    }
    trustPending.value = { serverId: id, fingerprint, action }
  }

  const handleTrustChoice = async (scope: McpTrustScope): Promise<void> => {
    const pending = trustPending.value
    if (!pending) {
      return
    }
    trustPending.value = null
    trustSaving.value = true

    try {
      await clearMcpToolBaseline(pending.serverId)
      await persistTrustRecord(config, pending, scope)
    } catch (error) {
      toast.error('Failed to trust server', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      return
    } finally {
      trustSaving.value = false
    }

    if (scope === 'never') {
      return
    }

    try {
      await pending.action()
    } catch (error) {
      toast.error('Failed to start server', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    trustPending,
    trustSaving,
    requireTrust,
    handleTrustChoice,
  }
}
