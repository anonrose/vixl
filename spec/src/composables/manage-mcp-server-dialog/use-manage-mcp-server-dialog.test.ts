import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'vue-sonner'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'
import ALLOWED_MCP_COMMANDS from '@/services/mcp/allowed-mcp-commands'
import useManageMcpServerDialog from '@/composables/manage-mcp-server-dialog'
import type { McpConfig, McpStdioServer } from '@/types/vixl/mcp-config'

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('@/services/vixl/vixl-tauri', () => mockVixlTauri())

const emptyConfig: McpConfig = { servers: {} }

const createDialog = () => {
  const emit = vi.fn<(...args: unknown[]) => void>()
  const dialog = useManageMcpServerDialog(
    {
      open: false,
      mode: 'create',
      mcpConfig: emptyConfig,
    },
    emit,
  )
  dialog.draftId.value = 'docker-mcp'
  dialog.transport.value = 'stdio'
  return { dialog, emit }
}

describe('use-manage-mcp-server-dialog stdio command allowlist', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
  })

  it('saves a stdio server when command is docker', () => {
    const { dialog, emit } = createDialog()
    dialog.command.value = 'docker'
    dialog.argsText.value = 'run, -i, --rm, mcp/docker-server'

    dialog.handleSave()

    expect(toast.error).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      'save',
      expect.objectContaining({
        serverId: 'docker-mcp',
        config: expect.objectContaining({
          command: 'docker',
          args: ['run', '-i', '--rm', 'mcp/docker-server'],
        } satisfies Partial<McpStdioServer>),
      }),
    )
    expect(emit).toHaveBeenCalledWith('update:open', false)
  })

  it('rejects bash with a toast that lists allowed commands', () => {
    const { dialog, emit } = createDialog()
    dialog.command.value = 'bash'

    dialog.handleSave()

    expect(emit).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      `MCP command 'bash' is not allowed. Use one of: ${ALLOWED_MCP_COMMANDS.join(', ')}`,
    )
  })

  it('rejects an absolute command path', () => {
    const { dialog, emit } = createDialog()
    dialog.command.value = '/usr/bin/docker'

    dialog.handleSave()

    expect(emit).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      'MCP command must be a PATH basename (for example npx or uvx), not a filesystem path',
    )
  })
})
