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
  drop: [files: File[]]
  activate: []
}>()

// A counter rather than a boolean: dragenter/dragleave also fire when the
// pointer crosses child elements, which would otherwise flicker the highlight.
const dragCount = ref(0)
const active = computed(() => dragCount.value > 0)

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
  emit('drop', Array.from(event.dataTransfer?.files ?? []))
}

function handleActivate(): void {
  if (props.clickable) {
    emit('activate')
  }
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors"
    :class="[
      active ? 'border-primary bg-primary/5' : 'border-border-strong',
      clickable
        ? 'cursor-pointer hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        : ''
    ]"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="handleActivate"
    @keydown.enter.prevent="handleActivate"
    @keydown.space.prevent="handleActivate"
    @dragover.prevent
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <NIcon :component="FolderOpenOutline" :size="28" class="text-text-muted" />
    <p class="max-w-md text-sm font-medium text-text-secondary">{{ title }}</p>
    <p class="max-w-md text-xs text-text-muted">{{ hint }}</p>
  </div>
</template>
