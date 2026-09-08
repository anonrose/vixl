import type { McpServerConfig } from '@/types/vixl/mcp-config'

export type TrustedMcpServerResult =
  | { trusted: true; config: McpServerConfig }
  | { trusted: false; reason: 'missing' | 'untrusted' }
