<script setup lang="ts">
import { NButton, NIcon, NModal } from 'naive-ui'
import { LogoGithub } from '@vicons/ionicons5'
import { useAppInfo } from '@renderer/composables/useAppInfo'
import { useSupportLink } from '@renderer/composables/useSupportLink'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { appInfo } = useAppInfo()
const { opening, openSupportLink } = useSupportLink()

function close(): void {
  emit('update:show', false)
}

async function handleSupportClick(): Promise<void> {
  await openSupportLink('github-sponsors')
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
    <div class="flex flex-col gap-4 text-sm">
      <p class="text-text-secondary">Version {{ appInfo?.appVersion ?? 'unavailable' }}</p>

      <section class="flex flex-col gap-1">
        <h2 class="font-semibold text-text">License</h2>
        <p class="text-text-secondary">
          droid.or is free and open-source software licensed under the MIT License. See the included
          LICENSE file for details.
        </p>
      </section>

      <p class="text-xs text-text-muted">
        Android, Google Play, and ADB are trademarks of Google LLC. droid.or is an independent
        open-source project and is not affiliated with, sponsored by, or endorsed by Google LLC or
        the Android Open Source Project.
      </p>

      <section class="flex flex-col gap-2">
        <h2 class="font-semibold text-text">Support Development</h2>
        <p class="text-xs text-text-muted">
          Contributions are voluntary, do not unlock features, and are not tax-deductible.
        </p>
        <div class="flex flex-wrap gap-2">
          <NButton
            type="primary"
            :loading="opening"
            :disabled="opening"
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
        <NButton @click="close">Close</NButton>
      </div>
    </template>
  </NModal>
</template>
