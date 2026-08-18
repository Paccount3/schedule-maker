import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { attachAudioUnlock } from './lib/sounds'
import App from './App'
import { AccessProvider } from './store/useAccess'
import { StoreProvider } from './store/useStore'
import { SettingsProvider } from './store/useSettings'
import { ConfirmProvider } from './store/useConfirm'

attachAudioUnlock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ConfirmProvider>
        <AccessProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </AccessProvider>
      </ConfirmProvider>
    </SettingsProvider>
  </StrictMode>,
)
