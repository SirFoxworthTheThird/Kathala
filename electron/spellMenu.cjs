const path = require('path')

/*
  Spelling in the desktop app (issue #705): a right-click menu that can act on
  the spell checker's underline, the world's names in the spell checker's
  dictionary, and the spell checker's languages, kept on this device. The
  decisions are in `docs/records/spelling-plan.md` (D-1, D-5, D-6).

  Pure where it can be: `menuTemplate` builds the menu from Electron's own
  `context-menu` parameters, and `attachSpelling` is handed Electron's parts,
  so both are tested without Electron (`src/lib/__tests__/electronSpelling.test.ts`).
*/

/** How many of the spell checker's suggestions the menu offers. */
const SUGGESTIONS = 5

/**
 * The menu for a right click (D-5): on a misspelt word, its suggestions and
 * Add to dictionary; where text can be edited, Cut, Copy, Paste and Select
 * all; elsewhere, Copy for a selection. Empty where there is nothing to offer.
 */
function menuTemplate(params, act) {
  const items = []
  const flags = params.editFlags || {}
  if (params.isEditable && params.misspelledWord) {
    const suggestions = (params.dictionarySuggestions || []).slice(0, SUGGESTIONS)
    if (suggestions.length === 0) items.push({ label: 'No suggestions', enabled: false })
    for (const s of suggestions) items.push({ label: s, click: () => act.replace(s) })
    items.push({ type: 'separator' })
    items.push({ label: 'Add to dictionary', click: () => act.addWord(params.misspelledWord) })
    items.push({ type: 'separator' })
  }
  if (params.isEditable) {
    items.push(
      { label: 'Cut', role: 'cut', enabled: flags.canCut !== false },
      { label: 'Copy', role: 'copy', enabled: flags.canCopy !== false },
      { label: 'Paste', role: 'paste', enabled: flags.canPaste !== false },
      { type: 'separator' },
      { label: 'Select all', role: 'selectAll' },
    )
  } else if ((params.selectionText || '').trim()) {
    items.push({ label: 'Copy', role: 'copy' })
  }
  return items
}

/** A word worth giving the dictionary: letters, and the marks inside a name, at most 64 of them. */
function dictionaryWord(w) {
  return typeof w === 'string' && w.length > 0 && w.length <= 64 && /^[\p{L}\p{M}][\p{L}\p{M}'’-]*$/u.test(w)
}

/** The languages chosen on this device, kept in the app's data folder (D-6); a file that cannot be read is no choice. */
function languageStore(fs, dir) {
  const file = path.join(dir, 'spelling.json')
  return {
    load() {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
        return Array.isArray(data.languages) ? data.languages.filter((l) => typeof l === 'string') : null
      } catch { return null }
    },
    save(languages) {
      try {
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(file, JSON.stringify({ languages }))
      } catch { /* kept for this run only */ }
    },
  }
}

/**
 * Spelling for the app: the languages set from what was chosen, or the
 * system's; the page's requests answered (names to the dictionary, the
 * languages to show and to choose); and each window's right-click menu.
 * On a Mac the system chooses the languages itself, so they are not set.
 */
function attachSpelling({ session, ipcMain, Menu, fs, dir, locale, platform }) {
  const store = languageStore(fs, dir)
  const mac = platform === 'darwin'
  const available = () => (mac ? [] : session.availableSpellCheckerLanguages || [])
  const usable = (list) => list.filter((l) => available().includes(l))

  if (!mac) {
    const chosen = usable(store.load() || [])
    const fallback = usable([locale, (locale || '').split('-')[0]].filter(Boolean))
    const languages = chosen.length ? chosen : fallback.slice(0, 1)
    if (languages.length) session.setSpellCheckerLanguages(languages)
  }

  const added = new Set()
  ipcMain.handle('spelling:add-words', (_event, words) => {
    let n = 0
    for (const w of Array.isArray(words) ? words : []) {
      if (!dictionaryWord(w) || added.has(w)) continue
      added.add(w)
      session.addWordToSpellCheckerDictionary(w)
      n++
    }
    return n
  })
  ipcMain.handle('spelling:languages', () => ({
    available: available(),
    chosen: mac ? [] : session.getSpellCheckerLanguages(),
    system: mac,
  }))
  ipcMain.handle('spelling:set-languages', (_event, languages) => {
    if (mac) return []
    const list = usable(Array.isArray(languages) ? languages : [])
    if (list.length === 0) return session.getSpellCheckerLanguages()
    session.setSpellCheckerLanguages(list)
    store.save(list)
    return list
  })

  return {
    /** Give a window the right-click menu. */
    menuFor(win) {
      win.webContents.on('context-menu', (_event, params) => {
        const template = menuTemplate(params, {
          replace: (w) => win.webContents.replaceMisspelling(w),
          addWord: (w) => session.addWordToSpellCheckerDictionary(w),
        })
        if (template.length) Menu.buildFromTemplate(template).popup({ window: win })
      })
    },
  }
}

module.exports = { menuTemplate, attachSpelling, dictionaryWord, languageStore, SUGGESTIONS }
