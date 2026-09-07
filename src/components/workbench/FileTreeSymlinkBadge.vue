<script setup lang="ts">
import { FolderSymlink } from '@lucide/vue'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <span
        class="inline-flex size-3.5 shrink-0 items-center justify-center"
        aria-label="Symlink"
      >
        <FolderSymlink class="size-3.5 shrink-0 text-violet-400 dark:text-violet-300" />
      </span>
    </TooltipTrigger>
    <TooltipContent>Symlink</TooltipContent>
  </Tooltip>
</template>
