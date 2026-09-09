<script setup lang="ts">
import { Copy, Download, Pencil, Plus, SquarePen, Trash2, Upload } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'

defineProps<{
  selectedIsBuiltIn: boolean
  importing: boolean
  exporting: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: []
  duplicate: []
  rename: []
  delete: []
  export: []
  import: []
}>()
</script>

<template>
  <Button
    variant="ghost"
    size="icon-sm"
    aria-label="Create theme from current"
    title="Create theme from current"
    @click="emit('create')"
  >
    <Plus class="h-4 w-4" />
  </Button>
  <Button
    variant="ghost"
    size="icon-sm"
    aria-label="Edit selected theme"
    title="Edit selected theme"
    @click="emit('edit')"
  >
    <Pencil class="h-4 w-4" />
  </Button>
  <Button
    variant="ghost"
    size="icon-sm"
    aria-label="Duplicate selected theme"
    title="Duplicate selected theme"
    @click="emit('duplicate')"
  >
    <Copy class="h-4 w-4" />
  </Button>
  <Button
    variant="ghost"
    size="icon-sm"
    :disabled="selectedIsBuiltIn"
    aria-label="Rename selected theme"
    title="Rename selected theme"
    @click="emit('rename')"
  >
    <SquarePen class="h-4 w-4" />
  </Button>
  <Button
    variant="ghost"
    size="icon-sm"
    :disabled="selectedIsBuiltIn"
    aria-label="Delete selected theme"
    title="Delete selected theme"
    @click="emit('delete')"
  >
    <Trash2 class="h-4 w-4" />
  </Button>
  <Button
    variant="ghost"
    size="icon-sm"
    :disabled="selectedIsBuiltIn || exporting"
    aria-label="Export selected theme"
    title="Export selected theme"
    @click="emit('export')"
  >
    <Download class="h-4 w-4" />
  </Button>
  <Button
    variant="ghost"
    size="icon-sm"
    :disabled="importing"
    aria-label="Import a theme file"
    title="Import a theme file"
    @click="emit('import')"
  >
    <Upload class="h-4 w-4" />
  </Button>
</template>
