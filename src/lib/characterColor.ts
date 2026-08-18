import type { Character } from '@/types'

function idToHue(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return h % 360
}

/**
 * A character's colour: their own if they have one, otherwise a hue from their
 * id in the theme's register.
 *
 * The hue still comes from the id — that is what makes a character the same
 * colour every time — but its saturation and lightness are the theme's, so a
 * cast reads as muted charcoal in Noir and as warm in Cosy without anybody
 * losing their identity. The custom properties resolve against whatever
 * element this lands on, which is always inside the themed root.
 */
export function charColor(char: Pick<Character, 'id' | 'color'>): string {
  return char.color ?? `hsl(${idToHue(char.id)} var(--cast-sat, 60%) var(--cast-light, 55%))`
}
