<script setup lang="ts">
import type { AiProviderId } from '@shared/types/ai-settings'
import {
  NAlert,
  NButton,
  NInput,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpin,
  NTag,
  useMessage
} from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import PageHeader from '@renderer/components/ui/PageHeader.vue'
import { useAdbSettingsStore } from '@renderer/stores/adb-settings.store'
import { useAiSettingsStore } from '@renderer/stores/ai-settings.store'
import { useSettingsStore, type ThemeMode } from '@renderer/stores/settings.store'

const adbSettingsStore = useAdbSettingsStore()
const aiSettingsStore = useAiSettingsStore()
const settingsStore = useSettingsStore()
const message = useMessage()

const themeOptions: Array<{ label: string; value: ThemeMode }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' }
]

onMounted(() => {
  void adbSettingsStore.load()
  void aiSettingsStore.load()
})

type AiProviderSelection = AiProviderId | 'none'

const aiProviderOptions: Array<{ label: string; value: AiProviderSelection }> = [
  { label: 'Disabled', value: 'none' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'OpenAI-compatible', value: 'openai-compatible' }
]

const providerInput = ref<AiProviderSelection>('none')
const modelInput = ref('')
const baseUrlInput = ref('')
const apiKeyInput = ref('')
const aiSaving = ref(false)

watch(
  () => aiSettingsStore.settings,
  (settings) => {
    providerInput.value = settings?.provider ?? 'none'
    modelInput.value = settings?.model ?? ''
    baseUrlInput.value = settings?.baseUrl ?? ''
  },
  { immediate: true }
)

async function saveAiSettings(): Promise<void> {
  aiSaving.value = true
  try {
    const ok = await aiSettingsStore.save({
      provider: providerInput.value === 'none' ? null : providerInput.value,
      model: modelInput.value.trim().length > 0 ? modelInput.value.trim() : null,
      baseUrl: baseUrlInput.value.trim().length > 0 ? baseUrlInput.value.trim() : null,
      // Leave the stored key untouched unless the user actually typed a
      // new one — never resend/overwrite it with an empty value just
      // because the field is (as always) blank on load.
      apiKey: apiKeyInput.value.length > 0 ? apiKeyInput.value : undefined
    })
    if (ok) {
      apiKeyInput.value = ''
      message.success('AI settings saved.')
    }
  } finally {
    aiSaving.value = false
  }
}

