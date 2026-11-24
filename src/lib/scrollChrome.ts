import { useEffect, useState, type RefObject } from 'react'

/**
 * Whether the rows above a reading scroller are out of the way, and the scroll
 * position the next change is measured from (ux-expert-fixes-plan.md, D-5).
 *
 * On a phone, Read gave the prose 48–59% of the screen, and nothing got out of
 * the way once reading started (UX-1-8). The rows go while the reader scrolls
 * down and come back on a scroll up, as reading apps do.
 */
export interface ScrollChrome {
  hidden: boolean
  /** While shown, the highest the scroller has been; while hidden, the lowest. */
  anchor: number
}

/** How far a scroll has to run one way before the rows go or come back: a finger's wobble is not a scroll. */
export const CHROME_THRESHOLD = 24
/** Near the top the rows are always there: there is nothing above to make room for. */
export const CHROME_TOP_ZONE = 48
/** How soon after a wheel, touch or key a scroll is taken to be the reader's. Momentum scrolling runs on after a flick. */
const INPUT_WINDOW_MS = 1500

export function chromeOnScroll(s: ScrollChrome, top: number, threshold = CHROME_THRESHOLD, topZone = CHROME_TOP_ZONE): ScrollChrome {
  if (top <= topZone) return { hidden: false, anchor: top }
  if (s.hidden) {
    if (top < s.anchor - threshold) return { hidden: false, anchor: top }
    return { hidden: true, anchor: Math.max(s.anchor, top) }
  }
  if (top > s.anchor + threshold) return { hidden: true, anchor: top }
  return { hidden: false, anchor: Math.min(s.anchor, top) }
}

/**
 * Whether `scrollRef`'s rows above are out of the way. Off (`enabled` false)
 * they are always shown, and a change of `resetKey` — another book, another
 * layout — shows them again.
 */
export function useChromeHidden(scrollRef: RefObject<HTMLElement | null>, enabled: boolean, resetKey?: unknown): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    setHidden(false)
    if (!enabled) return
    /*
      Heard on the document, in the capture phase, rather than on the scroller:
      the scroller is the book's, mounted when the book has loaded, which can be
      after this runs. A scroll does not bubble, but it is captured.
    */
    /*
      Only the reader's own scrolling moves the rows. The book scrolls itself
      too — to the reader's place on opening, to a chapter from Contents, along
      with Read aloud — and on opening that hid the rows before the reader had
      seen them. A scroll with no wheel, touch or key just before it moves the
      point measured from, and nothing else.
    */
    let lastInput = 0
    const onInput = () => { lastInput = performance.now() }
    let state: ScrollChrome | null = null
    const onScroll = (e: Event) => {
      const el = scrollRef.current
      if (!el || e.target !== el) return
      const top = el.scrollTop
      if (!state || performance.now() - lastInput > INPUT_WINDOW_MS) {
        state = { hidden: state?.hidden ?? false, anchor: top }
        return
      }
      state = chromeOnScroll(state, top)
      setHidden(state.hidden)
    }
    const inputs = ['wheel', 'touchmove', 'keydown'] as const
    for (const t of inputs) document.addEventListener(t, onInput, { capture: true, passive: true })
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      for (const t of inputs) document.removeEventListener(t, onInput, { capture: true })
      document.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [scrollRef, enabled, resetKey])
  return enabled && hidden
}
