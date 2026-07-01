import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// Self-hosted fonts (latin subsets only) — precached by the service worker so
// typography never flashes and the app works fully offline.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-800.css'
import { StoreProvider } from './store/StoreProvider.jsx'
import { SkinProvider } from './context/SkinContext.jsx'
import { registerSW } from 'virtual:pwa-register'

// Auto-updating service worker: new deploys are picked up on the next launch
// without any prompt. No-op in dev.
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <SkinProvider>
        <App />
      </SkinProvider>
    </StoreProvider>
  </React.StrictMode>,
)
