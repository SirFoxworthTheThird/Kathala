import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view'
import { StateEffect, StateField, type EditorState } from '@codemirror/state'
import { headerLineOf, headingsField, hideHeader, showHeader } from '@/lib/draftEditor'

/*
  A header line suggested from a scene's prose, beneath its header on the Page
  (next-plan.md, Part D1): who speaks in the scene and is not in its header
  (`suggestCast`). For the scene the caret is in only — a long book has one in
  many scenes, and a page of them would be read as clutter rather than as an
  offer. One key adds them to the header, another sets them aside.
*/

/** The scene's suggestion: who to add, by id and by name as the header writes it. */
export interface ProseSuggestion { sceneId: string; people: Array<{ id: string; name: string }> }

/** What the suggestion's buttons do: the same as its keys. */
export interface SuggestionActions { add: () => void; dismiss: () => void }

export const setSuggestion = StateEffect.define<ProseSuggestion | null>()

/** The keys, as the suggestion says them. */
export const ADD_KEY = 'Alt-Enter'
export const DISMISS_KEY = 'Alt-Shift-Enter'
const shown = (key: string) => key.replace(/-/g, '+')

class SuggestionWidget extends WidgetType {
  readonly suggestion: ProseSuggestion
  readonly actions: SuggestionActions
  constructor(suggestion: ProseSuggestion, actions: SuggestionActions) {
    super()
    this.suggestion = suggestion
    this.actions = actions
  }
  private get key() { return `${this.suggestion.sceneId}|${this.suggestion.people.map((p) => `${p.id}:${p.name}`).join(',')}` }
  eq(other: SuggestionWidget) { return other.key === this.key }
  toDOM() {
    const wrap = document.createElement('div')
    wrap.className = 'cm-draft-suggest'
    wrap.contentEditable = 'false'
    wrap.setAttribute('role', 'group')
    wrap.setAttribute('aria-label', 'Suggested for this scene’s header')
    const said = document.createElement('span')
    said.className = 'cm-draft-suggest-said'
    said.textContent = 'Speaking here, not in the header: '
    const line = document.createElement('code')
    line.textContent = this.suggestion.people.map((p) => `@@${p.name}`).join(' ')
    said.append(line)
    const button = (label: string, key: string, run: () => void) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.title = shown(key)
      b.setAttribute('aria-keyshortcuts', shown(key))
      // Pressed, not clicked: a mousedown would move the caret first, and the suggestion is the caret's scene's.
      b.addEventListener('mousedown', (e) => e.preventDefault())
      b.addEventListener('click', run)
      return b
    }
    wrap.append(
      said,
      button('Add to header', ADD_KEY, () => this.actions.add()),
      button('Not here', DISMISS_KEY, () => this.actions.dismiss()),
    )
    return wrap
  }
  ignoreEvent() { return true }
}

/** Where scene `sceneId`'s suggestion goes: under its header, or under its title where it shows none. */
function under(state: EditorState, sceneId: string): number | null {
  const headings = state.field(headingsField)
  const i = headings.findIndex((h) => h.id === sceneId)
  if (i < 0 || headings[i].kind !== 'scene') return null
  const header = headerLineOf(state, i)
  return state.doc.lineAt(header ? header.to : headings[i].pos).to
}

/** The suggestion for the caret's scene, and where it is drawn. `actions` is read when a button is pressed. */
export function suggestionField(actions: SuggestionActions) {
  return StateField.define<{ suggestion: ProseSuggestion | null; decorations: DecorationSet }>({
    create: () => ({ suggestion: null, decorations: Decoration.none }),
    update(value, tr) {
      let suggestion = value.suggestion
      for (const e of tr.effects) if (e.is(setSuggestion)) suggestion = e.value
      // Moved with the text, and with a header shown or taken away under the title.
      const headers = tr.effects.some((e) => e.is(showHeader) || e.is(hideHeader))
      if (suggestion === value.suggestion && !tr.docChanged && !headers) return value
      const at = suggestion ? under(tr.state, suggestion.sceneId) : null
      const decorations = suggestion && at !== null
        ? Decoration.set([Decoration.widget({ widget: new SuggestionWidget(suggestion, actions), side: 1, block: true }).range(at)])
        : Decoration.none
      return { suggestion, decorations }
    },
    provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
  })
}

export const SUGGESTION_THEME = {
  '.cm-draft-suggest': {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4em 0.6em', margin: '0.3em 0 0.6em',
    padding: '0.35em 0.6em', border: '1px dashed hsl(var(--border))', borderRadius: '4px',
    fontFamily: 'var(--font-body)', fontSize: '0.8em', lineHeight: '1.5', color: 'hsl(var(--muted-foreground))',
  },
  '.cm-draft-suggest code': { color: 'hsl(var(--foreground))', fontFamily: 'inherit' },
  '.cm-draft-suggest button': {
    color: 'hsl(var(--foreground))', backgroundColor: 'transparent', border: '1px solid hsl(var(--border))',
    borderRadius: '9999px', padding: '0.05em 0.7em', cursor: 'pointer',
  },
  '.cm-draft-suggest button:hover': { backgroundColor: 'hsl(var(--accent))' },
}

/*
  Who the writer has said is not in a scene, per scene, so the suggestion does
  not come back the next time the caret is there. On this device: it is the
  writer's answer to an offer, not something the book says, and losing it
  costs no more than seeing the offer again.
*/
const dismissedKey = (worldId: string) => `kathala-suggest-dismissed:${worldId}`

export function dismissedIn(worldId: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(dismissedKey(worldId))
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

export function dismissSuggestion(worldId: string, sceneId: string, ids: readonly string[]): Record<string, string[]> {
  const all = dismissedIn(worldId)
  const next = { ...all, [sceneId]: [...new Set([...(all[sceneId] ?? []), ...ids])] }
  try { localStorage.setItem(dismissedKey(worldId), JSON.stringify(next)) } catch { /* the offer comes back; nothing is lost */ }
  return next
}
