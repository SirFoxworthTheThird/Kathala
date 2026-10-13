import { describe, it, expect } from 'vitest'
import { formatSceneHeader, parseSceneHeader, splitSceneDraft, splitSceneHeader, sceneBody, planHeader, planIsClean, sceneFates, sceneItems, headerItems, sceneFacts, headerFacts, sceneRelations, headerRelations, scenePlaceStatus, sceneNames, headerNames } from '@/lib/sceneHeader'

/**
 * `[#The Kitchen @@Wren @@Sal'ka]` — where the scene happens and who is in it,
 * said in the act of writing rather than in a panel beside it.
 *
 * The header is rendered from the records and parsed back, never stored, so
 * these two functions are the whole seam. A round trip that loses a name loses
 * a character from somebody's book.
 */
describe('the scene header', () => {
  it('survives a round trip, names with spaces and all', () => {
    // 68% of the names in the shipped library are not one word, so this is the
    // ordinary case rather than the awkward one.
    const header = { place: 'The Kitchen', characters: ['Wren Halloway', "Sal'ka"] }
    expect(parseSceneHeader(formatSceneHeader(header))).toEqual(header)
  })

  it('renders nothing when there is nothing to say', () => {
    expect(formatSceneHeader({ place: null, characters: [] })).toBe('')
  })

  it('reads a place or a cast on their own', () => {
    expect(parseSceneHeader('[#The Kitchen]')).toEqual({ place: 'The Kitchen', characters: [] })
    expect(parseSceneHeader('[@@Wren]')).toEqual({ place: null, characters: ['Wren'] })
  })

  it('takes the first place and ignores a second', () => {
    // A scene happens in one place. Two is a writer mid-edit, not a claim.
    expect(parseSceneHeader('[#Kitchen #Hallway]').place).toBe('Kitchen')
  })

  it('does not record the same character twice', () => {
    expect(parseSceneHeader('[@@Wren @@Wren]').characters).toEqual(['Wren'])
  })

  it('reads a half-typed line as far as it goes', () => {
    // The normal state of a line somebody is typing. Returning nulls beats
    // throwing, and beats guessing at what the rest was going to say.
    expect(parseSceneHeader('[#Kit')).toEqual({ place: null, characters: [] })
    expect(parseSceneHeader('[#Kitchen @@]')).toEqual({ place: 'Kitchen', characters: [] })
  })
})

describe('telling a header from prose that starts with a bracket', () => {
  it('takes a complete first line', () => {
    const { header, body } = splitSceneHeader('[#Kitchen @@Wren]\nShe put the kettle on.')
    expect(header).toBe('[#Kitchen @@Wren]')
    expect(body).toBe('She put the kettle on.')
  })

  it('leaves prose alone, including prose in brackets', () => {
    /*
      The pair, and the half that matters: prose opens with a bracket often
      enough — a stage direction, an aside, an editorial note to self — and
      swallowing the first line of somebody's scene would be unforgivable.
    */
    /*
      This line used to assert the opposite — that `[she thought]` *is* a
      header — inside a test named for leaving prose alone. It was the leak,
      written down as intent: a bracket naming nobody and nowhere was read as
      a declaration, which emptied the scene and pushed the real line into the
      book.
    */
    expect(splitSceneHeader('[she thought]').header).toBeNull()
    expect(splitSceneHeader('[check: low water, or after it?]').header).toBeNull()
    // Shape is not enough; naming somebody is.
    expect(splitSceneHeader('[@@Wren]').header).toBe('[@@Wren]')
    expect(splitSceneHeader('[#Kitchen]').header).toBe('[#Kitchen]')
    expect(splitSceneHeader('[an unclosed thought\nand the next line').header).toBeNull()
    /*
      The one that matters, and the one my first version missed: a bracket
      opened on the first line and closed further down the scene. A header
      that may span newlines swallows everything between — a paragraph of
      somebody's book, silently, into a cast list.
    */
    expect(splitSceneHeader('[she thought, and did not say\nso the kettle sang] alone.').header).toBeNull()
    expect(splitSceneHeader('She put the kettle on.').header).toBeNull()
    expect(splitSceneHeader('She put the kettle on.\n[#Kitchen]').header).toBeNull()
  })

  it('strips the header for everything downstream', () => {
    /*
      What the manuscript, the exports, search and the word count all see —
      and the blank line that separated the header from the prose goes with
      it, so a scene does not compile with a stray leading newline.
    */
    expect(sceneBody('[#Kitchen @@Wren]\n\nShe put the kettle on.')).toBe('She put the kettle on.')
    expect(sceneBody('[#Kitchen]\nShe put the kettle on.')).toBe('She put the kettle on.')
    expect(sceneBody('She put the kettle on.')).toBe('She put the kettle on.')
  })
})

describe('the line the box was given', () => {
  const rendered = '[#Dogtooth Stair @@Teodora Vance @@Juno Skelling]'

  it('lifts the rendered line back out when a note is typed above it', () => {
    /*
      The whole H-1 loss, and the half `splitSceneHeader` cannot see on its
      own. A margin note above the line pushes it to row two, where a cold read
      has to call it prose — and it exported as prose, as a paragraph of
      somebody's book.

      Knowing what we rendered is what settles it: the note stays, as the prose
      it is, and the line stays the line.
    */
    const typed = `[check: low water?]\n${rendered}\n\nThe stair went down in eleven steps.`
    const { header, body } = splitSceneDraft(typed, rendered)
    expect(header).toBe(rendered)
    expect(body).toBe('[check: low water?]\n\nThe stair went down in eleven steps.')
    expect(body).not.toContain('@@')
  })

  it('lifts it out when the note is typed on the same line, with no newline', () => {
    const typed = `[check: low water?]${rendered}\n\nThe stair went down.`
    const { header, body } = splitSceneDraft(typed, rendered)
    expect(header).toBe(rendered)
    expect(body).toBe('[check: low water?]\nThe stair went down.')
  })

  it('reads the line normally when it is still the first thing in the box', () => {
    // The presence half: displacement is the exception, not the path.
    const { header, body } = splitSceneDraft(`${rendered}\n\nThe stair went down.`, rendered)
    expect(header).toBe(rendered)
    expect(body).toBe('The stair went down.')
  })

  it('is splitSceneHeader when the records say nothing', () => {
    /*
      A scene with no cast and no place renders no line, so a bracket in the box
      is the writer's own — which is exactly where a note-to-self goes, and
      exactly where the old reading emptied a scene that had nothing to empty
      and stored nothing of what was typed.
    */
    const { header, body } = splitSceneDraft('[check: who is in this room?]\n\nThe stair went down.', '')
    expect(header).toBeNull()
    expect(body).toBe('[check: who is in this room?]\n\nThe stair went down.')
  })

  it('keeps a bracketed note that is not the line, even when a line exists', () => {
    // Not every bracket is the rendered one, and the others are prose.
    const { header, body } = splitSceneDraft('[she thought]\n\nThe stair went down.', rendered)
    expect(header).toBeNull()
    expect(body).toBe('[she thought]\n\nThe stair went down.')
  })
})

