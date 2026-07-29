import { generateId } from './id'

const KEY = 'plotweave-device-id'

let cached: string | null = null

/**
 * A stable identifier for this browser profile, minted on first use.
 *
 * Operations record which device produced them so a later merge can tell two
 * devices apart — and so a user can be told *where* a change came from. It is
 * deliberately not tied to any account: a local-only world never has one.
 *
 * Not a security boundary. It identifies a device to its own user, nothing more.
 */
export function getDeviceId(): string {
  if (cached) return cached
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) {
      cached = stored
      return stored
    }
    const fresh = generateId()
    localStorage.setItem(KEY, fresh)
    cached = fresh
    return fresh
  } catch {
    // Private mode / storage disabled: stay usable with a per-session id.
    cached ??= generateId()
    return cached
  }
}

/** Test seam — drops the memo so a fresh id is read from storage. */
export function resetDeviceIdCache() {
  cached = null
}
