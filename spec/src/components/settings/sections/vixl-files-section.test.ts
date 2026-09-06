import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref, shallowRef } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { Collapsible } from '@/components/shadcn/ui/collapsible'
import { TooltipProvider } from '@/components/shadcn/ui/tooltip'
import VixlFileCreateHost from '@/components/settings/vixl-files/VixlFileCreateHost.vue'
import VixlFilesSection from '@/components/settings/sections/VixlFilesSection.vue'

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('@/services/vixl/vixl-tauri', () => ({
  listVixlFiles: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  fsMkdir: vi.fn<(...args: unknown[]) => Promise<void>>(),
  getVixlDir: vi.fn<(...args: unknown[]) => Promise<string>>(),
  revealInFolder: vi.fn<(...args: unknown[]) => Promise<void>>(),
}))

vi.mock('@/composables/use-vixl-config', () => ({
  default: () => ({
    activeRootPath: { value: null },
  }),
}))

vi.mock('@/composables/use-fleet-registry', () => ({
  default: () => ({
    projects: { value: [] },
    activeProjectId: { value: null },
  }),
}))

vi.mock('@/composables/use-workbench-store', () => ({
  default: () => ({
    openEditor: vi.fn<(...args: unknown[]) => void>(),
    openPlan: vi.fn<(...args: unknown[]) => void>(),
  }),
}))

vi.mock('@/composables/use-start-vixl-files-chat', () => ({
  default: () => ({
    handleSelectChat: vi.fn<(...args: unknown[]) => void>(),
  }),
}))

vi.mock('@/composables/use-vixl-live-sync', () => ({
  vixlFileChangeToken: ref(0),
  lastVixlFileChange: shallowRef(null),
}))

const sectionProps = {
  tab: 'personal' as const,
  kind: 'rules' as const,
  title: 'Rules',
  emptyMessage: 'No rules',
  folderLabel: 'rules',
  collapsible: true,
}

const isCollapsibleOpen = (wrapper: VueWrapper): boolean => {
  const collapsible = wrapper.findComponent(Collapsible)
  const openProp = collapsible.props('open')
  if (typeof openProp === 'boolean') {
    return openProp
  }
  return wrapper.findComponent(ChevronRight).classes().includes('rotate-90')
}

const SectionHost = defineComponent({
  components: { TooltipProvider, VixlFilesSection },
  setup() {
    return { sectionProps }
  },
  template: `
    <TooltipProvider>
      <VixlFilesSection v-bind="sectionProps" />
    </TooltipProvider>
  `,
})

const mountSection = (): VueWrapper =>
  mount(SectionHost, {
    global: {
      stubs: {
        VixlFileCreateHost: true,
      },
    },
  })

describe('VixlFilesSection create host', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('keeps the create host open without expanding the collapsible', async () => {
    wrapper = mountSection()
    await nextTick()

    const createHost = wrapper.findComponent(VixlFileCreateHost)
    expect(createHost.exists()).toBe(true)
    expect(isCollapsibleOpen(wrapper)).toBe(false)
    expect(wrapper.findComponent(ChevronRight).classes()).not.toContain('rotate-90')

    const newRule = wrapper.find('button[aria-label="New rule"]')
    expect(newRule.exists()).toBe(true)
    await newRule.trigger('click')
    await nextTick()

    expect(wrapper.findComponent(VixlFileCreateHost).props('open')).toBe(true)
    expect(isCollapsibleOpen(wrapper)).toBe(false)
    expect(wrapper.findComponent(ChevronRight).classes()).not.toContain('rotate-90')
  })
})
