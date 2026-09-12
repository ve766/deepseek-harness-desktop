/**
 * P1 review entry — standalone harness for the P1 state integration.
 * Mirrors the P0 entry: builds and screenshots the three consumer surfaces
 * without touching main.tsx or any existing app route. Build with:
 *
 *   node build.cjs src/p1DemoEntry.tsx
 */
import { createRoot } from 'react-dom/client'
import { P1Demo } from './P1Demo'
import './p1Demo.css'

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(<P1Demo />)
}
