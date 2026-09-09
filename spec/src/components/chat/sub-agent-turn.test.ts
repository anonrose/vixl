import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, type VueWrapper } from '@vue/test-utils'
import SubAgentTurn from '@/components/chat/SubAgentTurn.vue'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'

const routeState = vi.hoisted(() => ({
  name: 'home-chat' as string | symbol | undefined,
  params: { chatId: 'chat-1', slug: '' } as Record<string, unknown>,
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    push: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
  }),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

const subagent = (
  partial: Partial<SubagentTimelineItem> = {},
): SubagentTimelineItem => ({
  type: 'subagent',
  subagentId: 'sub-1',
  toolCallId: 'call-1',
  name: 'generalPurpose',
  blocking: true,
  status: 'done',
  tools: [],
  compactions: [],
  ...partial,
})

let wrapper: VueWrapper | null = null

const mountTurn = (item: SubagentTimelineItem): VueWrapper => {
  wrapper = shallowMount(SubAgentTurn, {
    props: { subagent: item },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        AiElementsShimmerShimmer: {
          name: 'AiElementsShimmerShimmer',
          template: '<span><slot /></span>',
        },
        Tooltip: { name: 'Tooltip', template: '<span><slot /></span>' },
        TooltipTrigger: { name: 'TooltipTrigger', template: '<span><slot /></span>' },
        TooltipContent: { name: 'TooltipContent', template: '<span><slot /></span>' },
      },
    },
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('SubAgentTurn title', () => {
  it('shows the agent name only', () => {
    const mounted = mountTurn(subagent({ name: 'explorer' }))
    expect(mounted.text()).toContain('explorer')
    expect(mounted.text()).not.toContain('Scan auth helpers')
  })

  it('falls back to Sub-agent when the name is blank', () => {
    const mounted = mountTurn(subagent({ name: '  ' }))
    expect(mounted.text()).toContain('Sub-agent')
  })
})
