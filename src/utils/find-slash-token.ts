const isSlashTokenBoundary = (
  text: string,
  index: number,
  tokenLength: number,
): boolean => {
  const after = index + tokenLength
  if (after >= text.length) {
    return true
  }
  const next = text[after]
  return next === undefined || !/[A-Za-z0-9_/-]/.test(next)
}

export default (text: string, name: string): string | null => {
  const trimmed = name.trim()
  if (!trimmed) {
    return null
  }
  const needle = `/${trimmed.toLowerCase()}`
  const lower = text.toLowerCase()
  let from = 0
  while (from < lower.length) {
    const index = lower.indexOf(needle, from)
    if (index < 0) {
      return null
    }
    if (isSlashTokenBoundary(text, index, needle.length)) {
      return text.slice(index, index + needle.length)
    }
    from = index + needle.length
  }
  return null
}
