import { useState } from 'react'
import { MacWindowShell } from './components/MacWindowShell'
import { CanvasRegion } from './components/CanvasRegion'
import { WelcomeDashboard } from './components/WelcomeDashboard'

export function App() {
  const [entered, setEntered] = useState(false)
  return (
    <MacWindowShell>
      {entered ? <CanvasRegion /> : <WelcomeDashboard onEnter={() => setEntered(true)} />}
    </MacWindowShell>
  )
}
