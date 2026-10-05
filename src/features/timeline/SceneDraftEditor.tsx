import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import {
  findMentionToken, mentionKey, mentionSuggestions,
  type MentionCandidate, type MentionSuggestion, type MentionToken,
  type MentionIntent,
} from '@/lib/mentionPicker'
import { caretPoint } from '@/lib/caretPoint'
import { arrivalCaret, sceneShortcut, type SceneShortcut } from '@/lib/sceneStep'
import { MentionMenu } from './MentionMenu'
import { inOpenHeader, mentionInsert, punctuate } from '@/lib/mentionInsert'

interface SceneDraftEditorProps {
  value: string
  /**
   * The scene keys — next, previous, new scene after — which the Timeline
   * answers. Returns whether it did: a key nothing acted on is left to the text
   * box, so Ctrl+Enter at the last scene of the book still does whatever the
   * box would have done with it.
   */
  onShortcut?: (shortcut: SceneShortcut, caret: number) => boolean
  /**
   * Take focus, with the caret at the start of the prose or the end of it.
   * Applied once per `nonce`, and not before `ready` — the text arrives after
   * the box, and a caret put at the end of an empty box is at 0.
   */
  focusRequest?: { nonce: number; at: 'start' | 'end' } | null
  ready?: boolean
  /** The caret is reported with the text: whether it is still inside the header
   *  line decides whether that line is safe to apply yet. */
  onChange: (text: string, caret: number) => void
  onBlur: () => void
  /** Everything "@" can name: the cast, the props and the places. */
  candidates: MentionCandidate[]
  /** False in a world with no map, where a location has nowhere to be a pin. */
  canCreateLocation: boolean
  /**
   * A row was chosen. The plain name is already being written into the prose;
   * this records it against the scene, and creates the record first when the
   * row was a *create*.
   */
  /**
   * `intent` says which sigil was typed: one "@" mentions a name, two assert
   * that the character is in the room. The editor does not act on it — it
   * only reports what the writer pressed.
   */
  onPick: (suggestion: MentionSuggestion, intent: MentionIntent) => void
  /**
   * The span of `value` occupied by the scene header line, when one is shown.
   *
   * The picker fires inside the brackets — it runs on the whole value and has
   * no idea the line is there — and that is worth keeping, because it is the
   * only spell-check the line has. What it did there was strip the sigil it was
   * triggered by, which is right in prose and ruinous in a header: the plain
   * name glued itself to the name before it, the line then named one person
   * nobody answered, and the cast emptied.
   *
   * So inside this span the sigil stays, and naming somebody is asserting they
   * are present — there is nothing else naming them in a header could mean.
   */
  headerRange?: { start: number; end: number } | null
  placeholder?: string
  /** Accessible name. A placeholder is not one — it is the last-resort source
   *  in HTML-AAM and it disappears the moment the field has prose in it. */
  ariaLabel?: string
  rows?: number
}

/**
 * A scene-prose textarea with "@"-mention autocomplete. Typing "@" then a name
 * opens a character picker; choosing one inserts the character's plain name
 * (keeping the manuscript clean) and reports the mention via onMention, rather
 * than leaving an "@token" in the prose.
 */
