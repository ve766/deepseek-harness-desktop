import type { AiStage } from './types'
import type { LanguageKey } from './i18n'

// Each reasoning stage maps to an i18n key (see `stage.*` in zh-CN.ts / en-US.ts).
// Consumers translate via their own `t()` so the banner follows the UI language.
export const STAGE_LABEL: Record<Exclude<AiStage, null>, LanguageKey> = {
  import: 'stage.import',
  analyze: 'stage.analyze',
  scan: 'stage.scan',
  relate: 'stage.relate',
  map: 'stage.map',
  done: 'stage.done',
}

/** Ordered reasoning flow shown as a progress strip while the AI works. */
export const STAGE_ORDER: Exclude<AiStage, null>[] = [
  'import',
  'analyze',
  'scan',
  'relate',
  'map',
  'done',
]
