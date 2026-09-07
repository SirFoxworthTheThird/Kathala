/*
  Remove the Library artwork from `dist/` before the desktop app is packaged.

  Vite copies `public/` into `dist/`, and `dist/` is the app, so the artwork
  reaches the installer even though `forge.config.cjs` explicitly excludes
  `public/`. That exclusion was already the intent; this makes it true.

  What stays is what the app cannot get from the network: the catalogue itself,
  the covers it names, and the world files, so browsing the Library and
  importing a book still work with no connection. Only the pictures inside a
  book become remote, and `World settings → Pictures` pulls those local when a
  reader wants them.

  The covers are read from `index.json` rather than listed here, so adding one
  cannot silently strip it.
*/
import { readFileSync, readdirSync, statSync, unlinkSync, rmdirSync } from 'fs'
import { join, relative, sep } from 'path'

// The build's output directory, so a test can point this at a fixture rather
// than at a real 1 GB build.
const ROOT = process.argv[2] ?? 'dist'
const LIBRARY = join(ROOT, 'library')

function fail(message) {
  console.error(`prune-desktop-library: ${message}`)
  process.exit(1)
}

let index
try {
  index = JSON.parse(readFileSync(join(LIBRARY, 'index.json'), 'utf8'))
} catch {
  // A missing catalogue means the build did not run, or ran into somewhere
  // else. Removing nothing quietly would ship the artwork again.
  fail(`no catalogue at ${join(LIBRARY, 'index.json')} — run the build first`)
}

const keep = new Set(['index.json'])
for (const entry of index.entries ?? []) {
  const cover = entry.cover
  if (typeof cover === 'string' && !/^https?:\/\//i.test(cover)) {
    // Catalogue paths are relative to `public/`, e.g. `library/<book>/art/x.jpg`.
    keep.add(cover.replace(/^library\//, '').split('/').join(sep))
  }
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* files(full)
    else yield full
  }
}

let removed = 0
let bytes = 0
let kept = 0
for (const file of files(LIBRARY)) {
  const rel = relative(LIBRARY, file)
  if (keep.has(rel) || /\.(pwk|pwb)$/i.test(rel)) {
    kept += 1
    continue
  }
  bytes += statSync(file).size
  unlinkSync(file)
  removed += 1
}

// Leave no empty scaffolding behind; `rmdir` refuses a directory that still
// holds a cover, which is exactly the behaviour wanted.
function prune(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) prune(full)
  }
  try { rmdirSync(dir) } catch { /* not empty — a cover lives here */ }
}
for (const name of readdirSync(LIBRARY)) {
  const full = join(LIBRARY, name)
  if (statSync(full).isDirectory()) prune(full)
}

if (removed === 0) fail('removed nothing — the artwork is not where it was expected')

console.log(
  `prune-desktop-library: removed ${removed} files (${(bytes / 1048576).toFixed(1)} MB), kept ${kept}`,
)
