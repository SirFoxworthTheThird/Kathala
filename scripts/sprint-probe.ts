import { test, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

/*
  Words added and cut, against the net a day keeps now (issue #706). Read from
  the scene histories of the writers' runs: each version of a scene against
  the next, and the last against the scene as it stands. For each pair:

  - the net, as the writing log keeps it today;
  - words added and cut by a word diff, the shared start and end of the two
    texts taken off first, which leaves the diff's answer as it was (the
    longest common run of a pair keeps their shared ends);
  - the same by counting the words in the middle that each side lacks, in any
    order, which is linear where the diff is quadratic.

  The files are the runs' own `.pwk` exports, given as SPRINT_PROBE_FILES
  (colon-separated). docs/records/sprints-plan.md.
*/

type Pwk = { sceneTexts?: Array<{ eventId: string; text: string; updatedAt: number }>; sceneRevisions?: Array<{ eventId: string; text: string; createdAt: number }> }

const words = (t: string) => t.match(/\S+/g) ?? []

function trimmed(a: string[], b: string[]): [string[], string[]] {
  let s = 0
  while (s < a.length && s < b.length && a[s] === b[s]) s++
  let e = 0
  while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++
  return [a.slice(s, a.length - e), b.slice(s, b.length - e)]
}

function lcs(a: string[], b: string[]): number {
  let prev = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const row = new Array(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1])
    prev = row
  }
  return prev[b.length]
}

function bag(a: string[], b: string[]): { added: number; cut: number } {
  const n = new Map<string, number>()
  for (const w of a) n.set(w, (n.get(w) ?? 0) + 1)
  let added = 0
  for (const w of b) { const k = n.get(w) ?? 0; if (k > 0) n.set(w, k - 1); else added++ }
  let cut = 0
  for (const k of n.values()) cut += k
  return { added, cut }
}

test('words added and cut in the writers’ scene histories', () => {
  const files = (process.env.SPRINT_PROBE_FILES ?? '').split(':').filter((f) => f && existsSync(f))
  expect(files.length).toBeGreaterThan(0)
  let pairs = 0, hidden = 0, cutOnly = 0, netSum = 0, activity = 0, lcsActivity = 0, disagree = 0, bigMiddle = 0
  let lcsMs = 0, bagMs = 0
  const middles: number[] = []
  for (const f of files) {
    const w = JSON.parse(readFileSync(f, 'utf8')) as Pwk
    const versions = new Map<string, Array<{ text: string; at: number }>>()
    for (const r of w.sceneRevisions ?? []) versions.set(r.eventId, [...(versions.get(r.eventId) ?? []), { text: r.text, at: r.createdAt }])
    for (const t of w.sceneTexts ?? []) if (versions.has(t.eventId)) versions.get(t.eventId)!.push({ text: t.text, at: Number.MAX_SAFE_INTEGER })
    let filePairs = 0
    for (const list of versions.values()) {
      list.sort((x, y) => x.at - y.at)
      for (let i = 1; i < list.length; i++) {
        const a = words(list[i - 1].text), b = words(list[i].text)
        const net = b.length - a.length
        const [ma, mb] = trimmed(a, b)
        middles.push(ma.length + mb.length)
        if (ma.length * mb.length > 4_000_000) bigMiddle++
        let t = performance.now()
        const common = lcs(ma, mb)
        lcsMs += performance.now() - t
        const exact = { added: mb.length - common, cut: ma.length - common }
        t = performance.now()
        const quick = bag(ma, mb)
        bagMs += performance.now() - t
        expect(quick.added - quick.cut).toBe(net)
        expect(exact.added - exact.cut).toBe(net)
        if (quick.added !== exact.added) disagree++
        pairs++; filePairs++
        netSum += Math.abs(net)
        activity += quick.added + quick.cut
        lcsActivity += exact.added + exact.cut
        if (net <= 0 && quick.added + quick.cut > 0) hidden++
        if (net < 0 && quick.added === 0) cutOnly++
      }
    }
    console.log(`${f.split('/').slice(-2).join('/').padEnd(40)} ${filePairs} pairs`)
  }
  middles.sort((x, y) => x - y)
  const q = (p: number) => middles[Math.floor(p * (middles.length - 1))]
  console.log(`pairs ${pairs}`)
  console.log(`net at or below zero with words changed: ${hidden} (${(100 * hidden / pairs).toFixed(1)}%), of them only cut: ${cutOnly}`)
  console.log(`|net| summed ${netSum}; added+cut (bag) ${activity}; added+cut (diff) ${lcsActivity}`)
  console.log(`bag and diff disagree on ${disagree} pairs`)
  console.log(`middle words: median ${q(0.5)}, p90 ${q(0.9)}, max ${q(1)}; over 4M cells ${bigMiddle}`)
  console.log(`time: diff ${lcsMs.toFixed(0)} ms, bag ${bagMs.toFixed(1)} ms`)
})