async function clearAiApiKey(): Promise<void> {
  aiSaving.value = true
  try {
    const ok = await aiSettingsStore.save({
      provider: providerInput.value === 'none' ? null : providerInput.value,
      model: modelInput.value.trim().length > 0 ? modelInput.value.trim() : null,
      baseUrl: baseUrlInput.value.trim().length > 0 ? baseUrlInput.value.trim() : null,
      apiKey: null
    })
    if (ok) {
      apiKeyInput.value = ''
      message.success('API key cleared.')
    }
  } finally {
    aiSaving.value = false
  }
}

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
  <div>
    <!-- No scroll container of its own: AppShell's content area already
         scrolls, and a nested one scrolled the page header out of view. -->
    <div class="flex flex-col gap-4 pb-4">
      <PageHeader title="Settings" />

      <NSpin :show="adbSettingsStore.loading">
        <div class="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 class="text-sm font-semibold text-text">ADB Connection</h2>

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
              <span v-if="adbSettingsStore.status.availability.available" class="text-text-muted">
                ADB {{ adbSettingsStore.status.availability.version }}
              </span>
              <NTag v-if="sourceLabel" size="small">{{ sourceLabel }}</NTag>
            </div>

            <p class="truncate text-xs text-text-muted">
              {{ adbSettingsStore.status.resolvedPath }}
            </p>

            <NAlert
              v-if="!adbSettingsStore.status.availability.available"
              type="warning"
              :show-icon="true"
            >
              {{ adbSettingsStore.status.availability.reason }}
            </NAlert>

            <div class="border-t border-divider pt-3">
              <template v-if="adbSettingsStore.status.managedSupported">
                <NButton :loading="adbSettingsStore.busy" @click="downloadPlatformTools">
                  {{
                    adbSettingsStore.status.managedInstalled
                      ? 'Update Platform-Tools'
                      : 'Download Platform-Tools'
                  }}
                </NButton>
                <p class="mt-1 text-xs text-text-muted">
                  Downloads the official Android platform-tools package directly from Google
                  (dl.google.com) and manages ADB for you — no manual install needed.
                </p>
              </template>
              <p v-else class="text-xs text-text-muted">
                A managed platform-tools download isn't available for this operating
                system/architecture. Install Android platform-tools manually, then set a custom path
                below.
              </p>
            </div>

            <div class="border-t border-divider pt-3">
              <label for="settings-adb-path" class="text-xs font-medium text-text-secondary">
                Custom ADB path
              </label>
              <div class="mt-1 flex items-center gap-2">
                <NInput
                  v-model:value="customPathInput"
                  placeholder="/path/to/adb"
                  :disabled="adbSettingsStore.busy"
                  :input-props="{ id: 'settings-adb-path' }"
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
              <p class="mt-1 text-xs text-text-muted">
                Overrides both the downloaded and system-PATH ADB. Validated before it's saved.
              </p>
            </div>
          </template>
        </div>
      </NSpin>

      <div class="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 class="text-sm font-semibold text-text">Appearance</h2>
        <p class="text-xs text-text-muted">
          "System" follows your operating system's light/dark setting and updates live.
        </p>
        <div class="flex flex-col items-start gap-1">
          <span id="settings-theme-label" class="text-xs font-medium text-text-secondary">
            Theme
          </span>
          <NRadioGroup
            :value="settingsStore.themeMode"
            aria-labelledby="settings-theme-label"
            @update:value="(mode: ThemeMode) => settingsStore.setThemeMode(mode)"
          >
            <NRadioButton v-for="option in themeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </NRadioButton>
          </NRadioGroup>
        </div>
      </div>

      <NSpin :show="aiSettingsStore.loading">
        <div class="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 class="text-sm font-semibold text-text">AI Analysis (optional)</h2>
          <p class="text-xs text-text-muted">
            Off by default. When enabled, an "Ask AI" button becomes available on individual
            packages — nothing is sent anywhere unless you click it. This never runs automatically
            or in bulk, and an AI opinion is never treated as authoritative — it's shown alongside
            droid.or's own local classification, not in place of it.
          </p>
          <div class="text-xs text-text-muted">
            <p>Each request sends only:</p>
            <ul class="mt-1 list-inside list-disc">
              <li>the device's manufacturer, model, and Android version</li>
              <li>the package name, app label, and version</li>
              <li>the permissions the app requests</li>
              <li>whether it's a system app</li>
            </ul>
          </div>

          <NAlert v-if="aiSettingsStore.errorMessage" type="error" closable>
            {{ aiSettingsStore.errorMessage }}
          </NAlert>

          <div>
            <label for="settings-ai-provider" class="text-xs font-medium text-text-secondary">
              Provider
            </label>
            <NSelect
              v-model:value="providerInput"
              :options="aiProviderOptions"
              class="mt-1"
              :input-props="{ id: 'settings-ai-provider' }"
            />
          </div>

          <template v-if="providerInput !== 'none'">
            <div>
              <label for="settings-ai-model" class="text-xs font-medium text-text-secondary">
                Model
              </label>
              <NInput
                v-model:value="modelInput"
                class="mt-1"
                :input-props="{ id: 'settings-ai-model' }"
                :placeholder="
                  providerInput === 'anthropic' ? 'e.g. claude-sonnet-5' : 'e.g. gpt-4o-mini'
                "
              />
            </div>

            <div v-if="providerInput === 'openai-compatible'">
              <label for="settings-ai-base-url" class="text-xs font-medium text-text-secondary">
                Base URL (optional)
              </label>
              <NInput
                v-model:value="baseUrlInput"
                class="mt-1"
                :input-props="{ id: 'settings-ai-base-url' }"
                placeholder="https://api.openai.com/v1"
              />
              <p class="mt-1 text-xs text-text-muted">
                Leave blank for OpenAI itself, or point at any OpenAI-compatible endpoint (Azure
                OpenAI, a self-hosted proxy, ...).
              </p>
            </div>

            <div>
              <label for="settings-ai-api-key" class="text-xs font-medium text-text-secondary">
                API key
              </label>
              <NInput
                v-model:value="apiKeyInput"
                class="mt-1"
                type="password"
                show-password-on="click"
                :input-props="{ id: 'settings-ai-api-key' }"
                :placeholder="
                  aiSettingsStore.settings?.hasApiKey ? 'A key is already set' : 'sk-...'
                "
              />
              <p class="mt-1 text-xs text-text-muted">
                Stored encrypted using this OS's own secret storage. Leave blank to keep the
                existing key when saving other fields.
              </p>
            </div>

            <div class="flex items-center gap-2">
              <NButton type="primary" :loading="aiSaving" @click="saveAiSettings">Save</NButton>
              <NButton
                v-if="aiSettingsStore.settings?.hasApiKey"
                :loading="aiSaving"
                @click="clearAiApiKey"
              >
                Clear API key
              </NButton>
            </div>
          </template>
          <div v-else class="flex items-center gap-2">
            <NButton type="primary" :loading="aiSaving" @click="saveAiSettings">Save</NButton>
          </div>
        </div>
      </NSpin>
    </div>
  </div>
</template>
