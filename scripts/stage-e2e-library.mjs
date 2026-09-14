/*
  Put the Library where the end-to-end suite can reach it.

  In production the app fetches the catalogue and the artwork from the library
  site. The suite cannot: it runs against a preview server on localhost, often
  with no route to the internet at all, and sixteen specs need real books —
  `libraryBrowse` asserts on all thirty-nine catalogue entries, that they file
  alphabetically past a leading article, and that searching "bronte" finds both
  sisters. A handful of fixture books would answer none of that, and would drift
  from the real catalogue the moment a book was added.

  So the suite serves the real library from the repository next door. Only the
  worlds and the catalogue are staged, not the 1.7 GB of artwork: no spec reads
  a pixel, and the ones that check a *picture* use uploaded blobs rather than
  the shipped files.

  Runs only for an end-to-end build. A production build has no `library/` in
  `dist/` at all, which is the point of the split.
*/
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

const source = process.env.PLOTWEAVE_LIBRARY ?? '../plotweave-library'
const from = join(source, 'library')
const to = 'dist/library'

if (!process.env.VITE_E2E) {
  console.log('stage-e2e-library: not an e2e build, nothing to stage')
  process.exit(0)
}

if (!existsSync(from)) {
  console.error(
    `stage-e2e-library: no library at ${from}\n` +
    '  The suite needs the books. Clone SirFoxworthTheThird/PlotWeave-Library\n' +
    '  beside this repository, or set PLOTWEAVE_LIBRARY to where it lives.',
  )
  process.exit(1)
}

mkdirSync(to, { recursive: true })
const worlds = readdirSync(from).filter((f) => /\.(pwk|pwb)$/.test(f))
if (worlds.length === 0) {
  console.error(`stage-e2e-library: ${from} holds no worlds — is it the right directory?`)
  process.exit(1)
}

for (const f of [...worlds, 'index.json']) {
  if (!existsSync(join(from, f))) {
    console.error(`stage-e2e-library: ${from} has no ${f}`)
    process.exit(1)
  }
  cpSync(join(from, f), join(to, f))
}

console.log(`stage-e2e-library: staged ${worlds.length} worlds and the catalogue from ${from}`)
