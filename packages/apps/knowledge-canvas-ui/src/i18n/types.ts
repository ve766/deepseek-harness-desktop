// Language & region preference types for the Knowledge Canvas prototype.
// Stored locally only (localStorage) — never uploaded to any backend.

/** Supported UI / AI interface languages. `ja` / `ko` are registered for future
 *  expansion; until translated they transparently fall back to `zh-CN` in PACKS. */
export type LocaleCode = 'zh-CN' | 'en-US' | 'ja' | 'ko'

/** A piece of text available in one or more languages. The un-translated `base`
 *  string on the entity is treated as the `zh-CN` default. */
export type LocText = Partial<Record<LocaleCode, string>>

export type AILanguageMode = 'system' | 'user' | 'auto'
export type DateFormatMode = 'system' | 'iso' | 'locale'
export type NumberFormatMode = 'system' | 'us' | 'eu'

/** Per-user language & region preference. */
export interface LanguagePreference {
  /** UI chrome language. */
  interfaceLanguage: LocaleCode
  /** Language Nox (AI) should reply in: follow system / use user preferred / auto-detect. */
  aiLanguage: AILanguageMode
  /** BCP-47 locale used for Intl formatting (date / number). */
  locale: string
  /** IANA timezone (e.g. Asia/Shanghai). */
  timezone: string
  dateFormat: DateFormatMode
  numberFormat: NumberFormatMode
}

export const DEFAULT_LANGUAGE: LanguagePreference = {
  interfaceLanguage: 'zh-CN',
  aiLanguage: 'system',
  locale: 'zh-CN',
  timezone: 'Asia/Shanghai',
  dateFormat: 'system',
  numberFormat: 'system',
}
