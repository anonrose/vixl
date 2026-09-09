<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Label } from '@/components/shadcn/ui/label'
import { NativeSelect } from '@/components/shadcn/ui/native-select'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import useVixlConfig from '@/composables/use-vixl-config'
import useAppearance from '@/composables/use-appearance'
import formatUnknownError from '@/utils/format-unknown-error'
import AppearanceModeSelect from '@/components/settings/appearance/AppearanceModeSelect.vue'
import AppearanceThemeActions from '@/components/settings/appearance/AppearanceThemeActions.vue'
import AppearanceThemeDialogs from '@/components/settings/appearance/AppearanceThemeDialogs.vue'
import AppearanceThemeEditor from '@/components/settings/appearance/AppearanceThemeEditor.vue'
import AppearanceThemeImportDialog from '@/components/settings/appearance/AppearanceThemeImportDialog.vue'
import { isBuiltInTheme } from '@/components/settings/appearance/appearance-ui'
import { useAppearanceEditor } from '@/components/settings/appearance/use-appearance-editor'
import { useAppearanceThemes } from '@/components/settings/appearance/use-appearance-themes'
import { useAppearanceSharing } from '@/components/settings/appearance/use-appearance-sharing'
import { BUILTIN_VIXL_THEME_ID } from '@/types/appearance/theme'
import type { VixlTheme } from '@/types/vixl/vixl-settings'

const config = useVixlConfig()
const runtime = useAppearance()
const {
  themes: savedThemes,
  activeTheme,
  isBuiltInActive,
  selectedThemeId,
  generateThemeId,
  saveTheme,
  removeTheme,
  renameTheme,
  setActiveTheme,
} = useAppearanceThemes()
const {
  draft,
  editingVariant,
  mode: editorMode,
  isEditing,
  isDirty,
  isDraftValid,
  beginCreate,
  beginEdit,
  beginDuplicate,
  cancel: cancelDraft,
  setVariant,
  rename,
  setToken,
  setTypography,
  setCanvas,
  resetVariant,
} = useAppearanceEditor()

const renameOpen = ref(false)
const renameValue = ref('')
const deleteOpen = ref(false)
const cancelOpen = ref(false)
const applying = ref(false)

// Shareable-theme import/export (cancellation is always a silent no-op).
const {
  importOpen,
  importActivate,
  pendingImport,
  importing,
  exporting,
  closeImport,
  handleImport,
  handleImportConfirm,
  handleExport,
} = useAppearanceSharing({
  existingThemeIds: () => savedThemes.value.map((entry) => entry.id),
  exportTarget: () => (selectedIsBuiltIn.value ? null : selectedTheme.value),
})

const theme = computed(
  () => config.effectiveSettings.value['appearance.theme'] ?? 'system',
)

const themeOptions = computed(() => [
  { id: BUILTIN_VIXL_THEME_ID, name: 'Vixl Default' },
  ...savedThemes.value.map((entry) => ({ id: entry.id, name: entry.name })),
])

const selectedTheme = computed(() => activeTheme.value)
const selectedIsBuiltIn = computed(() => isBuiltInTheme(selectedTheme.value))

const setMode = async (value: VixlTheme): Promise<void> => {
  try {
    await config.setTheme('personal', value)
  } catch (error) {
    toast.error('Failed to save mode', {
      description: formatUnknownError(error),
    })
  }
}

const handleSelectTheme = async (id: string): Promise<void> => {
  try {
    await setActiveTheme(id === BUILTIN_VIXL_THEME_ID ? null : id)
  } catch (error) {
    toast.error('Failed to switch theme', {
      description: formatUnknownError(error),
    })
  }
}

const startEditing = (mode: 'create' | 'edit' | 'duplicate'): void => {
  // In System mode the editor targets the currently resolved variant.
  const variant = runtime.effectiveAppearance.value.variant
  const id = generateThemeId(
    mode === 'duplicate' ? `${selectedTheme.value.name} copy` : 'Untitled theme',
  )
  if (mode === 'create') {
    beginCreate(selectedTheme.value, id, variant)
  } else if (mode === 'duplicate') {
    beginDuplicate(selectedTheme.value, id, variant)
  } else {
    beginEdit(selectedTheme.value, id, variant)
  }
}

const handleRenameConfirm = async (): Promise<void> => {
  const nextName = renameValue.value.trim()
  if (!nextName) {
    toast.error('Theme name is required')
    return
  }
  try {
    if (!(await renameTheme(selectedTheme.value.id, nextName))) {
      toast.error('Failed to rename theme')
      return
    }
    renameOpen.value = false
    toast.success('Theme renamed')
  } catch (error) {
    toast.error('Failed to rename theme', {
      description: formatUnknownError(error),
    })
  }
}

