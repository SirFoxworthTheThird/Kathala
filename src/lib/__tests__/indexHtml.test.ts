import { describe, it, expect } from 'vitest'
// The shell itself, as text. `?raw` rather than `node:fs` so this reads the
// same file Vite builds from, through the same resolution the app uses.
import html from '../../../index.html?raw'
// `main.cjs` loads that same shell, and the two have to agree about the title.
import main from '../../../electron/main.cjs?raw'

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
    expect(markup).toContain('href="/favicon-32.png"')
  })

  /*
    The tab icon is fetched by every browser on every first visit, so what it
    points at is a page-weight decision, not a cosmetic one. `favicon.png` is the
    right logo at the wrong size: a 1552×1570 master weighing 3.98 MB, which was
    the icon and — through `TopBar` and `WorldSelectorView` — the 28px and 40px
    logo as well.

    Asserted as "not the master" rather than "is this exact filename", because
    the rule is about weight. Any small cut of the real logo passes; pointing it
    back at the master does not.
  */
  it('does not draw a sixteen-pixel icon from the four-megabyte master', () => {
    const icon = /<link\s+rel="icon"[^>]*href="([^"]+)"/.exec(markup)?.[1]
    expect(icon, 'the head must still declare an icon').toBeTruthy()
    expect(icon).not.toBe('/favicon.png')
    expect(icon, 'and it must be a file this app serves').toMatch(/^\//)
  })

  /*
    Shared as a link is how this app mostly travels, and it used to arrive as
    bare text: no description, no preview card. These are the tags that fix
    that, kept here so a `<head>` tidy-up cannot quietly take them away again.

    They are also the reason the rule above is written against `href`/`src`
    rather than against "any absolute URL". An `og:image` is never fetched by
    the browser — a crawler reads it off the page — so it cannot block a paint,
    which is the whole thing that rule exists to prevent. Putting the same URL
    in an `href` would be a different matter, and still fails.
  */
  describe('how it looks when someone shares it', () => {
    it('says what the app is', () => {
      const description = /<meta\s+name="description"\s+content="([^"]+)"/.exec(markup)?.[1]
      expect(description, 'a search result with no description is a bare URL').toBeTruthy()
      expect(description!.length).toBeGreaterThan(60)
    })

    it('carries a preview card', () => {
      for (const tag of ['og:title', 'og:description', 'og:url', 'og:image']) {
        expect(markup, `${tag} is what makes a shared link render as a card`)
          .toContain(`property="${tag}"`)
      }
      expect(markup).toContain('name="twitter:card"')
    })

    it('gives the card an absolute image URL, since a relative one does not resolve for a crawler', () => {
      const image = /<meta\s+property="og:image"\s+content="([^"]+)"/.exec(markup)?.[1]
      expect(image).toMatch(/^https:\/\//)
    })

    /*
      The half that is not about the web at all. `electron/main.cjs` loads this
      same file, and Electron lets a page title replace the window title the
      moment it loads — so a `<title>` written to be a search result would put
      the whole tagline in the desktop title bar and the taskbar. The window
      sets `title: 'PlotWeave'` and must also refuse the update.
    */
    it('does not let the marketing title reach the desktop title bar', () => {
      const title = /<title>([^<]*)<\/title>/.exec(markup)?.[1] ?? ''
      if (title.trim() === 'PlotWeave') return // nothing to protect against
      expect(main, 'index.html has a long title, so main.cjs must pin the window one')
        .toContain('page-title-updated')
      expect(main).toContain("title: 'PlotWeave'")
    })
  })
})
