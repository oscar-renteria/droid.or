<script setup lang="ts">
import { NButton, NModal } from 'naive-ui'
import { useSafetyDisclaimerStore } from '@renderer/stores/safety-disclaimer.store'

const store = useSafetyDisclaimerStore()

async function handleAccept(): Promise<void> {
  await store.acknowledge()
}
</script>

<template>
  <NModal
    :show="!store.loading && store.acknowledgedAt === null"
    :mask-closable="false"
    :close-on-esc="false"
    :closable="false"
    preset="card"
    title="Before you start"
    style="width: 640px"
  >
    <div class="flex flex-col gap-3 text-sm text-text-secondary">
      <p>
        droid.or lets you disable, uninstall for the current user, and otherwise modify apps on your
        Android device — including apps preinstalled by the manufacturer or required by Android
        itself.
      </p>
      <ul class="list-disc space-y-1 pl-5">
        <li>Modifying packages can cause unexpected behavior, including features breaking.</li>
        <li>
          Some preinstalled apps are required for the device, a carrier feature, or another app to
          work correctly, even when they look removable.
        </li>
        <li>
          droid.or's recommendations are a starting point, not a guarantee — it cannot promise that
          any specific removal is safe on your specific device.
        </li>
        <li>You are responsible for the changes you choose to make.</li>
        <li>
          droid.or is not responsible for data loss, device malfunction, boot loops, lost
          functionality, or any other damage resulting from its use.
        </li>
        <li>Keep backups, and back up anything important before making changes.</li>
        <li>
          Advanced or aggressive operations should only be used if you understand the risk of what
          you're removing.
        </li>
      </ul>
      <p>
        Every operation still asks for confirmation individually, and changes this app makes can
        usually be reversed from the Recovery page — but this initial warning covers the category of
        risk as a whole, before you get there.
      </p>
    </div>
    <template #footer>
      <div class="flex justify-end">
        <NButton type="primary" @click="handleAccept">I Understand and Accept</NButton>
      </div>
    </template>
  </NModal>
</template>
