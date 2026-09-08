import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, type ComputedRef } from 'vue'
import { toast } from 'vue-sonner'
import useStartPlanBuild from '@/composables/use-start-plan-build'
import type { PendingChatMessage } from '@/services/chat/pending-message'
import type { PlanBuildFrontmatterPatch } from '@/services/plans/update-plan-frontmatter'
import type { ChatMeta, ChatStatus } from '@/types/chat/chat-meta'
import type { ReasoningLevel } from '@/types/models/reasoning-level'

const createNewChat = vi.hoisted(
  () =>
    vi.fn<(args: { title?: string }) => Promise<{ id: string }>>(async () => ({
      id: 'fresh-chat',
    })),
)
const forChat = vi.hoisted(
  () =>
    vi.fn<
      (projectSlug: string, chatId: string) => { meta: ComputedRef<ChatMeta | null> }
    >(),
)
const readChatMetaMock = vi.hoisted(
  () =>
    vi.fn<(projectSlug: string, chatId: string) => Promise<{ id: string }>>(
      async (_projectSlug, chatId) => ({ id: chatId }),
    ),
)
const updateChatMeta = vi.hoisted(
  () =>
    vi.fn<
      (
        projectSlug: string,
        chatId: string,
        patch: Record<string, unknown>,
      ) => Promise<void>
    >(async () => undefined),
)
const setPendingChatMessageMock = vi.hoisted(
  () => vi.fn<(payload: PendingChatMessage) => void>(),
)
const updatePlanFrontmatter = vi.hoisted(
  () =>
    vi.fn<
      (args: {
        projectRoot: string
        path: string
        patch: PlanBuildFrontmatterPatch
      }) => Promise<void>
    >(async () => undefined),
)
const routerPush = vi.hoisted(
  () => vi.fn<(to: string) => Promise<void>>(async () => undefined),
)
const setActiveProject = vi.hoisted(
  () => vi.fn<(projectId: string | null) => Promise<void>>(async () => undefined),
)
const getUserHomeDir = vi.hoisted(
  () => vi.fn<() => Promise<string>>(async () => '/Users/test-home'),
)
const loadPromptMock = vi.hoisted(
  () =>
    vi.fn<(path: string, variables?: Record<string, string>) => string>(
      () => 'build this plan',
    ),
)

const sessionStatus = ref<ChatStatus | null>('idle')

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: (...args: [string]) => routerPush(...args),
  }),
}))

vi.mock('@/composables/use-chat-store', () => ({
  default: () => ({
    createNewChat: (args: { title?: string }) => createNewChat(args),
    forChat: (projectSlug: string, chatId: string) => forChat(projectSlug, chatId),
  }),
}))

vi.mock('@/composables/use-fleet-registry', () => ({
  default: () => ({
    projects: {
      value: [
        {
          id: 'proj-1',
          slug: 'proj',
          rootPath: '/tmp/proj',
          name: 'Proj',
        },
      ],
    },
    setActiveProject,
  }),
}))

vi.mock('@/composables/use-vixl-config', () => ({
  default: () => ({
    effectiveSettings: { value: {} },
  }),
}))

vi.mock('@/composables/use-fleet-sidebar', () => ({
  refreshFleetSidebar: vi.fn<() => Promise<void>>(async () => undefined),
}))

vi.mock('@/services/models/resolve-model-for-role', () => ({
  default: () => 'openai/gpt-4.1',
}))

vi.mock('@/services/models/resolve-reasoning-for-call', () => ({
  resolveReasoningForRole: () => undefined,
}))

vi.mock('@/services/prompts/load-prompt', () => ({
  default: (path: string, variables?: Record<string, string>) =>
    loadPromptMock(path, variables),
}))

vi.mock('@/services/chat/pending-message', () => ({
  setPendingChatMessage: (payload: PendingChatMessage) =>
    setPendingChatMessageMock(payload),
}))

vi.mock('@/services/plans/update-plan-frontmatter', () => ({
  default: (args: {
    projectRoot: string
    path: string
    patch: PlanBuildFrontmatterPatch
  }) => updatePlanFrontmatter(args),
}))

vi.mock('@/services/harness/plan-execution-session', () => ({
  clearAwaitingPlanGo: vi.fn<(projectSlug: string, chatId: string) => void>(),
  setSubagentModelLock: vi.fn<
    (
      projectSlug: string,
      chatId: string,
      model: string | null,
      reasoning?: ReasoningLevel | null,
    ) => void
  >(),
}))

vi.mock('@/services/vixl/vixl-tauri', () => ({
  getUserHomeDir,
  readChatMeta: (projectSlug: string, chatId: string) =>
    readChatMetaMock(projectSlug, chatId),
  updateChatMeta: (
    projectSlug: string,
    chatId: string,
    patch: Record<string, unknown>,
  ) => updateChatMeta(projectSlug, chatId, patch),
}))

const baseInput = {
  projectId: 'proj-1',
  planPath: 'plans/example.md',
  planTitle: 'Example plan',
  model: 'openai/gpt-4.1',
}

