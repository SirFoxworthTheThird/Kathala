import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

/*
  Spelling in the desktop app (issue #705, D-1, D-5, D-6): the right-click
  menu built from Electron's own `context-menu` parameters, and the spelling
  set up with Electron's parts stood in, since the suite does not drive
  Electron. docs/records/spelling-plan.md.
*/

type Item = { label?: string; role?: string; type?: string; enabled?: boolean; click?: () => void }
type Params = { isEditable?: boolean; misspelledWord?: string; dictionarySuggestions?: string[]; selectionText?: string; editFlags?: Record<string, boolean> }
type Handler = (event: unknown, ...args: unknown[]) => unknown

const require = createRequire(import.meta.url)
const { menuTemplate, attachSpelling, dictionaryWord, SUGGESTIONS } = require('../../../electron/spellMenu.cjs') as {
  menuTemplate: (params: Params, act: { replace: (w: string) => void; addWord: (w: string) => void }) => Item[]
  attachSpelling: (deps: Record<string, unknown>) => { menuFor: (win: unknown) => void }
  dictionaryWord: (w: unknown) => boolean
  SUGGESTIONS: number
}

const labels = (items: Item[]) => items.map((i) => i.type === 'separator' ? '—' : `${i.label}${i.enabled === false ? ' (off)' : ''}`)

describe('the right-click menu (D-5)', () => {
  const act = () => {
    const done: string[] = []
    return { done, act: { replace: (w: string) => done.push(`replace ${w}`), addWord: (w: string) => done.push(`add ${w}`) } }
  }

  it('on a misspelt word: up to five suggestions, Add to dictionary, then the editing', () => {
    const { done, act: a } = act()
    const items = menuTemplate({ isEditable: true, misspelledWord: 'Teodroa', dictionarySuggestions: ['Teodora', 'Theodora', 'Teodoro', 'Tedora', 'Teodra', 'Toedora'], editFlags: { canCut: true, canCopy: true, canPaste: true } }, a)
    expect(SUGGESTIONS).toBe(5)
    expect(labels(items)).toEqual(['Teodora', 'Theodora', 'Teodoro', 'Tedora', 'Teodra', '—', 'Add to dictionary', '—', 'Cut', 'Copy', 'Paste', '—', 'Select all'])
    items[0].click!()
    items.find((i) => i.label === 'Add to dictionary')!.click!()
    expect(done).toEqual(['replace Teodora', 'add Teodroa'])
    expect(items.filter((i) => i.role).map((i) => i.role)).toEqual(['cut', 'copy', 'paste', 'selectAll'])
  })

  it('a misspelt word with nothing to suggest says so, and can still be added', () => {
    const { act: a } = act()
    expect(labels(menuTemplate({ isEditable: true, misspelledWord: 'Kessimar', dictionarySuggestions: [], editFlags: { canCut: false, canCopy: false, canPaste: true } }, a)))
      .toEqual(['No suggestions (off)', '—', 'Add to dictionary', '—', 'Cut (off)', 'Copy (off)', 'Paste', '—', 'Select all'])
  })

  it('where text can be edited, the editing; elsewhere Copy for a selection; nothing where there is nothing', () => {
    const { act: a } = act()
    expect(labels(menuTemplate({ isEditable: true, editFlags: {} }, a))).toEqual(['Cut', 'Copy', 'Paste', '—', 'Select all'])
    expect(labels(menuTemplate({ isEditable: false, selectionText: 'a line of prose' }, a))).toEqual(['Copy'])
    expect(menuTemplate({ isEditable: false, selectionText: '  ' }, a)).toEqual([])
    // A misspelt word outside an editable field is not offered for correcting.
    expect(menuTemplate({ isEditable: false, misspelledWord: 'Teodroa', dictionarySuggestions: ['Teodora'] }, a)).toEqual([])
  })
})

/** Electron's parts, stood in: what was asked of them is kept. */
function electron(opts: { platform?: string; locale?: string; saved?: string } = {}) {
  const calls: string[] = []
  const handlers = new Map<string, Handler>()
  const files = new Map<string, string>(opts.saved ? [['/data/spelling.json', opts.saved]] : [])
  let languages: string[] = ['en-US']
  const session = {
    availableSpellCheckerLanguages: ['en-US', 'en-GB', 'fr', 'pt-BR'],
    setSpellCheckerLanguages: (l: string[]) => { languages = l; calls.push(`languages ${l.join(',')}`) },
    getSpellCheckerLanguages: () => languages,
    addWordToSpellCheckerDictionary: (w: string) => { calls.push(`word ${w}`); return true },
  }
  const menus: Item[][] = []
  const deps = {
    session,
    ipcMain: { handle: (name: string, fn: Handler) => handlers.set(name, fn) },
    Menu: { buildFromTemplate: (t: Item[]) => { menus.push(t); return { popup: () => calls.push('popup') } } },
    fs: {
      readFileSync: (f: string) => { if (!files.has(f)) throw new Error('no file'); return files.get(f)! },
      writeFileSync: (f: string, d: string) => { files.set(f, d) },
      mkdirSync: () => {},
    },
    dir: '/data',
    locale: opts.locale ?? 'en-GB',
    platform: opts.platform ?? 'linux',
  }
  const spelling = attachSpelling(deps)
  const ask = (name: string, ...args: unknown[]) => handlers.get(name)!({}, ...args)
  return { calls, files, menus, spelling, ask, session }
}

