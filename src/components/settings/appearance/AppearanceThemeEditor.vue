<script setup lang="ts">
import { AppIcon } from '@/icons'
import { ref } from 'vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import AppearanceBackgroundEditor from './AppearanceBackgroundEditor.vue'
import AppearanceColorField from './AppearanceColorField.vue'
import AppearanceGlassEditor from './AppearanceGlassEditor.vue'
import AppearanceIconEditor from './AppearanceIconEditor.vue'
import AppearancePreview from './AppearancePreview.vue'
import AppearanceTypographyEditor from './AppearanceTypographyEditor.vue'
import { ADVANCED_TOKEN_FIELDS, CORE_TOKEN_FIELDS, contrastTargetFor } from './appearance-ui'
import type { AppearanceEditorSection } from './use-appearance-editor'
import type {
  VixlThemeDefinition,
  VixlThemeSemanticTokens,
  VixlThemeTypography,
  VixlThemeCanvas,
  VixlThemeGlass,
  VixlThemeIconAppearance,
  VixlThemeVariantKind,
} from '@/types/appearance/theme'

defineProps<{
  draft: VixlThemeDefinition
  editingVariant: VixlThemeVariantKind
  isDirty: boolean
  isDraftValid: boolean
  applying?: boolean
}>()

const emit = defineEmits<{
  rename: [value: string]
  'set-variant': [variant: VixlThemeVariantKind]
  'set-token': [key: keyof VixlThemeSemanticTokens, value: string]
  'set-typography': [patch: Partial<VixlThemeTypography>]
  'set-canvas': [canvas: VixlThemeCanvas]
  'set-glass': [glass: VixlThemeGlass]
  'set-icons': [icons: VixlThemeIconAppearance]
  'reset-variant': []
  'reset-section': [section: AppearanceEditorSection]
  apply: []
  cancel: []
}>()

const advancedOpen = ref(false)
</script>

<template>
  <div class="space-y-6 rounded-lg border border-border p-4" data-testid="appearance-theme-editor">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <Label for="appearance-draft-name">Name</Label>
        <Input
          id="appearance-draft-name"
          class="h-8 w-56"
          :model-value="draft.name"
          maxlength="64"
          aria-label="Theme name"
          @update:model-value="(value: string | number) => emit('rename', String(value))"
        />
        <span v-if="isDirty" class="text-xs text-muted-foreground"> Unsaved changes </span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1" role="group" aria-label="Edit variant">
          <Button
            variant="ghost"
            size="sm"
            :class="
              editingVariant === 'light' ? 'bg-muted text-foreground' : 'text-muted-foreground'
            "
            :aria-pressed="editingVariant === 'light'"
            @click="emit('set-variant', 'light')"
          >
            Light variant
          </Button>
          <Button
            variant="ghost"
            size="sm"
            :class="
              editingVariant === 'dark' ? 'bg-muted text-foreground' : 'text-muted-foreground'
            "
            :aria-pressed="editingVariant === 'dark'"
            @click="emit('set-variant', 'dark')"
          >
            Dark variant
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reset current variant to Vixl defaults"
          @click="emit('reset-variant')"
        >
          <AppIcon name="rotate-ccw" class="h-4 w-4" />
          Reset variant
        </Button>
      </div>
    </div>

    <!-- Core semantic colors -->
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium">Semantic colors</p>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reset colors to Vixl defaults"
          data-testid="appearance-reset-colors"
          @click="emit('reset-section', 'colors')"
        >
          <AppIcon name="rotate-ccw" class="h-3 w-3" />
          Reset
        </Button>
      </div>
      <div class="grid gap-2 lg:grid-cols-2">
        <AppearanceColorField
          v-for="token in CORE_TOKEN_FIELDS"
          :key="token.key"
          :label="token.label"
          :model-value="draft.variants[editingVariant].colors[token.key]"
          :contrast-against="contrastTargetFor(token.key, draft.variants[editingVariant].colors)"
          @update:model-value="(value: string) => emit('set-token', token.key, value)"
        />
      </div>
    </div>

    <!-- Advanced tokens -->
    <Collapsible :open="advancedOpen" @update:open="(open: boolean) => (advancedOpen = open)">
      <CollapsibleTrigger as-child>
        <Button variant="ghost" size="sm" :aria-expanded="advancedOpen">
          {{ advancedOpen ? 'Hide' : 'Show' }} advanced tokens (charts, sidebar)
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent class="mt-2 space-y-2">
        <div class="grid gap-2 lg:grid-cols-2">
          <AppearanceColorField
            v-for="token in ADVANCED_TOKEN_FIELDS"
            :key="token.key"
            :label="token.label"
            :model-value="draft.variants[editingVariant].colors[token.key]"
            :contrast-against="contrastTargetFor(token.key, draft.variants[editingVariant].colors)"
            @update:model-value="(value: string) => emit('set-token', token.key, value)"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>

    <!-- Typography -->
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium">Typography</p>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reset typography to Vixl defaults"
          data-testid="appearance-reset-typography"
          @click="emit('reset-section', 'typography')"
        >
          <AppIcon name="rotate-ccw" class="h-3 w-3" />
          Reset
        </Button>
      </div>
      <AppearanceTypographyEditor
        :typography="draft.variants[editingVariant].typography"
        @update="(patch) => emit('set-typography', patch)"
      />
    </div>

    <!-- Background -->
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium">Canvas background</p>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reset canvas background to Vixl defaults"
          data-testid="appearance-reset-background"
          @click="emit('reset-section', 'background')"
        >
          <AppIcon name="rotate-ccw" class="h-3 w-3" />
          Reset
        </Button>
      </div>
      <AppearanceBackgroundEditor
        :canvas="draft.variants[editingVariant].canvas"
        @update:canvas="(canvas) => emit('set-canvas', canvas)"
      />
    </div>

    <!-- Glass surfaces -->
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium">Glass surfaces</p>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reset glass surfaces to Vixl defaults"
          data-testid="appearance-reset-glass"
          @click="emit('reset-section', 'glass')"
        >
          <AppIcon name="rotate-ccw" class="h-3 w-3" />
          Reset
        </Button>
      </div>
      <AppearanceGlassEditor
        :glass="draft.variants[editingVariant].glass"
        @update:glass="(glass) => emit('set-glass', glass)"
      />
    </div>

    <!-- Icons -->
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium">Icons</p>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reset icons to Vixl defaults"
          data-testid="appearance-reset-icons"
          @click="emit('reset-section', 'icons')"
        >
          <AppIcon name="rotate-ccw" class="h-3 w-3" />
          Reset
        </Button>
      </div>
      <AppearanceIconEditor
        :icons="draft.variants[editingVariant].icons"
        @update:icons="(icons) => emit('set-icons', icons)"
      />
    </div>

    <!-- Live preview -->
    <AppearancePreview
      :variant-theme="draft.variants[editingVariant]"
      :variant-kind="editingVariant"
    />

    <div class="flex items-center gap-2">
      <Button :disabled="!isDraftValid || applying" @click="emit('apply')"> Apply and save </Button>
      <Button variant="outline" @click="emit('cancel')"> Cancel </Button>
      <span v-if="!isDraftValid" class="text-xs text-destructive" role="alert">
        Fix invalid colors before applying.
      </span>
    </div>
  </div>
</template>
