/*
  Words added and cut by a save (issue #706, sprints-plan.md, D-4). The words
  the two texts share at the start and the end are taken off; of what is left,
  *added* is the words the old text lacks and *cut* the words the new one lacks,
  in any order. Linear, where a word diff is quadratic and too slow for a save
  of a long scene, and within 0.18% of one on the writers' scene histories
  (scripts/sprint-probe.ts). `added − cut` is always the change in the count,
  so the day's net is as it was.
*/

export interface WordChange {
  added: number
  cut: number
}

/** Words as the count counts them (`wordCount`): runs of anything but space. */
const words = (text: string): string[] => text.match(/\S+/g) ?? []

export function wordChange(before: string, after: string): WordChange {
  const a = words(before)
  const b = words(after)
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let end = 0
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++

  const left = new Map<string, number>()
  for (let i = start; i < a.length - end; i++) left.set(a[i], (left.get(a[i]) ?? 0) + 1)
  let added = 0
  for (let i = start; i < b.length - end; i++) {
    const n = left.get(b[i]) ?? 0
    if (n > 0) left.set(b[i], n - 1)
    else added++
  }
  let cut = 0
  for (const n of left.values()) cut += n
  return { added, cut }
}

/**
 * A change known only by its net, as a restructuring tells it (S8): words
 * moved between scenes come out of one and go into the other, so a split or a
 * join that moves them adds and cuts nothing, and words it takes out are cut.
 */
export function netChange(net: number): WordChange {
  return { added: Math.max(0, net), cut: Math.max(0, -net) }
}
