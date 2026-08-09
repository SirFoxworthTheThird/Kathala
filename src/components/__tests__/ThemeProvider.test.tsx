import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '../ThemeProvider'
import { useAppStore } from '@/store'

const THEME_CLASSES = [
  'theme-fantasy',
  'theme-scifi',
  'theme-cyberpunk',
  'theme-horror',
  'theme-western',
  'theme-action',
  'theme-noir',
  'theme-romance',
]

describe('ThemeProvider', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    document.documentElement.classList.remove(...THEME_CLASSES)
    useAppStore.setState({ theme: 'default', activeWorldTheme: null })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('applies the selected global theme', () => {
    act(() => root.render(<ThemeProvider><span>content</span></ThemeProvider>))

    act(() => useAppStore.getState().setTheme('fantasy'))

    expect(document.documentElement).toHaveClass('theme-fantasy')
  })

  it('uses a world override and restores the global theme when it clears', () => {
    useAppStore.setState({ theme: 'scifi' })
    act(() => root.render(<ThemeProvider><span>content</span></ThemeProvider>))

    act(() => useAppStore.getState().setActiveWorldTheme('theme-noir'))
    expect(document.documentElement).toHaveClass('theme-noir')
    expect(document.documentElement).not.toHaveClass('theme-scifi')

    act(() => useAppStore.getState().setActiveWorldTheme(null))
    expect(document.documentElement).toHaveClass('theme-scifi')
    expect(document.documentElement).not.toHaveClass('theme-noir')
  })
})
