// P3 — Theme bootstrap.
// Drives the design system through `data-theme` on <html> so the user can
// pick System / Light / Dark explicitly, decoupled from prefers-color-scheme.
// "system" lets the @media (prefers-color-scheme) fallback in app.css apply;
// "light"/"dark" force the explicit :root[data-theme="..."] overrides.

export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'kcu-theme'

export function getTheme(): ThemeMode {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function applyTheme(mode: ThemeMode): void {
  // "system" must NOT write a dead "system" value — it removes the attribute
  // so the @media (prefers-color-scheme) fallback in app.css governs instead.
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.dataset.theme = mode
  }
}

export function setTheme(mode: ThemeMode): void {
  localStorage.setItem(KEY, mode)
  applyTheme(mode)
}

/** Run once, before React renders, to avoid a theme flash. */
export function bootstrapTheme(): void {
  try {
    applyTheme(getTheme())
  } catch {
    applyTheme('system')
  }
}
