import { describe, it, expect } from 'vitest'

/**
 * A world that names its chapters says where the names came from.
 *
 * **R1.** A blind reader run reported the shipped worlds inventing chapter
 * titles. Measured across all thirty, it is far narrower than that: four use the
 * book's own numbering (*Frankenstein*, *Neuromancer*, *Pride and Prejudice*,
 * *The Picture of Dorian Gray*), two use its own structural divisions
 * (*The Moonstone*'s periods, *The Woman in White*'s narrators), and of the
 * twenty-four that carry descriptive titles, all but two are the author's own —
 * *Dracula*'s document headings included, which look invented and are not.
 *
 * The two that are editorial are *Jane Eyre*, whose chapters Brontë numbered and
 * did not name, and *The Odyssey*, whose books carry numbers in the Greek and
 * acquire names only from translators. `EX-006` already requires an editorial
 * reconstruction to be identified in Lore and its assumptions explained — the
 * rule these worlds' calendars and maps already follow — and this is that rule
 * applied to the chapter titles.
 *
 * The list below cannot be checked automatically: nothing in the data
 * distinguishes a title an author wrote from one an example author supplied. So
 * the second test checks the half that *can* be derived — that a world named
 * here really does carry descriptive titles — which is what stops the list
 * outliving the thing it describes.
 */

const worldFiles = import.meta.glob('../../../public/library/*.pwk', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

interface World {
  lorePages?: { title: string; body: string }[]
  chapters?: { number: number; title?: string }[]
}

const worldsBySlug = new Map(Object.entries(worldFiles).map(([path, text]) => {
  const file = path.slice(path.lastIndexOf('/') + 1)
  return [file.replace(/\.pwk$/, ''), JSON.parse(text) as World] as const
}))

/** Worlds whose chapter names were written for the example, not by the author. */
const EDITORIAL_TITLES = ['jane-eyre', 'the-odyssey']

/** A heading that is only a number or a structural label, e.g. "Chapter IV". */
const STRUCTURAL = /^(chapter|letter|book|part|canto|prologue|epilogue|interlude)\b[\s\dIVXLC.:—-]*$/i

describe('editorial chapter titles', () => {
  it('has worlds to check', () => {
    // Without this both rules pass on an empty glob.
    expect(worldsBySlug.size).toBeGreaterThan(20)
  })

  it.each(EDITORIAL_TITLES)('%s says in Lore that its chapter names are editorial', (slug) => {
    const world = worldsBySlug.get(slug)
    expect(world, `${slug} should be a shipped world`).toBeDefined()
    const said = (world!.lorePages ?? []).some((p) =>
      /editorial signpost/i.test(p.body) && /chapter|book/i.test(p.body))
    expect(said, 'a reader should be able to find out that these names are not the author’s').toBe(true)
  })

  /*
    The half that keeps the list above honest. Renumber one of these worlds to
    the book's own "Chapter 1" and it no longer belongs here — the note would
    then describe titles that are gone, which is the quiet way a claim in a
    fixture outlives the thing it was about.
  */
  it.each(EDITORIAL_TITLES)('%s really does carry descriptive chapter titles', (slug) => {
    const chapters = worldsBySlug.get(slug)?.chapters ?? []
    expect(chapters.length).toBeGreaterThan(5)
    const descriptive = chapters.filter((c) => c.title && !STRUCTURAL.test(c.title))
    expect(descriptive.length).toBeGreaterThan(chapters.length * 0.6)
  })

  it('does not claim the same of a world whose titles are the author’s own', () => {
    /*
      Presence beside absence, and the reason the list is a list rather than a
      rule applied to everything: Alice's chapter titles are Carroll's, and
      telling a reader they were invented for this example would be a new
      untruth in place of the old one.
    */
    const alice = worldsBySlug.get('alice-in-wonderland')
    expect(alice, 'Alice should be a shipped world').toBeDefined()
    expect((alice!.chapters ?? []).filter((c) => c.title && !STRUCTURAL.test(c.title)).length)
      .toBeGreaterThan(5)
    expect((alice!.lorePages ?? []).some((p) => /editorial signpost/i.test(p.body))).toBe(false)
  })
})
