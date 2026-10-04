/**
 * Which scene the reader is looking at, from where each scene sits on screen.
 *
 * The reading band is a strip a quarter to two-fifths of the way down the
 * page — where the eye rests while reading, and where a scene counts as being
 * read. The scene there is the answer, the topmost if two share it.
 *
 * Between two scenes the band can hold neither: a chapter's heading and the
 * space around it sit there, with the last scene of one chapter above and the
 * first of the next below. The answer then is the scene below, the one the
 * heading is the start of. It used to be whatever scene had last crossed the
 * band, which after a jump — the scrollbar dragged, a page scrolled by script
 * — could be one from anywhere in the book.
 *
 * Past the last scene there is nothing below, and the last one above is the
 * answer. Positions are the scenes' tops and bottoms in the same coordinates
 * as the band's, in book order.
 */
export interface SceneSpan {
  id: string
  top: number
  bottom: number
}

export function sceneInBand(scenes: readonly SceneSpan[], bandTop: number, bandBottom: number): string | null {
  let below: SceneSpan | null = null
  let above: SceneSpan | null = null
  for (const s of scenes) {
    if (s.bottom > bandTop && s.top < bandBottom) return s.id
    if (s.top >= bandBottom) { if (!below) below = s }
    else above = s
  }
  return (below ?? above)?.id ?? null
}
