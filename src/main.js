import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const root = document.querySelector('#app')
const fallback = root.innerHTML
let bootFailed = false

function settleBoot(state) {
  window.clearTimeout(window.__portfolioBootTimeout)
  document.documentElement.classList.remove('js-loading')
  root.dataset.appState = state
}

function failBoot(error) {
  if (bootFailed) return

  bootFailed = true
  root.innerHTML = fallback
  settleBoot('failed')
  console.error('The interactive portfolio could not start.', error)
}

try {
  const app = createApp(App)
  app.config.errorHandler = failBoot
  app.mount(root)
  if (!bootFailed) {
    app.config.errorHandler = undefined
    settleBoot('ready')
  }
} catch (error) {
  failBoot(error)
}
