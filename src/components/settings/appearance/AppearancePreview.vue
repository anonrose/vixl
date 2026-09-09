<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle } from '@lucide/vue'
import {
  canvasToCss,
  contrastWarnings,
  fontStackCss,
} from './appearance-ui'
import type { VixlThemeVariant, VixlThemeVariantKind } from '@/types/appearance/theme'

const props = defineProps<{
  variantTheme: VixlThemeVariant
  variantKind: VixlThemeVariantKind
}>()

const typography = computed(() => props.variantTheme.typography)
const tokens = computed(() => props.variantTheme.colors)
const editor = computed(() => props.variantTheme.editor)

const canvasStyle = computed(() => ({
  background: canvasToCss(
    props.variantTheme.canvas,
    props.variantTheme.colors.background,
  ),
}))

const uiFontStack = computed(() => fontStackCss(typography.value, 'ui'))
const monoFontStack = computed(() => fontStackCss(typography.value, 'mono'))

const tokenStyles = computed(() => {
  const t = tokens.value
  return {
    foreground: { color: t.foreground },
    primaryButton: { background: t.primary, color: t.primaryForeground },
    secondaryButton: { background: t.secondary, color: t.secondaryForeground },
    input: { background: t.background, color: t.foreground, borderColor: t.input },
    card: { background: t.card, color: t.cardForeground, borderColor: t.border },
    sidebar: { background: t.sidebar, color: t.sidebarForeground, borderColor: t.sidebarBorder },
    muted: { color: t.mutedForeground },
    destructive: { color: t.destructive },
    code: {
      background: editor.value.background,
      color: editor.value.foreground,
      borderColor: editor.value.hoverWidgetBorder,
      fontSize: `${typography.value.editorFontSize}px`,
      fontFamily: monoFontStack.value,
    },
  }
})

const codeKeywordStyle = computed(() => ({ color: editor.value.keyword }))
const codeStringStyle = computed(() => ({ color: editor.value.string }))
const codeCommentStyle = computed(() => ({ color: editor.value.comment }))

const warnings = computed(() => contrastWarnings(tokens.value))
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-medium">Preview ({{ variantKind }} variant)</p>
    <div
      class="rounded-lg border border-border p-4"
      :style="{ ...canvasStyle, fontFamily: uiFontStack, fontSize: `${typography.uiFontSize}px` }"
      data-testid="appearance-preview-canvas"
    >
      <div class="flex gap-3">
        <div
          class="w-28 shrink-0 rounded-md border p-2"
          :style="tokenStyles.sidebar"
          data-testid="appearance-preview-sidebar"
        >
          <p
            class="text-xs font-medium"
            :style="tokenStyles.foreground"
          >
            Sidebar
          </p>
          <p
            class="mt-1 text-[10px]"
            :style="tokenStyles.muted"
          >
            Nav item
          </p>
        </div>
        <div class="min-w-0 flex-1 space-y-3">
          <p
            class="text-sm font-medium"
            :style="tokenStyles.foreground"
          >
            Heading text
          </p>
          <p
            class="text-xs"
            :style="tokenStyles.muted"
          >
            Body copy at {{ typography.uiFontSize }}px.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-md px-3 py-1 text-xs font-medium"
              :style="tokenStyles.primaryButton"
            >
              Primary
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1 text-xs font-medium"
              :style="tokenStyles.secondaryButton"
            >
              Secondary
            </button>
            <span
              class="text-xs font-medium"
              :style="tokenStyles.destructive"
            >
              Destructive
            </span>
          </div>
          <div
            class="rounded-md border px-2 py-1 text-xs"
            :style="tokenStyles.input"
            data-testid="appearance-preview-input"
          >
            Input placeholder
          </div>
          <div
            class="rounded-md border p-2"
            :style="tokenStyles.card"
            data-testid="appearance-preview-card"
          >
            <p class="text-xs font-medium">Card surface</p>
            <p
              class="mt-1 text-[10px]"
              :style="tokenStyles.muted"
            >
              Cards keep semantic surface tokens.
            </p>
          </div>
          <pre
            class="overflow-x-auto rounded-md border p-2"
            :style="tokenStyles.code"
            data-testid="appearance-preview-code"
          ><code><span :style="codeCommentStyle">// code sample</span>
<span :style="codeKeywordStyle">const</span> theme = <span :style="codeStringStyle">'vixl'</span></code></pre>
        </div>
      </div>
    </div>

    <div
      v-if="warnings.length > 0"
      class="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2"
      role="alert"
      data-testid="appearance-contrast-warnings"
    >
      <p class="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        <AlertTriangle class="h-3 w-3" />
        Low-contrast combinations (values kept as chosen)
      </p>
      <ul class="list-inside list-disc text-xs text-amber-700 dark:text-amber-400">
        <li
          v-for="warning in warnings"
          :key="warning.label"
        >
          {{ warning.label }}: {{ warning.ratio.toFixed(1) }}:1 (minimum 4.5:1)
        </li>
      </ul>
    </div>
  </div>
</template>
