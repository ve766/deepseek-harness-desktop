import { useAppearance } from '../store/canvasStore'

type FitMode = 'fill' | 'fit' | 'center'

function bgStyle(appearance: ReturnType<typeof useAppearance>): React.CSSProperties {
  const base: React.CSSProperties = {}
  if (appearance.backgroundType === 'image' && appearance.backgroundImage) {
    const mode: FitMode = appearance.backgroundFit ?? 'fill'
    base.backgroundImage = `url(${appearance.backgroundImage})`
    base.backgroundRepeat = 'no-repeat'
    if (mode === 'fill') {
      base.backgroundSize = 'cover'
      base.backgroundPosition = 'center'
    } else if (mode === 'fit') {
      base.backgroundSize = 'contain'
      base.backgroundPosition = 'center'
    } else {
      base.backgroundSize = 'auto'
      base.backgroundPosition = 'center'
    }
    if (appearance.blur > 0) base.filter = `blur(${appearance.blur}px)`
  }
  return base
}

/** Background behind the canvas world. Default = Apple-style gradient; image mode
 *  applies fit + blur + dark overlay so node readability is preserved. Never uploads. */
export function BackgroundLayer() {
  const appearance = useAppearance()
  const isImage = appearance.backgroundType === 'image' && !!appearance.backgroundImage
  return (
    <div className="bg-layer" aria-hidden>
      <div className="bg-layer__base" />
      {isImage && <div className="bg-layer__image" style={bgStyle(appearance)} />}
      {/* Overlay only matters for images (readability); kept off in default mode so
          the classic dotted-grid Space look is preserved exactly. */}
      {isImage && (
        <div className="bg-layer__overlay" style={{ opacity: appearance.overlayOpacity }} />
      )}
    </div>
  )
}
