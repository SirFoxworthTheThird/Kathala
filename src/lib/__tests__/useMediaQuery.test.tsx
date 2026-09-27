import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMediaQuery, WIDE } from '../useMediaQuery'

// jsdom has no matchMedia, so a stand-in whose answer the test can change and
// announce, the way a window resize would.
function fakeMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  window.matchMedia = ((query: string) => ({
    get matches() { return matches },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia
  return {
    set(next: boolean) { matches = next; listeners.forEach((fn) => fn()) },
    listening: () => listeners.size,
  }
}

function Probe() {
  return <span>{useMediaQuery(WIDE) ? 'wide' : 'narrow'}</span>
}

describe('useMediaQuery', () => {
  const original = window.matchMedia
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    container.remove()
    window.matchMedia = original
  })

  it('answers the query and follows it when it changes', () => {
    const media = fakeMatchMedia(false)
    act(() => root.render(<Probe />))
    expect(container.textContent).toBe('narrow')

    act(() => media.set(true))
    expect(container.textContent).toBe('wide')

    act(() => media.set(false))
    expect(container.textContent).toBe('narrow')
    act(() => root.unmount())
  })

  it('stops listening when unmounted', () => {
    const media = fakeMatchMedia(true)
    act(() => root.render(<Probe />))
    expect(media.listening()).toBe(1)
    act(() => root.unmount())
    expect(media.listening()).toBe(0)
  })

  it('reads as narrow where there is no matchMedia', () => {
    // @ts-expect-error — removing it is the case under test
    delete window.matchMedia
    act(() => root.render(<Probe />))
    expect(container.textContent).toBe('narrow')
    act(() => root.unmount())
  })
})
