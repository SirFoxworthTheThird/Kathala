import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Pause, Play, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { aloudQueue, nextSpoken, previousSpoken, startAt, type AloudChapter, type AloudItem } from '@/lib/readAloud'

/*
  Reading the prose aloud on Read (issue #704): the browser's own speech, local
  voices only, a sentence at a time, the sentence marked on the page as it is
  spoken. The decisions are in `docs/records/read-aloud-plan.md`.
*/

const VOICE_KEY = 'kathala-read-aloud-voice'
const RATE_KEY = 'kathala-read-aloud-rate'
export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const
/** The name of the page's highlight for the sentence being spoken (D-6). */
export const HIGHLIGHT = 'read-aloud'
/** How long to wait for a browser to say which voices it has before saying it has none. */
const VOICES_WAIT_MS = 1500

/** Kept on this device; a refused read or write is no read or write (D-8). */
function stored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function store(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private window, or storage full: kept for this visit only */ }
}

export interface Speech {
  synth: SpeechSynthesis | null
  /** The voices that speak on this device (D-2). */
  voices: SpeechSynthesisVoice[]
  /** Why reading aloud cannot be offered, or null where it can. */
  reason: string | null
}

/** The browser's speech, and its local voices (D-2). */
export function useSpeech(): Speech {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  const [all, setAll] = useState<SpeechSynthesisVoice[]>(() => synth?.getVoices() ?? [])
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (!synth) return
    const load = () => setAll(synth.getVoices())
    load()
    synth.addEventListener('voiceschanged', load)
    const t = setTimeout(() => setWaited(true), VOICES_WAIT_MS)
    return () => { synth.removeEventListener('voiceschanged', load); clearTimeout(t) }
  }, [synth])
  const voices = useMemo(() => all.filter((v) => v.localService), [all])
  let reason: string | null = null
  if (!synth) reason = 'This browser cannot read text aloud.'
  else if (voices.length === 0) {
    if (all.length > 0) reason = 'Only online voices are offered here, and they would send the prose away to be spoken.'
    else reason = waited ? 'No voice is installed on this device to read with.' : 'Finding the voices on this device…'
  }
  return { synth, voices, reason }
}

/** The button that starts reading aloud, or says why it cannot (D-2, D-7). */
export function ReadAloudButton({ on, onToggle, className }: { on: boolean; onToggle: () => void; className?: string }) {
  const { reason } = useSpeech()
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        className={cn(className, on && 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]')}
        aria-pressed={on}
        disabled={!!reason && !on}
        aria-describedby={reason ? 'read-aloud-reason' : undefined}
        onClick={onToggle}
      >
        <Volume2 className="h-4 w-4" aria-hidden="true" /> Read aloud
      </Button>
      {reason && <span id="read-aloud-reason" role="status" className="text-xs text-[hsl(var(--muted-foreground))]">{reason}</span>}
    </span>
  )
}

/** The text node and offset at `offset` characters into an element's text. */
function pointIn(el: Element, offset: number): { node: Text; at: number } | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let seen = 0
  let last: Text | null = null
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const len = n.data.length
    if (offset <= seen + len) return { node: n, at: offset - seen }
    seen += len
    last = n
  }
  return last ? { node: last, at: last.data.length } : null
}

/** The stretch of the page an item is: a sentence's words, or a chapter's heading. */
function rangeOf(root: HTMLElement, item: AloudItem): Range | null {
  if (item.kind === 'heading') {
    const h = root.querySelector(`[data-chapter-id="${CSS.escape(item.chapterId)}"] h2`)
    if (!h) return null
    const r = document.createRange()
    r.selectNodeContents(h)
    return r
  }
  if (item.kind !== 'sentence') return null
  const p = root.querySelector(`[data-scene-event-id="${CSS.escape(item.eventId)}"] [data-p="${item.paragraph}"]`)
  if (!p) return null
  const a = pointIn(p, item.from)
  const b = pointIn(p, item.to)
  if (!a || !b) return null
  const r = document.createRange()
  r.setStart(a.node, a.at)
  r.setEnd(b.node, b.at)
  return r
}

/** Where to start (D-7): a sentence selected in the book, or else the scene on screen. */
function startingPoint(root: HTMLElement, queue: readonly AloudItem[]): number {
  const sel = window.getSelection()
  const node = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null
  const el = node ? (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement) : null
  const p = el?.closest('[data-p]')
  const scene = p?.closest('[data-scene-event-id]')
  if (p && scene && root.contains(p)) {
    const before = document.createRange()
    before.setStart(p, 0)
    before.setEnd(sel!.getRangeAt(0).startContainer, sel!.getRangeAt(0).startOffset)
    const i = startAt(queue, scene.getAttribute('data-scene-event-id')!, { paragraph: Number(p.getAttribute('data-p')), offset: before.toString().length })
    if (i >= 0) return i
  }
  // The scene on screen: the first whose end is below the top quarter of the view, as reading follows it.
  const view = root.getBoundingClientRect()
  for (const s of root.querySelectorAll('[data-scene-event-id]')) {
    if (s.getBoundingClientRect().bottom > view.top + view.height / 4) {
      const i = startAt(queue, s.getAttribute('data-scene-event-id')!)
      if (i >= 0) return i
    }
  }
  return queue.length > 0 ? 0 : -1
}

type Status = 'speaking' | 'paused'

/**
 * The bar that reads the book aloud from where it is opened: previous, pause or
 * resume, next, stop, the voice and the speed. Mounted by pressing *Read
 * aloud*; unmounting it — stopping, or leaving Read — stops the speech (D-7).
 */
