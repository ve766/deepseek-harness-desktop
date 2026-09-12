import { useRef } from 'react'
import { useAppearanceSettings } from '../hooks/useAppearance'
import { useT } from '../i18n'

// Built-in gradient presets — generated as local SVG data URLs (never uploaded).
function gradientDataUrl(stops: [string, string], glow: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='800'>` +
    `<defs>` +
    `<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${stops[0]}'/>` +
    `<stop offset='1' stop-color='${stops[1]}'/>` +
    `</linearGradient>` +
    `<radialGradient id='r' cx='28%' cy='22%' r='65%'>` +
    `<stop offset='0' stop-color='${glow}' stop-opacity='0.5'/>` +
    `<stop offset='1' stop-color='${glow}' stop-opacity='0'/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width='1280' height='800' fill='url(#g)'/>` +
    `<rect width='1280' height='800' fill='url(#r)'/>` +
    `</svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

const PRESETS = [
  { id: 'cosmos', labelKey: 'appearance.presetCosmos', url: gradientDataUrl(['#0b1026', '#232b5e'], '#5e5ce6') },
  { id: 'mist', labelKey: 'appearance.presetMist', url: gradientDataUrl(['#e9eef7', '#cdd8ee'], '#a8c8ec') },
  { id: 'aurora', labelKey: 'appearance.presetAurora', url: gradientDataUrl(['#0f2027', '#123a4a'], '#34c759') },
]

type FitMode = NonNullable<ReturnType<typeof useAppearanceSettings>['appearance']['backgroundFit']>
const FITS: [FitMode, string][] = [
  ['fill', 'appearance.fill'],
  ['fit', 'appearance.fitMode'],
  ['center', 'appearance.center'],
]

/** Basic (v1.3) background personalization popover.
 *  No image editor — pick a local file OR a built-in gradient preset, choose a fit
 *  mode, tune blur / overlay. Everything stays local (localStorage); never uploaded. */
export function AppearanceSettings({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const { appearance, update, reset } = useAppearanceSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const fit = appearance.backgroundFit ?? 'fill'
  const isImage = appearance.backgroundType === 'image'

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) {
      alert(t('appearance.tooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      update({ backgroundType: 'image', backgroundImage: dataUrl, backgroundFit: 'fill', blur: Math.max(appearance.blur, 6) })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="appearance-pop" role="dialog" aria-label={t('appearance.title')}>
      <div className="appearance-pop__head">
        <span>{t('appearance.title')}</span>
        <button className="appearance-pop__x" onClick={onClose} aria-label={t('settings.close')}>
          ✕
        </button>
      </div>

      <div className="appearance-pop__label">{t('appearance.source')}</div>
      <div className="appearance-pop__row">
        <button
          className={'appbtn' + (!isImage ? ' is-on' : '')}
          onClick={() => update({ backgroundType: 'default', backgroundImage: undefined })}
        >
          {t('appearance.appleGradient')}
        </button>
        <button
          className={'appbtn' + (isImage && appearance.backgroundImage?.startsWith('data:image/') && !PRESETS.some((p) => p.url === appearance.backgroundImage) ? ' is-on' : '')}
          onClick={() => fileRef.current?.click()}
        >
          {t('appearance.upload')}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPick} />
      </div>

      <div className="appearance-pop__label">{t('appearance.presets')}</div>
      <div className="appearance-pop__modes">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={'appbtn appbtn--sm' + (isImage && appearance.backgroundImage === p.url ? ' is-on' : '')}
            onClick={() =>
              update({ backgroundType: 'image', backgroundImage: p.url, backgroundFit: fit, blur: Math.max(appearance.blur, 6) })
            }
          >
            {t(p.labelKey as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      <div className="appearance-pop__label">{t('appearance.fit')}</div>
      <div className="appearance-pop__modes">
        {FITS.map(([m, lk]) => (
          <button
            key={m}
            className={'appbtn appbtn--sm' + (isImage && fit === m ? ' is-on' : '')}
            disabled={!isImage}
            onClick={() => update({ backgroundFit: m })}
          >
            {t(lk as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      <div className="appearance-pop__label">{t('appearance.blur')} {appearance.blur}px</div>
      <input
        type="range"
        min={0}
        max={20}
        value={appearance.blur}
        disabled={!isImage}
        onChange={(e) => update({ blur: Number(e.target.value) })}
      />

      <div className="appearance-pop__label">{t('appearance.overlay')} {Math.round(appearance.overlayOpacity * 100)}%</div>
      <input
        type="range"
        min={0}
        max={0.8}
        step={0.05}
        value={appearance.overlayOpacity}
        onChange={(e) => update({ overlayOpacity: Number(e.target.value) })}
      />

      <button className="appbtn appbtn--ghost" onClick={reset}>
        {t('appearance.reset')}
      </button>
    </div>
  )
}
