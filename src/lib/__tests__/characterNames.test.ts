import { describe, it, expect } from 'vitest'
import { nameAt, aliasesAt, allNames, proseAliases, moveNameScenes, sceneAfterRemoval, renameNames, storedChanges, storedAliasesFrom, type Named } from '../characterNames'

/** Scenes in reading order: Bree (1.1), the reveal (1.2), Lothlórien (2.1), the end (3.1). */
const keys = new Map([['bree', 1.1], ['reveal', 1.2], ['lorien', 2.1], ['end', 3.1]])
const sortKeyOf = (id: string) => keys.get(id)

const aragorn: Named = {
  name: 'Aragorn',
  aliases: ['Strider', 'Elessar'],
  nameChanges: [{ eventId: 'reveal', name: 'Aragorn' }, { eventId: 'bree', name: 'Strider' }],
  aliasesFrom: [{ alias: 'Elessar', eventId: 'lorien' }],
}

describe('nameAt', () => {
  it('is the last change reached, in reading order, whatever order they were written in', () => {
    expect(nameAt(aragorn, 1.1, sortKeyOf)).toBe('Strider')
    expect(nameAt(aragorn, 1.2, sortKeyOf)).toBe('Aragorn')
    expect(nameAt(aragorn, 3.1, sortKeyOf)).toBe('Aragorn')
  })

  it('before the first change is the character’s own name', () => {
    expect(nameAt(aragorn, 1.0, sortKeyOf)).toBe('Aragorn')
    const gandalf: Named = { name: 'Gandalf', aliases: [], nameChanges: [{ eventId: 'lorien', name: 'Gandalf the White' }] }
    expect(nameAt(gandalf, 1.2, sortKeyOf)).toBe('Gandalf')
    expect(nameAt(gandalf, 2.1, sortKeyOf)).toBe('Gandalf the White')
  })

  it('is the whole book’s last name when the cursor is the whole book', () => {
    expect(nameAt(aragorn, null, sortKeyOf)).toBe('Aragorn')
  })

  it('holds back a change whose scene cannot be placed', () => {
    const lost: Named = { name: 'Aragorn', aliases: [], nameChanges: [{ eventId: 'gone', name: 'Strider' }] }
    expect(nameAt(lost, 3.1, sortKeyOf)).toBe('Aragorn')
    expect(nameAt(lost, null, sortKeyOf)).toBe('Aragorn')
  })

  it('a record with no changes is its own name', () => {
    expect(nameAt({ name: 'Sam', aliases: [] }, 1.1, sortKeyOf)).toBe('Sam')
  })
})

describe('aliasesAt', () => {
  it('at Bree: no Elessar, and never the reveal', () => {
    expect(aliasesAt(aragorn, 1.1, sortKeyOf)).toEqual([])
  })

  it('past the reveal: Strider, a name he has been called; Elessar once Lothlórien is reached', () => {
    expect(aliasesAt(aragorn, 1.2, sortKeyOf)).toEqual(['Strider'])
    expect(aliasesAt(aragorn, 2.1, sortKeyOf)).toEqual(['Strider', 'Elessar'])
  })

  it('an alias with no scene is known from the start; one with an unplaceable scene is held back', () => {
    const c: Named = { name: 'A', aliases: ['Always', 'Lost'], aliasesFrom: [{ alias: 'lost', eventId: 'gone' }] }
    expect(aliasesAt(c, 1.1, sortKeyOf)).toEqual(['Always'])
  })

  it('a name passed is kept even when it is not among the aliases, and never repeats the name in effect', () => {
    const gandalf: Named = { name: 'Gandalf', aliases: ['Mithrandir'], nameChanges: [
      { eventId: 'bree', name: 'Gandalf the Grey' }, { eventId: 'lorien', name: 'Gandalf the White' },
    ] }
    expect(aliasesAt(gandalf, 1.1, sortKeyOf)).toEqual(['Mithrandir'])
    expect(aliasesAt(gandalf, 2.1, sortKeyOf)).toEqual(['Mithrandir', 'Gandalf the Grey'])
  })
})

