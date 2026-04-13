import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useChapterSnapshots } from '@/db/hooks/useSnapshots'
import { useCharacters } from '@/db/hooks/useCharacters'
import type { PlaybackSpeed } from '@/store'
import { readingHoldMs } from '@/lib/playbackTiming'

const FADE_OUT_BEFORE_MS = 1400

interface Props {
  eventId: string
  worldId: string
  playbackSpeed: PlaybackSpeed
  chapterNumber: number
  chapterTitle: string
  synopsis?: string
}

export function StoryNotesOverlay({ eventId, worldId, playbackSpeed, chapterNumber, chapterTitle, synopsis }: Props) {
  const snapshots  = useChapterSnapshots(eventId)
  const characters = useCharacters(worldId)
  const [phase, setPhase] = useState<'hidden' | 'chapter' | 'notes' | 'fading'>('hidden')
  const scrollRef = useRef<HTMLDivElement>(null)

  const notedSnaps = snapshots.filter((s) => s.statusNotes?.trim())

  // Compute hold time from all text shown in this overlay:
  // title + synopsis + every character's status note for this chapter
  const notesText = notedSnaps.map((s) => s.statusNotes ?? '').join(' ')
  const holdMs = readingHoldMs(
    [chapterTitle, synopsis ?? '', notesText].join(' '),
    playbackSpeed,
  )

  useEffect(() => {
    setPhase('hidden')
    const timers: ReturnType<typeof setTimeout>[] = []

    // 1. Fade in chapter heading
    timers.push(setTimeout(() => setPhase('chapter'), 120))
    // 2. Show notes text beneath it
    timers.push(setTimeout(() => setPhase('notes'), 900))
    // 3. Auto-scroll the text area if tall
    timers.push(setTimeout(() => {
      const el = scrollRef.current
      if (!el || el.scrollHeight <= el.clientHeight) return
      const scrollDist = el.scrollHeight - el.clientHeight
      const scrollDuration = Math.max(holdMs - 900 - FADE_OUT_BEFORE_MS - 300, 1000)
      const start = performance.now()
      function scrollTick() {
        const t = Math.min((performance.now() - start) / scrollDuration, 1)
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        el!.scrollTop = eased * scrollDist
        if (t < 1) requestAnimationFrame(scrollTick)
      }
      requestAnimationFrame(scrollTick)
    }, 1000))
    // 4. Fade out before chapter advances
    const fadeAt = Math.max(holdMs - FADE_OUT_BEFORE_MS, holdMs * 0.55)
    timers.push(setTimeout(() => setPhase('fading'), fadeAt))

    return () => timers.forEach(clearTimeout)
  }, [eventId, holdMs])

  const visible  = phase !== 'hidden' && phase !== 'fading'
  const showNotes = phase === 'notes'

  const wrapStyle: CSSProperties = {
    position: 'fixed',
    bottom: 'calc(3.25rem + 2rem)',
    left: '50%',
    transform: `translateX(-50%) translateY(${visible ? '0' : '10px'})`,
    zIndex: 990,
    width: 'min(600px, calc(100vw - 4rem))',
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.5s ease, transform 0.5s ease',
    textAlign: 'center',
  }

  const chapterLabelStyle: CSSProperties = {
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'var(--tl-accent)',
    fontFamily: 'var(--font-body)',
    marginBottom: '0.5rem',
    opacity: 0.9,
    textShadow: '0 1px 8px rgba(0,0,0,0.8)',
  }

  const titleStyle: CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'hsl(var(--foreground))',
    fontFamily: 'var(--font-body)',
    marginBottom: '1rem',
    textShadow: '0 2px 12px rgba(0,0,0,0.9)',
    lineHeight: 1.3,
  }

  const notesWrapStyle: CSSProperties = {
    opacity: showNotes ? 1 : 0,
    transition: 'opacity 0.6s ease',
    maxHeight: '35vh',
    overflowY: 'hidden',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.55) 100%)',
    borderRadius: 'var(--radius)',
    padding: '1rem 1.5rem',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)' as string,
    border: '1px solid rgba(255,255,255,0.07)',
  }

  const proseStyle: CSSProperties = {
    fontSize: '0.875rem',
    lineHeight: 1.75,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'var(--font-body)',
    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
  }

  if (!notedSnaps.length) {
    // Still show the chapter heading even with no notes
    return (
      <div style={wrapStyle}>
        <div style={chapterLabelStyle}>Chapter {chapterNumber}</div>
        <div style={titleStyle}>{chapterTitle}</div>
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      <div style={chapterLabelStyle}>Chapter {chapterNumber}</div>
      <div style={titleStyle}>{chapterTitle}</div>

      <div style={notesWrapStyle}>
        <div ref={scrollRef} style={{ maxHeight: '33vh', overflowY: 'hidden' }}>
          <p style={proseStyle}>
            {notedSnaps.map((snap, i) => {
              const char = characters.find((c) => c.id === snap.characterId)
              if (!char) return null
              return (
                <span key={snap.id}>
                  {i > 0 && ' '}
                  <strong style={{ color: 'var(--tl-accent)', fontWeight: 700 }}>{char.name}</strong>
                  {' '}
                  {snap.statusNotes!.trim()}
                </span>
              )
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
