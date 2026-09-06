const normalizeGitRoot = (path: string): string => path.trim().replace(/[/\\]+$/, '')

export default (eventRoot: string, currentRoot: string | null): boolean => {
  if (currentRoot === null || currentRoot === '') {
    return false
  }
  if (eventRoot === currentRoot) {
    return true
  }
  return normalizeGitRoot(eventRoot) === normalizeGitRoot(currentRoot)
}
