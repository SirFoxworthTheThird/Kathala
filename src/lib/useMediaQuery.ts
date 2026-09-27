import { useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, kept current as the window changes.
 *
 * For when something should not be *in the page* at a width, rather than be in
 * it and hidden. A CSS-hidden copy is invisible to a person and still there for
 * everything else: the Timeline's binder column, hidden on a phone by `hidden
 * lg:flex`, was the first match for a lookup that went on to find it hidden.
 *
 * False where `matchMedia` does not exist — jsdom, in the unit tests.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  )
}

/** Tailwind's `lg`, where the Timeline has room for a column beside the writing. */
export const WIDE = '(min-width: 1024px)'
