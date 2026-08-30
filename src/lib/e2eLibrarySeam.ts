import { downloadLibraryWorld, fetchLibraryIndex, libraryBaseUrl } from './library'

/**
 * Seam so e2e tests can install a library world without driving the catalogue.
 *
 * Eleven specs need *a populated reading world* — a large cast, chapters, maps,
 * factions — and reach for the Library because it is the easiest way to get
 * one. None of them is about the Library: `libraryBrowse` and `libraryCovers`,
 * which are, drive the dialog themselves and do not use this.
 *
 * What those eleven were paying for was the catalogue: opening the dialog,
 * fetching the index, rendering thirty cards each with a remote cover image,
 * waiting for one to become visible, scrolling to it and clicking. The download
 * and the import underneath are the part they actually want, and this is
 * exactly the call the dialog makes — same fetch, same `applyWorldImport`, same
 * everything the world ends up containing. Only the chrome is skipped.
 *
 * Same flag as `__pwdb` in `database.ts`: present in dev and in a build made
 * with `VITE_E2E=1`, absent from a released bundle.
 */
export interface E2ELibrarySeam {
  install: (title: string) => Promise<string>
}

if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
  ;(window as unknown as { __pwlibrary?: E2ELibrarySeam }).__pwlibrary = {
    async install(title: string) {
      const baseUrl = libraryBaseUrl(window.location.origin)
      const index = await fetchLibraryIndex(baseUrl)
      const entry = index.entries.find((e) => e.title === title)
      // Named rather than positional, and loudly absent: a helper that silently
      // installed the wrong book would make every assertion after it a claim
      // about a story nobody chose.
      if (!entry) throw new Error(`No library book titled “${title}”`)
      const { worldId } = await downloadLibraryWorld(baseUrl, entry, { withImages: false })
      return worldId
    },
  }
}