describe('a single @ inside the brackets', () => {
  it('names a character, where it used to vanish into the place', () => {
    /*
      `[#Court @Sella]` read "Court" as the place — the name ran to the next
      sigil, and `@` was not one — and dropped Sella entirely. That is a silent
      no-op on the gesture the picker's own notice recommends.
    */
    expect(parseSceneHeader('[#The Salt Court @Sella]')).toEqual({
      place: 'The Salt Court', characters: ['Sella'],
    })
    // And the pair: two sigils are still one token, not an empty name and a real one.
    expect(parseSceneHeader('[#The Salt Court @@Sella]')).toEqual({
      place: 'The Salt Court', characters: ['Sella'],
    })
  })
})

describe('what a header line does to the scene', () => {
  const world = {
    characters: [
      { id: 'wren', name: 'Wren Halloway', aliases: ['Wren'] },
      { id: 'sal', name: "Sal'ka" },
    ],
    places: [{ id: 'kitchen', name: 'The Kitchen' }, { id: 'yard', name: 'The Yard' }],
  }
  const scene = { involved: ['sal'], mentioned: ['wren'], place: 'yard' }

  it('sets the cast and the setting it names, by name or alias, and takes the named off the mentioned list', () => {
    const plan = planHeader('[#the kitchen @@Wren]', world, scene)
    expect(plan.update).toEqual({ involvedCharacterIds: ['wren'], mentionedCharacterIds: [], remoteCharacterIds: [], locationMarkerId: 'kitchen' })
    expect(planIsClean(plan)).toBe(true)
  })

  it('answers to a name the character changes to, as well as their own and their aliases', () => {
    const named = {
      ...world,
      characters: [...world.characters, { id: 'gandalf', name: 'Gandalf', nameChanges: [{ eventId: 'e9', name: 'Gandalf the White' }] }],
    }
    expect(planHeader('[@@Gandalf the White]', named, scene).update?.involvedCharacterIds).toEqual(['gandalf'])
    // Paired: a name nobody goes by is still unknown.
    expect(planHeader('[@@Gandalf the Blue]', named, scene).unknown.names).toEqual(['Gandalf the Blue'])
    expect(planHeader('[@@Gandalf the Blue]', named, scene).unknown.people).toBeUndefined()
  })

  it('changes nothing when it says what the scene already holds', () => {
    expect(planHeader("[#The Yard @@Sal'ka]", world, scene).update).toBeNull()
  })

  it('no header is no change: deleting the line clears the screen, not the cast', () => {
    expect(planHeader(null, world, scene)).toEqual({ unknown: { names: [], place: null }, update: null, fates: [], items: { involvedItemIds: null, give: [], put: [], takeBack: [], unput: [], condition: [], uncondition: [] }, facts: { learn: [], unlearn: [], readerHere: [], readerOff: [], originHere: [], originOff: [] }, relations: { create: [], relabel: [], state: [], unstate: [] }, placeStatus: { set: null, unset: null }, identity: { rename: [], unrename: [], reveal: [], unreveal: [] } })
  })

  it('a name nothing answers leaves the cast alone and is named; a place nothing answers keeps the setting', () => {
    const plan = planHeader('[#The Kichen @@Wren @@Juno]', world, scene)
    expect(plan.unknown).toEqual({ names: ['Juno'], place: 'The Kichen' })
    expect(plan.update).toBeNull()
    expect(planIsClean(plan)).toBe(false)
  })

  it('a header with no place clears the setting', () => {
    expect(planHeader("[@@Sal'ka]", world, scene).update).toEqual({ involvedCharacterIds: ['sal'], mentionedCharacterIds: ['wren'], remoteCharacterIds: [], locationMarkerId: null })
  })
})

