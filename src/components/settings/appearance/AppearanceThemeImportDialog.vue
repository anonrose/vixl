<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import { Button } from '@/components/shadcn/ui/button'
import { Checkbox } from '@/components/shadcn/ui/checkbox'
import { Label } from '@/components/shadcn/ui/label'
import type { ThemeFileSummary } from '@/services/appearance/theme-file-utils'

defineProps<{
  open: boolean
  summary: ThemeFileSummary | null
  /** Original file id when a collision forced a rename, otherwise `null`. */
  renamedFromId: string | null
  activate: boolean
  importing: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'update:activate': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <Dialog
    :open="open"
    @update:open="(value: boolean) => emit('update:open', value)"
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Import theme</DialogTitle>
        <DialogDescription>
          Review the theme before it is added to your library.
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="summary"
        class="space-y-2 text-sm"
      >
        <p class="font-medium">{{ summary.name }}</p>
        <p
          v-if="renamedFromId"
          class="text-muted-foreground"
        >
          Id {{ renamedFromId }} is already in use; the imported theme will be
          saved as <span class="font-mono">{{ summary.id }}</span>.
        </p>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt class="text-muted-foreground">Id</dt>
          <dd class="font-mono">{{ summary.id }}</dd>
          <dt class="text-muted-foreground">Variants</dt>
          <dd>{{ summary.variants.join(', ') }}</dd>
          <dt class="text-muted-foreground">Backgrounds</dt>
          <dd>
            light: {{ summary.backgrounds.light }}, dark:
            {{ summary.backgrounds.dark }}
          </dd>
          <dt class="text-muted-foreground">Fonts</dt>
          <dd>
            {{ summary.uiFontFamily }} / {{ summary.monoFontFamily }} ({{
              summary.uiFontSize
            }}px UI, {{ summary.editorFontSize }}px editor)
          </dd>
          <dt class="text-muted-foreground">Colors</dt>
          <dd>{{ summary.tokenCount }} semantic tokens</dd>
        </dl>

        <div class="flex items-center gap-2 pt-2">
          <Checkbox
            id="appearance-import-activate"
            :model-value="activate"
            @update:model-value="(value: boolean | 'indeterminate') => emit('update:activate', value === true)"
          />
          <Label for="appearance-import-activate">
            Activate the theme after importing
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="importing"
          @click="emit('update:open', false)"
        >
          Cancel
        </Button>
        <Button
          :disabled="importing || !summary"
          @click="emit('confirm')"
        >
          {{ importing ? 'Importing…' : 'Import' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
