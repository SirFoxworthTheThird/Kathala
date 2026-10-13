export function pixelDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

export function pathPixelLength(points: [number, number][]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += pixelDist(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
  }
  return total
}

export function formatDistance(pixels: number, pixelsPerUnit: number, unit: string): string {
  const dist = pixels / pixelsPerUnit
  return `${dist < 10 ? dist.toFixed(1) : Math.round(dist)} ${unit}`
}

/** The units a scale is set in, one of each: "1 miles = 290 px" read wrong in the breadcrumb (writer run 8). */
const ONE: Record<string, string> = { miles: 'mile', leagues: 'league', 'days travel': "day's travel", furlongs: 'furlong', meters: 'meter' }

/** A map's scale as said: `1 mile = 290 px`. */
export function scaleLabel(pixelsPerUnit: number, unit: string): string {
  return `1 ${ONE[unit] ?? unit} = ${Math.round(pixelsPerUnit)} px`
}
