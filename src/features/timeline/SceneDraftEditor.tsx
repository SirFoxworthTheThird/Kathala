import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Users, Package, MapPin, Plus } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import {
  mentionSuggestions, type MentionCandidate, type MentionKind, type MentionSuggestion,
} from '@/lib/mentionPicker'

interface SceneDraftEditorProps {
  value: string
  onChange: (text: string) => void
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
  onPick: (suggestion: MentionSuggestion) => void
  placeholder?: string
  /** Accessible name. A placeholder is not one — it is the last-resort source
   *  in HTML-AAM and it disappears the moment the field has prose in it. */
  ariaLabel?: string
  rows?: number
}

interface MentionState {
  /** Index of the "@" in the text. */
  start: number
  /** Caret position (end of the query). */
  end: number
  query: string
}

/** Find an in-progress "@name" token immediately before the caret, if any. */
function findMention(text: string, caret: number): MentionState | null {
  const before = text.slice(0, caret)
  const m = before.match(/@(\w*)$/)
  if (!m) return null
  return { start: caret - m[0].length, end: caret, query: m[1] }
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
  value, onChange, onBlur, candidates, canCreateLocation, onPick, placeholder, ariaLabel, rows = 5,
}: SceneDraftEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<MentionState | null>(null)
  const [highlight, setHighlight] = useState(0)
  const pendingCaret = useRef<number | null>(null)

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

  const matches = mention
    ? mentionSuggestions(mention.query, candidates, { canCreateLocation })
    : []

  function refresh(text: string, caret: number) {
    const m = findMention(text, caret)
    setMention(m)
    setHighlight(0)
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    onChange(text)
    refresh(text, e.target.selectionStart ?? text.length)
  }

  function select(suggestion: MentionSuggestion) {
    if (!mention) return
    // The plain name goes into the prose either way — a manuscript should not
    // carry "@tokens", and a name the writer has just invented reads the same
    // as one they picked.
    const insert = suggestion.name + ' '
    const next = value.slice(0, mention.start) + insert + value.slice(mention.end)
    pendingCaret.current = mention.start + insert.length
    onChange(next)
    onPick(suggestion)
    setMention(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setHighlight((h) => (h + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHighlight((h) => (h - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault(); select(matches[highlight])
    } else if (e.key === 'Escape') {
      e.preventDefault(); setMention(null)
    }
  }

  return (
    <div className="relative">
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
        className="resize-none overflow-hidden text-sm font-serif leading-relaxed"
      />
      {mention && matches.length > 0 && (
        <div className="absolute left-2 top-full z-20 mt-1 w-64 overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg">
          {matches.map((s, i) => {
            const Icon = s.type === 'create' ? Plus : KIND_ICON[s.kind]
            return (
              <button
                key={`${s.type}:${s.kind}:${s.type === 'existing' ? s.id : s.name}`}
                // Keep textarea focus (avoid onBlur/save) while clicking.
                onMouseDown={(e) => { e.preventDefault(); select(s) }}
                onMouseEnter={() => setHighlight(i)}
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