describe('allNames and proseAliases', () => {
  it('every name the character goes by anywhere, once', () => {
    expect(allNames(aragorn)).toEqual(['Aragorn', 'Strider', 'Elessar'])
    const gandalf: Named = { name: 'Gandalf', aliases: [], nameChanges: [{ eventId: 'lorien', name: 'Gandalf the White' }] }
    expect(allNames(gandalf)).toEqual(['Gandalf', 'Gandalf the White'])
    expect(proseAliases(gandalf)).toEqual(['Gandalf the White'])
  })
})

describe('moveNameScenes', () => {
  it('points what was at one scene at another', () => {
    expect(moveNameScenes(aragorn, 'bree', 'end')).toEqual({
      nameChanges: [{ eventId: 'reveal', name: 'Aragorn' }, { eventId: 'end', name: 'Strider' }],
      aliasesFrom: [{ alias: 'Elessar', eventId: 'lorien' }],
    })
    expect(moveNameScenes(aragorn, 'lorien', 'end')?.aliasesFrom).toEqual([{ alias: 'Elessar', eventId: 'end' }])
  })

  it('drops a change landing on a scene that has its own, and everything when there is nowhere', () => {
    expect(moveNameScenes(aragorn, 'bree', 'reveal')?.nameChanges).toEqual([{ eventId: 'reveal', name: 'Aragorn' }])
    expect(moveNameScenes(aragorn, 'lorien', null)?.aliasesFrom).toEqual([])
  })

  it('is nothing to write when nothing points at the scene', () => {
    expect(moveNameScenes(aragorn, 'end', 'bree')).toBeNull()
    expect(moveNameScenes({ name: 'Sam', aliases: [] }, 'bree', 'end')).toBeNull()
  })
})

describe('sceneAfterRemoval', () => {
  it('is the next scene in reading order not being removed', () => {
    expect(sceneAfterRemoval('reveal', new Set(['reveal']), keys)).toBe('lorien')
    expect(sceneAfterRemoval('reveal', new Set(['reveal', 'lorien']), keys)).toBe('end')
  })

  it('else the one before, else nowhere', () => {
    expect(sceneAfterRemoval('end', new Set(['end']), keys)).toBe('lorien')
    expect(sceneAfterRemoval('bree', new Set(keys.keys()), keys)).toBeNull()
  })

  it('nowhere for a scene that cannot be placed', () => {
    expect(sceneAfterRemoval('gone', new Set(['gone']), keys)).toBeNull()
  })
})

describe('renameNames', () => {
  it('renames an alias and the scene it is learned at together, and the changes', () => {
    const out = renameNames(aragorn, (n) => n.replace('Elessar', 'Envinyatar').replace('Strider', 'Longshanks'))
    expect(out.aliases).toEqual(['Longshanks', 'Envinyatar'])
    expect(out.aliasesFrom).toEqual([{ alias: 'Envinyatar', eventId: 'lorien' }])
    expect(out.nameChanges).toEqual([{ eventId: 'reveal', name: 'Aragorn' }, { eventId: 'bree', name: 'Longshanks' }])
    // Still learned in Lothlórien: not known at Bree.
    expect(aliasesAt({ name: 'Aragorn', ...out }, 1.1, sortKeyOf)).not.toContain('Envinyatar')
  })
})

describe('what the editor stores', () => {
  it('a change with a scene and a name; a half-filled row is not one', () => {
    expect(storedChanges([
      { key: '1', eventId: 'bree', name: ' Strider ' },
      { key: '2', eventId: null, name: 'Aragorn' },
      { key: '3', eventId: 'reveal', name: '  ' },
    ])).toEqual([{ eventId: 'bree', name: 'Strider' }])
  })

  it('a known-from only for an alias the character still has', () => {
    expect(storedAliasesFrom(['Strider', 'Elessar'], { Elessar: 'lorien', Thorongil: 'end' }))
      .toEqual([{ alias: 'Elessar', eventId: 'lorien' }])
  })
})