describe('the header as a block', () => {
  /*
    docs/records/scene-header-block-plan.md: one labelled line for each kind of
    record, and none for a kind the scene has not got. The labels are for the
    eye; the sigil says what a token is.
  */
  const block = "[\n  Place: #The Kitchen\n  Characters: @@Wren Halloway @@Sal'ka\n]"

  it('is drawn one labelled line per kind, and only the kinds there are', () => {
    expect(formatSceneHeader({ place: 'The Kitchen', characters: ['Wren Halloway', "Sal'ka"] })).toBe(block)
    expect(formatSceneHeader({ place: null, characters: ['Wren'] })).toBe('[\n  Characters: @@Wren\n]')
    expect(formatSceneHeader({ place: 'The Kitchen', characters: [] })).toBe('[\n  Place: #The Kitchen\n]')
  })

  it('reads back what it was drawn from, and the line form still reads the same', () => {
    expect(parseSceneHeader(block)).toEqual({ place: 'The Kitchen', characters: ['Wren Halloway', "Sal'ka"] })
    expect(parseSceneHeader("[#The Kitchen @@Wren Halloway @@Sal'ka]")).toEqual(parseSceneHeader(block))
  })

  it('reads a token by its sigil, whatever line it was typed on', () => {
    expect(parseSceneHeader('[\n  Characters: #The Kitchen @@Wren\n  Place: @@Sal\n]'))
      .toEqual({ place: 'The Kitchen', characters: ['Wren', 'Sal'] })
    // No label at all is a header's line too.
    expect(parseSceneHeader('[\n  #The Kitchen\n  @@Wren\n]')).toEqual({ place: 'The Kitchen', characters: ['Wren'] })
  })

  it('ends a name at the end of its line', () => {
    expect(parseSceneHeader('[\n  Place: #The Kitchen\n  @@Wren\n]').place).toBe('The Kitchen')
  })

  it('starts a token only at the start of a line or after a space', () => {
    // A sigil's character inside a name is part of the name.
    expect(parseSceneHeader('[@@Sal#ka @@Wren]').characters).toEqual(['Sal#ka', 'Wren'])
    // A token for a later kind of record ends the name before it, rather than joining it.
    expect(parseSceneHeader('[@@Wren ^Ash Ledger ?A secret ~Wren/Sal:friends]').characters).toEqual(['Wren'])
  })

  it('is split from the prose under it', () => {
    expect(splitSceneHeader(`${block}\n\nShe put the kettle on.`)).toEqual({ header: block, body: 'She put the kettle on.' })
    expect(sceneBody(`${block}\nShe put the kettle on.`)).toBe('She put the kettle on.')
  })

  it('is prose when a line between its brackets is prose, or it closes too far down, or names nobody', () => {
    /*
      The pair with the test above, and the reason for the rule: a bracket
      opened alone on the first line and closed further down would otherwise
      take every line between into a cast list.
    */
    expect(splitSceneHeader('[\nshe thought\n@@Wren\n]\nprose').header).toBeNull()
    expect(splitSceneHeader('[\n  Note: the light is wrong here\n]\nprose').header).toBeNull()
    expect(splitSceneHeader(`[\n${'  @@Wren\n'.repeat(13)}]\nprose`).header).toBeNull()
    expect(splitSceneHeader(`[\n${'  @@Wren\n'.repeat(12)}]\nprose`).header).not.toBeNull()
    expect(splitSceneHeader('[\n  Place:\n  Characters:\n]\nprose').header).toBeNull()
    expect(splitSceneHeader('[\n  Place: #The Kitchen\n\nShe put the kettle on.').header).toBeNull()
  })

  it('stays a header while a line added to it has only the start of its label (writer run 7, W7-1)', () => {
    for (const typed of ['P', 'Pla', 'Place', 'cha', 'Relation']) {
      expect(splitSceneHeader(`[\n${typed}\n  Characters: @@Alice Grey @@Bob Black \n]\n\nSnow.`).header, typed).not.toBeNull()
    }
    // The start of no label is still prose — the pair of the rule above.
    expect(splitSceneHeader('[\nPlaice\n  Characters: @@Alice Grey\n]\n\nSnow.').header).toBeNull()
    expect(splitSceneHeader('[\nshe thought\n@@Wren\n]\nprose').header).toBeNull()
  })

  it('is lifted back out when a note is typed above it', () => {
    const { header, body } = splitSceneDraft(`[check: low water?]\n${block}\n\nThe stair went down.`, block)
    expect(header).toBe(block)
    expect(body).toBe('[check: low water?]\n\nThe stair went down.')
  })

  it('does to the scene what the same line would', () => {
    const world = { characters: [{ id: 'wren', name: 'Wren Halloway' }, { id: 'sal', name: "Sal'ka" }], places: [{ id: 'kitchen', name: 'The Kitchen' }] }
    const scene = { involved: [], mentioned: [], place: null }
    expect(planHeader(block, world, scene)).toEqual(planHeader("[#The Kitchen @@Wren Halloway @@Sal'ka]", world, scene))
    expect(planHeader(block, world, scene).update).toEqual({ involvedCharacterIds: ['wren', 'sal'], mentionedCharacterIds: [], remoteCharacterIds: [], locationMarkerId: 'kitchen' })
  })
})

describe('a fate on the Characters line', () => {
  // docs/records/scene-header-block-plan.md, part 2: `@@Name:dead` and `@@Name:alive`.
  it('is read off the name, and drawn back on it', () => {
    const header = '[\n  Characters: @@Corwen Dask:dead @@Sabine Varro @@Pell:alive\n]'
    expect(parseSceneHeader(header)).toEqual({ place: null, characters: ['Corwen Dask', 'Sabine Varro', 'Pell'], dead: ['Corwen Dask'], alive: ['Pell'] })
    expect(formatSceneHeader(parseSceneHeader(header))).toBe(header)
    // Case and spaces round the colon are the writer's; the name is still the name.
    expect(parseSceneHeader('[@@Corwen Dask : DEAD]')).toEqual({ place: null, characters: ['Corwen Dask'], dead: ['Corwen Dask'] })
  })

  it('is only a fate when it is one of the two words: any other colon is part of the name', () => {
    expect(parseSceneHeader('[@@Ser Dask:the Elder]')).toEqual({ place: null, characters: ['Ser Dask:the Elder'] })
  })

  const world = { characters: [{ id: 'dask', name: 'Corwen Dask' }, { id: 'sab', name: 'Sabine Varro' }], places: [] }
  const scene = { involved: ['dask', 'sab'], mentioned: [], place: null }

  it('records a death or a return given, and changes no cast to do it', () => {
    const plan = planHeader('[@@Corwen Dask:dead @@Sabine Varro:alive]', world, scene)
    expect(plan.update).toBeNull()
    expect(plan.fates).toEqual([
      { characterId: 'dask', isAlive: false, revived: false },
      { characterId: 'sab', isAlive: true, revived: true },
    ])
  })

  it('records nothing for a fate the scene already draws, and sets back one taken off', () => {
    expect(planHeader('[@@Corwen Dask:dead @@Sabine Varro]', world, { ...scene, dead: ['dask'] }).fates).toEqual([])
    expect(planHeader('[@@Corwen Dask @@Sabine Varro]', world, { ...scene, dead: ['dask'], alive: ['sab'] }).fates).toEqual([
      { characterId: 'dask', isAlive: true, revived: false },
      { characterId: 'sab', isAlive: false, revived: false },
    ])
  })

  it('leaves the state of somebody taken off the header altogether: leaving the room is not living', () => {
    const plan = planHeader('[@@Sabine Varro]', world, { ...scene, dead: ['dask'] })
    expect(plan.update?.involvedCharacterIds).toEqual(['sab'])
    expect(plan.fates).toEqual([])
  })

  it('is drawn only where the state changes: dead here after alive, or no state, before', () => {
    const snaps = [
      { characterId: 'dask', eventId: 'e1', isAlive: true, sortKey: 1.000001 },
      { characterId: 'dask', eventId: 'e2', isAlive: false, sortKey: 2.000001 },
      { characterId: 'dask', eventId: 'e3', isAlive: false, sortKey: 3.000001 },
      { characterId: 'sab', eventId: 'e2', isAlive: false, sortKey: 2.000001 },
      { characterId: 'sab', eventId: 'e3', isAlive: true, revived: true, sortKey: 3.000001 },
    ]
    expect(sceneFates('e2', ['dask', 'sab'], snaps)).toEqual({ dead: ['dask', 'sab'], alive: [] })
    // Still dead a scene later is not a death there.
    expect(sceneFates('e3', ['dask', 'sab'], snaps)).toEqual({ dead: [], alive: ['sab'] })
    // Nobody out of the cast is drawn.
    expect(sceneFates('e2', ['sab'], snaps)).toEqual({ dead: ['sab'], alive: [] })
  })
})

