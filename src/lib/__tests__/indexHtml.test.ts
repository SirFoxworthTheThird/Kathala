import { describe, it, expect } from 'vitest'
// The shell itself, as text. `?raw` rather than `node:fs` so this reads the
// same file Vite builds from, through the same resolution the app uses.
import html from '../../../index.html?raw'

/**
 * The app's shell must not block its first paint on anything it does not serve
 * itself.
 *
 * `index.html` carried a `<link rel="stylesheet">` to `fonts.googleapis.com`
 * for Playfair Display. A stylesheet link is render-blocking, so every load of
 * every screen — desktop build included, since `electron/main.cjs` loads this
 * same file — waited on a third-party host before painting anything. The face
 * was never used: every theme sets a system stack.
 *
 * This is a source-text test on purpose. The regression is a line someone adds
 * back to the HTML, and no runtime assertion in jsdom would see it.
 */

/*
  Comments are stripped first, and deliberately: the `<head>` explains at length
  what was removed and why, naming both the host and the typeface. Asserting on
  the raw text would make that explanation the thing that fails, which would
  teach the next person to delete the explanation.
*/
const markup = html.replace(/<!--[\s\S]*?-->/g, '')

/** `href`/`src` values pointing at another origin. */
function externalRefs(source: string): string[] {
  const refs = source.match(/(?:href|src)\s*=\s*"([^"]*)"/g) ?? []
  return refs
    .map((r) => r.replace(/^(?:href|src)\s*=\s*"/, '').replace(/"$/, ''))
    .filter((v) => /^(https?:)?\/\//.test(v))
}

describe('index.html', () => {
  it('references no external hosts at all', () => {
    expect(externalRefs(markup)).toEqual([])
  })

  it('does not ask for the webfont it never used', () => {
    expect(markup).not.toContain('fonts.googleapis.com')
    expect(markup).not.toContain('fonts.gstatic.com')
    expect(markup).not.toContain('Playfair')
  })

  /*
    The presence half. Without it the two assertions above are satisfied by an
    empty file, or by a `<head>` someone gutted — both would pass while the app
    failed to boot.
  */
  it('still loads the app from its own origin', () => {
    expect(markup).toContain('<div id="root">')
    expect(markup).toMatch(/<script type="module" src="\/src\/main\.tsx">/)
    expect(markup).toContain('href="/favicon.png"')
  })
})