export function ReadAloudBar({ chapters, scrollRef, onClose }: {
  chapters: readonly AloudChapter[]
  scrollRef: RefObject<HTMLDivElement | null>
  onClose: () => void
}) {
  const { synth, voices, reason } = useSpeech()
  const queue = useMemo(() => aloudQueue(chapters), [chapters])
  const [voiceURI, setVoiceURI] = useState<string | null>(() => stored(VOICE_KEY))
  const [rate, setRate] = useState<number>(() => {
    const r = Number(stored(RATE_KEY))
    return (RATES as readonly number[]).includes(r) ? r : 1
  })
  const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voices.find((v) => v.default) ?? voices[0] ?? null
  const [index, setIndex] = useState(-1)
  const [status, setStatus] = useState<Status>('paused')

  // Every start, pause or stop is a new generation: what the one before it had queued answers to nobody.
  const gen = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The voice and speed as now: a change applies from the next part spoken.
  const settings = useRef({ voice, rate })
  useEffect(() => { settings.current = { voice, rate } }, [voice, rate])

  const halt = useCallback(() => {
    gen.current++
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    synth?.cancel()
  }, [synth])

  const speakFrom = useCallback((i: number) => {
    halt()
    const g = gen.current
    const run = (at: number) => {
      if (g !== gen.current) return
      const item = queue[at]
      if (!item) { setStatus('paused'); setIndex(-1); onClose(); return }
      setIndex(at)
      if (item.kind === 'pause') { timer.current = setTimeout(() => run(at + 1), item.ms); return }
      const say = (k: number) => {
        if (g !== gen.current) return
        if (k >= item.say.length) { run(at + 1); return }
        const u = new SpeechSynthesisUtterance(item.say[k])
        const { voice: v, rate: r } = settings.current
        if (v) { u.voice = v; u.lang = v.lang }
        u.rate = r
        u.onend = () => say(k + 1)
        u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') say(k + 1) }
        synth?.speak(u)
      }
      say(0)
    }
    setStatus('speaking')
    run(i)
  }, [halt, queue, synth, onClose])

  // Pressing *Read aloud* starts it: from a selected sentence, or the scene on screen.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || reason || !scrollRef.current || queue.length === 0) return
    started.current = true
    const i = startingPoint(scrollRef.current, queue)
    if (i >= 0) speakFrom(i)
  }, [reason, scrollRef, queue, speakFrom])

  // Nothing keeps speaking once the bar is gone: stopped, or Read left (D-7).
  useEffect(() => () => {
    halt()
    try { CSS.highlights?.delete(HIGHLIGHT) } catch { /* no highlights here */ }
  }, [halt])

  // The sentence marked on the page, and kept in view (D-6).
  useEffect(() => {
    const root = scrollRef.current
    const item = queue[index]
    if (!root || !item || item.kind === 'pause') return
    const range = rangeOf(root, item)
    if (!range) return
    try {
      if (typeof Highlight !== 'undefined' && CSS.highlights) CSS.highlights.set(HIGHLIGHT, new Highlight(range))
    } catch { /* no highlights here: the sentence is still scrolled to */ }
    const r = range.getBoundingClientRect()
    const view = root.getBoundingClientRect()
    if (r.top < view.top + view.height * 0.15 || r.bottom > view.bottom - view.height * 0.15) {
      root.scrollBy({ top: r.top - view.top - view.height / 3 })
    }
  }, [index, queue, scrollRef])

  const pause = useCallback(() => { halt(); setStatus('paused') }, [halt])
  const resume = useCallback(() => { if (index >= 0) speakFrom(index) }, [index, speakFrom])
  const step = useCallback((to: number) => {
    if (to < 0) return
    if (status === 'speaking') speakFrom(to)
    else setIndex(to)
  }, [status, speakFrom])
  const stop = useCallback(() => { halt(); onClose() }, [halt, onClose])

  // Space pauses and resumes, and does not scroll the page — unless it is typing somewhere (D-7).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return
      e.preventDefault()
      if (status === 'speaking') pause()
      else resume()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, pause, resume])

  const item = queue[index]
  const where = item && item.kind !== 'pause'
    ? `${item.kind === 'heading' ? 'Heading' : 'Sentence'} ${queue.slice(0, index + 1).filter((q) => q.kind !== 'pause').length} of ${queue.filter((q) => q.kind !== 'pause').length}`
    : ''

  return (
    <div role="toolbar" aria-label="Read aloud" className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-xs">
      <Volume2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
      {reason ? <span role="status">{reason}</span> : (
        <>
          <Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Previous sentence" onClick={() => step(previousSpoken(queue, index))}>
            <SkipBack className="h-4 w-4" aria-hidden="true" />
          </Button>
          {status === 'speaking' ? (
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2" onClick={pause}><Pause className="h-4 w-4" aria-hidden="true" /> Pause</Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2" onClick={resume} disabled={index < 0}><Play className="h-4 w-4" aria-hidden="true" /> Resume</Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Next sentence" onClick={() => step(nextSpoken(queue, index))}>
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2" onClick={stop}><Square className="h-3.5 w-3.5" aria-hidden="true" /> Stop</Button>
          <span className="tabular-nums text-[hsl(var(--muted-foreground))]">{where}</span>
          <label className="ml-auto flex items-center gap-1">
            Voice
            <select
              className="h-7 max-w-[14rem] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1"
              value={voice?.voiceURI ?? ''}
              onChange={(e) => { setVoiceURI(e.target.value); store(VOICE_KEY, e.target.value) }}
            >
              {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Speed
            <select
              className="h-7 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1"
              value={String(rate)}
              onChange={(e) => { const r = Number(e.target.value); setRate(r); store(RATE_KEY, String(r)) }}
            >
              {RATES.map((r) => <option key={r} value={String(r)}>{r}×</option>)}
            </select>
          </label>
        </>
      )}
    </div>
  )
}
