/**
 * What a scene's header can say, line by line: the cheat sheet beside the
 * editor (`HeaderCheatSheet`). The header grew a line at a time — place and
 * cast, then fates, items, facts, relationships, conditions, statuses, names
 * and reveals — and only the guide said all of it, while the hint under the
 * box named two sigils.
 *
 * Every example here is parsed by `headerSyntax.test.ts` and checked against
 * what its row says it records, so the sheet cannot drift from the parser.
 */
export interface HeaderSyntaxRow {
  /** As typed on the line, without the label: `#The Drowned Chapel:ruined`. */
  example: string
  /** What it records, in a few words. */
  says: string
}

export interface HeaderSyntaxLine {
  /** The line's label, as the block draws it. */
  label: string
  rows: HeaderSyntaxRow[]
}

export const HEADER_SYNTAX: HeaderSyntaxLine[] = [
  {
    label: 'Place',
    rows: [
      { example: '#The Drowned Chapel', says: 'where the scene happens; the cast is recorded there' },
      { example: '#The Drowned Chapel:ruined', says: 'and the place’s status from this scene' },
    ],
  },
  {
    label: 'Characters',
    rows: [
      { example: '@@Sabine Varro', says: 'in the scene' },
      { example: '@@Corwen Dask:dead', says: 'dies in this scene' },
      { example: '@@Pell Okonjo:alive', says: 'comes back in this scene' },
      { example: '@@Strider:called Aragorn', says: 'the book calls them Aragorn from here' },
      { example: '@@Edward Hyde:is Dr Henry Jekyll', says: 'revealed to be Jekyll here' },
    ],
  },
  {
    label: 'Items',
    rows: [
      { example: '^Ash Ledger', says: 'in the scene' },
      { example: '^Ash Ledger:@Sabine Varro', says: 'hers from this scene' },
      { example: '^Ash Ledger:#The Drowned Chapel', says: 'put down there in this scene' },
      { example: '^Ash Ledger:damaged', says: 'its condition from this scene' },
    ],
  },
  {
    label: 'Facts',
    rows: [
      { example: '?Dask is the Notary:@Sabine Varro', says: 'Sabine learns it here' },
      { example: '?Dask is the Notary:reader', says: 'the reader learns it here' },
      { example: '?Dask is the Notary', says: 'it becomes true here' },
    ],
  },
  {
    label: 'Relationships',
    rows: [
      { example: '~Sabine Varro/Idris Quell:Estranged', says: 'what they are to each other from here' },
      { example: '~Sabine Varro/Idris Quell:ended', says: 'it is over from here' },
    ],
  },
]

/** The words a colon after a token can carry; any other colon is part of the name. */
export const HEADER_WORDS = {
  characters: ['dead', 'alive', 'called …', 'is …'],
  itemConditions: ['intact', 'damaged', 'destroyed', 'repaired', 'lost', 'found', 'unknown'],
  placeStatuses: ['active', 'occupied', 'sieged', 'abandoned', 'ruined', 'destroyed', 'rebuilt', 'unknown'],
} as const
