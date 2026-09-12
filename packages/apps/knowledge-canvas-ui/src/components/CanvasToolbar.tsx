import { useT } from '../i18n'
import { store } from '../store/canvasStore'
import { runImportDemo } from '../demo/sequencer'
import { GROWTH_KINDS } from '../domain/nodeKinds'

export function CanvasToolbar() {
  const { t } = useT()
  const zoomIn = () => {
    const v = store.getState().view
    store.setView({ ...v, z: Math.min(2.5, v.z * 1.2) })
  }
  const zoomOut = () => {
    const v = store.getState().view
    store.setView({ ...v, z: Math.max(0.2, v.z / 1.2) })
  }
  const fit = () => {
    const el = document.querySelector('.canvas-viewport') as HTMLElement | null
    if (el) store.fitToContentFiltered((n) => !GROWTH_KINDS.has(n.kind), el.clientWidth, el.clientHeight)
  }
  const group = () => {
    const sel = [...store.getState().selection]
    if (sel.length >= 1) store.groupNodes(sel, 'cluster.newName')
  }

  return (
    <div className="toolbar">
      <button className="tbtn" onClick={zoomOut} title={t('toolbar.zoomOut')}>
        −
      </button>
      <button className="tbtn" onClick={zoomIn} title={t('toolbar.zoomIn')}>
        +
      </button>
      <button className="tbtn" onClick={fit} title={t('toolbar.fit')}>
        ⤢
      </button>
      <span className="toolbar__sep" />
      <button className="tbtn tbtn--primary" onClick={runImportDemo}>
        {t('toolbar.import')}
      </button>
      <button className="tbtn" onClick={group}>
        {t('toolbar.group')}
      </button>
      <button className="tbtn" onClick={() => store.clearAiGenerated()}>
        {t('toolbar.clearAi')}
      </button>
    </div>
  )
}