describe('the spelling set up (D-1, D-6)', () => {
  it('starts in the system’s language where nothing is chosen, and in what was chosen where it was', () => {
    expect(electron({ locale: 'en-GB' }).calls).toEqual(['languages en-GB'])
    // A locale the checker has only as a language, not a region.
    expect(electron({ locale: 'fr-CA' }).calls).toEqual(['languages fr'])
    expect(electron({ saved: JSON.stringify({ languages: ['pt-BR', 'en-US'] }) }).calls).toEqual(['languages pt-BR,en-US'])
    // A broken file, or languages this device lacks, are no choice.
    expect(electron({ saved: '{not json', locale: 'en-US' }).calls).toEqual(['languages en-US'])
    expect(electron({ saved: JSON.stringify({ languages: ['xx'] }), locale: 'en-US' }).calls).toEqual(['languages en-US'])
  })

  it('gives the dictionary the world’s name words, each once, and nothing that is not a word', async () => {
    const e = electron()
    e.calls.length = 0
    expect(await e.ask('spelling:add-words', ['Teodora', 'Vasse', 'Teodora', "O'Brien", 'Abbé', '<script>', 'two words', '', 'x'.repeat(65)])).toBe(4)
    expect(await e.ask('spelling:add-words', ['Teodora', 'Kessimar'])).toBe(1)
    expect(e.calls).toEqual(['word Teodora', 'word Vasse', "word O'Brien", 'word Abbé', 'word Kessimar'])
    expect(await e.ask('spelling:add-words', 'Teodora')).toBe(0)
    expect([dictionaryWord('Grimward'), dictionaryWord('-dash'), dictionaryWord(7)]).toEqual([true, false, false])
  })

  it('answers which languages there are and which are chosen, and keeps a choice on this device', async () => {
    const e = electron()
    expect(await e.ask('spelling:languages')).toEqual({ available: ['en-US', 'en-GB', 'fr', 'pt-BR'], chosen: ['en-GB'], system: false })
    expect(await e.ask('spelling:set-languages', ['fr', 'xx', 'en-GB'])).toEqual(['fr', 'en-GB'])
    expect(JSON.parse(e.files.get('/data/spelling.json')!)).toEqual({ languages: ['fr', 'en-GB'] })
    // Nothing usable chosen changes nothing.
    expect(await e.ask('spelling:set-languages', ['xx'])).toEqual(['fr', 'en-GB'])
    expect(JSON.parse(e.files.get('/data/spelling.json')!)).toEqual({ languages: ['fr', 'en-GB'] })
  })

  it('on a Mac leaves the languages to the system', async () => {
    const e = electron({ platform: 'darwin' })
    expect(e.calls).toEqual([])
    expect(await e.ask('spelling:languages')).toEqual({ available: [], chosen: [], system: true })
    expect(await e.ask('spelling:set-languages', ['fr'])).toEqual([])
    expect(e.calls).toEqual([])
  })

  it('gives a window the menu, acting on its own page', () => {
    const e = electron()
    const listeners = new Map<string, Handler>()
    const done: string[] = []
    const win = { webContents: { on: (name: string, fn: Handler) => listeners.set(name, fn), replaceMisspelling: (w: string) => done.push(`replace ${w}`) } }
    e.spelling.menuFor(win)
    listeners.get('context-menu')!({}, { isEditable: true, misspelledWord: 'Teodroa', dictionarySuggestions: ['Teodora'], editFlags: {} })
    expect(e.calls.at(-1)).toBe('popup')
    e.menus[0][0].click!()
    e.menus[0].find((i) => i.label === 'Add to dictionary')!.click!()
    expect(done).toEqual(['replace Teodora'])
    expect(e.calls).toContain('word Teodroa')
    // Nothing to offer, no menu.
    const before = e.calls.length
    listeners.get('context-menu')!({}, { isEditable: false, selectionText: '' })
    expect(e.calls.length).toBe(before)
  })
})