describe('the Items line', () => {
  // docs/records/scene-header-block-plan.md, part 3.
  it('is read, item by item, with where each goes, and drawn back the same', () => {
    const header = "[\n  Items: ^Ash Ledger:@Sabine Varro ^Warden's Pistol:#The Drowned Chapel ^the vial\n]"
    expect(parseSceneHeader(header).items).toEqual([
      { name: 'Ash Ledger', holder: 'Sabine Varro' },
      { name: "Warden's Pistol", place: 'The Drowned Chapel' },
      { name: 'the vial' },
    ])
    expect(formatSceneHeader(parseSceneHeader(header))).toBe(header)
    // A line naming only items is a header.
    expect(splitSceneHeader(`${header}\n\nProse.`).header).toBe(header)
  })

  it('ends an item’s name at the next token, and does not split it at the @ or # that says where it goes', () => {
    expect(parseSceneHeader('[@@Sabine ^Ash Ledger:@Sabine @@Pell]')).toEqual({
      place: null, characters: ['Sabine', 'Pell'], items: [{ name: 'Ash Ledger', holder: 'Sabine' }],
    })
  })

  const world = {
    characters: [{ id: 'sab', name: 'Sabine Varro' }, { id: 'pell', name: 'Pell Okonjo' }],
    places: [{ id: 'chapel', name: 'The Drowned Chapel' }],
    items: [{ id: 'ledger', name: 'Ash Ledger' }, { id: 'pistol', name: "Warden's Pistol" }],
  }
  const scene = { involved: [], mentioned: [], place: null }
  const drawn = (over: Partial<{ involved: string[]; handoffs: { itemId: string; characterId: string }[]; placements: { itemId: string; placeId: string }[] }> = {}) =>
    ({ involved: [], handoffs: [], placements: [], ...over })

  it('puts every item named in the scene, and gives and puts down the ones with somewhere to go', () => {
    const plan = planHeader("[^Ash Ledger:@Sabine Varro ^Warden's Pistol:#The Drowned Chapel]", world, { ...scene, items: drawn() })
    expect(plan.items).toEqual({
      involvedItemIds: ['ledger', 'pistol'],
      give: [{ itemId: 'ledger', characterId: 'sab' }],
      put: [{ itemId: 'pistol', placeId: 'chapel' }],
      takeBack: [], unput: [], condition: [], uncondition: [],
    })
    // Case is the writer's: the item is the item.
    expect(planHeader('[^ash ledger]', world, { ...scene, items: drawn() }).items.involvedItemIds).toEqual(['ledger'])
  })

  it('writes nothing again for what the scene already draws, and takes back what is taken off', () => {
    const now = drawn({ involved: ['ledger', 'pistol'], handoffs: [{ itemId: 'ledger', characterId: 'sab' }], placements: [{ itemId: 'pistol', placeId: 'chapel' }] })
    expect(planHeader("[^Ash Ledger:@Sabine Varro ^Warden's Pistol:#The Drowned Chapel]", world, { ...scene, items: now }).items)
      .toEqual({ involvedItemIds: null, give: [], put: [], takeBack: [], unput: [], condition: [], uncondition: [] })
    expect(planHeader("[^Ash Ledger ^Warden's Pistol]", world, { ...scene, items: now }).items)
      .toEqual({ involvedItemIds: null, give: [], put: [], takeBack: [{ itemId: 'ledger', characterId: 'sab' }], unput: ['pistol'], condition: [], uncondition: [] })
    // Given to somebody else instead: taken back from one, given to the other.
    expect(planHeader("[^Ash Ledger:@Pell Okonjo ^Warden's Pistol:#The Drowned Chapel]", world, { ...scene, items: now }).items)
      .toMatchObject({ give: [{ itemId: 'ledger', characterId: 'pell' }], takeBack: [{ itemId: 'ledger', characterId: 'sab' }] })
  })

  it('a name nothing answers is said, and takes nothing back that it might be the typo of', () => {
    const now = drawn({ involved: ['ledger'], handoffs: [{ itemId: 'ledger', characterId: 'sab' }] })
    const plan = planHeader('[^Ash Ledgr:@Sabine Varro ^Warden\'s Pistol:@Pel]', world, { ...scene, items: now })
    // The item apart, as the note offers to make it; the person who is nobody, with the other names.
    expect(plan.unknown.items).toEqual(['Ash Ledgr'])
    expect(plan.unknown.names).toEqual(['Pel'])
    // Not offered to be made: a name after an item's colon is as likely a typo as a person (the Characters line has its picker).
    expect(plan.unknown.people).toBeUndefined()
    expect(plan.items).toEqual({ involvedItemIds: null, give: [], put: [], takeBack: [], unput: [], condition: [], uncondition: [] })
    expect(planIsClean(plan)).toBe(false)
  })

  it('an item nothing answers, alone on the line, still keeps the line — and once it exists, the line is clean', () => {
    const plan = planHeader('[^Brass Bell]', world, { ...scene, items: drawn() })
    expect(plan.unknown).toEqual({ names: [], place: null, items: ['Brass Bell'] })
    expect(plan.items.involvedItemIds).toBeNull()
    expect(planIsClean(plan)).toBe(false)
    // Named twice, offered once.
    expect(planHeader('[^Brass Bell ^brass bell:damaged]', world, { ...scene, items: drawn() }).unknown.items).toEqual(['Brass Bell'])
    const made = planHeader('[^Brass Bell]', { ...world, items: [...world.items, { id: 'bell', name: 'Brass Bell' }] }, { ...scene, items: drawn() })
    expect(made.unknown.items).toBeUndefined()
    expect(made.items.involvedItemIds).toEqual(['bell'])
    expect(planIsClean(made)).toBe(true)
  })

  it('draws a hand-off only where the item changes hands, and a placement where it is put down', () => {
    const states = [
      { characterId: 'sab', eventId: 'e1', inventoryItemIds: [], sortKey: 1.000001 },
      { characterId: 'sab', eventId: 'e2', inventoryItemIds: ['ledger'], sortKey: 2.000001 },
      { characterId: 'sab', eventId: 'e3', inventoryItemIds: ['ledger'], sortKey: 3.000001 },
    ]
    const placements = [{ itemId: 'pistol', eventId: 'e2', locationMarkerId: 'chapel' }]
    expect(sceneItems('e2', [], states, placements)).toEqual({
      involved: [], handoffs: [{ itemId: 'ledger', characterId: 'sab' }], placements: [{ itemId: 'pistol', placeId: 'chapel' }],
    })
    // Still held a scene later is not a hand-off there.
    expect(sceneItems('e3', [], states, placements)).toEqual({ involved: [], handoffs: [], placements: [] })
  })

  it('draws each item once, by name, with where it goes', () => {
    const names = { item: (id: string) => ({ ledger: 'Ash Ledger', pistol: "Warden's Pistol", vial: 'the vial' })[id], character: () => 'Sabine Varro', place: () => 'The Drowned Chapel' }
    expect(headerItems({ involved: ['vial', 'ledger'], handoffs: [{ itemId: 'ledger', characterId: 'sab' }], placements: [{ itemId: 'pistol', placeId: 'chapel' }] }, names)).toEqual([
      { name: 'the vial' },
      { name: 'Ash Ledger', holder: 'Sabine Varro' },
      { name: "Warden's Pistol", place: 'The Drowned Chapel' },
    ])
  })

  it('reads a condition after an item, alone or before where it goes, and draws it back the same', () => {
    const header = "[\n  Items: ^Ash Ledger:damaged ^Warden's Pistol:destroyed:#The Drowned Chapel ^the vial:lost:@Sabine Varro\n]"
    expect(parseSceneHeader(header).items).toEqual([
      { name: 'Ash Ledger', condition: 'damaged' },
      { name: "Warden's Pistol", condition: 'destroyed', place: 'The Drowned Chapel' },
      { name: 'the vial', condition: 'lost', holder: 'Sabine Varro' },
    ])
    expect(formatSceneHeader(parseSceneHeader(header))).toBe(header)
    // Written after where it goes, it means the same, and is drawn before it.
    expect(parseSceneHeader('[^Ash Ledger:@Sabine Varro:Damaged]').items).toEqual([{ name: 'Ash Ledger', condition: 'damaged', holder: 'Sabine Varro' }])
  })

  it('counts only the conditions the app records: any other colon is part of the name', () => {
    expect(parseSceneHeader('[^Letter: to the Abbess ^Ash Ledger:charred]').items).toEqual([
      { name: 'Letter: to the Abbess' },
      { name: 'Ash Ledger:charred' },
    ])
  })

  it('records a condition here, writes nothing again for the one drawn, and takes back one taken off', () => {
    const named = planHeader('[^Ash Ledger:damaged ^Warden\'s Pistol]', world, { ...scene, items: drawn() })
    expect(named.items).toMatchObject({ involvedItemIds: ['ledger', 'pistol'], condition: [{ itemId: 'ledger', condition: 'damaged' }], uncondition: [] })
    const now = { ...drawn({ involved: ['ledger'] }), conditions: [{ itemId: 'ledger', condition: 'damaged' as const }] }
    expect(planHeader('[^Ash Ledger:damaged]', world, { ...scene, items: now }).items).toMatchObject({ condition: [], uncondition: [] })
    expect(planHeader('[^Ash Ledger]', world, { ...scene, items: now }).items).toMatchObject({ condition: [], uncondition: ['ledger'] })
    // Another condition here replaces it, without taking it back first.
    expect(planHeader('[^Ash Ledger:destroyed]', world, { ...scene, items: now }).items)
      .toMatchObject({ condition: [{ itemId: 'ledger', condition: 'destroyed' }], uncondition: [] })
    // A line with something nothing answers takes nothing back.
    expect(planHeader('[^Ash Ledgr]', world, { ...scene, items: now }).items).toMatchObject({ uncondition: [] })
  })

  it('draws a condition only at the scene it changes, and not for a state that carries it on', () => {
    const itemStates = [
      { itemId: 'ledger', eventId: 'e1', condition: 'intact', sortKey: 1.000001 },
      { itemId: 'ledger', eventId: 'e2', condition: 'damaged', sortKey: 2.000001 },
      { itemId: 'ledger', eventId: 'e3', condition: 'damaged', sortKey: 3.000001 },
    ]
    expect(sceneItems('e1', [], [], [], itemStates).conditions).toEqual([{ itemId: 'ledger', condition: 'intact' }])
    expect(sceneItems('e2', [], [], [], itemStates).conditions).toEqual([{ itemId: 'ledger', condition: 'damaged' }])
    expect(sceneItems('e3', [], [], [], itemStates).conditions).toBeUndefined()
    // A condition the header has no word for is not drawn: the line could not say it.
    expect(sceneItems('e1', [], [], [], [{ itemId: 'ledger', eventId: 'e1', condition: 'broken', sortKey: 1 }]).conditions).toBeUndefined()
    const names = { item: () => 'Ash Ledger', character: () => 'Sabine Varro', place: () => undefined }
    expect(headerItems({ ...sceneItems('e2', [], [], [], itemStates) }, names)).toEqual([{ name: 'Ash Ledger', condition: 'damaged' }])
  })
})

