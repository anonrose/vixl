<script setup lang="ts">
import { computed } from 'vue'
import { Minus, Plus } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import { THEME_GRADIENT_STOP_MAX, THEME_GRADIENT_STOP_MIN } from '@/schemas/appearance/theme'
import { clampStopPosition } from './appearance-ui'
import type { VixlThemeCanvasBackground } from '@/types/appearance/theme'
import AppearanceColorField from './AppearanceColorField.vue'

const props = defineProps<{
  canvas: VixlThemeCanvasBackground
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:canvas': [canvas: VixlThemeCanvasBackground]
}>()

const isGradient = computed(() => props.canvas.type === 'gradient')

const gradient = computed(() =>
  props.canvas.type === 'gradient' ? props.canvas : null,
)

const setKind = (type: VixlThemeCanvasBackground['type']): void => {
  if (type === props.canvas.type) {
    return
  }
  if (type === 'gradient') {
    const base = props.canvas.type === 'solid' ? props.canvas.color : props.canvas.stops[0]?.color ?? '#ffffff'
    emit('update:canvas', {
      type: 'gradient',
      angle: 180,
      stops: [
        { color: base, position: 0 },
        { color: base, position: 100 },
      ],
    })
    return
  }
  const base =
    props.canvas.type === 'gradient'
      ? (props.canvas.stops[0]?.color ?? '#ffffff')
      : props.canvas.color
  emit('update:canvas', { type: 'solid', color: base })
}

const handleAngle = (value: string | number): void => {
  if (!gradient.value) {
    return
  }
  const raw = Number(value)
  const angle = Number.isFinite(raw) ? ((Math.round(raw) % 360) + 360) % 360 : 0
  emit('update:canvas', { ...gradient.value, angle })
}

const handleStopColor = (index: number, color: string): void => {
  if (!gradient.value) {
    return
  }
  const stops = gradient.value.stops.map((stop, stopIndex) =>
    stopIndex === index ? { ...stop, color } : stop,
  )
  emit('update:canvas', { ...gradient.value, stops })
}

const handleStopPosition = (index: number, raw: string | number): void => {
  if (!gradient.value) {
    return
  }
  const position = clampStopPosition(Number(raw))
  const stops = gradient.value.stops.map((stop, stopIndex) =>
    stopIndex === index ? { ...stop, position } : stop,
  )
  emit('update:canvas', {
    ...gradient.value,
    stops: [...stops].sort((a, b) => a.position - b.position),
  })
}

const addStop = (): void => {
  if (!gradient.value || gradient.value.stops.length >= THEME_GRADIENT_STOP_MAX) {
    return
  }
  const stops = [...gradient.value.stops].sort((a, b) => a.position - b.position)
  const last = stops[stops.length - 1] ?? { color: '#ffffff', position: 100 }
  const previous = stops[stops.length - 2] ?? { ...last, position: 0 }
  const position = Math.round((previous.position + last.position) / 2)
  stops.splice(stops.length - 1, 0, { color: last.color, position })
  emit('update:canvas', { ...gradient.value, stops })
}

const removeStop = (index: number): void => {
  if (!gradient.value || gradient.value.stops.length <= THEME_GRADIENT_STOP_MIN) {
    return
  }
  emit('update:canvas', {
    ...gradient.value,
    stops: gradient.value.stops.filter((_, stopIndex) => stopIndex !== index),
  })
}
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex items-center gap-1"
      role="group"
      aria-label="Background type"
    >
      <Button
        variant="ghost"
        size="sm"
        :class="!isGradient ? 'bg-muted text-foreground' : 'text-muted-foreground'"
        :aria-pressed="!isGradient"
        :disabled="disabled"
        @click="setKind('solid')"
      >
        Solid
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :class="isGradient ? 'bg-muted text-foreground' : 'text-muted-foreground'"
        :aria-pressed="isGradient"
        :disabled="disabled"
        @click="setKind('gradient')"
      >
        Gradient
      </Button>
    </div>

    <AppearanceColorField
      v-if="!isGradient"
      label="Canvas color"
      :model-value="canvas.type === 'solid' ? canvas.color : '#ffffff'"
      :disabled="disabled"
      @update:model-value="(color: string) => emit('update:canvas', { type: 'solid', color })"
    />

    <template v-else-if="gradient">
      <div class="flex items-center gap-3">
        <Label
          for="appearance-gradient-angle"
          class="min-w-40 text-sm"
        >
          Gradient angle
        </Label>
        <input
          id="appearance-gradient-angle"
          type="range"
          min="0"
          max="360"
          step="1"
          class="h-2 w-40 accent-current"
          :value="gradient.angle"
          :disabled="disabled"
          aria-label="Gradient angle in degrees"
          @input="handleAngle(($event.target as HTMLInputElement).value)"
        >
        <Input
          class="h-7 w-20"
          type="number"
          :min="0"
          :max="360"
          :model-value="gradient.angle"
          :disabled="disabled"
          aria-label="Gradient angle numeric value"
          @update:model-value="handleAngle"
        />
        <span class="text-xs text-muted-foreground">degrees</span>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium">
          Gradient stops ({{ gradient.stops.length }}/{{ THEME_GRADIENT_STOP_MAX }})
        </p>
        <div
          v-for="(stop, index) in gradient.stops"
          :key="`${index}-${stop.position}`"
          class="flex items-center gap-2"
        >
          <span class="min-w-16 text-xs text-muted-foreground">Stop {{ index + 1 }}</span>
          <input
            type="color"
            class="h-7 w-9 cursor-pointer rounded border border-input bg-transparent p-0"
            :value="stop.color"
            :disabled="disabled"
            :aria-label="`Stop ${index + 1} color picker`"
            @input="handleStopColor(index, ($event.target as HTMLInputElement).value)"
          >
          <Input
            class="h-7 w-28 font-mono text-xs"
            :model-value="stop.color"
            :disabled="disabled"
            :aria-label="`Stop ${index + 1} hex value`"
            @update:model-value="(value: string | number) => handleStopColor(index, String(value))"
          />
          <Input
            class="h-7 w-20"
            type="number"
            :min="0"
            :max="100"
            :model-value="stop.position"
            :disabled="disabled"
            :aria-label="`Stop ${index + 1} position percent`"
            @update:model-value="(value: string | number) => handleStopPosition(index, value)"
          />
          <span class="text-xs text-muted-foreground">%</span>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="disabled || gradient.stops.length <= THEME_GRADIENT_STOP_MIN"
            :aria-label="`Remove stop ${index + 1}`"
            @click="removeStop(index)"
          >
            <Minus class="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          :disabled="disabled || gradient.stops.length >= THEME_GRADIENT_STOP_MAX"
          @click="addStop"
        >
          <Plus class="h-4 w-4" />
          Add stop
        </Button>
      </div>
    </template>
  </div>
</template>
