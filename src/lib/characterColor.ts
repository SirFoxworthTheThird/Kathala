import type { Character } from '@/types'

function idToHue(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return h % 360
}

export function charColor(char: Pick<Character, 'id' | 'color'>): string {
  return char.color ?? `hsl(${idToHue(char.id)}, 60%, 55%)`
}
