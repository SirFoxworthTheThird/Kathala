import { describe, it, expect } from 'vitest'
import { buildPrompt, validateResponse } from '../ChapterAIDialog'
import { INVALID_JSON_MESSAGE } from '@/lib/codeFence'
import type { Chapter } from '@/types'

function chapter(): Chapter {
  return {
    id: 'ch1', worldId: 'w', timelineId: 't1', number: 3,
    title: 'The Reckoning', synopsis: 'Things come to a head.', notes: '',
    wordGoal: null, createdAt: 0, updatedAt: 0,
  }
}

/** buildPrompt takes a long argument list; everything but the ids can be empty. */
function build(update: boolean): string {
  return buildPrompt(
    'w', 'World', 't1', 'Timeline', 3, [],
    [], [], [], [], [], [], [],
    update ? { chapter: chapter(), events: [], snapshots: [], relSnapshots: [] } : undefined,
  )
}

describe('ChapterAIDialog prompt', () => {
  for (const mode of ['create', 'update'] as const) {
    const isUpdate = mode === 'update'

    it(`${mode}: instructs the model to rate dramatic tension`, () => {
      const prompt = build(isUpdate)
      // The pacing curve reads event.tension, so the prompt must ask for a rating.
      expect(prompt).toMatch(/tension/i)
      expect(prompt).toMatch(/rate .*tension/i)
      expect(prompt).toMatch(/1[–-]5/) // the 1–5 scale
    })

    it(`${mode}: does not hardcode "tension": null in the event schema`, () => {
      const prompt = build(isUpdate)
      expect(prompt).not.toContain('"tension": null')
    })
  }
})

describe('ChapterAIDialog response validation', () => {
  const empty = () => new Set<string>()
  const body = JSON.stringify({
    chapter: { id: 'ch1', worldId: 'w', timelineId: 't1', number: 3, title: 'The Reckoning' },
    events: [],
    characterSnapshots: [],
  })
  const validate = (raw: string) =>
    validateResponse(raw, 'w', 't1', empty(), empty(), empty(), empty())

  it('accepts a response the assistant wrapped in a markdown fence', () => {
    for (const raw of ['```json\n' + body + '\n```', '```\n' + body + '\n```']) {
      expect(validate(raw).chapter.title).toBe('The Reckoning')
    }
    // The unfenced form must pass too, or the fenced assertions prove nothing.
    expect(validate(body).chapter.title).toBe('The Reckoning')
  })

  it('still rejects genuinely broken JSON, fenced or not', () => {
    expect(() => validate('```json\n{"chapter": \n```')).toThrow(INVALID_JSON_MESSAGE)
    expect(() => validate('here is your chapter!')).toThrow(INVALID_JSON_MESSAGE)
  })

  it('validates the unfenced content rather than accepting anything fenced', () => {
    expect(() => validate('```json\n{"chapter":{"id":"ch1","worldId":"OTHER","timelineId":"t1","number":3,"title":"T"},"events":[],"characterSnapshots":[]}\n```'))
      .toThrow(/worldId mismatch/)
  })
})