export function SceneDraftEditor({
  value, onChange, onBlur, candidates, canCreateLocation, onPick, headerRange = null,
  placeholder, ariaLabel, rows = 5, onShortcut, focusRequest = null, ready = true,
}: SceneDraftEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)

  const focusedFor = useRef<number | null>(null)
  useEffect(() => {
    const ta = taRef.current
    if (!focusRequest || !ready || !ta || focusedFor.current === focusRequest.nonce) return
    focusedFor.current = focusRequest.nonce
    const caret = arrivalCaret(ta.value, headerRange?.end ?? null, focusRequest.at)
    // The card scrolls itself to the top; focusing must not drag it elsewhere.
    ta.focus({ preventScroll: true })
    ta.setSelectionRange(caret, caret)
  })
  const [mention, setMention] = useState<MentionToken | null>(null)
  const [highlight, setHighlight] = useState(0)
  const pendingCaret = useRef<number | null>(null)
  /** Where the space after a name just picked is, while the writer goes straight on from it: see `punctuate`. */
  const spaceAfterPick = useRef<number | null>(null)

  /*
    WR-1: the box was a fixed five rows with its own scrollbar, so 882 words of
    prose were written and read through a letterbox on the app's central
    activity. It grows to its content now, with `rows` as the floor, so a scene
    is as tall as it is.

    The resize handle went with it. It existed to escape the letterbox, and
    dragging it would only be undone by the next keystroke — auto-growing and
    hand-resizing cannot both own the height.
  */
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [value])

  // Apply a caret position requested after a controlled value update.
  useLayoutEffect(() => {
    if (pendingCaret.current != null && taRef.current) {
      taRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current)
      pendingCaret.current = null
    }
  })

  /*
    `@@` on somebody who does not exist yet: no rows, and until now no panel
    either. The notice below is placed by the same measurement as the list, so
    it needs the same ref and the same effect — hence one flag rather than two
    conditions that could drift apart.
  */
  /** Whether the token being typed sits inside the header line. */
  const inHeader = !!mention && (headerRange
    ? mention.start >= headerRange.start && mention.start < headerRange.end
    // Or the first line, opened as one and not closed yet: see `inOpenHeader`.
    : !value.slice(0, mention.start).includes('\n') && inOpenHeader(value.slice(0, mention.end)))

  const matches = mention
    ? mentionSuggestions(mention.query, candidates, {
        canCreateLocation,
        // Presence is about people, and out in the prose it may not invent one
        // — see `MentionPickerOptions`.
        ...(mention.intent === 'present' || inHeader
          ? { kinds: ['character'] as const, allowCreate: inHeader }
          : {}),
      })
    : []

  /**
   * The picker found nothing and the writer deserves to know why.
   *
   * **In practice this is always `@@`**, and the condition does not say so on
   * purpose. A single `@` with something typed always has at least a create
   * row — asserted in `mentionPicker.test.ts` — so testing the intent here
   * would be a branch that cannot be taken, which reads to a reviewer as
   * behaviour that exists. If `@` ever *could* come up empty, the writer would
   * want telling then too, and this already does.
   *
   * A bare sigil with nothing typed is a picker waiting, not a picker failing,
   * so that stays silent.
   */
  const showsNotice = !!mention && matches.length === 0 && mention.query.trim() !== ''

  function refresh(text: string, caret: number) {
    // The candidates go in because the token's own bounds depend on them: a
    // lowercase word only stays part of a name while the run still spells one
    // that exists, which is what makes "Renée de Saint-Méran" reachable.
    setMention(findMentionToken(text, caret, candidates))
    setHighlight(0)
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    const caret = e.target.selectionStart ?? text.length
    onChange(text, caret)
    refresh(text, caret)
  }

  function select(suggestion: MentionSuggestion) {
    if (!mention) return
    // The plain name goes into the prose either way — a manuscript should not
    // carry "@tokens", and a name the writer has just invented reads the same
    // as one they picked.
    // The words the writer was typing toward, which for an aliased record is
    // not the record's name — see `insertionFor`.
    const name = (suggestion.type === 'existing' ? suggestion.insert : suggestion.name)
    // In the brackets the sigil is the syntax, not a trigger to be consumed: see `mentionInsert`.
    const lineEnd = value.indexOf('\n', mention.end)
    const { insert, caret, autoSpace } = mentionInsert(name, {
      inHeader, after: value.slice(mention.end, lineEnd < 0 ? value.length : lineEnd),
    })
    const next = value.slice(0, mention.start) + insert + value.slice(mention.end)
    pendingCaret.current = mention.start + caret
    spaceAfterPick.current = autoSpace === null ? null : mention.start + autoSpace
    onChange(next, pendingCaret.current)
    onPick(suggestion, inHeader ? 'present' : mention.intent)
    setMention(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const space = spaceAfterPick.current
    // Shift is on the way to a "?" or a "!", not a move on.
    if (e.key !== 'Shift') spaceAfterPick.current = null
    const ta = e.currentTarget
    const punctuated = ta.selectionStart === ta.selectionEnd && !e.ctrlKey && !e.metaKey && !e.altKey
      ? punctuate(value, space, ta.selectionStart ?? 0, e.key)
      : null
    if (punctuated) {
      e.preventDefault()
      pendingCaret.current = punctuated.caret
      onChange(punctuated.text, punctuated.caret)
      return
    }
    const shortcut = onShortcut ? sceneShortcut(e) : null
    if (shortcut && onShortcut!(shortcut, e.currentTarget.selectionStart ?? 0)) {
      e.preventDefault()
      setMention(null)
      /*
        Leaving the scene saves it: blur is where the bracket line is applied
        and the prose written, and the card is about to close under the text
        box — an unmount flushes the prose but not the line. Still in time,
        because the close is a state update and waits for this handler to end.
        Only when the key went somewhere: at either end of the book the writer
        stays where they were, caret and all.
      */
      if (shortcut !== 'new') e.currentTarget.blur()
      return
    }
    if (!mention) return
    // Enter may complete a name but not invent a record: see `mentionKey`.
    const action = mentionKey(e.key, matches, highlight)
    if (!action) return
    if (action.kind === 'highlight') { e.preventDefault(); setHighlight(action.index) }
    else if (action.kind === 'select') { e.preventDefault(); select(action.suggestion) }
    else {
      if (!action.passThrough) e.preventDefault()
      setMention(null)
    }
  }

  /*
    **Which half of the box is the book.**

    Header and prose share one `<textarea>`, and a textarea has one text style:
    measured, the line rendered in the same serif at the same 14px in the same
    colour as the sentence under it. Nothing distinguished it, and *that* is why
    a margin note in brackets read as a declaration — because the line looks
    like a first line, a first line looked like the line.

    A class cannot fix it where it lives, so this is the thing that can: a mirror
    laid under the textarea holding the same characters in the same metrics, with
    the header's run tinted and everything else transparent. The tint therefore
    wraps exactly as the text wraps, because it *is* the text, laid out twice.

    Two properties of this box make it cheap. It auto-grows to its content and
    carries `overflow-hidden`, so it never scrolls internally and there is no
    scroll position to keep in step; and it is `bg-transparent`, so a background
    behind it shows through. The mirror is `aria-hidden` and untouchable: the
    real text is still the textarea's, one layer up.
  */
  const before = headerRange ? value.slice(0, headerRange.start) : value
  const band = headerRange ? value.slice(headerRange.start, headerRange.end) : ''
  const after = headerRange ? value.slice(headerRange.end) : ''

  return (
    <div className="relative">
      {band && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent px-3 py-2 text-sm leading-relaxed text-transparent"
          style={{ fontFamily: 'var(--font-prose)' }}
        >
          {before}
          {/*
            `box-decoration-break: clone` so a header long enough to wrap is
            tinted on every line it occupies rather than once across the whole
            run — five names in one line is an ordinary header.
          */}
          <span
            className="rounded bg-[hsl(var(--primary)/0.14)]"
            style={{ boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}
          >
            {band}
          </span>
          {after}
        </div>
      )}
      <Textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => { setMention(null); onBlur() }}
        onClick={(e) => refresh(value, (e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={rows}
        className="relative resize-none overflow-hidden bg-transparent text-sm leading-relaxed"
        style={{ fontFamily: 'var(--font-prose)' }}
      />
      {mention && (
        <MentionMenu
          matches={matches}
          highlight={highlight}
          onHighlight={setHighlight}
          onSelect={select}
          /*
            The notice is reachable only *outside* the header, where a single
            `@` is indeed the create gesture. Inside the brackets a create row
            is offered directly, because following this advice there emptied
            the cast: the picker wrote the plain name over the sigil and the
            line lost somebody. See `headerRange`.
          */
          nobody={showsNotice ? mention.query.trim() : null}
          caret={() => (taRef.current ? caretPoint(taRef.current) : null)}
          placeKey={`${mention.start}:${mention.end}:${value}`}
        />
      )}
    </div>
  )
}
