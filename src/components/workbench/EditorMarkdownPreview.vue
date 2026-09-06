<script setup lang="ts">
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'

defineProps<{
  content: string
}>()
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <div class="px-4 py-3 text-sm">
      <Markdown
        v-if="content.trim()"
        :content="content"
        :enable-animate="false"
      />
    </div>
  </div>
</template>