describe('the Facts line', () => {
  // docs/records/scene-header-block-plan.md, part 4.
  it('is read fact by fact, with who learns each, and drawn back the same', () => {
    const header = '[\n  Facts: ?The vial is a witness-draught ?Dask is the Grey Notary:@Sabine Varro ?Dask is the Grey Notary:reader\n]'
    expect(parseSceneHeader(header).facts).toEqual([
      { title: 'The vial is a witness-draught' },
      { title: 'Dask is the Grey Notary', learner: 'Sabine Varro' },
      { title: 'Dask is the Grey Notary', reader: true },
    ])
    expect(formatSceneHeader(parseSceneHeader(header))).toBe(header)
    expect(splitSceneHeader(`${header}\n\nProse.`).header).toBe(header)
  })

  it('keeps a question mark that ends a title as part of it, and a colon that is not a learner', () => {
    expect(parseSceneHeader('[?Who killed Varro?:@Sabine ?Dask: the Notary]').facts).toEqual([
      { title: 'Who killed Varro?', learner: 'Sabine' },
      { title: 'Dask: the Notary' },
    ])
  })

  const world = {
    characters: [{ id: 'sab', name: 'Sabine Varro' }, { id: 'pell', name: 'Pell Okonjo' }],
    places: [],
    facts: [{ id: 'notary', title: 'Dask is the Grey Notary' }, { id: 'vial', title: 'The vial is a witness-draught' }],
  }
  const scene = { involved: [], mentioned: [], place: null }
  const none = { learned: [], reader: [], origin: [] }

  it('makes a reveal for each learner, and marks what the reader learns and what becomes true here', () => {
    expect(planHeader('[?Dask is the Grey Notary:@Sabine Varro ?Dask is the Grey Notary:@Pell Okonjo ?Dask is the Grey Notary:reader ?The vial is a witness-draught]', world, { ...scene, facts: none }).facts).toEqual({
      learn: [{ factId: 'notary', characterId: 'sab' }, { factId: 'notary', characterId: 'pell' }],
      unlearn: [], readerHere: ['notary'], readerOff: [], originHere: ['vial'], originOff: [],
    })
  })

  it('writes nothing again for what the scene draws, and takes back what is taken off', () => {
    const now = { learned: [{ factId: 'notary', characterId: 'sab' }], reader: ['notary'], origin: ['vial'] }
    expect(planHeader('[?Dask is the Grey Notary:@Sabine Varro ?Dask is the Grey Notary:reader ?The vial is a witness-draught]', world, { ...scene, facts: now }).facts)
      .toEqual({ learn: [], unlearn: [], readerHere: [], readerOff: [], originHere: [], originOff: [] })
    expect(planHeader('[@@Pell Okonjo]', world, { ...scene, facts: now }).facts)
      .toEqual({ learn: [], unlearn: [{ factId: 'notary', characterId: 'sab' }], readerHere: [], readerOff: ['notary'], originHere: [], originOff: ['vial'] })
  })

  it('offers a title nothing answers to be made, says it, and takes nothing back meanwhile', () => {
    const now = { learned: [{ factId: 'notary', characterId: 'sab' }], reader: [], origin: [] }
    const plan = planHeader('[?The ledger is forged:@Sabine Varro]', world, { ...scene, facts: now })
    expect(plan.unknown.facts).toEqual(['The ledger is forged'])
    expect(plan.facts.unlearn).toEqual([])
    expect(planIsClean(plan)).toBe(false)
  })

  it('a learner nobody answers to is offered to be made, as on the Relationships line (W5-8)', () => {
    const plan = planHeader('[?Dask is the Grey Notary:@Lydia Marrick ?The vial is a witness-draught:@Lydia Marrick]', world, { ...scene, facts: none })
    expect(plan.unknown.names).toContain('Lydia Marrick')
    // Offered once, however many lines name her.
    expect(plan.unknown.people).toEqual(['Lydia Marrick'])
    expect(planIsClean(plan)).toBe(false)
  })

  it('does not draw a reveal known before the story on the first scene, so a line without it takes nothing back (writer run 6, F4)', () => {
    const facts = [{ id: 'notary', readerLearnsAtEventId: null, originEventId: null }]
    const before = [{ factId: 'notary', characterId: 'pell', eventId: 'e1', beforeStory: true }]
    expect(sceneFacts('e1', before, facts).learned).toEqual([])
    expect(planHeader('[@@Sabine Varro]', world, { ...scene, facts: sceneFacts('e1', before, facts) }).facts.unlearn).toEqual([])
    // Learned at the first scene, it is drawn there, and a line without it takes it back.
    const learned = [{ factId: 'notary', characterId: 'pell', eventId: 'e1' }]
    expect(sceneFacts('e1', learned, facts).learned).toEqual([{ factId: 'notary', characterId: 'pell' }])
    expect(planHeader('[@@Sabine Varro]', world, { ...scene, facts: sceneFacts('e1', learned, facts) }).facts.unlearn).toEqual([{ factId: 'notary', characterId: 'pell' }])
  })

  it('draws what the records say of this scene, and nothing of another', () => {
    const reveals = [{ factId: 'notary', characterId: 'sab', eventId: 'e2' }, { factId: 'notary', characterId: 'pell', eventId: 'e3' }]
    const facts = [{ id: 'notary', readerLearnsAtEventId: 'e2', originEventId: null }, { id: 'vial', readerLearnsAtEventId: null, originEventId: 'e2' }]
    const drawn = sceneFacts('e2', reveals, facts)
    expect(drawn).toEqual({ learned: [{ factId: 'notary', characterId: 'sab' }], reader: ['notary'], origin: ['vial'] })
    expect(sceneFacts('e1', reveals, facts)).toEqual({ learned: [], reader: [], origin: [] })
    expect(headerFacts(drawn, { fact: (id) => ({ notary: 'Dask is the Grey Notary', vial: 'The vial is a witness-draught' })[id], character: () => 'Sabine Varro' })).toEqual([
      { title: 'The vial is a witness-draught' },
      { title: 'Dask is the Grey Notary', learner: 'Sabine Varro' },
      { title: 'Dask is the Grey Notary', reader: true },
    ])
  })
})

