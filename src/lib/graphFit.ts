/**
 * The view that fits a graph's nodes into the part of its pane below a toolbar
 * floating over its top (UX-3-19).
 *
 * React Flow's own fit takes the whole pane, so the top node sat under the
 * toolbar and the zoom note: one node on a laptop, three on a phone, where the
 * toolbar wraps to three rows. Here the space given to the nodes starts at
 * `top`, and the zoom is the larger that fits both ways, within its limits.
 */
export interface Box { x: number; y: number; width: number; height: number }

export function fitBelow(
  nodes: Box,
  pane: { width: number; height: number },
  top: number,
  { padding = 0.15, minZoom = 0.1, maxZoom = 2 }: { padding?: number; minZoom?: number; maxZoom?: number } = {},
): { x: number; y: number; zoom: number } {
  const room = Math.max(1, pane.height - top)
  const w = Math.max(1, nodes.width) * (1 + 2 * padding)
  const h = Math.max(1, nodes.height) * (1 + 2 * padding)
  const zoom = Math.min(maxZoom, Math.max(minZoom, Math.min(pane.width / w, room / h)))
  return {
    zoom,
    x: pane.width / 2 - (nodes.x + nodes.width / 2) * zoom,
    y: top + room / 2 - (nodes.y + nodes.height / 2) * zoom,
  }
}