const handleDelete = async (): Promise<void> => {
  const wasActive = !isBuiltInActive.value && selectedTheme.value.id !== BUILTIN_VIXL_THEME_ID
  try {
    if (!(await removeTheme(selectedTheme.value.id))) {
      toast.error('Failed to delete theme')
      return
    }
    deleteOpen.value = false
    toast.success(wasActive ? 'Theme deleted; reverted to Vixl Default' : 'Theme deleted')
  } catch (error) {
    toast.error('Failed to delete theme', {
      description: formatUnknownError(error),
    })
  }
}

const handleApply = async (): Promise<void> => {
  if (!draft.value || !isDraftValid.value) {
    toast.error('Theme is invalid', {
      description: 'Fix invalid color values before saving.',
    })
    return
  }
  applying.value = true
  try {
    const wasNew = editorMode.value !== 'edit'
    if (!(await saveTheme(draft.value, { activate: true }))) {
      toast.error('Failed to save theme')
      return
    }
    cancelDraft()
    toast.success(wasNew ? 'Theme created and applied' : 'Theme saved and applied')
  } catch (error) {
    toast.error('Failed to save theme', {
      description: formatUnknownError(error),
    })
  } finally {
    applying.value = false
  }
}

const handleCancelRequest = (): void => {
  if (isDirty.value) {
    cancelOpen.value = true
    return
  }
  cancelDraft()
}

const handleDiscard = (): void => {
  cancelOpen.value = false
  cancelDraft()
}

// Live preview: experimental edits render immediately without persisting.
watch(
  [draft, editingVariant],
  () => {
    if (draft.value) {
      runtime.updatePreview({ theme: draft.value, variant: editingVariant.value })
    } else if (runtime.isPreviewing.value) {
      runtime.cancelPreview()
    }
  },
  { deep: true },
)

// Never leave stale preview state behind when the editor closes.
onUnmounted(() => {
  if (draft.value) {
    cancelDraft()
  }
  runtime.cancelPreview()
})
</script>

<template>
  <SettingsSectionScroll title="Appearance">
    <div class="space-y-8">
      <!-- Color mode (moved from General so there is a single control) -->
      <AppearanceModeSelect
        :mode="theme"
        @select="setMode"
      />

      <!-- Theme selection and management -->
      <div class="space-y-2">
        <Label for="appearance-theme-select">Theme</Label>
        <div class="flex flex-wrap items-center gap-2">
          <NativeSelect
            id="appearance-theme-select"
            :model-value="selectedThemeId"
            class="w-56"
            aria-label="Active appearance theme"
            @change="handleSelectTheme(($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="option in themeOptions"
              :key="option.id"
              :value="option.id"
            >
              {{ option.name }}
            </option>
          </NativeSelect>

          <AppearanceThemeActions
            :selected-is-built-in="selectedIsBuiltIn"
            :importing="importing"
            :exporting="exporting"
            @create="startEditing('create')"
            @edit="startEditing('edit')"
            @duplicate="startEditing('duplicate')"
            @rename="renameValue = selectedTheme.name; renameOpen = true"
            @delete="deleteOpen = true"
            @export="handleExport"
            @import="handleImport"
          />
        </div>
      </div>

      <!-- Theme editor (draft; nothing persists until Apply) -->
      <AppearanceThemeEditor
        v-if="isEditing && draft"
        :draft="draft"
        :editing-variant="editingVariant"
        :is-dirty="isDirty"
        :is-draft-valid="isDraftValid"
        :applying="applying"
        @rename="rename"
        @set-variant="setVariant"
        @set-token="setToken"
        @set-typography="setTypography"
        @set-canvas="setCanvas"
        @reset-variant="resetVariant(); toast.success(`Reset ${editingVariant} variant to Vixl defaults`)"
        @apply="handleApply"
        @cancel="handleCancelRequest"
      />
    </div>

    <!-- Confirmation and rename dialogs -->
    <AppearanceThemeDialogs
      :theme-name="selectedTheme.name"
      :rename-open="renameOpen"
      :rename-value="renameValue"
      :delete-open="deleteOpen"
      :cancel-open="cancelOpen"
      @update:rename-open="(open: boolean) => (renameOpen = open)"
      @update:rename-value="(value: string) => (renameValue = value)"
      @update:delete-open="(open: boolean) => (deleteOpen = open)"
      @update:cancel-open="(open: boolean) => (cancelOpen = open)"
      @confirm-rename="handleRenameConfirm"
      @confirm-delete="handleDelete"
      @discard="handleDiscard"
    />

    <!-- Import summary and confirmation -->
    <AppearanceThemeImportDialog
      :open="importOpen"
      :summary="pendingImport?.summary ?? null"
      :renamed-from-id="pendingImport?.renamedFromId ?? null"
      :activate="importActivate"
      :importing="importing"
      @update:open="(open: boolean) => (open ? (importOpen = true) : closeImport())"
      @update:activate="(value: boolean) => (importActivate = value)"
      @confirm="handleImportConfirm"
    />
  </SettingsSectionScroll>
</template>
