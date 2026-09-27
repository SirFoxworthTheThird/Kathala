import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Users, Package, MapPin, Plus } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import {
  findMentionToken, mentionSuggestions,
  type MentionCandidate, type MentionKind, type MentionSuggestion, type MentionToken,
  type MentionIntent,
} from '@/lib/mentionPicker'
import { caretPoint, placePanel } from '@/lib/caretPoint'

interface SceneDraftEditorProps {
  value: string
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
const KIND_ICON: Record<MentionKind, typeof Users> = {
  character: Users,
  item: Package,
  location: MapPin,
}

const KIND_LABEL: Record<MentionKind, string> = {
  character: 'character',
  item: 'item',
  location: 'place',
}

export function SceneDraftEditor({
  value, onChange, onBlur, candidates, canCreateLocation, onPick, headerRange = null,
  placeholder, ariaLabel, rows = 5,
}: SceneDraftEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<MentionToken | null>(null)
  const [highlight, setHighlight] = useState(0)
  const pendingCaret = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [listPos, setListPos] = useState<{ top: number; left: number } | null>(null)

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
  const inHeader = !!mention && !!headerRange
    && mention.start >= headerRange.start && mention.start < headerRange.end

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

  /*
    F4: the list used to be `absolute top-full` — below the whole textarea. The
    textarea auto-grows to its content, and `main` owns the scrolling with
    `overflow-auto`, so on a scene longer than the screen the list was laid out
    past the bottom of `main` and simply never painted. Measured in a 900px
    viewport: rows at 859, 887 and 915, with the chapter bar occupying the first
    two and `new place` below the viewport entirely — and nothing scrollable to
    reach any of them.

    So it is positioned against the *caret* instead, in viewport coordinates,
    flipped above when there is no room below and clamped when there is room for
    neither. Fixed rather than absolute, so no ancestor's `overflow` can clip it.
  */
  useLayoutEffect(() => {
    const ta = taRef.current
    const list = listRef.current
    if (!mention || (matches.length === 0 && !showsNotice) || !ta || !list) {
      setListPos(null)
      return
    }
    const place = () => {
      const point = caretPoint(ta)
      if (!point) return
      setListPos(placePanel(
        point,
        { width: list.offsetWidth, height: list.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ))
    }
    place()
    // The window can move under an open list: a resize, or a scroll of any
    // ancestor. `capture` catches scrolls on `main` as well as on the window.
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [mention, matches.length, showsNotice, value])

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
    // In the brackets the sigil is the syntax, not a trigger to be consumed.
    const insert = inHeader ? `@@${name} ` : `${name} `
    const next = value.slice(0, mention.start) + insert + value.slice(mention.end)
    pendingCaret.current = mention.start + insert.length
    onChange(next, pendingCaret.current)
    onPick(suggestion, inHeader ? 'present' : mention.intent)
    setMention(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setHighlight((h) => (h + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHighlight((h) => (h - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      /*
        W23-4: **Enter may complete a name, it may not invent a record.**

        It used to take the highlighted row whatever that row was, and
        `mentionSuggestions` always appends create rows for any name not already
        taken — so `matches` is effectively never empty while a token is open,
        and Enter was never a paragraph break. Typing *"…knew every stone of
        @Wenmere"* and pressing Enter to start the next paragraph created a
        **character called Wenmere**, silently: no confirmation, no toast, just
        a new chip under MENTIONED, a row in Cast Balance reading *never
        appears*, and an entry in the picker for the rest of the book.

        The two halves of that keystroke are not alike. Completing a record that
        already exists only inserts text the writer was already typing.
        Creating one changes the world, and a key that means *paragraph* in
        every other prose editor is not consent to it. So a create needs an
        unambiguous gesture — **Tab**, or a click on the row.

        Enter on a create row closes the picker and lets the newline through,
        leaving the `@Wenmere` the writer typed as ordinary text. That is worse
        prose than a mention and better than a phantom cast member: it is
        visible, and they can see to remove it.
      */
      const chosen = matches[highlight]
      if (e.key === 'Tab' || chosen.type === 'existing') {
        e.preventDefault(); select(chosen)
      } else {
        setMention(null)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault(); setMention(null)
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
      {/*
        **Silence is the wrong answer when a sigil finds nothing.**

        `@@` deliberately offers people only and will not invent one, so a
        character who does not exist yet produces no rows — and the picker
        rendered nothing at all. That is the single moment a writer most wants
        `@@`: the first time somebody walks into the book. A run measured five
        operations to recover, and no way to tell "nothing to offer" from
        "the app stopped listening".

        So it says which it is, and where to go: a single `@` creates. The row
        is inert — it is an explanation, not an option.
      */}
      {showsNotice && (
        <div
          ref={listRef}
          style={{
            position: 'fixed',
            top: listPos?.top ?? 0,
            left: listPos?.left ?? 0,
            visibility: listPos ? 'visible' : 'hidden',
          }}
          className="z-[3000] w-64 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))] shadow-lg"
          role="status"
        >
          Nobody called “{mention!.query.trim()}” yet — type a single <b>@</b> to create them.
          {/*
            Reachable only *outside* the header, where a single `@` is indeed
            the create gesture. Inside the brackets a create row is offered
            directly, because following this advice there emptied the cast:
            the picker wrote the plain name over the sigil and the line lost
            somebody. See `headerRange`.
          */}
        </div>
      )}
      {mention && matches.length > 0 && (
        <div
          ref={listRef}
          /*
            Rendered before it is placed so it can be measured, but not painted
            at the wrong spot first: `useLayoutEffect` runs before paint, so the
            hidden frame never reaches the screen. z above the chapter bar,
            which is what was covering the first two rows.
          */
          style={{
            position: 'fixed',
            top: listPos?.top ?? 0,
            left: listPos?.left ?? 0,
            visibility: listPos ? 'visible' : 'hidden',
          }}
          className="z-[3000] w-64 overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg"
        >
          {matches.map((s, i) => {
            const Icon = s.type === 'create' ? Plus : KIND_ICON[s.kind]
            return (
              <button
                key={`${s.type}:${s.kind}:${s.type === 'existing' ? s.id : s.name}`}
                // Keep textarea focus (avoid onBlur/save) while clicking.
                onMouseDown={(e) => { e.preventDefault(); select(s) }}
                /*
                  `mousemove`, not `mouseenter`. Now that the list opens at the
                  caret it can appear directly under a pointer that is not
                  moving — the pointer is wherever the writer last clicked into
                  the prose — and `mouseenter` fires on appearance, silently
                  moving the selection off the row the typing had chosen. That
                  turned Enter on an exact match into a paragraph break, because
                  the highlighted row had become a *create* row and Enter
                  rightly refuses to invent a record.

                  `mousemove` only fires when the pointer actually moves, so
                  hovering still works and appearing under a still pointer does
                  not steal the choice.
                */
                onMouseMove={() => setHighlight(i)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors ${
                  i === highlight ? 'bg-[hsl(var(--accent))]' : ''
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
                <span className="truncate text-[hsl(var(--foreground))]">{s.name}</span>
                {/*
                  The kind is on every row, not just the ambiguous ones. A world
                  can hold a character and a place of the same name, and a badge
                  that appears only sometimes is one the eye stops reading.
                */}
                <span className="ml-auto shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                  {s.type === 'create' ? `new ${KIND_LABEL[s.kind]}` : KIND_LABEL[s.kind]}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
