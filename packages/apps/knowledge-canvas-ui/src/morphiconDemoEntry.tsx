/**
 * P0 review entry — standalone harness for the Morphicon state system.
 *
 * This file is intentionally separate from `main.tsx`: it lets us build and
 * screenshot the seven-state morphicons + state machine WITHOUT touching any
 * existing app component, route or stylesheet. Build with:
 *
 *   node build.cjs src/morphiconDemoEntry.tsx
 */
import { createRoot } from 'react-dom/client'
import { MorphiconDemo } from './components/MorphiconDemo'
import './morphiconDemo.css'

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(<MorphiconDemo />)
}
