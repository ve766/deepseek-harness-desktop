// S13-A (T6): Nox research panel — renders inside the growth insight branch of
// AIInsightPanel, right after NoxGapCard. Consumes `useNoxResearch`, which itself
// only touches the `LlmClient` seam + the knowledge retrieval seam. No direct LLM
// package imports (per the T1-scope ruling: UI -> llmContext only).

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useT } from '../i18n'
import { useNoxResearch } from './useNoxResearch'

export function NoxResearchPanel() {
  const { t } = useT()
  const { state, run, reset } = useNoxResearch('nox')
  const [input, setInput] = useState('')

  const submit = () => {
    if (!input.trim() || state.status === 'retrieving' || state.status === 'thinking') return
    void run(input)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const busy = state.status === 'retrieving' || state.status === 'thinking'

  return (
    <div className="nox-research">
      <div className="nox-research__head">
        <span className="nox-research__avatar">🐈‍⬛</span>
        <div className="nox-research__name">{t('nox.research.title')}</div>
      </div>

      <form className="nox-research__input" onSubmit={onSubmit}>
        <textarea
          className="nox-research__textarea"
          value={input}
          placeholder={t('nox.research.placeholder')}
          onChange={(e) => {
            setInput(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
        />
        <button className="nox-research__ask" type="submit" disabled={busy || !input.trim()}>
          {t('nox.research.ask')}
        </button>
      </form>

      {state.retrievalUnsupported && (
        <div className="nox-research__note nox-research__note--warn">{t('nox.research.unsupported')}</div>
      )}

      {!state.retrievalUnsupported && state.contextNodes.length === 0 && (state.status === 'done' || state.llmUnavailable) && (
        <div className="nox-research__note nox-research__note--muted">{t('nox.research.noContext')}</div>
      )}

      {state.contextNodes.length > 0 && (
        <div className="nox-research__section">
          <div className="nox-research__sec-title">
            {t('nox.research.contextTitle')} · {t('nox.research.hits', { n: state.contextNodes.length })}
          </div>
          <ul className="nox-research__ctx">
            {state.contextNodes.map(c => (
              <li key={c.nodeId} className="nox-research__ctx-item">
                <span className="nox-research__ctx-title">{c.title}</span>
                <span className="nox-research__ctx-score">{Math.round(c.score * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.llmUnavailable && (
        <div className="nox-research__note nox-research__note--muted">{t('nox.research.unavailable')}</div>
      )}

      {state.status === 'thinking' && state.thinking && (
        <div className="nox-research__thinking">{state.thinking}</div>
      )}
      {state.status === 'thinking' && !state.thinking && (
        <div className="nox-research__thinking">{t('nox.research.thinking')}</div>
      )}

      {state.answer && (
        <div className="nox-research__section">
          <div className="nox-research__sec-title">{t('nox.research.answer')}</div>
          <div className="nox-research__text">{state.answer}</div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="nox-research__note nox-research__note--error">
          {t('nox.research.error')}
          {state.errorText ? `: ${state.errorText}` : ''}
        </div>
      )}

      {(state.status === 'done' || state.status === 'error') && (
        <button className="nox-research__clear" type="button" onClick={reset}>
          {t('nox.research.clear')}
        </button>
      )}
    </div>
  )
}
