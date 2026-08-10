import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Character } from '@/types'
import { Textarea } from '@/components/ui/textarea'
import { PortraitImage } from '@/components/PortraitImage'
import { charColor } from '@/lib/characterColor'

interface SceneDraftEditorProps {
  value: string
  onChange: (text: string) => void
  onBlur: () => void
  characters: Character[]
  /** Called when a character is chosen via the "@" picker. */
  onMention: (characterId: string) => void
  placeholder?: string
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
export function SceneDraftEditor({
  value, onChange, onBlur, characters, onMention, placeholder, rows = 5,
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
    ? characters
        .filter((c) => {
          if (!mention.query) return true
          const q = mention.query.toLowerCase()
          const first = c.name.split(/\s+/)[0].toLowerCase()
          return c.name.toLowerCase().startsWith(q) || first.startsWith(q) ||
            c.aliases?.some((a) => a.toLowerCase().startsWith(q))
        })
        .slice(0, 6)
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

  function select(character: Character) {
    if (!mention) return
    const insert = character.name + ' '
    const next = value.slice(0, mention.start) + insert + value.slice(mention.end)
    pendingCaret.current = mention.start + insert.length
    onChange(next)
    onMention(character.id)
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
        rows={rows}
        className="resize-none overflow-hidden text-sm font-serif leading-relaxed"
      />
      {mention && matches.length > 0 && (
        <div className="absolute left-2 top-full z-20 mt-1 w-56 overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg">
          {matches.map((c, i) => (
            <button
              key={c.id}
              // Keep textarea focus (avoid onBlur/save) while clicking.
              onMouseDown={(e) => { e.preventDefault(); select(c) }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors ${
                i === highlight ? 'bg-[hsl(var(--accent))]' : ''
              }`}
            >
              <PortraitImage
                imageId={c.portraitImageId}
                className="h-5 w-5 rounded-full object-cover"
                fallbackClassName="h-5 w-5 rounded-full"
              />
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: charColor(c) }} />
              <span className="truncate text-[hsl(var(--foreground))]">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
