<script setup lang="ts">
import { NAlert, NButton, NIcon, NModal } from 'naive-ui'
import { LogoGithub } from '@vicons/ionicons5'
import { ref } from 'vue'
import { useAppInfo } from '@renderer/composables/useAppInfo'
import { useSupportLink } from '@renderer/composables/useSupportLink'
import { GITHUB_REPOSITORY } from '@shared/constants/repository'

// Plain links: the main process sends allow-listed https://github.com URLs
// to the system browser (window-security.ts), the same path the onboarding
// guide link uses — no extra IPC channel needed.
const REPOSITORY_URL = `https://github.com/${GITHUB_REPOSITORY}`
const NEW_ISSUE_URL = `${REPOSITORY_URL}/issues/new/choose`
const LINK_CLASS =
  'font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { appInfo } = useAppInfo()
const { opening, openSupportLink } = useSupportLink()
const openingNotices = ref(false)
const noticesError = ref('')

function close(): void {
  emit('update:show', false)
}

async function handleSupportClick(): Promise<void> {
  await openSupportLink('github-sponsors')
}

async function handleOpenThirdPartyNotices(): Promise<void> {
  if (openingNotices.value) return
  openingNotices.value = true
  noticesError.value = ''

  try {
    await window.droidor.openThirdPartyNotices()
  } catch (error) {
    noticesError.value =
      error instanceof Error ? error.message : 'Failed to open third-party notices.'
  } finally {
    openingNotices.value = false
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="About droid.or"
    aria-label="About droid.or"
    closable
    :bordered="false"
    class="text-text"
    style="width: 480px; max-width: calc(100vw - 32px)"
    @update:show="(value: boolean) => emit('update:show', value)"
    @close="close"
  >
    <div class="flex flex-col gap-5 text-sm">
      <p class="text-xs text-text-muted">Version {{ appInfo?.appVersion ?? 'unavailable' }}</p>

      <section class="flex flex-col gap-2">
        <div class="flex flex-col gap-1">
          <h2 class="font-semibold text-text">License</h2>
          <p class="text-text-secondary">
            droid.or is free and open-source software licensed under the MIT License. See the
            included LICENSE file for details.
          </p>
          <NButton
            text
            type="primary"
            :loading="openingNotices"
            :disabled="openingNotices"
            class="self-start"
            @click="handleOpenThirdPartyNotices"
          >
            View third-party notices
          </NButton>
          <NAlert v-if="noticesError" type="error" :show-icon="true">
            <p>
              Could not open third-party notices. Try again or open THIRD_PARTY_NOTICES.txt from the
              app's installation folder.
            </p>
            <p class="mt-1 text-xs">{{ noticesError }}</p>
          </NAlert>
        </div>
        <p class="text-xs leading-relaxed text-text-muted">
          Android, Google Play, and ADB are trademarks of Google LLC. droid.or is an independent
          open-source project and is not affiliated with, sponsored by, or endorsed by Google LLC or
          the Android Open Source Project.
        </p>
      </section>

      <section class="flex flex-col gap-2 border-t border-divider pt-4">
        <h2 class="font-semibold text-text">Project</h2>
        <p class="text-text-secondary">
          Found a bug or have an idea? Tell us on GitHub. If droid.or is useful to you, a star helps
          others find it.
        </p>
        <p class="flex flex-wrap gap-x-4 gap-y-1">
          <a :href="REPOSITORY_URL" target="_blank" rel="noopener noreferrer" :class="LINK_CLASS">
            Star on GitHub
          </a>
          <a :href="NEW_ISSUE_URL" target="_blank" rel="noopener noreferrer" :class="LINK_CLASS">
            Report an issue
          </a>
        </p>
        <p class="text-xs text-text-muted">Links open in your browser.</p>
      </section>

      <section class="flex flex-col gap-2 border-t border-divider pt-4">
        <h2 class="font-semibold text-text">Support Development</h2>
        <p class="text-xs text-text-muted">
          Contributions are voluntary, do not unlock features, and are not tax-deductible.
        </p>
        <div class="flex flex-wrap gap-2">
          <NButton
            type="primary"
            :loading="opening"
            :disabled="opening"
            class="about-support-action"
            @click="handleSupportClick"
          >
            <template #icon>
              <NIcon :component="LogoGithub" aria-hidden="true" />
            </template>
            Sponsor on GitHub
          </NButton>
        </div>
      </section>
    </div>
    <template #footer>
      <div class="flex justify-end">
        <NButton class="about-support-action" @click="close"> Close </NButton>
      </div>
    </template>
  </NModal>
</template>

<style>
.n-button.about-support-action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
