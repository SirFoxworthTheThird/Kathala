import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { useActiveEventId, useAppStore } from '@/store'
import { useWorldChapters, useAllWorldEvents } from '@/db/hooks/useTimeline'
import { useWorld } from '@/db/hooks/useWorlds'
import { cn } from '@/lib/utils'
import { useRevealAll } from '@/components/useRevealAll'

/**
 * Always-visible readout + stepper for the global time cursor (`activeEventId`).
 *
 * The chapter cursor is the heart of the app — every view reads state relative
 * to it — but it previously lived only in the bottom timeline bar, which is
 * hidden on several sections (Dashboard, Arc, Lore, Factions, Settings). This
 * surfaces "what moment am I viewing" in the TopBar on every page, and lets the
 * writer step through time or jump to the full timeline from anywhere.
 *
 * It reads and writes the same `activeEventId` as the bottom bar, so the two
 * stay perfectly in sync wherever both are shown.
 */
export function TimeCursor({ worldId }: { worldId: string }) {
  const navigate = useNavigate()
  const activeEventId = useActiveEventId()
  const setActiveEventId = useAppStore((s) => s.setActiveEventId)
  // While the story is playing, the playback loop owns activeEventId. Keep the
  // readout live (it animates through chapters as the story plays) but make the
  // controls inert so a stray click can't fight or restart the playback timer.
  const isPlayingStory = useAppStore((s) => s.isPlayingStory)
  // `undefined` while Dexie is opening. The gate reports itself inactive during
  // that window too, which is indistinguishable from "writing" — see
  // `revealAllAction`.
  const world = useWorld(worldId)
  const chapters = useWorldChapters(worldId)
  // "All chapters" is a full reveal by design. For a writer that is just the
  // default view; for a reader it undoes the thing they turned reading mode on
  // for, and this button is an X beside the stepper — which reads as "dismiss",
  // not "show me the ending". So while reading, it asks first — see
  // `useRevealAll`, which is shared with the bottom bar's identical control.
  const { requestClear, revealAllDialog } = useRevealAll(worldId)
  // Ungated: the cursor has to be able to step forward into what has not been
  // revealed yet — stepping forward is how a reader reveals it.
  const events = useAllWorldEvents(worldId)

  // Order events the same way the timeline bar does: by chapter number, then
  // by the event's sort order within its chapter.
  const orderedEvents = useMemo(() => {
    const numById = new Map(chapters.map((c) => [c.id, c.number]))
    return [...events].sort((a, b) => {
      const an = (numById.get(a.chapterId) ?? 0) * 10_000 + a.sortOrder
      const bn = (numById.get(b.chapterId) ?? 0) * 10_000 + b.sortOrder
      return an - bn
    })
  }, [events, chapters])

  const activeIndex = activeEventId ? orderedEvents.findIndex((e) => e.id === activeEventId) : -1
  const activeEvent = activeIndex >= 0 ? orderedEvents[activeIndex] : null
  const activeChapter = activeEvent ? chapters.find((c) => c.id === activeEvent.chapterId) ?? null : null
  const prevEvent = activeIndex > 0 ? orderedEvents[activeIndex - 1] : null
  const nextEvent =
    activeIndex >= 0
      ? activeIndex < orderedEvents.length - 1
        ? orderedEvents[activeIndex + 1]
        : null
      : (orderedEvents[0] ?? null) // from "All", stepping forward lands on the first moment

  // Nothing to point at yet — stay out of the way until the story has a moment.
  if (orderedEvents.length === 0) return null

  // 32x32, matching every other icon button in the top bar. These were h-6 w-5
  // — 24x20, less than half the 44px touch guideline — while being the primary
  // way to move the time cursor on a phone.
  //
  // Deliberately not `.pw-tap`: that utility centres a 44px hit area on the
  // control, and its own guidance is to use it only where controls are well
  // spaced. Here the previous-moment button sits ~6px from the brand button
  // (which navigates out of the world) and the next-moment button sits beside
  // the clear-cursor X, so overlapping 44px zones would make the neighbours
  // easier to hit by accident rather than harder.
  const stepBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-30'

  return (
    // `min-w-0` matters: without it this flex item refuses to shrink below its
    // content, so a long chapter title pushes the cursor straight through the
    // top bar's right-hand buttons instead of truncating.
    <div className="flex min-w-0 items-center gap-0.5">
      <button
        onClick={() => prevEvent && setActiveEventId(prevEvent.id)}
        disabled={!prevEvent || isPlayingStory}
        aria-label="Previous moment"
        title="Previous moment"
        className={stepBtn}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        onClick={isPlayingStory ? undefined : () => navigate(`/worlds/${worldId}/timeline`)}
        disabled={isPlayingStory}
        title={
          isPlayingStory
            ? `Playing… Ch.${activeChapter?.number} · ${activeEvent?.title || activeChapter?.title || ''}`
            : activeEvent
            ? `Ch.${activeChapter?.number} · ${activeChapter?.title} — ${activeEvent.title || 'Untitled scene'} (open timeline)`
            : 'Viewing all chapters — open the timeline to pick a moment'
        }
        className={cn(
          // Narrower cap on a phone, where the top bar also carries undo, redo
          // and search: at 200px the pill claimed more than half the header.
          //
          // `px-1.5` below `sm` is 4px of the 12 that F-5 needed. The pill is
          // the last thing in this header that can shrink, so every fixed pixel
          // beside it comes out of the label.
          'flex h-7 min-w-0 max-w-[110px] items-center gap-1.5 rounded-md border px-1.5 text-xs transition-colors sm:max-w-[200px] sm:px-2',
          activeEvent
            ? 'border-[hsl(var(--ring)/0.4)] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
        )}
      >
        {/*
          Decoration, so it yields to the label on a phone — "Ch.4" tells you
          where you are; the clock does not.

          It used to say that and appear at `min-[360px]`, which is the width
          where the label needs the room most, and being `shrink-0` it took its
          14px out of the label's share. Measured on the built app with the
          cursor on Ch.4: the label box was **0px of the 30px** it needed at
          360, 15/30 at 320, 25/30 at 390 — the pill was a bare clock glyph on
          the commonest phone width there is. Gated at `sm` it is gone wherever
          the header is tight and back wherever there is room.
        */}
        <Clock className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden="true" />
        {activeEvent ? (
          <span className="truncate">
            <span className="font-semibold">Ch.{activeChapter?.number ?? '—'}</span>
            {/* The event title is dropped on a phone rather than squeezed to a
                couple of letters. The chapter number is the part that still
                reads at that size; the full label is in the tooltip and on the
                timeline the pill opens. */}
            <span className="hidden text-[hsl(var(--muted-foreground))] sm:inline">
              {' · '}
              {activeEvent.title || activeChapter?.title || 'Untitled'}
            </span>
          </span>
        ) : (
          <span className="truncate">All chapters</span>
        )}
      </button>

      <button
        onClick={() => nextEvent && setActiveEventId(nextEvent.id)}
        disabled={!nextEvent || isPlayingStory}
        aria-label="Next moment"
        title="Next moment"
        className={stepBtn}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>

      {activeEvent && (
        <button
          onClick={requestClear}
          disabled={isPlayingStory || world === undefined}
          aria-label="View all chapters"
          title="View all chapters"
          // Hidden on the narrowest phones so the chapter number itself still
          // fits. It is the most redundant control here — the timeline reaches
          // "all chapters" too, and stepping back does the same job.
          // Set apart from "next moment": this one discards the reading
          // position, and it used to sit 2px from the control a reader taps
          // repeatedly.
          //
          // The cut-off is 390 rather than 360 because 360 is where it stopped
          // being affordable: with this button and the clock both arriving at
          // 360, a two-digit chapter had 33px of the 39 it needs. At 390 there
          // is room for both, and `e2e/touchTargets.spec.ts` asserts it is
          // present and clear of "next moment" at exactly that width.
          className={cn(stepBtn, 'ml-1.5 hidden min-[390px]:flex')}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {revealAllDialog}
    </div>
  )
}
