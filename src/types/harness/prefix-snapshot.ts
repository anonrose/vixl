import type { SystemPromptParts } from '@/services/context/system-prompt-parts'
import type { VixlChatMode } from '@/types/vixl/vixl-settings'

export type PrefixSnapshot = {
  systemString: string
  toolSchemasJson: string
  mcpCatalogSnapshot: string
  rulesBodies: string
  hash: string
  frozenAt: string
  /** Chat mode at freeze time. */
  mode?: VixlChatMode
  /** Bucket-ready parts at freeze time. */
  parts?: SystemPromptParts
}
