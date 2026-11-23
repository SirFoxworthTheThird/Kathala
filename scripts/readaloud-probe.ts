import { test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { plainScene, sentences } from '../src/lib/proseChecks/text'
import { LIBRARY } from './proseLibrary'

test('sentences of the Library, as read aloud would speak them', () => {
  let books = 0, scenes = 0, total = 0, chars = 0
  const len: number[] = []
  let underscore = 0, asterisk = 0, bracket = 0, hash = 0, angle = 0, emptyish = 0
  const longest: Array<[number, string]> = []
  const ex: Record<string, string[]> = { underscore: [], asterisk: [], bracket: [], hash: [], angle: [] }
  for (const file of readdirSync(LIBRARY).filter((f) => f.endsWith('.pwk')).sort()) {
    const w = JSON.parse(readFileSync(join(LIBRARY, file), 'utf8')) as { sceneTexts?: Array<{ text: string }> }
    if (!w.sceneTexts?.length) continue
    books++
    let n = 0
    for (const t of w.sceneTexts) {
      if (!t.text?.trim()) continue
      scenes++
      const plain = plainScene(t.text).text
      for (const s of sentences(plain)) {
        const body = plain.slice(s.start, s.end)
        n++; chars += body.length; len.push(body.length)
        const note = (k: string) => { if (ex[k].length < 4) ex[k].push(`${file}: ${body.slice(0, 120)}`) }
        if (body.includes('_')) { underscore++; note('underscore') }
        if (body.includes('*')) { asterisk++; note('asterisk') }
        if (/\[[^\]]*\]/.test(body)) { bracket++; note('bracket') }
        if (/^#/.test(body)) { hash++; note('hash') }
        if (/<[a-z/]/i.test(body)) { angle++; note('angle') }
        if (!/[\p{L}\p{N}]/u.test(body)) emptyish++
        longest.push([body.length, `${file}: ${body.slice(0, 80)}`])
      }
    }
    total += n
    console.log(`${file.padEnd(48)} ${n}`)
  }
  len.sort((a, b) => a - b)
  const q = (p: number) => len[Math.floor(p * (len.length - 1))]
  longest.sort((a, b) => b[0] - a[0])
  console.log(`${books} books, ${scenes} scenes, ${total} sentences, ${chars} chars`)
  console.log(`length chars: median ${q(0.5)}, p90 ${q(0.9)}, p99 ${q(0.99)}, max ${len[len.length - 1]}; over 400: ${len.filter((x) => x > 400).length}; over 1000: ${len.filter((x) => x > 1000).length}`)
  console.log(`with _ ${underscore}, * ${asterisk}, [..] ${bracket}, leading # ${hash}, <tag ${angle}, no letters ${emptyish}`)
  for (const [k, v] of Object.entries(ex)) for (const e of v) console.log(`  ${k}: ${e}`)
  for (const [n, s] of longest.slice(0, 5)) console.log(`  long ${n}: ${s}`)
})
