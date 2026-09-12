import { useState } from 'react'
import { useT, useLanguagePref, setLanguage, type LanguageKey } from '../i18n'
import type { AILanguageMode, DateFormatMode, NumberFormatMode, LocaleCode } from '../i18n/types'

export const INTERFACE_LANGS: { code: LocaleCode; labelKey: LanguageKey; soon?: boolean }[] = [
  { code: 'zh-CN', labelKey: 'lang.optZh' },
  { code: 'en-US', labelKey: 'lang.optEn' },
  { code: 'ja', labelKey: 'lang.optJa', soon: true },
  { code: 'ko', labelKey: 'lang.optKo', soon: true },
]

const AI_LANGS: { mode: AILanguageMode; labelKey: LanguageKey }[] = [
  { mode: 'system', labelKey: 'lang.aiSystem' },
  { mode: 'user', labelKey: 'lang.aiUser' },
  { mode: 'auto', labelKey: 'lang.aiAuto' },
]

const DATE_FORMATS: { mode: DateFormatMode; labelKey: LanguageKey }[] = [
  { mode: 'system', labelKey: 'lang.dateSystem' },
  { mode: 'locale', labelKey: 'lang.dateLocale' },
  { mode: 'iso', labelKey: 'lang.dateISO' },
]

const NUMBER_FORMATS: { mode: NumberFormatMode; labelKey: LanguageKey }[] = [
  { mode: 'system', labelKey: 'lang.numSystem' },
  { mode: 'us', labelKey: 'lang.numUS' },
  { mode: 'eu', labelKey: 'lang.numEU' },
]

const REGIONS: { locale: string; tz: string; labelKey: string }[] = [
  { locale: 'zh-CN', tz: 'Asia/Shanghai', labelKey: 'lang.regionZh' },
  { locale: 'en-US', tz: 'America/New_York', labelKey: 'lang.regionEn' },
  { locale: 'ja-JP', tz: 'Asia/Tokyo', labelKey: 'lang.regionJa' },
  { locale: 'ko-KR', tz: 'Asia/Seoul', labelKey: 'lang.regionKo' },
]

/** Language & Region settings (v1.3 scope): UI language, AI reply language,
 *  date/time + number formats, and region. All stored locally (localStorage). */
export function LanguageSettings({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const pref = useLanguagePref()
  const [saved, setSaved] = useState(false)

  const markSaved = () => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }
  const update = (patch: Partial<typeof pref>) => {
    setLanguage(patch)
    markSaved()
  }

  return (
    <div className="appearance-pop" role="dialog" aria-label={t('lang.title')}>
      <div className="appearance-pop__head">
        <span>{t('lang.title')}</span>
        <button className="appearance-pop__x" onClick={onClose} aria-label={t('settings.close')}>
          ✕
        </button>
      </div>

      <div className="appearance-pop__label">{t('lang.interface')}</div>
      <div className="appearance-pop__hint">{t('lang.interfaceHint')}</div>
      <div className="appearance-pop__modes">
        {INTERFACE_LANGS.map(l => (
          <button
            key={l.code}
            className={'appbtn appbtn--sm' + (pref.interfaceLanguage === l.code ? ' is-on' : '')}
            disabled={l.soon}
            onClick={() => update({ interfaceLanguage: l.code })}
          >
            {t(l.labelKey)}
            {l.soon && <span className="appbtn__soon">soon</span>}
          </button>
        ))}
      </div>

      <div className="appearance-pop__label">{t('lang.aiResponse')}</div>
      <div className="appearance-pop__hint">{t('lang.aiResponseHint')}</div>
      <div className="appearance-pop__modes">
        {AI_LANGS.map(a => (
          <button
            key={a.mode}
            className={'appbtn appbtn--sm' + (pref.aiLanguage === a.mode ? ' is-on' : '')}
            onClick={() => update({ aiLanguage: a.mode })}
          >
            {t(a.labelKey)}
          </button>
        ))}
      </div>

      <div className="appearance-pop__label">{t('lang.dateTime')}</div>
      <div className="appearance-pop__modes">
        {DATE_FORMATS.map(d => (
          <button
            key={d.mode}
            className={'appbtn appbtn--sm' + (pref.dateFormat === d.mode ? ' is-on' : '')}
            onClick={() => update({ dateFormat: d.mode })}
          >
            {t(d.labelKey)}
          </button>
        ))}
      </div>

      <div className="appearance-pop__label">{t('lang.number')}</div>
      <div className="appearance-pop__modes">
        {NUMBER_FORMATS.map(n => (
          <button
            key={n.mode}
            className={'appbtn appbtn--sm' + (pref.numberFormat === n.mode ? ' is-on' : '')}
            onClick={() => update({ numberFormat: n.mode })}
          >
            {t(n.labelKey)}
          </button>
        ))}
      </div>

      <div className="appearance-pop__label">{t('lang.region')}</div>
      <div className="appearance-pop__modes">
        {REGIONS.map(r => (
          <button
            key={r.locale}
            className={'appbtn appbtn--sm' + (pref.locale === r.locale ? ' is-on' : '')}
            onClick={() => update({ locale: r.locale, timezone: r.tz })}
          >
            {t(r.labelKey)}
          </button>
        ))}
      </div>

      <div className="appearance-pop__note">{t('lang.note')}</div>
      {saved && <div className="appearance-pop__saved">{t('lang.saved')}</div>}
    </div>
  )
}
