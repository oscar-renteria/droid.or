<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { watch } from 'vue'
import { useErrorReportStore } from '@renderer/stores/error-report.store'

/** Renderless: shows each unexpected error as a toast. Must sit inside
 *  NMessageProvider so the toast follows the app theme. */
const errorReportStore = useErrorReportStore()
const message = useMessage()

watch(
  () => errorReportStore.latestNotice,
  (notice) => {
    if (notice) {
      message.error(
        `Something went wrong: ${notice.message}. Details were saved to the log (Logs → Open Log Folder).`,
        { duration: 8_000, closable: true }
      )
    }
  }
)
</script>

<template>
  <span hidden />
</template>