describe('use-start-plan-build', () => {
  beforeEach(() => {
    createNewChat.mockClear()
    forChat.mockClear()
    readChatMetaMock.mockClear()
    updateChatMeta.mockClear()
    setPendingChatMessageMock.mockClear()
    updatePlanFrontmatter.mockClear()
    routerPush.mockClear()
    setActiveProject.mockClear()
    getUserHomeDir.mockClear()
    getUserHomeDir.mockResolvedValue('/Users/test-home')
    loadPromptMock.mockClear()
    loadPromptMock.mockReturnValue('build this plan')
    vi.mocked(toast.error).mockClear()
    sessionStatus.value = 'idle'
    createNewChat.mockResolvedValue({ id: 'fresh-chat' })
    readChatMetaMock.mockImplementation(async (_projectSlug, chatId) => ({ id: chatId }))
    forChat.mockImplementation((_projectSlug, chatId) => ({
      meta: computed((): ChatMeta | null =>
        sessionStatus.value
          ? ({ id: chatId, status: sessionStatus.value } as ChatMeta)
          : null,
      ),
    }))
  })

  it('returns false, toasts, and skips pending message when the reused chat is running', async () => {
    sessionStatus.value = 'running'
    const { startPlanBuild } = useStartPlanBuild()

    const result = await startPlanBuild({
      ...baseInput,
      lastBuildChatId: 'last-build',
      sourceChatId: 'source-chat',
      freshChat: false,
    })

    expect(result).toBe(false)
    expect(setPendingChatMessageMock).not.toHaveBeenCalled()
    expect(updateChatMeta).not.toHaveBeenCalled()
    expect(createNewChat).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Plan is already building in that chat')
    expect(readChatMetaMock).toHaveBeenCalledWith('proj', 'last-build')
  })

  it('creates a fresh chat when freshChat is true even if lastBuildChatId and sourceChatId resolve', async () => {
    const { startPlanBuild } = useStartPlanBuild()

    const result = await startPlanBuild({
      ...baseInput,
      lastBuildChatId: 'last-build',
      sourceChatId: 'source-chat',
      freshChat: true,
    })

    expect(result).toBe(true)
    expect(readChatMetaMock).not.toHaveBeenCalled()
    expect(createNewChat).toHaveBeenCalledTimes(1)
    expect(forChat).toHaveBeenCalledWith('proj', 'fresh-chat')
    expect(setPendingChatMessageMock).toHaveBeenCalled()
    expect(updatePlanFrontmatter).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ lastBuildChatId: 'fresh-chat' }),
      }),
    )
    expect(setActiveProject).toHaveBeenCalledWith('proj-1')
    expect(routerPush).toHaveBeenCalledWith('/project/proj/chat/fresh-chat')
  })

  it('synthesizes the home workspace, skips setActiveProject, and routes to /chat', async () => {
    const { startPlanBuild } = useStartPlanBuild()

    const result = await startPlanBuild({
      ...baseInput,
      projectId: '_home_',
      freshChat: true,
    })

    expect(result).toBe(true)
    expect(getUserHomeDir).toHaveBeenCalled()
    expect(setActiveProject).not.toHaveBeenCalled()
    expect(createNewChat).toHaveBeenCalledWith(
      expect.objectContaining({
        projectSlug: '_home_',
        projectRoot: '/Users/test-home',
        title: 'Example plan',
      }),
    )
    expect(forChat).toHaveBeenCalledWith('_home_', 'fresh-chat')
    expect(updatePlanFrontmatter).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: '/Users/test-home',
        path: 'plans/example.md',
      }),
    )
    expect(routerPush).toHaveBeenCalledWith('/chat/fresh-chat')
  })

  it('prefers lastBuildChatId over sourceChatId when reusing a chat', async () => {
    const { startPlanBuild } = useStartPlanBuild()

    const result = await startPlanBuild({
      ...baseInput,
      lastBuildChatId: 'last-build',
      sourceChatId: 'source-chat',
    })

    expect(result).toBe(true)
    expect(createNewChat).not.toHaveBeenCalled()
    expect(readChatMetaMock).toHaveBeenCalledTimes(1)
    expect(readChatMetaMock).toHaveBeenCalledWith('proj', 'last-build')
    expect(forChat).toHaveBeenCalledWith('proj', 'last-build')
    expect(setPendingChatMessageMock).toHaveBeenCalled()
    expect(updatePlanFrontmatter).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ lastBuildChatId: 'last-build' }),
      }),
    )
  })

  it('passes the locked subagent model into the orchestrate handoff', async () => {
    const { startPlanBuild } = useStartPlanBuild()

    const result = await startPlanBuild({
      ...baseInput,
      executionMode: 'orchestrator',
      subagentModel: 'anthropic::claude-sonnet-4',
      freshChat: true,
    })

    expect(result).toBe(true)
    expect(loadPromptMock).toHaveBeenCalledWith('handoffs/plan-orchestrate.md', {
      planPath: 'plans/example.md',
      planTitle: 'Example plan',
      subagentModel: 'anthropic::claude-sonnet-4',
    })
  })
})
