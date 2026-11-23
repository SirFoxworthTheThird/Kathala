import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/*
  Where the browser's spell checker is on, and where it is off (issue #705,
  D-7): on where the writer writes prose, off where the boxes hold prompts and
  JSON, whose words are not prose and whose underlines would be noise.
*/

const source = (file: string) => readFileSync(join(__dirname, '..', '..', file), 'utf8')

describe('spell checking', () => {
  it('is on in the Page and in Focus mode', () => {
    expect(source('features/timeline/DraftBook.tsx')).toMatch(/contentAttributes\.of\(\{[^}]*spellcheck: 'true'/)
    expect(source('features/timeline/FocusMode.tsx')).toMatch(/<textarea[\s\S]*?\bspellCheck\b(?!=\{false\})/)
  })

  it('is off in every text box of the AI audit and the chapter AI dialog', () => {
    for (const file of ['features/continuity/AuditPanel.tsx', 'features/timeline/ChapterAIDialog.tsx']) {
      const text = source(file)
      // To the tag's own close: an `=>` in a handler is not its end.
      const boxes = text.match(/<(textarea|Textarea)\b[\s\S]*?\/>/g) ?? []
      expect(boxes.length, file).toBeGreaterThan(0)
      for (const box of boxes) expect(box, file).toContain('spellCheck={false}')
    }
  })
})
