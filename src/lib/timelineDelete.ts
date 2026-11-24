import { plural } from './plural'

/**
 * What deleting a timeline takes with it, in its confirmation (D-8, UX-1-16).
 *
 * It said "All chapters and scenes in this timeline will be permanently
 * deleted": no number, for the largest delete in a book (twenty chapters for
 * *The Homecoming Present*), and "permanently" where Undo brings all of it back
 * — a journalled delete keeps what its cascade removed.
 */
export function timelineDeleteSays(chapters: number, scenes: number): string {
  if (chapters === 0 && scenes === 0) return 'It has no chapters yet. Undo brings it back.'
  const what = scenes > 0 ? `${plural(chapters, 'chapter')} and ${plural(scenes, 'scene')}` : plural(chapters, 'chapter')
  return `Its ${what} go with it, prose and all. Undo brings them back.`
}
