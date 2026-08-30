import { expect, type Page } from '@playwright/test'

/**
 * Download a named world from the Library.
 *
 * Specs used to take `Download (…)` `.first()`, which meant *Harry Potter and
 * the Philosopher's Stone* only because that is the order `index.json` happened
 * to list. Filing the catalogue alphabetically (**LIB-1**) moved *Around the
 * World in Eighty Days* to the top and six specs started asserting Hogwarts
 * facts about Phileas Fogg.
 *
 * The order of a catalogue is not something a test about factions or pacing
 * should depend on, so say which book you mean. `libraryCovers` already scoped
 * its cards this way; this is that pattern, shared.
 */
export async function downloadLibraryBook(page: Page, title: string) {
  /*
    The same download and import the dialog performs — `downloadLibraryWorld`,
    which is the one call `LibraryDialog.download` makes — reached through the
    dev/e2e seam instead of through the catalogue.

    What the eleven specs using this were paying for was the chrome: opening the
    dialog, fetching the index, rendering thirty cards each with a remote cover
    image, waiting for one to be visible, scrolling to it, clicking. None of
    them is about the Library; they want a populated reading world, and this
    produces exactly the world the dialog would have. The two specs that *are*
    about the Library — `libraryBrowse` and `libraryCovers` — drive the dialog
    themselves and do not come through here.
  */
  const worldId = await page.evaluate(async (name: string) => {
    const seam = (window as unknown as {
      __pwlibrary?: { install: (t: string) => Promise<string> }
    }).__pwlibrary
    if (!seam) throw new Error('__pwlibrary seam missing — build with VITE_E2E=1')
    return seam.install(name)
  }, title)

  await page.goto(`/#/worlds/${worldId}/`, { waitUntil: 'load' })
  // The world is really open, so a spec that reads the id out of the URL — most
  // of them do — cannot read it from a page that has not arrived yet.
  await expect(page).toHaveURL(new RegExp(`#/worlds/${worldId}`), { timeout: 60_000 })
  return worldId
}

/**
 * The book most reading-mode specs are written against: a large cast, several
 * chapters, maps, and factions — and the one they all silently assumed.
 */
export const DEFAULT_BOOK = "Harry Potter and the Philosopher's Stone"
