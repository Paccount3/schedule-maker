import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { attachAudioUnlock } from './lib/sounds'
import App from './App'
import { StoreProvider } from './store/useStore'

attachAudioUnlock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
