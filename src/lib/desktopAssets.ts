/**
 * Where a packaged desktop build loads the Library's artwork from.
 *
 * The web build needs none of this: a stored `library/…` path resolves against
 * the document, which is the site that served the page, and the pictures come
 * from the same origin as everything else.
 *
 * A packaged app has no such origin. It loads over `file://`, so "resolve
 * against the document" means "a file inside the installer", and satisfying
 * that meant shipping every book's artwork — **1,045 MB across 658 files**, for
 * 33 books of which a reader might open one. It also broke the Windows
 * installer outright: Squirrel embeds the payload with a 32-bit tool that has
 * roughly 2 GB of address space and needs the payload in memory twice, so at
 * 1.23 GiB it silently produced a `Setup.exe` containing nothing. v1.1.0 was
 * built, uploaded and very nearly published that way.
 *
 * So the desktop build points at a CDN copy of the same files instead. jsDelivr
 * serves them straight from the repository, which means there is no second copy
 * to upload or keep in step — the sync failures this project already has
 * between `example/` and `public/library/` are not worth a third one.
 *
 * **Pinned to the version's tag, never a branch.** A published installer keeps
 * asking for these URLs for as long as it is installed, and a moving `@main`
 * would let a later commit change or remove the artwork an old build depends
 * on. The tag is the same one the release workflow creates.
 */
export function desktopAssetBaseUrl(repositoryUrl: string, version: string): string {
  const match = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repositoryUrl)
  if (!match) throw new Error(`Not a GitHub repository URL: ${repositoryUrl}`)
  const [, owner, repo] = match
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@v${version}/public/`
}
