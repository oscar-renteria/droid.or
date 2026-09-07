import { createRouter, createWebHashHistory } from 'vue-router'
import AnalyzerView from '@renderer/views/AnalyzerView.vue'
import AppsView from '@renderer/views/AppsView.vue'
import OverviewView from '@renderer/views/OverviewView.vue'
import PlaceholderView from '@renderer/views/PlaceholderView.vue'

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
      path: '/history',
      name: 'history',
      component: PlaceholderView,
      props: {
        title: 'Operation History',
        description: 'A record of every change this application makes lands here.'
      }
    },
    {
      path: '/recovery',
      name: 'recovery',
      component: PlaceholderView,
      props: {
        title: 'Device Recovery',
        description: 'Restoring changes made by this application lands here.'
      }
    },
    {
      path: '/settings',
      name: 'settings',
      component: PlaceholderView,
      props: {
        title: 'Settings',
        description: 'ADB configuration and application preferences land here.'
      }
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
