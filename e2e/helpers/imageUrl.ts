/**
 * An image served by whichever server the suite is pointed at.
 *
 * Deliberately `favicon.jpg`, which ships in `public/` but is referenced
 * nowhere in `src/`. The obvious choice was `favicon.png`, which was then the
 * app's own logo: with `base: './'` a production build compiles `import
 * faviconUrl from '/favicon.png'` into `new URL('../favicon.png',
 * import.meta.url).href`, an absolute URL, so `img[src="http://host/favicon.png"]`
 * matched the logo in the top bar instead of the picture under test. In dev the
 * same import stays `/favicon.png` and never collides, which is why this only
 * broke on a build.
 *
 * The logo is `logo-128.png` now, cut from `favicon.ico`, so that particular
 * collision is gone — but the rule it taught is not: pick a file `src/` never
 * imports, or the app's own chrome answers a locator meant for the fixture.
 */
export const IMAGE_URL = `${process.env.E2E_DEV ? 'http://localhost:5173' : 'http://localhost:4173'}/favicon.jpg`
