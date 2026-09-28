import { useState, useMemo, useRef } from 'react'
import { ChapterGoal } from '@/features/manuscript'
import { useNavigate } from 'react-router-dom'
import { Users, Network, StickyNote, ChevronDown, ChevronRight, Scroll, BookLock, X } from 'lucide-react'
import { useEvents, updateChapter } from '@/db/hooks/useTimeline'
import { useChapterEventSnapshots } from '@/db/hooks/useSnapshots'
import { useEventRelationshipSnapshots } from '@/db/hooks/useRelationshipSnapshots'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { chapterWithheld } from '@/lib/chapterReached'
import { Button } from '@/components/ui/button'
import { RecordStateInline } from './RecordStateInline'
import { SnapshotCard } from './SnapshotCard'
import { EmptyState } from '@/components/EmptyState'
import type { Chapter, Character, WorldEvent } from '@/types'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { castWithoutState, charactersNotInChapter, hasAnyCharacterState } from '@/lib/chapterCast'

/**
 * One scene's cast and the state each of them is in (CD-1).
 *
 * This used to list only the snapshots that happened to exist, which meant a
 * scene with five named characters and no snapshots yet showed nothing at all —
 * and the panel's dominant content became the world's other thirty-six
 * characters, each marked *no snapshot*. The writer's question is "who is here
 * and what state are they in"; the answer starts from the scene's own cast, and
 * a cast member with nothing recorded is a gap worth showing rather than a
 * reason to leave them out.
 */
function EventSnapshotSection({
  event,
  snapshots,
  characters,
  worldId,
  onRecordState,
}: {
  event: WorldEvent
  snapshots: ReturnType<typeof useChapterEventSnapshots>
  characters: Character[]
  worldId: string
  /** Absent while reading: this is a readout then, not a way in. */
  onRecordState?: (characterId: string, eventId: string) => void
}) {
  const [open, setOpen] = useState(true)
  /**
   * Which character's quick form is open, if any — one at a time, and the same
   * state for both halves of the panel: a gap row recording a state, and a
   * recorded card correcting one.
   */
  const [recording, setRecording] = useState<string | null>(null)
  const eventSnapshots = snapshots.filter((s) => s.eventId === event.id)
  const uncast = castWithoutState(event, snapshots, characters)

  const total = eventSnapshots.length + uncast.length
  if (total === 0) return null

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        }
        <span className="truncate flex-1">{event.title}</span>
        <span className="shrink-0 text-[hsl(var(--muted-foreground))]">{total}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[hsl(var(--border))] p-2">
          {eventSnapshots.map((s) => {
            /*
              The same form the row below uses to *record* a state, reused to
              correct one. It prefills from this scene's own record — including
              the status note, which `draftFromSnapshot` keeps when the record
              is at this scene rather than carried forward — and saving updates
              that row in place.
            */
            if (onRecordState && recording === s.characterId) {
              const who = characters.find((c) => c.id === s.characterId)
              return (
                <RecordStateInline
                  key={s.id}
                  worldId={worldId}
                  characterId={s.characterId}
                  characterName={who?.name ?? '?'}
                  eventId={event.id}
                  onDone={() => setRecording(null)}
                  onOpenFullEditor={() => { setRecording(null); onRecordState(s.characterId, event.id) }}
                />
              )
            }
            return (
              <SnapshotCard
                key={s.id}
                snapshot={s}
                onEdit={onRecordState ? () => setRecording(s.characterId) : undefined}
              />
            )
          })}
          {uncast.map((c) => {
            /*
              F15's other half: the row told you a state was missing and gave
              you no way to record it — filling the gap it names cost six to
              eight clicks across three screens.

              It routed to the character's own page next, which made it one
              click and a change of screen. Both writer runs still priced the
              whole act at six to eight interactions, so the row now *takes* the
              answer: the three questions somebody walking down a cast is
              answering, in place, with the full editor still one click away.
            */
            if (onRecordState && recording === c.id) {
              return (
                <RecordStateInline
                  key={c.id}
                  worldId={worldId}
                  characterId={c.id}
                  characterName={c.name}
                  eventId={event.id}
                  onDone={() => setRecording(null)}
                  onOpenFullEditor={() => { setRecording(null); onRecordState(c.id, event.id) }}
                />
              )
            }
            const Row = onRecordState ? 'button' : 'div'
            return (
            <Row
              key={c.id}
              data-cast-without-state={c.id}
              onClick={onRecordState ? () => setRecording(c.id) : undefined}
              title={onRecordState ? `Record ${c.name}'s state in this scene` : undefined}
              /*
                F15: the caption was `shrink-0` and the name was not, so in a
                296px column the italic note took what it wanted and the name —
                the part you are scanning for — was crushed to "Corvin …",
                measured at a 57px box holding 72px of text.

                The name is the rigid one now and the note is what moves: when
                the two do not fit side by side the note wraps to a second line,
                which is the right way round — a note on its own line is still
                legible, a truncated name is not. `max-w-full truncate` keeps an
                extreme name inside the row rather than breaking the layout.
              */
              className={cn(
                'flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-2 text-left text-xs',
                onRecordState && 'transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]',
              )}
            >
              <span className="max-w-full shrink-0 truncate font-medium">{c.name}</span>
              <span className="shrink-0 italic text-[hsl(var(--muted-foreground))]">
                {onRecordState ? 'no state recorded — record it' : 'no state recorded'}
              </span>
            </Row>
          )})}
        </div>
      )}
    </div>
  )
}

