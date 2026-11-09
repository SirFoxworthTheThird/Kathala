import { test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { emphasisSpans } from '../src/lib/proseEmphasis'
import { paragraphBlocks } from '../src/lib/manuscriptParagraphs'
import { LIBRARY } from './proseLibrary'

/*
  Asterisk emphasis against the Library (round-trip-plan.md, T2.1, decision
  D-1): every paragraph of every shipped book, in every language, read with
  asterisks as emphasis and without, and each one that reads differently
  printed. Asterisks were left out because none of these books has one: this
  is the measure that says whether that is still so.

    KATHALA_LIBRARY=… npm run probe:emphasis
*/
test('asterisk emphasis changes no paragraph of the Library', () => {
  let books = 0, paragraphs = 0, asterisks = 0
  const changed: string[] = []
  for (const file of readdirSync(LIBRARY).filter((f) => f.endsWith('.pwk')).sort()) {
    const w = JSON.parse(readFileSync(join(LIBRARY, file), 'utf8')) as { sceneTexts?: Array<{ text: string }> }
    if (!w.sceneTexts?.length) continue
    books++
    for (const t of w.sceneTexts) for (const p of paragraphBlocks(t.text)) {
      paragraphs++
      if (p.text.includes('*')) asterisks++
      const a = JSON.stringify(emphasisSpans(p.text, ['_']))
      const b = JSON.stringify(emphasisSpans(p.text))
      if (a !== b) changed.push(`${file}: ${p.text.slice(0, 160)}`)
    }
  }
  console.log(`${books} books, ${paragraphs} paragraphs, ${asterisks} with an asterisk, ${changed.length} read differently`)
  for (const c of changed) console.log('  ' + c)
})
