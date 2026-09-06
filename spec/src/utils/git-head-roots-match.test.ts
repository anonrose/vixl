import { describe, expect, it } from 'vitest'
import gitHeadRootsMatch from '@/utils/git-head-roots-match'

describe('git-head-roots-match', () => {
  it('matches the exact string rust emits', () => {
    expect(gitHeadRootsMatch('/Users/aidan/proj', '/Users/aidan/proj')).toBe(true)
  })

  it('does not match a different workspace root', () => {
    expect(gitHeadRootsMatch('/Users/aidan/a', '/Users/aidan/b')).toBe(false)
  })

  it('does not match when there is no current root', () => {
    expect(gitHeadRootsMatch('/Users/aidan/proj', null)).toBe(false)
    expect(gitHeadRootsMatch('/Users/aidan/proj', '')).toBe(false)
  })

  it('matches after trimming and dropping a trailing slash', () => {
    expect(gitHeadRootsMatch('/tmp/repo/', '/tmp/repo')).toBe(true)
    expect(gitHeadRootsMatch(' /tmp/repo ', '/tmp/repo')).toBe(true)
  })
})
