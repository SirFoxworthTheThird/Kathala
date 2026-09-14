/*
  Put the Library's catalogue and worlds into `dist/`, for the two builds that
  cannot fetch them.

  **The end-to-end suite**, because it runs against a preview server on
  localhost, often with no route to the internet at all, and sixteen specs need
  real books — `libraryBrowse` asserts on all thirty-nine catalogue entries,
  that they file alphabetically past a leading article, and that searching
  "bronte" finds both sisters. Fixture books would answer none of that and would
  drift from the real catalogue the moment a book was added.

  **The desktop app**, because a reader with no connection should still be able
  to open the Library and import a book. It prefers the live catalogue when it
  can reach one, so a desktop install still sees books published after it was
  built; this is what it falls back to.

  Only the worlds and the catalogue, never the 1.7 GB of artwork. No test reads
  a pixel, and a packaged app fetches pictures from the library site exactly as
  the browser build does.

  A plain web build stages nothing: `dist/` has no `library/` at all, which is
  the point of the split.
*/
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

const source = process.env.PLOTWEAVE_LIBRARY ?? '../plotweave-library'
const from = join(source, 'library')
const to = 'dist/library'

// `--bundled` is the desktop build; `VITE_E2E` is the suite. Passed as a flag
// rather than an environment variable because the release matrix builds the
// Windows installer, and `VAR=value command` is not a thing in cmd.exe.
const wanted = process.argv.includes('--bundled') || process.env.VITE_E2E
if (!wanted) {
  console.log('stage-library: a plain web build stages nothing')
  process.exit(0)
}

if (!existsSync(from)) {
  console.error(
    `stage-library: no library at ${from}\n` +
    '  The suite needs the books. Clone SirFoxworthTheThird/PlotWeave-Library\n' +
    '  beside this repository, or set PLOTWEAVE_LIBRARY to where it lives.',
  )
  process.exit(1)
}

mkdirSync(to, { recursive: true })
const worlds = readdirSync(from).filter((f) => /\.(pwk|pwb)$/.test(f))
if (worlds.length === 0) {
  console.error(`stage-library: ${from} holds no worlds — is it the right directory?`)
  process.exit(1)
}

for (const f of [...worlds, 'index.json']) {
  if (!existsSync(join(from, f))) {
    console.error(`stage-library: ${from} has no ${f}`)
    process.exit(1)
  }
  cpSync(join(from, f), join(to, f))
}

console.log(`stage-library: staged ${worlds.length} worlds and the catalogue from ${from}`)