describe('the Relationships line', () => {
  // docs/records/scene-header-block-plan.md, part 5.
  it('is read pair by pair, with how they stand, and drawn back the same', () => {
    const header = '[\n  Relationships: ~Sabine Varro/Idris Quell:Estranged partners ~Pell Okonjo/Sabine Varro:ended\n]'
    expect(parseSceneHeader(header).relations).toEqual([
      { a: 'Sabine Varro', b: 'Idris Quell', label: 'Estranged partners' },
      { a: 'Pell Okonjo', b: 'Sabine Varro', label: '', ended: true },
    ])
    expect(formatSceneHeader(parseSceneHeader(header))).toBe(header)
    // One per pair, either way round.
    expect(parseSceneHeader('[~A B/C D:friends ~C D/A B:rivals]').relations).toEqual([{ a: 'A B', b: 'C D', label: 'friends' }])
  })

  const world = {
    characters: [{ id: 'sab', name: 'Sabine Varro' }, { id: 'idris', name: 'Idris Quell' }, { id: 'pell', name: 'Pell Okonjo' }],
    places: [],
    relationships: [{ id: 'r-si', characterAId: 'sab', characterBId: 'idris' }],
  }
  const scene = { involved: [], mentioned: [], place: null }

  it('makes a relationship for two people who have none, and records a state for two who have one', () => {
    expect(planHeader('[~Pell Okonjo/Sabine Varro:Debt ~Idris Quell/Sabine Varro:Estranged]', world, { ...scene, relations: [] }).relations).toEqual({
      create: [{ characterAId: 'pell', characterBId: 'sab', label: 'Debt' }],
      relabel: [],
      state: [{ relationshipId: 'r-si', label: 'Estranged', isActive: true }],
      unstate: [],
    })
    // Ending one that never began makes nothing.
    expect(planHeader('[~Pell Okonjo/Sabine Varro:ended]', world, { ...scene, relations: [] }).relations.create).toEqual([])
  })

  it('relabels one that starts here, writes nothing for what is drawn, and takes back a state taken off — but not a start', () => {
    const startsHere = [{ relationshipId: 'r-si', label: 'Partners', ended: false, startsHere: true }]
    expect(planHeader('[~Sabine Varro/Idris Quell:Partners]', world, { ...scene, relations: startsHere }).relations)
      .toEqual({ create: [], relabel: [], state: [], unstate: [] })
    expect(planHeader('[~Sabine Varro/Idris Quell:Lovers]', world, { ...scene, relations: startsHere }).relations.relabel)
      .toEqual([{ relationshipId: 'r-si', label: 'Lovers' }])
    expect(planHeader('[@@Pell Okonjo]', world, { ...scene, relations: startsHere }).relations.unstate).toEqual([])
    const stateHere = [{ relationshipId: 'r-si', label: 'Estranged', ended: false, startsHere: false }]
    expect(planHeader('[@@Pell Okonjo]', world, { ...scene, relations: stateHere }).relations.unstate).toEqual(['r-si'])
    expect(planHeader('[~Sabine Varro/Idris Quell:ended]', world, { ...scene, relations: stateHere }).relations.state)
      .toEqual([{ relationshipId: 'r-si', label: '', isActive: false }])
    // Once written, an ending is drawn with the label it kept, and `:ended` is that same line: nothing to write again.
    const endedHere = [{ relationshipId: 'r-si', label: 'Estranged', ended: true, startsHere: false }]
    expect(planHeader('[~Sabine Varro/Idris Quell:ended]', world, { ...scene, relations: endedHere }).relations)
      .toEqual({ create: [], relabel: [], state: [], unstate: [] })
    // A label in place of the ending is a change, and is written.
    expect(planHeader('[~Sabine Varro/Idris Quell:Estranged]', world, { ...scene, relations: endedHere }).relations.state)
      .toEqual([{ relationshipId: 'r-si', label: 'Estranged', isActive: true }])
  })

  it('a name nothing answers is said, and takes nothing back', () => {
    const stateHere = [{ relationshipId: 'r-si', label: 'Estranged', ended: false, startsHere: false }]
    const plan = planHeader('[~Sabine Varro/Idris Quel:Estranged]', world, { ...scene, relations: stateHere })
    expect(plan.unknown.names).toEqual(['Idris Quel'])
    // A Relationships line holds only people: the note may offer to make one (W5-8).
    expect(plan.unknown.people).toEqual(['Idris Quel'])
    expect(plan.relations).toEqual({ create: [], relabel: [], state: [], unstate: [] })
  })

  it('draws a relationship where it starts, or its state where one is recorded, and nowhere else', () => {
    const rels = [{ id: 'r-si', label: 'Partners', startEventId: 'e1', characterAId: 'sab', characterBId: 'idris' }]
    const states = [{ relationshipId: 'r-si', eventId: 'e3', label: '', isActive: false }]
    expect(sceneRelations('e1', rels, states)).toEqual([{ relationshipId: 'r-si', label: 'Partners', ended: false, startsHere: true }])
    expect(sceneRelations('e2', rels, states)).toEqual([])
    const ended = sceneRelations('e3', rels, states)
    expect(headerRelations(ended, rels, (id) => ({ sab: 'Sabine Varro', idris: 'Idris Quell' })[id])).toEqual([{ a: 'Sabine Varro', b: 'Idris Quell', label: '', ended: true }])
  })
})

