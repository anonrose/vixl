export type ChatArtifact = {
  kind: 'plan' | 'file'
  path: string
  label?: string
  startLine?: number
  endLine?: number
}
