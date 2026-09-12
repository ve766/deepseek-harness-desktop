/** `view` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'view'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'chat.label': '对话',
  'switcher.aria': '切换视图',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<ViewKey, string> = {
  'chat.label': 'Chat',
  'switcher.aria': 'Switch view',
}

/** Key domain of the `view` namespace (zh is the source of truth). */
export type ViewKey = keyof typeof zh
