import { useSyncExternalStore } from 'react'
import type { LanguagePreference, LocaleCode, LocText } from './types'
import { DEFAULT_LANGUAGE } from './types'
import { zhCN } from './zh-CN'
import { enUS } from './en-US'

type Pack = Record<string, string>

// ja / ko are registered for future expansion; until translated they fall back to zh-CN.
const PACKS: Record<LocaleCode, Pack> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  ja: zhCN,
  ko: zhCN,
}

/** The set of valid translation keys — derived from the canonical zh-CN pack so a
 *  missing key is a compile-time error (TS) and a visible fallback (runtime). */
export type LanguageKey = keyof typeof zhCN

export interface TApi {
  t: (key: LanguageKey, params?: Record<string, string | number>) => string
  lang: LocaleCode
}

function lookup(key: LanguageKey, lang: LocaleCode): string {
  const pack = PACKS[lang] ?? PACKS['zh-CN']
  return pack[key as string] ?? PACKS['zh-CN'][key as string] ?? (key as string)
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str
  let out = str
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v))
  }
  return out
}

/** Hook used inside React components. Returns a lang-bound `t`. */
export function useT(): TApi {
  const pref = useLanguagePref()
  const lang = pref.interfaceLanguage
  const t = (key: LanguageKey, params?: Record<string, string | number>): string =>
    interpolate(lookup(key, lang), params)
  return { t, lang }
}

/** Non-reactive translator for runtime callbacks (outside render). */
export function tNow(key: LanguageKey, params?: Record<string, string | number>): string {
  return interpolate(lookup(key, getLanguage().interfaceLanguage), params)
}

// ---- Locale-aware entity text (agent names, node titles, Nox messages) ----
// Resolved by key lookup only — no `lang === 'x'` branching anywhere in the app.
/** Resolve an entity-level localized string (agent name, node title, etc.).
 *  Priority: exact locale match → (non-en UI) base is the canonical zh-CN default
 *  → English translation → base → empty. This guarantees the Chinese source text
 *  shows in zh-CN / ja / ko mode even when only `en-US` is provided. */
export function resolveLoc(base: string | undefined, loc: LocText | undefined, lang: LocaleCode): string {
  if (loc?.[lang]) return loc[lang]!
  if (lang !== 'en-US') return base ?? loc?.['en-US'] ?? ''
  return loc?.['en-US'] ?? base ?? ''
}

/** Resolve an entity-level localized string (agent name, node title, etc.). */
export function resolveEntity(base: string | undefined, loc: LocText | undefined, lang: LocaleCode): string {
  return resolveLoc(base, loc, lang)
}

// ---- Locale-aware formatting (Intl) ----

export function formatDate(d: Date, pref: LanguagePreference): string {
  if (pref.dateFormat === 'iso') {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const opts: Intl.DateTimeFormatOptions =
    pref.dateFormat === 'locale'
      ? { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
      : { month: 'long', day: 'numeric', weekday: 'long' }
  try {
    return new Intl.DateTimeFormat(pref.locale, opts).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

export function formatNumber(n: number, pref: LanguagePreference): string {
  const locale =
    pref.numberFormat === 'us' ? 'en-US' : pref.numberFormat === 'eu' ? 'de-DE' : pref.locale
  try {
    return new Intl.NumberFormat(locale).format(n)
  } catch {
    return String(n)
  }
}

// ---- Reactive store: localStorage -> navigator.language -> fallback ----

const KEY = 'kcu.language.v1'
type Listener = () => void
const listeners = new Set<Listener>()

/** Default resolution order (per spec):
 *  1. persisted localStorage preference
 *  2. navigator.language (zh* -> zh-CN, else en-US)
 *  3. fallback en-US / zh-CN */
function detect(): LanguagePreference {
  const nav = (typeof navigator !== 'undefined' && navigator.language) || ''
  const zh = nav.toLowerCase().startsWith('zh')
  let tz = 'Asia/Shanghai'
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz
  } catch {
    /* ignore */
  }
  return {
    interfaceLanguage: zh ? 'zh-CN' : 'en-US',
    aiLanguage: 'system',
    locale: zh ? 'zh-CN' : 'en-US',
    timezone: tz,
    dateFormat: 'system',
    numberFormat: zh ? 'system' : 'us',
  }
}

function load(): LanguagePreference {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_LANGUAGE, ...JSON.parse(raw) }
  } catch {
    /* ignore malformed storage */
  }
  return detect()
}

let state: LanguagePreference = load()
applyDocLang()

function emit() {
  listeners.forEach((l) => l())
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}
function applyDocLang() {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = state.interfaceLanguage
  }
}

export function getLanguage(): LanguagePreference {
  return state
}
export function setLanguage(patch: Partial<LanguagePreference>): void {
  state = { ...state, ...patch }
  persist()
  applyDocLang()
  emit()
}
export function resetLanguage(): void {
  state = detect()
  persist()
  applyDocLang()
  emit()
}

function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Reactive hook — re-renders the calling component when the language changes. */
export function useLanguagePref(): LanguagePreference {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage)
}

/** Convenience re-export for settings components. */
export function useLocalePref(): LanguagePreference {
  return useLanguagePref()
}

export type { LanguagePreference, LocaleCode, LocText }
