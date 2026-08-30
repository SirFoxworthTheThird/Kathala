import { describe, it, expect } from 'vitest'
import { importCollision } from '@/lib/importCollision'

/**
 * The question the confirm is asking: does this file land on a world that is
 * already here? Getting it wrong in either direction is bad in a different way
 * — a false negative deletes a draft silently, a false positive puts a
 * "Replace?" dialog in front of every ordinary import.
 */

const locals = [
  { id: 'w-highbarrow', name: 'Highbarrow' },
  { id: 'w-salt', name: 'The Salt Road' },
]

const fileFor = (id: string, name = 'Highbarrow') => ({
  version: 1,
  world: { id, name },
  characters: [],
})

describe('importCollision', () => {
  it('reports the world that would be overwritten', () => {
    expect(importCollision(fileFor('w-highbarrow'), locals)).toEqual({
      worldId: 'w-highbarrow',
      localName: 'Highbarrow',
      incomingName: 'Highbarrow',
    })
  })

  it('reports nothing for a world that is not here yet', () => {
    expect(importCollision(fileFor('w-elsewhere'), locals)).toBeNull()
  })

  it('reports nothing when there is nothing here at all', () => {
    expect(importCollision(fileFor('w-highbarrow'), [])).toBeNull()
  })

  /*
    The names are allowed to disagree — the file carries the name the world had
    when it was exported. Identity is the id, and the dialog needs both names so
    it can say which local world it means.
  */
  it('keeps both names when the world was renamed after the export', () => {
    const renamed = importCollision(fileFor('w-salt', 'Salt Road'), locals)
    expect(renamed).toEqual({
      worldId: 'w-salt',
      localName: 'The Salt Road',
      incomingName: 'Salt Road',
    })
  })

  it('falls back to the local name when the file names nothing', () => {
    const nameless = importCollision({ world: { id: 'w-salt', name: '  ' } }, locals)
    expect(nameless?.incomingName).toBe('The Salt Road')
  })

  /*
    A file we cannot read a world id out of is not a collision: it is going to
    fail validation a moment later, and guessing here would put the dialog in
    front of an import that was never going to happen.
  */
  it.each([
    ['an images-only file', { type: 'images', images: [] }],
    ['a world that is not an object', { world: 'Highbarrow' }],
    ['a null world', { world: null }],
    ['a world with no id', { world: { name: 'Highbarrow' } }],
    ['a world with a non-string id', { world: { id: 7, name: 'Highbarrow' } }],
    ['not an object at all', 'nonsense'],
    ['null', null],
    ['undefined', undefined],
  ])('reports nothing for %s', (_label, payload) => {
    expect(importCollision(payload, locals)).toBeNull()
  })
})
