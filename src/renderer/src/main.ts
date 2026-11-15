import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { useErrorReportStore } from './stores/error-report.store'
import './styles/tailwind.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Unexpected errors are logged to the persistent log file and shown as a
// toast instead of failing silently in a devtools console nobody opens.
const errorReportStore = useErrorReportStore(pinia)
app.config.errorHandler = (error, _instance, info) => {
  console.error(error)
  errorReportStore.report(error, 'vue', info)
}
window.addEventListener('error', (event) => {
  errorReportStore.report(event.error ?? event.message, 'window-error')
})
window.addEventListener('unhandledrejection', (event) => {
  errorReportStore.report(event.reason, 'unhandled-rejection')
})

app.mount('#app')
