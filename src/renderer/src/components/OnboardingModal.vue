<script setup lang="ts">
import { NAlert, NButton, NModal } from 'naive-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { GITHUB_REPOSITORY } from '@shared/constants/repository'
import { useAdbAvailability } from '@renderer/composables/useAdbAvailability'
import { useAppInfo } from '@renderer/composables/useAppInfo'
import { useOnboardingStore } from '@renderer/stores/onboarding.store'
import { useSafetyDisclaimerStore } from '@renderer/stores/safety-disclaimer.store'

const ADB_GUIDE_URL = `https://github.com/${GITHUB_REPOSITORY}/blob/master/ADB.md`

const onboardingStore = useOnboardingStore()
const disclaimerStore = useSafetyDisclaimerStore()
const router = useRouter()
const { adbAvailability } = useAdbAvailability()
const { appInfo } = useAppInfo()

// Never stacked on top of the safety disclaimer: on a first run it
// appears right after the disclaimer is accepted.
const show = computed(
  () =>
    onboardingStore.reopened ||
    (!onboardingStore.seen && !disclaimerStore.loading && disclaimerStore.acknowledgedAt !== null)
)

function openAdbSettings(): void {
  onboardingStore.dismiss()
  void router.push({ name: 'settings' })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="Connect your Android device"
    style="width: 600px"
    :mask-closable="false"
    @close="onboardingStore.dismiss()"
  >
    <div class="flex flex-col gap-4 text-sm text-text-secondary">
      <ol class="flex list-decimal flex-col gap-2 pl-5">
        <li>
          <span class="font-medium text-text">Turn on Developer options</span> — on the phone, open
          Settings → About phone and tap <span class="font-medium text-text">Build number</span>
          seven times.
        </li>
        <li>
          <span class="font-medium text-text">Turn on USB debugging</span> — Settings → System →
          Developer options → USB debugging. (The menu location varies slightly by manufacturer.)
        </li>
        <li>
          <span class="font-medium text-text">Connect over USB</span> and accept
          <span class="font-medium text-text">"Allow USB debugging?"</span> on the phone. The device
          then appears in the sidebar.
        </li>
      </ol>

      <NAlert v-if="adbAvailability?.available" type="success" title="ADB is ready">
        Using adb {{ adbAvailability.version }}.
      </NAlert>
      <NAlert v-else-if="adbAvailability" type="warning" title="ADB is not available yet">
        <div class="flex flex-col items-start gap-2">
          <span>{{ adbAvailability.reason }}</span>
          <NButton size="small" @click="openAdbSettings"> Set up ADB in Settings </NButton>
        </div>
      </NAlert>

      <p v-if="appInfo?.platform === 'win32'">
        <span class="font-medium text-text">Windows:</span> if the phone isn't detected, install
        your manufacturer's USB driver (Google's USB driver covers Pixel devices).
      </p>

      <p>
        More help:
        <a
          :href="ADB_GUIDE_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ADB setup and troubleshooting guide
        </a>
        <span class="text-text-muted"> (opens in your browser)</span>
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <NButton type="primary" @click="onboardingStore.dismiss()">Get started</NButton>
      </div>
    </template>
  </NModal>
</template>
