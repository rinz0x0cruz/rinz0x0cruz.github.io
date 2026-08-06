import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const root = document.querySelector('#app')
const fallback = root.innerHTML

function settleBoot(state) {
  window.clearTimeout(window.__portfolioBootTimeout)
  document.documentElement.classList.remove('js-loading')
  root.dataset.appState = state
}

try {
  createApp(App).mount(root)
  settleBoot('ready')
} catch (error) {
  root.innerHTML = fallback
  settleBoot('failed')
  console.error('The interactive portfolio could not start.', error)
}
