import { createRouter, createWebHashHistory } from 'vue-router'
import AnalyzerView from '@renderer/views/AnalyzerView.vue'
import AppsView from '@renderer/views/AppsView.vue'
import HistoryView from '@renderer/views/HistoryView.vue'
import InstallView from '@renderer/views/InstallView.vue'
import OverviewView from '@renderer/views/OverviewView.vue'
import PlaceholderView from '@renderer/views/PlaceholderView.vue'
import RecoveryView from '@renderer/views/RecoveryView.vue'
import SettingsView from '@renderer/views/SettingsView.vue'

/**
 * Hash history is used because the renderer is loaded from a file:// URL in
 * production builds, where HTML5 history mode has no server to fall back to.
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/overview' },
    {
      path: '/overview',
      name: 'overview',
      component: OverviewView
    },
    {
      path: '/apps',
      name: 'apps',
      component: AppsView
    },
    {
      path: '/analyzer',
      name: 'analyzer',
      component: AnalyzerView
    },
    {
      path: '/install',
      name: 'install',
      component: InstallView
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView
    },
    {
      path: '/recovery',
      name: 'recovery',
      component: RecoveryView
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView
    },
    {
      path: '/logs',
      name: 'logs',
      component: PlaceholderView,
      props: {
        title: 'Logs',
        description: 'A viewer for application and ADB operation logs lands here.'
      }
    }
  ]
})
