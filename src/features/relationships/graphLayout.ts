/**
 * Deterministic layout for the relationship graph.
 *
 * The graph used to place every character on a fixed four-column grid, so a
 * cast of forty-five became a tall narrow column: fitView zoomed out to swallow
 * its height, the connected characters knotted together in the top third, and
 * both side thirds stayed empty. Worse, the grid position had nothing to do
 * with who knew whom, so the distance between two characters read as meaning
 * while carrying none.
 *
 * This settles each connected group with a force simulation, so how far apart
 * two characters sit follows from how they are linked, then packs the groups
 * into a roughly landscape area with characters nobody is linked to gathered in
 * a block of their own. Pure and deterministic — the same cast and relationships
 * always give the same picture, so nothing shifts under the writer between
 * visits.
 */

export interface LayoutEdge {
  a: string
  b: string
}

export interface Point {
  x: number
  y: number
}

/** Roughly a character card, plus breathing room. */
const NODE_W = 150
const NODE_H = 120
/** How far apart a relationship wants to hold the two characters it joins. */
const EDGE_LENGTH = 170
/** No two cards end up closer than this, whatever the forces want. */
const MIN_SEPARATION = 140
/** Gap between one group's bounding box and the next. */
const GROUP_GAP = 90

/** Groups of ids connected to each other, in first-appearance order. */
export function connectedGroups(ids: string[], edges: LayoutEdge[]): string[][] {
  const known = new Set(ids)
  const adjacency = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const { a, b } of edges) {
    if (a === b || !known.has(a) || !known.has(b)) continue
    adjacency.get(a)!.push(b)
    adjacency.get(b)!.push(a)
  }

  const seen = new Set<string>()
  const groups: string[][] = []
  for (const start of ids) {
    if (seen.has(start)) continue
    const group: string[] = []
    const queue = [start]
    seen.add(start)
    while (queue.length) {
      const id = queue.shift()!
      group.push(id)
      for (const next of adjacency.get(id)!) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    groups.push(group)
  }
  return groups
}

/**
 * Every id within `depth` links of `rootId`, including the root. Returns an
 * empty set for an unknown root, so a stale focus hides nothing rather than
 * hiding everything.
 */
export function neighbourhood(
  ids: string[],
  edges: LayoutEdge[],
  rootId: string,
  depth: number,
): Set<string> {
  const known = new Set(ids)
  if (!known.has(rootId)) return new Set()

  const adjacency = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const { a, b } of edges) {
    if (a === b || !known.has(a) || !known.has(b)) continue
    adjacency.get(a)!.push(b)
    adjacency.get(b)!.push(a)
  }

  const found = new Set([rootId])
  let frontier = [rootId]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const neighbour of adjacency.get(id)!) {
        if (found.has(neighbour)) continue
        found.add(neighbour)
        next.push(neighbour)
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return found
}

/**
 * Fruchterman–Reingold: relationships pull the two characters together, every
 * pair pushes apart, and the whole thing cools to a rest. No randomness — the
 * starting positions come off a phyllotaxis spiral, so the same cast always
 * settles into the same picture.
 *
 * A hub-and-spoke cast becomes a wheel and a long chain of acquaintances becomes
 * a curve; a concentric ring layout got the wheel right and strung the chain out
 * into a line thirty screens tall.
 */
