// P4-1: First-run gate state. A single localStorage flag.
// No PersistedStore, no Context, no backend — Settings must call
// resetFirstRun() rather than touching localStorage directly.
const KEY = 'kcu-firstrun'

export function getIsFirstRun(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'done'
  } catch {
    return true
  }
}

export function markFirstRunDone(): void {
  try {
    localStorage.setItem(KEY, 'done')
  } catch {
    /* ignore quota errors */
  }
}

export function resetFirstRun(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
