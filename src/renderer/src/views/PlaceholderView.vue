<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-2 text-center">
    <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">{{ title }}</h2>
    <p class="max-w-md text-sm text-gray-500 dark:text-gray-400">
      {{ description }}
    </p>
  </div>
</template>
