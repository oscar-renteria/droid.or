<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NLoadingBarProvider, NMessageProvider } from 'naive-ui'
import { onMounted } from 'vue'
import { useResolvedTheme } from '@renderer/composables/useResolvedTheme'
import AppShell from '@renderer/components/layout/AppShell.vue'
import SafetyDisclaimerModal from '@renderer/components/SafetyDisclaimerModal.vue'
import { useSafetyDisclaimerStore } from '@renderer/stores/safety-disclaimer.store'

const { naiveTheme, themeOverrides } = useResolvedTheme()
const safetyDisclaimerStore = useSafetyDisclaimerStore()

onMounted(() => {
  void safetyDisclaimerStore.check()
})
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides" class="h-screen w-screen">
    <NLoadingBarProvider>
      <NDialogProvider>
        <NMessageProvider>
          <AppShell />
          <SafetyDisclaimerModal />
        </NMessageProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