describe('a place’s status on the Place line', () => {
  it('is read after the place, drawn back the same, and only a status the app records counts', () => {
    const header = '[\n  Place: #The Drowned Chapel:ruined\n  Characters: @@Sabine Varro\n]'
    expect(parseSceneHeader(header)).toMatchObject({ place: 'The Drowned Chapel', placeStatus: 'ruined' })
    expect(formatSceneHeader(parseSceneHeader(header))).toBe(header)
    expect(parseSceneHeader('[#The Quay:Sieged]')).toMatchObject({ place: 'The Quay', placeStatus: 'sieged' })
    // Any other colon is part of the place's name.
    expect(parseSceneHeader('[#Gate: the North]')).toEqual({ place: 'Gate: the North', characters: [] })
    // Said of the scene's place, the first: a status after a second place is not the first one's.
    expect(parseSceneHeader('[#The Quay #The Drowned Chapel:ruined]')).toEqual({ place: 'The Quay', characters: [] })
    expect(parseSceneHeader('[#The Quay:sieged #The Drowned Chapel]')).toEqual({ place: 'The Quay', placeStatus: 'sieged', characters: [] })
  })

  const world = { characters: [], places: [{ id: 'chapel', name: 'The Drowned Chapel' }, { id: 'quay', name: 'The Quay' }] }
  const scene = { involved: [], mentioned: [], place: 'chapel' }

  it('records the status here, nothing again for the one drawn, and takes back one taken off', () => {
    expect(planHeader('[#The Drowned Chapel:ruined]', world, scene).placeStatus).toEqual({ set: { placeId: 'chapel', status: 'ruined' }, unset: null })
    const drawn = { ...scene, placeStatus: 'ruined' as const }
    expect(planHeader('[#The Drowned Chapel:ruined]', world, drawn).placeStatus).toEqual({ set: null, unset: null })
    expect(planHeader('[#The Drowned Chapel]', world, drawn).placeStatus).toEqual({ set: null, unset: 'chapel' })
    // Another status replaces it here, without taking it back first.
    expect(planHeader('[#The Drowned Chapel:abandoned]', world, drawn).placeStatus).toEqual({ set: { placeId: 'chapel', status: 'abandoned' }, unset: null })
  })

  it('a different place takes back what was said of the old one; a place nothing answers changes nothing', () => {
    const drawn = { ...scene, placeStatus: 'ruined' as const }
    expect(planHeader('[#The Quay:sieged]', world, drawn).placeStatus).toEqual({ set: { placeId: 'quay', status: 'sieged' }, unset: 'chapel' })
    expect(planHeader('[#The Quay]', world, drawn).placeStatus).toEqual({ set: null, unset: 'chapel' })
    expect(planHeader('[#The Qauy:sieged]', world, drawn).placeStatus).toEqual({ set: null, unset: null })
  })

  it('draws a status only at the scene it changes, and only for the scene’s place', () => {
    const states = [
      { locationMarkerId: 'chapel', eventId: 'e1', status: 'active', sortKey: 1.000001 },
      { locationMarkerId: 'chapel', eventId: 'e2', status: 'ruined', sortKey: 1.000002 },
      { locationMarkerId: 'chapel', eventId: 'e3', status: 'ruined', sortKey: 1.000003 },
      { locationMarkerId: 'quay', eventId: 'e2', status: 'sieged', sortKey: 1.000002 },
    ]
    expect(scenePlaceStatus('e1', 'chapel', states)).toBe('active')
    expect(scenePlaceStatus('e2', 'chapel', states)).toBe('ruined')
    expect(scenePlaceStatus('e3', 'chapel', states)).toBeNull()
    expect(scenePlaceStatus('e2', null, states)).toBeNull()
    // A status the line has no word for is not drawn.
    expect(scenePlaceStatus('e1', 'chapel', [{ locationMarkerId: 'chapel', eventId: 'e1', status: 'haunted', sortKey: 1 }])).toBeNull()
  })
})

