import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { P3Showcase } from './P3Showcase'
import './p3Demo.css'
import './styles/app.css'
import { bootstrap } from './mock/bootstrap'
import { bootstrapTheme } from './themeBootstrap'

// Apply persisted theme (localStorage kcu-theme) before first paint so the
// explicit System/Light/Dark choice takes effect without a flash.
bootstrapTheme()

void bootstrap().catch(() => {})

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <StrictMode>
      <P3Showcase />
    </StrictMode>,
  )
}
