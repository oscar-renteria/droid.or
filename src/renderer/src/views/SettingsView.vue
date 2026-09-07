<script setup lang="ts">
import { NAlert, NButton, NInput, NSpin, NTag, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useAdbSettingsStore } from '@renderer/stores/adb-settings.store'

const adbSettingsStore = useAdbSettingsStore()
const message = useMessage()

onMounted(() => {
  void adbSettingsStore.load()
})

const customPathInput = ref('')
watch(
  () => adbSettingsStore.status?.customPath,
  (customPath) => {
    customPathInput.value = customPath ?? ''
  },
  { immediate: true }
)

const sourceLabel = computed(() => {
  switch (adbSettingsStore.status?.source) {
    case 'custom':
      return 'Custom path'
    case 'managed':
      return 'Downloaded platform-tools'
    case 'system':
      return 'System PATH'
    default:
      return null
  }
})

async function browsePath(): Promise<void> {
  const chosen = await adbSettingsStore.browseForExecutable()
  if (chosen) {
    customPathInput.value = chosen
  }
}

async function saveCustomPath(): Promise<void> {
  const trimmed = customPathInput.value.trim()
  const ok = await adbSettingsStore.setCustomPath(trimmed.length > 0 ? trimmed : null)
  if (ok) {
    message.success(trimmed.length > 0 ? 'Custom ADB path saved.' : 'Custom ADB path cleared.')
  }
}

async function clearCustomPath(): Promise<void> {
  customPathInput.value = ''
  const ok = await adbSettingsStore.setCustomPath(null)
  if (ok) {
    message.success('Custom ADB path cleared.')
  }
}

async function downloadPlatformTools(): Promise<void> {
  const ok = await adbSettingsStore.downloadPlatformTools()
  if (ok) {
    message.success('Platform-tools installed successfully.')
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-y-auto pr-1">
    <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">Settings</h2>

    <NSpin :show="adbSettingsStore.loading">
      <div class="flex flex-col gap-3 rounded border border-gray-200 p-4 dark:border-gray-800">
        <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">ADB Connection</h3>

        <NAlert v-if="adbSettingsStore.errorMessage" type="error" closable>
          {{ adbSettingsStore.errorMessage }}
        </NAlert>

        <template v-if="adbSettingsStore.status">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <NTag
              :type="adbSettingsStore.status.availability.available ? 'success' : 'error'"
              size="small"
            >
              {{ adbSettingsStore.status.availability.available ? 'Available' : 'Not available' }}
            </NTag>
            <span
              v-if="adbSettingsStore.status.availability.available"
              class="text-gray-600 dark:text-gray-400"
            >
              ADB {{ adbSettingsStore.status.availability.version }}
            </span>
            <NTag v-if="sourceLabel" size="small">{{ sourceLabel }}</NTag>
          </div>

          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ adbSettingsStore.status.resolvedPath }}
          </p>

          <NAlert
            v-if="!adbSettingsStore.status.availability.available"
            type="warning"
            :show-icon="true"
          >
            {{ adbSettingsStore.status.availability.reason }}
          </NAlert>

          <div class="border-t border-gray-100 pt-3 dark:border-gray-800">
            <template v-if="adbSettingsStore.status.managedSupported">
              <NButton :loading="adbSettingsStore.busy" @click="downloadPlatformTools">
                {{
                  adbSettingsStore.status.managedInstalled
                    ? 'Update Platform-Tools'
                    : 'Download Platform-Tools'
                }}
              </NButton>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Downloads the official Android platform-tools package directly from Google
                (dl.google.com) and manages ADB for you — no manual install needed.
              </p>
            </template>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400">
              A managed platform-tools download isn't available for this operating
              system/architecture. Install Android platform-tools manually, then set a custom path
              below.
            </p>
          </div>

          <div class="border-t border-gray-100 pt-3 dark:border-gray-800">
            <label class="text-xs font-medium text-gray-700 dark:text-gray-300"
              >Custom ADB path</label
            >
            <div class="mt-1 flex items-center gap-2">
              <NInput
                v-model:value="customPathInput"
                placeholder="/path/to/adb"
                :disabled="adbSettingsStore.busy"
              />
              <NButton :disabled="adbSettingsStore.busy" @click="browsePath">Browse…</NButton>
            </div>
            <div class="mt-2 flex items-center gap-2">
              <NButton
                type="primary"
                :loading="adbSettingsStore.busy"
                :disabled="customPathInput.trim() === (adbSettingsStore.status.customPath ?? '')"
                @click="saveCustomPath"
              >
                Save
              </NButton>
              <NButton
                v-if="adbSettingsStore.status.customPath"
                :disabled="adbSettingsStore.busy"
                @click="clearCustomPath"
              >
                Clear override
              </NButton>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Overrides both the downloaded and system-PATH ADB. Validated before it's saved.
            </p>
          </div>
        </template>
      </div>
    </NSpin>
  </div>
</template>
