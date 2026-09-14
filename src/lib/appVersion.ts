import pkg from '../../package.json'

/** This build's version, as `package.json` declares it. */
export const APP_VERSION: string = pkg.version

/**
 * Compare two `major.minor.patch` strings.
 *
 * Numeric part by part, not lexicographic: `"1.10.0" > "1.9.0"` is true here
 * and false for a string comparison, which is the whole reason this exists
 * rather than an inline `<`.
 *
 * Returns a negative number if `a` is older, positive if newer, 0 if the same.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Whether this app is too old to open a book.
 *
 * A catalogue entry may name the oldest PlotWeave that can read it. Since the
 * books moved to their own repository they are published independently of the
 * app, so a desktop install from a year ago will one day fetch a catalogue
 * written for something newer. This is what lets that book say so on the card
 * rather than importing into a world quietly missing what it relied on.
 *
 * A book with no requirement opens anywhere, which is nearly all of them. An
 * unreadable requirement is treated as no requirement: a malformed string is
 * the catalogue's mistake, and refusing to show a book over it would be a worse
 * outcome than showing one that may not need anything.
 */
export function needsNewerApp(
  minAppVersion: string | undefined,
  appVersion: string = APP_VERSION,
): boolean {
  if (!minAppVersion) return false
  if (!/^\d+(\.\d+)*$/.test(minAppVersion.trim())) return false
  return compareVersions(appVersion, minAppVersion.trim()) < 0
}
