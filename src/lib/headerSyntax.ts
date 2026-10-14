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
      { example: '#The Kitchen (Scaur House)', says: 'which one, when places on two maps share the name' },
    ],
  },
  {
    label: 'Characters',
    rows: [
      { example: '@@Sabine Varro', says: 'in the scene' },
      { example: '@@Corwen Dask:dead', says: 'dies in this scene' },
      { example: '@@Jordan Kelly:dead elsewhere', says: 'died away from it; the scene tells of it' },
      { example: '@@Pell Okonjo:alive', says: 'comes back in this scene' },
      { example: '@@Edmund Varley:phone', says: 'in it from elsewhere — on the phone; :remote too' },
      { example: '@@Strider:called Aragorn', says: 'the book calls them Aragorn from here' },
      { example: '@@Edward Hyde:is Dr Henry Jekyll', says: 'revealed to be Jekyll here' },
    ],
  },
  {
    label: 'When',
    rows: [
      { example: '+3 days', says: 'three days after the scene before; +3d, +2 weeks' },
      { example: 'same day', says: 'the same day as the scene before' },
      { example: '16 October, 2025', says: 'on that date, in the book’s own months' },
      { example: 'Thursday 16 October', says: 'with its weekday checked; no year is the next one' },
      { example: '4 Harvest 19 BBY', says: 'the year in its era, where the calendar has eras' },
      { example: 'day 412', says: 'that day of the story’s clock, with no calendar' },
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
      { example: '?Dask is the Notary:@Sabine Varro:before', says: 'she knew it before the story began' },
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
  characters: ['dead', 'dead elsewhere', 'alive', 'phone', 'remote', 'called …', 'is …'],
  facts: ['reader', 'before (after a name)'],
  itemConditions: ['intact', 'damaged', 'destroyed', 'repaired', 'lost', 'found', 'unknown'],
  placeStatuses: ['active', 'occupied', 'sieged', 'abandoned', 'ruined', 'destroyed', 'rebuilt', 'unknown'],
} as const