describe('a name, or a reveal, on the Characters line', () => {
  it('reads :called and :is after a name, and draws them back the same', () => {
    const header = '[\n  Characters: @@Strider:called Aragorn @@Edward Hyde:is Dr Henry Jekyll @@Pell\n]'
    expect(parseSceneHeader(header)).toMatchObject({
      characters: ['Strider', 'Edward Hyde', 'Pell'],
      called: [{ name: 'Strider', as: 'Aragorn' }],
      reveals: [{ name: 'Edward Hyde', as: 'Dr Henry Jekyll' }],
    })
    expect(formatSceneHeader(parseSceneHeader(header))).toBe(header)
    // Only those words: any other colon is part of the name.
    expect(parseSceneHeader('[@@Gate: the North]').characters).toEqual(['Gate: the North'])
  })

  const world = {
    characters: [
      { id: 'ara', name: 'Aragorn', aliases: ['Strider'] },
      { id: 'hyde', name: 'Edward Hyde' },
      { id: 'jek', name: 'Dr Henry Jekyll' },
      { id: 'utt', name: 'Gabriel Utterson', revealedAs: { characterId: 'jek', eventId: 'e9' } },
    ],
    places: [],
  }
  const scene = { involved: ['ara', 'hyde'], mentioned: [], place: null }

  it('records the name from here and the reveal here, nothing again for what is drawn, and takes back what is taken off', () => {
    expect(planHeader('[@@Strider:called Aragorn @@Edward Hyde:is Dr Henry Jekyll]', world, scene).identity).toEqual({
      rename: [{ characterId: 'ara', name: 'Aragorn' }], unrename: [], reveal: [{ characterId: 'hyde', asId: 'jek' }], unreveal: [],
    })
    const drawn = { ...scene, names: { called: [{ characterId: 'ara', name: 'Aragorn' }], revealed: [{ characterId: 'hyde', asId: 'jek' }] } }
    expect(planHeader('[@@Strider:called Aragorn @@Edward Hyde:is Dr Henry Jekyll]', world, drawn).identity)
      .toEqual({ rename: [], unrename: [], reveal: [], unreveal: [] })
    expect(planHeader('[@@Strider @@Edward Hyde]', world, drawn).identity)
      .toEqual({ rename: [], unrename: ['ara'], reveal: [], unreveal: ['hyde'] })
    // Taken off the line altogether: they leave the scene, and what was recorded of their name stays.
    expect(planHeader('[@@Strider]', world, drawn).identity).toEqual({ rename: [], unrename: ['ara'], reveal: [], unreveal: [] })
  })

  it('a reveal the rules forbid is refused and said, and the line is not clean; one nobody answers is unknown', () => {
    const self = planHeader('[@@Edward Hyde:is Edward Hyde]', world, scene)
    expect(self.identity.reveal).toEqual([])
    expect(self.unknown.refused).toEqual(['Edward Hyde cannot be revealed to be themself.'])
    expect(planIsClean(self)).toBe(false)
    // Utterson is revealed as Jekyll already, so nobody can be revealed as Utterson; Jekyll has Utterson revealed as him.
    expect(planHeader('[@@Edward Hyde:is Gabriel Utterson]', world, scene).unknown.refused)
      .toEqual(['Edward Hyde cannot be revealed to be Gabriel Utterson, who is revealed to be somebody else.'])
    expect(planHeader('[@@Dr Henry Jekyll:is Edward Hyde]', world, { ...scene, involved: ['jek'] }).unknown.refused)
      .toEqual(['Dr Henry Jekyll cannot be revealed to be anyone: others are revealed to be Dr Henry Jekyll.'])
    const nobody = planHeader('[@@Edward Hyde:is Mr Seek]', world, scene)
    expect(nobody.unknown.names).toEqual(['Mr Seek'])
    expect(nobody.identity.reveal).toEqual([])
  })

  it('draws a name change and a reveal at the scene they are recorded at, and for the cast only', () => {
    const people = [
      { id: 'ara', nameChanges: [{ eventId: 'e1', name: 'Strider' }, { eventId: 'e5', name: 'Aragorn' }] },
      { id: 'hyde', revealedAs: { characterId: 'jek', eventId: 'e5' } },
      { id: 'jek' },
    ]
    expect(sceneNames('e5', people)).toEqual({ called: [{ characterId: 'ara', name: 'Aragorn' }], revealed: [{ characterId: 'hyde', asId: 'jek' }] })
    expect(sceneNames('e2', people)).toEqual({ called: [], revealed: [] })
    const nameOf = (id: string) => ({ ara: 'Aragorn', hyde: 'Edward Hyde', jek: 'Dr Henry Jekyll' })[id]
    expect(headerNames(sceneNames('e5', people), ['ara', 'hyde'], nameOf)).toEqual({
      called: [{ name: 'Aragorn', as: 'Aragorn' }], reveals: [{ name: 'Edward Hyde', as: 'Dr Henry Jekyll' }],
    })
    expect(headerNames(sceneNames('e5', people), ['jek'], nameOf)).toEqual({ called: [], reveals: [] })
  })
})
