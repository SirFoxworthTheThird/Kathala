import { describe, it, expect } from 'vitest'
// Read through Vite rather than `node:fs`: the app's tsconfig sets
// `types: ["vite/client"]` and deliberately keeps Node's types out, so a test
// reaching for `readFileSync` breaks `tsc -b` for the whole project.
import fellowshipExample from '../../../example/The Fellowship of the Ring.pwk?raw'
import fellowshipLibrary from '../../../public/library/the-fellowship-of-the-ring.pwk?raw'

/**
 * MW-9 — the shipped map scales.
 *
 * A scale is not decoration: the continuity checker turns it into travel times
 * and warns when a journey is impossible, so a wrong one produces confident
 * nonsense. Fifteen of the Fellowship example's sixteen layers carried a number
 * and only two had ever been checked.
 *
 * **The screen that finds them costs nothing.** `imageWidth / scalePixelsPerUnit`
 * is the extent a stored scale *claims*, and against the place the layer depicts
 * that is decisive — a fortress ring claiming 2,595 km is wrong whatever its
 * artwork says. It is a screen rather than a proof: it flagged Moria at 813 km,
 * and Moria's own printed bar ("a scale of twenty leagues") turned out to back
 * that within 1.3%. So the bounds below are wide, per-layer, and justified by
 * what each map is a map *of* — they are meant to catch three orders of
 * magnitude, not to pin a number down.
 *
 * The numbers themselves were measured off each layer's printed bar; the
 * working is in `docs/ux-review.md`.
 */

interface Layer {
  name: string
  imageWidth: number
  scalePixelsPerUnit: number | null
  scaleUnit: string | null
}

/** km across, as the layer's own scale claims. */
const BOUNDS: Record<string, [number, number]> = {
  // Settlements and single buildings.
  'Hobbiton':     [0.2, 5],       // a village around The Water
  'Bree':         [0.5, 10],      // a town inside its dike
  'Isengard':     [0.5, 10],      // the ring of Isengard and Orthanc
  'Minas Tirith': [0.5, 10],      // the seven levels of the city
  // Districts and small regions.
  'Bree-land':    [20, 400],
  'Shire':        [50, 800],
  'Anórien':      [50, 900],
  // Realms.
  'Rohan':        [200, 2000],
  'Gondor':       [200, 2500],
  'Mordor':       [200, 2000],
  // Moria's bar reads twenty leagues and puts the plate at ~810 km; the mine
  // itself is a fraction of that, which is the artist's framing, not our error.
  'Moria':        [100, 2000],
  // The continent, and the two journey plates cut from the same image.
  'Middle Earth':       [1500, 6000],
  'Lothlórien Journey': [1500, 6000],
  'The Lower Anduin':   [1500, 6000],
}

const FILES: [name: string, raw: string][] = [
  ['example/The Fellowship of the Ring.pwk', fellowshipExample],
  ['public/library/the-fellowship-of-the-ring.pwk', fellowshipLibrary],
]

function layers(raw: string): Layer[] {
  return (JSON.parse(raw) as { mapLayers: Layer[] }).mapLayers
}

describe.each(FILES)('%s map scales', (_name, raw) => {
  const all = layers(raw)

  it('has the sixteen layers this test knows about', () => {
    expect(all.length).toBe(16)
  })

  it('claims an extent its own subject does not contradict', () => {
    const bad: string[] = []
    for (const l of all) {
      if (l.scalePixelsPerUnit == null) continue
      const bounds = BOUNDS[l.name]
      expect(bounds, `no bound recorded for "${l.name}" — add one`).toBeDefined()
      const km = l.imageWidth / l.scalePixelsPerUnit
      if (km < bounds[0] || km > bounds[1]) {
        bad.push(`${l.name}: ${km.toFixed(1)} km across, expected ${bounds[0]}–${bounds[1]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('states a unit wherever it states a scale, and never a unit without one', () => {
    for (const l of all) {
      if (l.scalePixelsPerUnit == null) {
        expect(l.scaleUnit, `${l.name} has a unit but no scale`).toBeNull()
      } else {
        // Travel-mode speeds are one world-level "per day" figure, so a layer
        // in feet or leagues would silently mean something else on that map.
        expect(l.scaleUnit, `${l.name} has a scale but no unit`).toBe('km')
      }
    }
  })

  it('leaves a scale off rather than asserting one nothing backs', () => {
    // Rivendell has no printed bar; Edoras has one whose unit is written in a
    // script this pass could not read, and whose stored number was wrong by
    // two to three orders of magnitude under either reading of it.
    const unscaled = all.filter((l) => l.scalePixelsPerUnit == null).map((l) => l.name).sort()
    expect(unscaled).toEqual(['Endoras', 'Rivendell'])
  })
})

it('the shipped copy and the library copy agree about every scale', () => {
  // They had diverged: the library's Middle Earth read 0.85 where the example's
  // read 1.9449, so a reader who downloaded the book and a writer who imported
  // the file were measuring the same map differently.
  const [a, b] = FILES.map(([, raw]) => layers(raw))
  const key = (ls: Layer[]) =>
    ls.map((l) => `${l.name}=${l.scalePixelsPerUnit}${l.scaleUnit ?? ''}`).sort()
  expect(key(a)).toEqual(key(b))
})
