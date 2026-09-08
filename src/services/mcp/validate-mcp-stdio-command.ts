import ALLOWED_MCP_COMMANDS from '@/services/mcp/allowed-mcp-commands'

const validateMcpStdioCommand = (command: string): string | null => {
  if (command.includes('/') || command.includes('\\')) {
    return 'MCP command must be a PATH basename (for example npx or uvx), not a filesystem path'
  }
  const commandName = command.toLowerCase()
  const isAllowed = ALLOWED_MCP_COMMANDS.some((allowed) => allowed === commandName)
  if (!isAllowed) {
    return `MCP command '${command}' is not allowed. Use one of: ${ALLOWED_MCP_COMMANDS.join(', ')}`
  }
  return null
}

export default validateMcpStdioCommand
