/*
  The desktop app's spell checker, as the page reaches it (issue #705): the
  preload's `electronAPI.spelling` (`electron/preload.cjs`). Absent in a
  browser, where a page has no way to change the browser's dictionary.
*/

export interface SpellingLanguages {
  /** The languages this device can check. Empty on a Mac, where the system chooses. */
  available: string[]
  chosen: string[]
  /** The system chooses the languages itself (a Mac). */
  system: boolean
}

export interface SpellingBridge {
  /** Give words to the spell checker's dictionary on this device; how many were new. */
  addWords: (words: string[]) => Promise<number>
  languages: () => Promise<SpellingLanguages>
  /** Choose the languages; answers with those now set. */
  setLanguages: (languages: string[]) => Promise<string[]>
}

/** The desktop app's spell checker, or null in a browser. */
export function spellingBridge(): SpellingBridge | null {
  return (window as unknown as { electronAPI?: { spelling?: SpellingBridge } }).electronAPI?.spelling ?? null
}

/** A language's name in the page's own language, where the browser knows it: "en-GB" as "British English". */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' }).of(code)
    return name && name !== code ? `${name} (${code})` : code
  } catch {
    return code
  }
}
