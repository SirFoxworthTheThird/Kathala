/**
 * Bring `el` into view inside the chapter panel's own scrolling column — the
 * aside beside the page, or the sheet on a phone, marked `data-follows-scene` —
 * and only when it is out of view there. Nothing else is scrolled: the page
 * beside the panel stays where the writer is.
 */
export function bringIntoPanelView(el: HTMLElement | null) {
  const box = el?.closest<HTMLElement>('[data-follows-scene]')
  if (!el || !box) return
  const r = el.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  if (r.top >= b.top && r.top < b.bottom - 40) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  box.scrollTo({ top: Math.max(0, box.scrollTop + r.top - b.top - 8), behavior: reduce ? 'auto' : 'smooth' })
}
