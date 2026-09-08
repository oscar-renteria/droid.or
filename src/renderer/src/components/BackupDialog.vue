<script setup lang="ts">
import { NAlert, NButton, NModal, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useApkBackupStore } from '@renderer/stores/apk-backup.store'

const props = defineProps<{
  show: boolean
  deviceId: string
  packageNames: string[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  done: []
}>()

const backupStore = useApkBackupStore()
const destDir = ref<string | null>(null)

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      destDir.value = null
      backupStore.reset()
    }
  }
)

async function chooseDirectory(): Promise<void> {
  const chosen = await backupStore.browseForDirectory()
  if (chosen) {
    destDir.value = chosen
  }
}

async function startBackup(): Promise<void> {
  if (!destDir.value) {
    return
  }
  await backupStore.backup(props.deviceId, props.packageNames, destDir.value)
}

function close(): void {
  emit('update:show', false)
  if (backupStore.results) {
    emit('done')
  }
}

const succeededCount = computed(
  () => backupStore.results?.filter((result) => result.success).length ?? 0
)
const failedCount = computed(
  () => backupStore.results?.filter((result) => !result.success).length ?? 0
)
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="Backup APKs"
    style="width: 600px"
    @update:show="(value: boolean) => !value && close()"
  >
    <div v-if="!backupStore.results" class="flex flex-col gap-3">
      <p class="text-sm text-gray-700 dark:text-gray-300">
        Copies the APK file(s) for {{ packageNames.length }} selected app(s) to a folder you choose
        — each app gets its own subfolder, including every split file for apps installed as a
        bundle.
      </p>

      <NAlert type="warning" title="What this does not back up" :show-icon="true">
        Backing up an APK preserves the installer file only. It does not back up application data,
        accounts, encryption keys, DRM licenses, server-side data, or system state — reinstalling
        from this backup starts the app as if freshly installed.
      </NAlert>

      <div class="flex items-center gap-2">
        <NButton :disabled="backupStore.busy" @click="chooseDirectory">
          Choose destination folder…
        </NButton>
        <span v-if="destDir" class="truncate text-xs text-gray-500 dark:text-gray-400">{{
          destDir
        }}</span>
      </div>

      <NAlert v-if="backupStore.errorMessage" type="error">
        {{ backupStore.errorMessage }}
      </NAlert>
    </div>

    <div v-else class="flex max-h-96 flex-col gap-2 overflow-y-auto">
      <p class="text-sm text-gray-700 dark:text-gray-300">
        Backed up {{ succeededCount }} of {{ backupStore.results.length }} app(s){{
          failedCount > 0 ? ` — ${failedCount} failed` : ''
        }}.
      </p>
      <div
        v-for="result in backupStore.results"
        :key="result.packageName"
        class="rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
      >
        <div class="flex items-center gap-2">
          <span class="truncate font-medium text-gray-900 dark:text-gray-100">{{
            result.packageName
          }}</span>
          <NTag size="small" :type="result.success ? 'success' : 'error'">
            {{ result.success ? `${result.files.length} file(s)` : 'Failed' }}
          </NTag>
        </div>
        <p v-if="result.errorMessage" class="mt-1 text-xs text-red-600 dark:text-red-400">
          {{ result.errorMessage }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <NButton :disabled="backupStore.busy" @click="close">
          {{ backupStore.results ? 'Close' : 'Cancel' }}
        </NButton>
        <NButton
          v-if="!backupStore.results"
          type="primary"
          :disabled="!destDir"
          :loading="backupStore.busy"
          @click="startBackup"
        >
          Start Backup
        </NButton>
      </div>
    </template>
  </NModal>
</template>
