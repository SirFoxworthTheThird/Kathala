import { describe, expect, it } from 'vitest'
import { adjacentScene, arrivalCaret, sceneShortcut, type ShortcutKey } from '../sceneStep'

const key = (k: string, mods: Partial<ShortcutKey> = {}): ShortcutKey =>
  ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods })

describe('sceneShortcut', () => {
  it('reads Ctrl or ⌘ with Alt and an arrow as a step', () => {
    expect(sceneShortcut(key('ArrowDown', { ctrlKey: true, altKey: true }))).toBe('next')
    expect(sceneShortcut(key('ArrowUp', { metaKey: true, altKey: true }))).toBe('previous')
  })

  it('reads Ctrl or ⌘ with Shift and Enter as a split, and nothing else with Shift', () => {
    expect(sceneShortcut(key('Enter', { ctrlKey: true, shiftKey: true }))).toBe('split')
    expect(sceneShortcut(key('Enter', { metaKey: true, shiftKey: true }))).toBe('split')
    expect(sceneShortcut(key('Enter', { shiftKey: true }))).toBeNull()                        // a line break
    expect(sceneShortcut(key('Enter', { ctrlKey: true, shiftKey: true, altKey: true }))).toBeNull()
  })

  it('reads Ctrl or ⌘ with Enter as a new scene', () => {
    expect(sceneShortcut(key('Enter', { ctrlKey: true }))).toBe('new')
    expect(sceneShortcut(key('Enter', { metaKey: true }))).toBe('new')
  })

  it('leaves the keys a text box already means alone', () => {
    expect(sceneShortcut(key('Enter'))).toBeNull()                                 // a paragraph
    expect(sceneShortcut(key('ArrowDown', { altKey: true }))).toBeNull()            // a Mac paragraph jump
    expect(sceneShortcut(key('ArrowDown', { ctrlKey: true }))).toBeNull()           // a Windows paragraph jump
    expect(sceneShortcut(key('ArrowDown', { ctrlKey: true, altKey: true, shiftKey: true }))).toBeNull()
    expect(sceneShortcut(key('Enter', { ctrlKey: true, altKey: true }))).toBeNull()
  })
})

describe('adjacentScene', () => {
  const chapters = [
    { id: 'c3', number: 3 },
    { id: 'c1', number: 1 },
    { id: 'c2', number: 2 },   // no scenes
  ]
  const scenes = [
    { id: 'b', chapterId: 'c1', sortOrder: 2 },
    { id: 'a', chapterId: 'c1', sortOrder: 1 },
    { id: 'c', chapterId: 'c3', sortOrder: 1 },
    { id: 'x', chapterId: 'elsewhere', sortOrder: 0 },
  ]

  it('steps within a chapter by the scene order', () => {
    expect(adjacentScene(chapters, scenes, 'a', 'next')?.id).toBe('b')
    expect(adjacentScene(chapters, scenes, 'b', 'previous')?.id).toBe('a')
  })

  it('crosses into the next chapter by number, passing over an empty one', () => {
    expect(adjacentScene(chapters, scenes, 'b', 'next')?.id).toBe('c')
    expect(adjacentScene(chapters, scenes, 'c', 'previous')?.id).toBe('b')
  })

  it('stops at either end of the book', () => {
    expect(adjacentScene(chapters, scenes, 'a', 'previous')).toBeNull()
    expect(adjacentScene(chapters, scenes, 'c', 'next')).toBeNull()
  })

  it('walks only the chapters it is given', () => {
    expect(adjacentScene(chapters, scenes, 'x', 'next')).toBeNull()
    // And so a reader's list, cut at what they have reached, ends there.
    expect(adjacentScene(chapters, scenes.filter((s) => s.id !== 'c'), 'b', 'next')).toBeNull()
  })
})

describe('arrivalCaret', () => {
  const text = '[@@Juno]\n\nShe counted the steps.'
  it('starts after the header line and the blank line under it', () => {
    expect(text.slice(arrivalCaret(text, 8, 'start'))).toBe('She counted the steps.')
  })
  it('starts at the top when there is no header', () => {
    expect(arrivalCaret('Plain prose.', null, 'start')).toBe(0)
  })
  it('ends at the end', () => {
    expect(arrivalCaret(text, 8, 'end')).toBe(text.length)
  })
})
