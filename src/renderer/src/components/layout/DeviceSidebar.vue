<script setup lang="ts">
import { NEmpty } from 'naive-ui'
</script>

<template>
  <aside class="flex h-full w-64 flex-col border-r border-gray-200 dark:border-gray-800">
    <div
      class="px-4 py-3 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
    >
      Devices
    </div>
    <div class="flex flex-1 items-center justify-center px-4">
      <NEmpty description="No devices yet" size="small">
        <template #extra>
          <p class="max-w-[16rem] text-center text-xs text-gray-500 dark:text-gray-400">
            Connect an Android phone via USB with USB debugging enabled.
          </p>
        </template>
      </NEmpty>
    </div>
  </aside>
</template>
