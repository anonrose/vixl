export default (
  source: 'dropdown' | 'checkout' | 'root' | 'head' | 'focus',
): {
  listBranches: boolean
  toastOnError: boolean
  setPending: boolean
} => {
  if (source === 'dropdown' || source === 'checkout') {
    return { listBranches: true, toastOnError: true, setPending: true }
  }
  if (source === 'root') {
    return { listBranches: true, toastOnError: false, setPending: true }
  }
  return { listBranches: false, toastOnError: false, setPending: false }
}
