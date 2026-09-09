import { toast } from 'vue-sonner'
import type { McpConfig } from '@/types/vixl/mcp-config'
import { loadProjectConfigForRoot } from '@/composables/mcp-servers/config'

export default (projectRoot: () => string | null) => {
  const localProjectConfig = shallowRef<McpConfig | null>(null)
  let loadGeneration = 0

  const reloadProjectConfig = async (): Promise<void> => {
    const generation = loadGeneration + 1
    loadGeneration = generation
    const rootPath = projectRoot()
    if (!rootPath) {
      localProjectConfig.value = null
      return
    }

    try {
      const loaded = await loadProjectConfigForRoot(rootPath)
      if (generation !== loadGeneration) {
        return
      }
      localProjectConfig.value = loaded
    } catch (error) {
      if (generation !== loadGeneration) {
        return
      }
      localProjectConfig.value = null
      toast.error('Failed to load MCP servers', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  watch(
    projectRoot,
    () => {
      reloadProjectConfig().catch((error: unknown) => {
        toast.error('Failed to load MCP servers', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    },
    { immediate: true },
  )

  return {
    localProjectConfig,
    reloadProjectConfig,
  }
}
