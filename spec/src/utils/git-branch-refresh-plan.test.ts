import { describe, expect, it } from 'vitest'
import gitBranchRefreshPlan from '@/utils/git-branch-refresh-plan'

describe('git-branch-refresh-plan', () => {
  it('toasts and lists branches for dropdown and checkout', () => {
    expect(gitBranchRefreshPlan('dropdown')).toEqual({
      listBranches: true,
      toastOnError: true,
      setPending: true,
    })
    expect(gitBranchRefreshPlan('checkout')).toEqual({
      listBranches: true,
      toastOnError: true,
      setPending: true,
    })
  })

  it('lists branches silently when the workspace root changes', () => {
    expect(gitBranchRefreshPlan('root')).toEqual({
      listBranches: true,
      toastOnError: false,
      setPending: true,
    })
  })

  it('refreshes the current branch only for head and focus', () => {
    expect(gitBranchRefreshPlan('head')).toEqual({
      listBranches: false,
      toastOnError: false,
      setPending: false,
    })
    expect(gitBranchRefreshPlan('focus')).toEqual({
      listBranches: false,
      toastOnError: false,
      setPending: false,
    })
  })
})