function forceLayout(group: string[], adjacency: Map<string, string[]>): Map<string, Point> {
  const n = group.length
  const k = EDGE_LENGTH
  const index = new Map(group.map((id, i) => [id, i] as const))
  const x = new Float64Array(n)
  const y = new Float64Array(n)

  // Golden angle, so the seed positions spread evenly instead of spiralling into
  // arms that the forces then have to undo.
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const r = k * Math.sqrt(i)
    x[i] = Math.cos(i * golden) * r
    y[i] = Math.sin(i * golden) * r
  }

  const repulsionRange = k * 3
  const iterations = n > 80 ? 150 : 300
  let temperature = k * 2
  const cooling = temperature / (iterations + 1)
  const dx = new Float64Array(n)
  const dy = new Float64Array(n)

  for (let step = 0; step < iterations; step++) {
    dx.fill(0)
    dy.fill(0)

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = x[i] - x[j]
        let vy = y[i] - y[j]
        let d = Math.hypot(vx, vy)
        // Two characters already well apart have nothing left to say to each
        // other. Without this cutoff every pair keeps pushing, and a chain of
        // fifteen acquaintances inflates until each link is twice as long as
        // the one in a chain of five — the same relationship drawn at two
        // different lengths depending on how big the cast is.
        if (d > repulsionRange) continue
        if (d < 0.01) {
          // Exactly coincident: nudge along a fixed direction derived from the
          // indices, so the tie is broken the same way on every run.
          vx = Math.cos(i * golden + j)
          vy = Math.sin(i * golden + j)
          d = 1
        }
        const force = (k * k) / d
        dx[i] += (vx / d) * force
        dy[i] += (vy / d) * force
        dx[j] -= (vx / d) * force
        dy[j] -= (vy / d) * force
      }
    }

    for (const id of group) {
      const i = index.get(id)!
      for (const neighbour of adjacency.get(id) ?? []) {
        const j = index.get(neighbour)
        if (j === undefined || j <= i) continue // each relationship pulls once
        const vx = x[i] - x[j]
        const vy = y[i] - y[j]
        const d = Math.hypot(vx, vy) || 0.01
        const force = (d * d) / k
        dx[i] -= (vx / d) * force
        dy[i] -= (vy / d) * force
        dx[j] += (vx / d) * force
        dy[j] += (vy / d) * force
      }
    }

    for (let i = 0; i < n; i++) {
      const d = Math.hypot(dx[i], dy[i]) || 1
      const step = Math.min(d, temperature)
      x[i] += (dx[i] / d) * step
      y[i] += (dy[i] / d) * step
    }
    temperature -= cooling
  }

  separate(x, y, n)

  const positions = new Map<string, Point>()
  group.forEach((id, i) => positions.set(id, { x: x[i], y: y[i] }))
  return positions
}

/**
 * Pushes apart any pair the forces left closer than a card's width. The forces
 * balance an average, not a minimum, and a card half-under another is the one
 * thing a reader cannot work around.
 */
function separate(x: Float64Array, y: Float64Array, n: number): void {
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let round = 0; round < 200; round++) {
    let worst = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = x[i] - x[j]
        let vy = y[i] - y[j]
        let d = Math.hypot(vx, vy)
        if (d >= MIN_SEPARATION) continue
        if (d < 0.01) {
          vx = Math.cos(i * golden + j)
          vy = Math.sin(i * golden + j)
          d = 1
        }
        worst = Math.max(worst, MIN_SEPARATION - d)
        const push = (MIN_SEPARATION - d) / 2 / d
        x[i] += vx * push
        y[i] += vy * push
        x[j] -= vx * push
        y[j] -= vy * push
      }
    }
    if (worst < 0.5) break
  }
}

interface Box {
  positions: Map<string, Point>
  width: number
  height: number
}

/** Shifts a group's positions so its bounding box starts at the origin. */
function normalise(positions: Map<string, Point>): Box {
  const xs = [...positions.values()].map((p) => p.x)
  const ys = [...positions.values()].map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const shifted = new Map<string, Point>()
  for (const [id, p] of positions) shifted.set(id, { x: p.x - minX, y: p.y - minY })
  return {
    positions: shifted,
    width: Math.max(...xs) - minX + NODE_W,
    height: Math.max(...ys) - minY + NODE_H,
  }
}

/**
 * Positions for every id. Groups are laid out around their hub and shelved
 * left-to-right into a landscape area; characters with no relationships are
 * gathered into a grid below the rest, where their distance from the graph
 * says only "unconnected" rather than pretending to be a measurement.
 */
