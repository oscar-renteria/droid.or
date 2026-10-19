<script setup lang="ts">
import { computed, ref } from 'vue'
import { NIcon } from 'naive-ui'
import { FolderOpenOutline } from '@vicons/ionicons5'

const props = defineProps<{
  title: string
  hint: string
  clickable?: boolean
}>()

const emit = defineEmits<{
  (e: 'drop', paths: string[]): void
  (e: 'activate'): void
}>()

const dragCount = ref(0)
const active = computed(() => dragCount.value > 0)

function handleDragOver(event: DragEvent): void {
  event.preventDefault()
}

function handleDragEnter(event: DragEvent): void {
  event.preventDefault()
  dragCount.value += 1
}

function handleDragLeave(): void {
  dragCount.value = Math.max(0, dragCount.value - 1)
}

function handleDrop(event: DragEvent): void {
  event.preventDefault()
  dragCount.value = 0
  const files = event.dataTransfer?.files
  if (!files) return
  const paths: string[] = []
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i] as unknown as { path?: string }
    if (file.path) paths.push(file.path)
  }
  emit('drop', paths)
}

function handleActivate(): void {
  if (props.clickable) emit('activate')
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-2 rounded-lg border p-6 text-center transition-colors"
    :class="[
      active ? 'border-primary bg-primary/5' : 'border-dashed border-border',
      'text-text'
    ]"
    :role="props.clickable ? 'button' : undefined"
    :tabindex="props.clickable ? 0 : undefined"
    :aria-label="props.clickable ? props.title : undefined"
    @click="handleActivate"
    @keydown.enter.prevent="handleActivate"
    @keydown.space.prevent="handleActivate"
    @dragover.prevent="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <NIcon :component="FolderOpenOutline" size="28" class="text-text-muted" />
    <div class="font-medium text-text truncate max-w-xs">{{ title }}</div>
    <div class="text-xs text-text-muted truncate max-w-xs">{{ hint }}</div>
  </div>
</template>