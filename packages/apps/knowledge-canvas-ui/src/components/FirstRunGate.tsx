import type { ReactNode } from 'react'
import { useState } from 'react'
import { getIsFirstRun, markFirstRunDone } from '../firstRun'
import { FirstRunScreen } from './FirstRunScreen'

/**
 * Wraps the app root. On first launch (no `kcu-firstrun` flag) it shows the
 * 3-step onboarding; afterwards it renders the real app unchanged.
 * This must NOT alter App's internal logic (WelcomeDashboard ↔ CanvasRegion).
 */
export function FirstRunGate({ children }: { children: ReactNode }) {
  const [done, setDone] = useState<boolean>(() => !getIsFirstRun())

  if (done) return <>{children}</>

  return (
    <FirstRunScreen
      onFinish={() => {
        markFirstRunDone()
        setDone(true)
      }}
    />
  )
}
