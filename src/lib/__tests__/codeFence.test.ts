import { describe, it, expect } from 'vitest'
import { INVALID_JSON_MESSAGE } from '@/lib/codeFence'
import { parseCharactersSpec } from '@/lib/sectionImport'
import { parseWorldSpec } from '@/lib/worldSpec'
import { validateResponse } from '@/features/timeline/ChapterAIDialog'

/**
 * Every AI paste target rejects unparseable text the same way. There were three
 * wordings across four parsers, one of which named a single assistant while the
 * dialogs around it offered "any AI assistant".
 */
describe('the shared invalid-JSON message', () => {
  it('names no particular assistant', () => {
    expect(INVALID_JSON_MESSAGE).not.toMatch(/claude|chatgpt|gemini/i)
  })

  it('is what every parser returns for text that will not parse', () => {
    expect(parseCharactersSpec('not json at all').error).toBe(INVALID_JSON_MESSAGE)
    expect(parseWorldSpec('not json at all').error).toBe(INVALID_JSON_MESSAGE)
    expect(() => validateResponse('not json at all', 'w', 't', new Set(), new Set(), new Set(), new Set()))
      .toThrow(INVALID_JSON_MESSAGE)
  })

  it('still lets a parse *success* through, so the check is not vacuous', () => {
    expect(parseWorldSpec('{"world":{"name":"W"},"chapters":[]}').error).toBeUndefined()
  })
})
