/**
 * Where a place goes on a map when nobody has said where: the centre, or the
 * nearest spot around it that no pin already holds (**T-4**).
 *
 * The centre alone put every such place on top of the last — a writer run
 * found an earlier pin reduced to a nameless dot under the later one's label,
 * with nothing on screen to say there were two. Rings outward from the centre,
 * a few points per ring, keep each new pin findable and near where the eye
 * goes first. Pixel coordinates, as everywhere on a map.
 */
export function freeSpot(
  layer: { imageWidth: number; imageHeight: number },
  taken: ReadonlyArray<{ x: number; y: number }>,
): { x: number; y: number } {
  const cx = Math.round(layer.imageWidth / 2)
  const cy = Math.round(layer.imageHeight / 2)
  // About a pin label's width apart, on any size of map.
  const gap = Math.max(24, Math.round(Math.min(layer.imageWidth, layer.imageHeight) * 0.06))
  const clear = (x: number, y: number) => taken.every((p) => Math.hypot(p.x - x, p.y - y) >= gap)
  if (clear(cx, cy)) return { x: cx, y: cy }
  for (let ring = 1; ring <= 12; ring++) {
    const r = ring * gap
    const points = ring * 6
    for (let i = 0; i < points; i++) {
      const a = (i / points) * 2 * Math.PI
      const x = Math.round(cx + r * Math.cos(a))
      const y = Math.round(cy + r * Math.sin(a))
      if (x < 0 || y < 0 || x > layer.imageWidth || y > layer.imageHeight) continue
      if (clear(x, y)) return { x, y }
    }
  }
  // A map with no room left near the middle: the centre, as before.
  return { x: cx, y: cy }
}
