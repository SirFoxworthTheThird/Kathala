import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../ChapterAIDialog'
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
