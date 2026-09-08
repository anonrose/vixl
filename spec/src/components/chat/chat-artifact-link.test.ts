import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChatArtifactLink from '@/components/chat/ChatArtifactLink.vue'
import { HOME_WORKSPACE_ID } from '@/constants/home-chat'
import type { ChatArtifact } from '@/types/chat/chat-artifact'

const routeState = vi.hoisted(() => ({
  name: 'home-chat' as string | symbol | undefined,
  params: { chatId: 'chat-1' } as Record<string, unknown>,
}))

const fleetState = vi.hoisted(() => ({
  projects: { value: [] as Array<{ id: string; slug: string }> },
  activeProjectId: { value: null as string | null },
}))

const openPlan = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)

const toastError = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastError,
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('@/composables/use-fleet-registry', () => ({
  default: () => fleetState,
}))

vi.mock('@/composables/use-workbench-store', () => ({
  default: () => ({
    openPlan,
  }),
}))

vi.mock('@/utils/open-at-line', () => ({
  default: vi.fn<(...args: unknown[]) => Promise<void>>(),
}))

const planArtifact: ChatArtifact = {
  kind: 'plan',
  path: '.vixl/plans/home-plan/PLAN.md',
  label: 'home-plan',
}

const mountLink = (): VueWrapper =>
  mount(ChatArtifactLink, {
    props: { artifact: planArtifact },
  })

describe('ChatArtifactLink home chat', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    openPlan.mockClear()
    toastError.mockClear()
    fleetState.projects.value = []
    fleetState.activeProjectId.value = null
    routeState.name = 'home-chat'
    routeState.params = { chatId: 'chat-1' }
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('opens the plan with HOME_WORKSPACE_ID on home-chat', async () => {
    wrapper = mountLink()
    await wrapper.get('button').trigger('click')

    expect(toastError).not.toHaveBeenCalled()
    expect(openPlan).toHaveBeenCalledWith(
      HOME_WORKSPACE_ID,
      'home-plan',
      planArtifact.path,
      planArtifact.label,
    )
  })

  it('opens the plan with HOME_WORKSPACE_ID on home-chat-subagent', async () => {
    routeState.name = 'home-chat-subagent'
    wrapper = mountLink()
    await wrapper.get('button').trigger('click')

    expect(toastError).not.toHaveBeenCalled()
    expect(openPlan).toHaveBeenCalledWith(
      HOME_WORKSPACE_ID,
      'home-plan',
      planArtifact.path,
      planArtifact.label,
    )
  })

  it('toasts when a project chat cannot resolve a project id', async () => {
    routeState.name = 'project-chat'
    routeState.params = { slug: 'missing-project', chatId: 'chat-1' }
    wrapper = mountLink()
    await wrapper.get('button').trigger('click')

    expect(openPlan).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Project not found', {
      description: 'Could not resolve the active project for this chat.',
    })
  })
})
