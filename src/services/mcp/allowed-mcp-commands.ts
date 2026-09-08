/**
 * Source of truth: `src-tauri/src/commands/mcp/allowlist.rs`.
 * The frontend list must stay in sync with that Rust allowlist.
 */
const ALLOWED_MCP_COMMANDS = [
  'npx',
  'npm',
  'node',
  'pnpm',
  'yarn',
  'bun',
  'bunx',
  'deno',
  'uvx',
  'uv',
  'python',
  'python3',
  'pipx',
  'codegraph',
  'docker',
  'podman',
  'nerdctl',
] as const

export default ALLOWED_MCP_COMMANDS
