<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NLoadingBarProvider, NMessageProvider } from 'naive-ui'
import { useResolvedTheme } from '@renderer/composables/useResolvedTheme'
import AppShell from '@renderer/components/layout/AppShell.vue'

const { naiveTheme, themeOverrides } = useResolvedTheme()
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides" class="h-screen w-screen">
    <NLoadingBarProvider>
      <NDialogProvider>
        <NMessageProvider>
          <AppShell />
        </NMessageProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
