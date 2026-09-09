import { toast } from 'vue-sonner'
import type { ShallowRef } from 'vue'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import { loadEffectiveSettings } from '@/services/config/vixl-config'

export default (
  root: () => string | null,
): { settings: ShallowRef<VixlSettings>; reload: () => Promise<void> } => {
  const { personalSettings } = useVixlConfig()

  const settings = shallowRef<VixlSettings>(personalSettings.value)
  let loadGeneration = 0

  const reload = async (): Promise<void> => {
    const generation = loadGeneration + 1
    loadGeneration = generation
    try {
      const loaded = await loadEffectiveSettings(root())
      if (generation !== loadGeneration) {
        return
      }
      settings.value = loaded
    } catch (error) {
      if (generation !== loadGeneration) {
        return
      }
      toast.error('Failed to load project settings', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  watch(
    root,
    () => {
      reload().catch((error: unknown) => {
        toast.error('Failed to load project settings', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    },
    { immediate: true },
  )

  return {
    settings,
    reload,
  }
}
