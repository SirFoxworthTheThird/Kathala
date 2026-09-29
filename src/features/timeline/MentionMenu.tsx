import { useLayoutEffect, useRef, useState } from 'react'
import { Users, Package, MapPin, Plus } from 'lucide-react'
import type { MentionKind, MentionSuggestion } from '@/lib/mentionPicker'
import { placePanel, type CaretPoint } from '@/lib/caretPoint'

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

interface MentionMenuProps {
  /** The rows, from `mentionSuggestions`. */
  matches: MentionSuggestion[]
  highlight: number
  onHighlight: (index: number) => void
  onSelect: (suggestion: MentionSuggestion) => void
  /** A name the picker found nobody for, to say so rather than show nothing; null when there is nothing to say. */
  nobody: string | null
  /** Where the caret is on screen, read each time the menu is placed. */
  caret: () => CaretPoint | null
  /** Changes whenever the caret may have moved, so the menu is placed again. */
  placeKey: string
}

/**
 * The "@" picker's list, at the caret: shared by a scene card's draft and the
 * Manuscript's Page, which find the token and write the records each their own
 * way. Which rows there are, and what each key does, is `mentionPicker`.
 */
export function MentionMenu({ matches, highlight, onHighlight, onSelect, nobody, caret, placeKey }: MentionMenuProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [listPos, setListPos] = useState<{ top: number; left: number } | null>(null)
  const caretRef = useRef(caret)
  // Before the placing below, which runs after it: effects run in order.
  useLayoutEffect(() => { caretRef.current = caret })
  const shown = matches.length > 0 || nobody !== null

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
    const list = listRef.current
    if (!shown || !list) {
      setListPos(null)
      return
    }
    const place = () => {
      const point = caretRef.current()
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
  }, [shown, matches.length, nobody, placeKey])

  /*
    Rendered before it is placed so it can be measured, but not painted at the
    wrong spot first: `useLayoutEffect` runs before paint, so the hidden frame
    never reaches the screen. z above the chapter bar, which is what was
    covering the first two rows.
  */
  const style = {
    position: 'fixed' as const,
    top: listPos?.top ?? 0,
    left: listPos?.left ?? 0,
    visibility: listPos ? ('visible' as const) : ('hidden' as const),
  }

  /*
    **Silence is the wrong answer when a sigil finds nothing.**

    `@@` deliberately offers people only and will not invent one, so a
    character who does not exist yet produces no rows — and the picker
    rendered nothing at all. That is the single moment a writer most wants
    `@@`: the first time somebody walks into the book. A run measured five
    operations to recover, and no way to tell "nothing to offer" from
    "the app stopped listening".

    So it says which it is, and where to go: a single `@` creates. The row
    is inert — it is an explanation, not an option.
  */
  if (matches.length === 0) {
    if (nobody === null) return null
    return (
      <div
        ref={listRef}
        style={style}
        className="z-[3000] w-64 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))] shadow-lg"
        role="status"
      >
        Nobody called “{nobody}” yet — type a single <b>@</b> to create them.
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      style={style}
      className="z-[3000] w-64 overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg"
    >
      {matches.map((s, i) => {
        const Icon = s.type === 'create' ? Plus : KIND_ICON[s.kind]
        return (
          <button
            key={`${s.type}:${s.kind}:${s.type === 'existing' ? s.id : s.name}`}
            // Keep the editor's focus (avoid its blur and save) while clicking.
            onMouseDown={(e) => { e.preventDefault(); onSelect(s) }}
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
            onMouseMove={() => onHighlight(i)}
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
  )
}
