import { useT } from '../i18n'

export function TitleBar() {
  const { t } = useT()
  return (
    <header className="titlebar">
      <div className="traffic">
        <span className="dot dot--close" />
        <span className="dot dot--min" />
        <span className="dot dot--max" />
      </div>
      <div className="titlebar__title">{t('app.title')}</div>
      <div className="titlebar__spacer" />
    </header>
  )
}