export function layoutRelationshipGraph(ids: string[], edges: LayoutEdge[]): Record<string, Point> {
  if (ids.length === 0) return {}

  const known = new Set(ids)
  const adjacency = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const { a, b } of edges) {
    if (a === b || !known.has(a) || !known.has(b)) continue
    adjacency.get(a)!.push(b)
    adjacency.get(b)!.push(a)
  }

  const groups = connectedGroups(ids, edges)
  const linked = groups.filter((g) => g.length > 1)
  const lonely = groups.filter((g) => g.length === 1).map((g) => g[0])

  // Tallest first, the standard shelf-packing order: a long chain of
  // acquaintances comes out wide and short, and placing it before a tall hub
  // leaves a void under it the width of the chain. Equal heights fall back to
  // the bigger group, then to the order the characters were created in.
  const boxes: Box[] = linked
    .map((group, i) => ({ box: normalise(forceLayout(group, adjacency)), size: group.length, i }))
    .sort((l, r) => r.box.height - l.box.height || r.size - l.size || l.i - r.i)
    .map(({ box }) => box)

  // Try every sensible place to break the row and keep whichever comes out
  // closest to a wide screen's shape. A single width formula got a picture a
  // third taller than it was wide on the very cast that prompted the change.
  const widest = boxes.reduce((n, b) => Math.max(n, b.width), 0)
  const candidates = new Set<number>([Math.max(widest, NODE_W)])
  let running = 0
  for (const box of boxes) {
    running += box.width + GROUP_GAP
    candidates.add(Math.max(widest, running - GROUP_GAP))
  }

  let best: { out: Record<string, Point>; penalty: number } | null = null
  for (const shelfWidth of [...candidates].sort((a, b) => a - b)) {
    const arranged = arrange(boxes, lonely, shelfWidth)
    const penalty = Math.abs(Math.log(arranged.width / arranged.height / TARGET_ASPECT))
    // Ties go to the narrowest shelf that achieves them.
    if (!best || penalty < best.penalty - 1e-9) {
      best = { out: arranged.out, penalty }
    }
  }
  return best!.out
}

const TARGET_ASPECT = 16 / 9

/** Shelves the groups into rows no wider than `shelfWidth`, loners underneath. */
function arrange(
  boxes: Box[],
  lonely: string[],
  shelfWidth: number,
): { out: Record<string, Point>; width: number; height: number } {
  const out: Record<string, Point> = {}
  // Boxes are placed as they come, then the row is centred vertically once its
  // height is known — a short group left flush against the top of a tall row
  // reads as though it belongs to whatever is above it.
  const rows: { boxes: Box[]; top: number; height: number }[] = []
  let rowX = 0
  let rowY = 0
  let row: { boxes: Box[]; top: number; height: number } = { boxes: [], top: 0, height: 0 }
  let width = 0
  const offsets = new Map<Box, number>()
  for (const box of boxes) {
    if (rowX > 0 && rowX + box.width > shelfWidth) {
      rows.push(row)
      rowY += row.height + GROUP_GAP
      rowX = 0
      row = { boxes: [], top: rowY, height: 0 }
    }
    offsets.set(box, rowX)
    row.boxes.push(box)
    row.height = Math.max(row.height, box.height)
    rowX += box.width + GROUP_GAP
    width = Math.max(width, rowX - GROUP_GAP)
  }
  if (row.boxes.length) rows.push(row)

  for (const r of rows) {
    for (const box of r.boxes) {
      const left = offsets.get(box)!
      const top = r.top + (r.height - box.height) / 2
      for (const [id, p] of box.positions) out[id] = { x: left + p.x, y: top + p.y }
    }
  }
  let height = rows.length ? rows[rows.length - 1].top + rows[rows.length - 1].height : 0

  if (lonely.length) {
    const top = boxes.length ? height + GROUP_GAP * 2 : 0
    const columns = Math.max(1, Math.min(lonely.length, Math.floor(Math.max(shelfWidth, NODE_W) / NODE_W)))
    lonely.forEach((id, i) => {
      out[id] = { x: (i % columns) * NODE_W, y: top + Math.floor(i / columns) * NODE_H }
    })
    width = Math.max(width, Math.min(lonely.length, columns) * NODE_W)
    height = top + Math.ceil(lonely.length / columns) * NODE_H
  }

  return { out, width: Math.max(width, 1), height: Math.max(height, 1) }
}
