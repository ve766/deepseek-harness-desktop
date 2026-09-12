import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { FirstRunGate } from './components/FirstRunGate'
import './styles/app.css'
import { bootstrap } from './mock/bootstrap'
import { bootstrapTheme } from './themeBootstrap'

// Apply the persisted theme before first paint to avoid a flash.
bootstrapTheme()

void bootstrap().then(() => {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root not found')
  createRoot(root).render(
    <StrictMode>
      <FirstRunGate>
        <App />
      </FirstRunGate>
    </StrictMode>,
  )
})
