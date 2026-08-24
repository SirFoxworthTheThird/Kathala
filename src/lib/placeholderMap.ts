/**
 * The blank map a world gets when it has no image of its own.
 *
 * A place in PlotWeave is a pin, and a pin needs a map — locations may only be
 * added to maps and sub-maps that already exist. That rule is deliberate, but it
 * left a writer with no picture of their world unable to record a setting at
 * all: the Maps screen offered an image upload and a button labelled AI, and the
 * scene card simply withheld `+ Setting` without saying why.
 *
 * This is the grid the AI location import has always drawn for itself, lifted
 * out so the plain "start a blank map" door can draw the same one.
 */
/** The blank grid is a fixed size; markers are laid out inside it. */
export const PLACEHOLDER_W = 1600
export const PLACEHOLDER_H = 1000

/** A blank placeholder map image + its dimensions. */
export interface PlaceholderImage { blob: Blob; width: number; height: number }

/** Runtime default: draw a subtle blank canvas to stand in for a map image. */
export async function defaultPlaceholderImage(): Promise<PlaceholderImage> {
  const canvas = document.createElement('canvas')
  canvas.width = PLACEHOLDER_W
  canvas.height = PLACEHOLDER_H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, PLACEHOLDER_W, PLACEHOLDER_H)
  ctx.strokeStyle = 'rgba(148,163,184,0.12)'
  ctx.lineWidth = 1
  for (let x = 0; x <= PLACEHOLDER_W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PLACEHOLDER_H); ctx.stroke() }
  for (let y = 0; y <= PLACEHOLDER_H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PLACEHOLDER_W, y); ctx.stroke() }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render placeholder map'))), 'image/png'))
  return { blob, width: PLACEHOLDER_W, height: PLACEHOLDER_H }
}

