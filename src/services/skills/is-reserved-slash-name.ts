const RESERVED_SLASH_NAMES = new Set([
  'ask',
  'plan',
  'agent',
  'orchestrator',
])

export default (name: string): boolean =>
  RESERVED_SLASH_NAMES.has(name.trim().toLowerCase())