/**
 * The chapter you are in, beside the book.
 *
 * This was a page of its own — the chapter screen — with the chapter's scenes
 * down the middle and these panels beside them, while the whole book was a
 * second page listing the same chapters and scenes another way. The scenes are
 * the book's now: the open chapter's row expands in the list, holding the same
 * cards. What is about the chapter rather than any one scene — its title and
 * synopsis, who is in it and in what state, the relationships at its end, the
 * writer's notes — is this panel, which sits beside the list on a wide screen
 * and under the chapter's row on a narrow one.
 *
 * Keyed on the chapter by its parent, so the fields below start from the
 * chapter they are showing rather than the one before.
 */
export function ChapterPanel({ chapter, onClose, words }: {
  chapter: Chapter
  /** Back to the whole book, with no chapter open. */
  onClose: () => void
  /** The chapter's prose so far, for its word goal. */
  words: number
}) {
  const worldId = chapter.worldId
  const chapterId = chapter.id
  const navigate = useNavigate()
  const events = useEvents(chapterId)
  const characters = useCharacters(worldId)
  const relationships = useRelationships(worldId)
  const gate = useGate()
  const setActiveEventId = useAppStore((st) => st.setActiveEventId)

  const [notes, setNotes] = useState(chapter.notes ?? '')
  const [synopsis, setSynopsis] = useState(chapter.synopsis ?? '')
  const [title, setTitle] = useState(chapter.title)
  const [showAbsent, setShowAbsent] = useState(false)

  const sortedEvents = [...events].sort((a, b) => a.sortOrder - b.sortOrder)
  const eventIds = sortedEvents.map((e) => e.id)
  const lastEventId = eventIds.length > 0 ? eventIds[eventIds.length - 1] : null

  const chapterSnapshots = useChapterEventSnapshots(eventIds)
  /*
    `useChapterEventSnapshots` is ungated — its neighbour `useWorldSnapshots` in
    the same file filters through the gate and this one does not — so even on a
    chapter the reader has reached, state recorded at a *later scene within it*
    would be on screen. The withheld guard below cannot catch that: the chapter
    is legitimately open.
  */
  const allSnapshots = useMemo(
    () => (gate.active ? chapterSnapshots.filter((s) => gate.hasReached(s.eventId)) : chapterSnapshots),
    [chapterSnapshots, gate],
  )
  const relSnapshots = useEventRelationshipSnapshots(lastEventId)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const synopsisTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleNotesChange(value: string) {
    setNotes(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      // One writing burst is one undo step, not one per typing pause.
      updateChapter(chapterId, { notes: value }, { coalesce: true })
    }, 600)
  }

  /*
    N5: the synopsis was write-once. The Add Chapter dialog offered the field and
    nothing anywhere edited it afterwards. It prints in the Manuscript in draft
    mode, in the Writer's Brief and on the chapter's row, it feeds the chapter-AI
    prompt, and it is searchable once the reader has reached the chapter —
    saved like the notes, debounced and coalesced, so a sentence typed in one go
    is one undo step.
  */
  function handleSynopsisChange(value: string) {
    setSynopsis(value)
    if (synopsisTimer.current) clearTimeout(synopsisTimer.current)
    synopsisTimer.current = setTimeout(() => {
      updateChapter(chapterId, { synopsis: value }, { coalesce: true })
    }, 600)
  }

  /*
    Typed in place, like the synopsis beside it, rather than only through the
    row's ⋯ → Rename chapter — at 117 chapters, finding the row was the cost.
  */
  function handleTitleChange(value: string) {
    setTitle(value)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => {
      // Blank is not a rename: clearing the field to retype should not leave a
      // nameless chapter behind in the moment between.
      if (value.trim()) updateChapter(chapterId, { title: value.trim() }, { coalesce: true })
    }, 600)
  }

  const close = (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Close the chapter"
      title="Back to the whole book" onClick={onClose}>
      <X className="h-4 w-4" />
    </Button>
  )

  /*
    A chapter the reader has not reached shows nothing of itself.

    The chapter screen, when it was one, took the gate for two things — hiding
    *Add Scene*, and declining to move the cursor — and so a later chapter
    showed its scenes, its synopsis and its Character States in full. Measured
    on a downloaded *Philosopher's Stone* at chapter 4, that put Quirrell and
    Voldemort two taps from a reader's ordinary position. Withholding the whole
    panel rather than field by field is deliberate: a rule applied per field
    leaves the next field added here unguarded by default. The row in the list
    is already locked; this says why, rather than showing a blank.
  */
  if (chapterWithheld(gate, chapter.number)) {
    return (
      <section aria-label={`Chapter ${chapter.number}`} className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-2">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold">Chapter {chapter.number}</h2>
          {close}
        </div>
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <BookLock className="h-8 w-8 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            You have not reached this chapter yet
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            You are reading at chapter {gate.chapterNumber}. This will fill in when you get
            here — nothing from it is shown before then.
          </p>
        </div>
      </section>
    )
  }

  // The rest of the world's characters are not in this chapter, which is
  // ordinary rather than a finding — so the roll-call of them is folded away by
  // default (CD-1) instead of being the panel's dominant content.
  const missingSnapshots = charactersNotInChapter(characters, sortedEvents, allSnapshots)
  const anyState = hasAnyCharacterState(sortedEvents, allSnapshots, characters)

  return (
    <section aria-label={`Chapter ${chapter.number}`} className="flex flex-col">
      <div className="flex items-start gap-2 border-b border-[hsl(var(--border))] px-4 py-2">
        <div className="min-w-0 flex-1">
          {gate.active ? (
            <h2 className="text-base font-semibold">Ch. {chapter.number} — {chapter.title}</h2>
          ) : (
            <h2 className="flex items-baseline gap-1 text-base font-semibold">
              <span className="shrink-0">Ch. {chapter.number} —</span>
              <input
                className="min-w-0 flex-1 truncate rounded bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-[hsl(var(--muted-foreground))] focus:bg-[hsl(var(--muted))]"
                aria-label="Chapter title"
                placeholder="Untitled chapter"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
            </h2>
          )}
          {gate.active ? (
            // A reader's chapter summary is the author's writing, shown and not typed in.
            chapter.synopsis ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2" title={chapter.synopsis}>{chapter.synopsis}</p>
            ) : null
          ) : (
            <input
              className="w-full truncate bg-transparent text-xs text-[hsl(var(--muted-foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:text-[hsl(var(--foreground))]"
              aria-label="Chapter synopsis"
              placeholder="One line on what happens in this chapter…"
              value={synopsis}
              onChange={(e) => handleSynopsisChange(e.target.value)}
            />
          )}
          {/* The author's target for the chapter — the Manuscript's, here where the chapter is. */}
          {!gate.active && <ChapterGoal chapterId={chapterId} words={words} goal={chapter.wordGoal ?? null} />}
        </div>
        {close}
      </div>

      {/* Character snapshots — per-event breakdown */}
      <div className="flex flex-col border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-2">
          <Users className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-medium">Character States</span>
        </div>
        <div className="flex flex-col gap-2 p-3">
          {events.length === 0 && (
            <EmptyState icon={Scroll} title="No scenes yet" className="py-4" />
          )}

          {/* EV-2: with events but nobody in them the column used to be a
              blank column with no explanation at all. */}
          {events.length > 0 && !anyState && (
            <EmptyState
              icon={Users}
              title="No one in this chapter yet"
              description="Add characters to a scene's cast, or record their state on the map, and they will appear here."
              className="py-4"
            />
          )}

          {sortedEvents.map((ev) => (
            <EventSnapshotSection
              key={ev.id}
              event={ev}
              snapshots={allSnapshots}
              characters={characters}
              worldId={worldId}
              onRecordState={gate.active ? undefined : (characterId, eventId) => {
                // The cursor first, so the panel opens on the scene the gap
                // is in rather than wherever the writer happened to be.
                setActiveEventId(eventId)
                navigate(`/worlds/${worldId}/characters/${characterId}?tab=state`)
              }}
            />
          ))}

          {/* Everyone else in the world, folded away (CD-1) */}
          {missingSnapshots.length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setShowAbsent((v) => !v)}
                aria-expanded={showAbsent}
                className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                {showAbsent
                  ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                }
                {missingSnapshots.length} other character{missingSnapshots.length !== 1 ? 's' : ''} not in this chapter
              </button>
              {showAbsent && missingSnapshots.map((c) => (
                <div key={c.id} className="mb-1 flex items-center gap-2 rounded border border-dashed border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {c.name}
                  <span className="ml-auto italic">no snapshot</span>
                </div>
              ))}
            </div>
          )}

          {/*
            Relationship snapshots (end of chapter state).

            A section with nothing in it is a finding for a writer — nobody
            has recorded a state here yet — and a dead end for a reader, who
            cannot record one. Two blind reader runs met this and the empty
            Writer's Notes beside it as "two empty sections addressed to
            somebody who is not here". Same rule as the map sidebar's Routes
            and Regions.
          */}
          {relationships.length > 0 && (!gate.active || relSnapshots.length > 0) && (
            <div className="mt-1 border-t border-[hsl(var(--border))] pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Network className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Relationship States</span>
                <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">end of chapter</span>
              </div>
              {relSnapshots.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No relationship states recorded.</p>
              ) : (
                relSnapshots.map((rs) => {
                  const rel = relationships.find((r) => r.id === rs.relationshipId)
                  const charA = characters.find((c) => c.id === rel?.characterAId)
                  const charB = characters.find((c) => c.id === rel?.characterBId)
                  if (!rel || !charA || !charB) return null
                  return (
                    <div key={rs.id} className="mb-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-1 font-medium">
                        <span>{charA.name}</span>
                        <span className="text-[hsl(var(--muted-foreground))]">↔</span>
                        <span>{charB.name}</span>
                        {!rs.isActive && (
                          <span className="ml-1 rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">inactive</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{rs.label} · {rs.sentiment} · {rs.strength}</p>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Writer's Notes — see the note on Relationship States above. */}
      {(!gate.active || notes.trim()) && (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-2">
          <StickyNote className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-medium">Writer's Notes</span>
        </div>
        <div className="flex flex-col p-3">
          {/*
            The notes are the author's, on a chapter the reader has reached —
            so they are shown and not editable. This box took a reader's
            typing and wrote it to the database while `readingMode` was on,
            which is the same defect **RM-1** closed on the map.
          */}
          {gate.active ? (
            notes.trim() ? (
              <p className="whitespace-pre-wrap rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2.5 text-sm leading-relaxed text-[hsl(var(--foreground))] lg:text-xs">
                {notes}
              </p>
            ) : (
              <p className="text-xs italic text-[hsl(var(--muted-foreground))]">
                No notes on this chapter.
              </p>
            )
          ) : (
            <>
              <textarea
                className="min-h-[10rem] resize-y rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors focus:border-[hsl(var(--ring))] leading-relaxed lg:text-xs"
                aria-label="Writer's notes for this chapter"
                placeholder="Freeform notes for this chapter — reminders, things to fix, ideas, open questions…"
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
              />
              <p className="mt-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">Auto-saved</p>
            </>
          )}
        </div>
      </div>
      )}
    </section>
  )
}
