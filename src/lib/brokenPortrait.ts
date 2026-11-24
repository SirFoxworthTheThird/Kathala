/**
 * A pin's portrait that failed to load is taken out, so the initials drawn under
 * it show (UX-3-25). Meant to be heard on the document in the capture phase: an
 * image's `error` does not bubble, and the map's pills are HTML strings Leaflet
 * builds, out of React's reach. Only images marked `data-pin-portrait` are
 * touched.
 */
export function dropBrokenPortrait(e: Event): void {
  const img = e.target
  if (img instanceof HTMLImageElement && img.hasAttribute('data-pin-portrait')) img.remove()
}
