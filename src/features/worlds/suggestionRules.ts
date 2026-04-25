export interface WorldSummaryData {
  characterCount: number
  eventCount: number
  hasCharacterAtAnyEvent: boolean
  relationshipCount: number
  mapLayerCount: number
  lorePageCount: number
  factionCount: number
}

export interface SuggestionRule {
  id: string
  title: string
  dismissible: boolean
  condition: (d: WorldSummaryData) => boolean
  navigateTo: string
  navLabel: string
}

export const SUGGESTION_RULES: SuggestionRule[] = [
  { id: 'add-character',     title: 'Add your first character',               dismissible: false, condition: (d) => d.characterCount === 0,                                        navigateTo: 'characters',    navLabel: 'Go to Characters' },
  { id: 'add-first-event',   title: 'Add your first event',                   dismissible: false, condition: (d) => d.characterCount > 0 && d.eventCount === 0,                   navigateTo: 'timeline',      navLabel: 'Go to Timeline'   },
  { id: 'place-character',   title: 'Place a character on the timeline',      dismissible: false, condition: (d) => d.eventCount > 0 && !d.hasCharacterAtAnyEvent,                 navigateTo: 'timeline',      navLabel: 'Go to Timeline'   },
  { id: 'add-relationships', title: 'Define how your characters relate',      dismissible: false, condition: (d) => d.characterCount >= 2 && d.relationshipCount === 0,            navigateTo: 'relationships', navLabel: 'Go to Relations'  },
  { id: 'add-map',           title: 'Add a map to track where things happen', dismissible: false, condition: (d) => d.eventCount > 0 && d.mapLayerCount === 0,                    navigateTo: 'maps',          navLabel: 'Go to Maps'       },
  { id: 'document-lore',     title: "Document your world's lore",             dismissible: true,  condition: (d) => d.eventCount >= 5 && d.lorePageCount === 0,                   navigateTo: 'lore',          navLabel: 'Go to Lore'       },
  { id: 'add-factions',      title: 'Are there organizations in your world?', dismissible: true,  condition: (d) => d.characterCount >= 3 && d.factionCount === 0,                navigateTo: 'factions',      navLabel: 'Go to Factions'   },
]

export const MAX_SUGGESTIONS = 3

export function evaluateSuggestions(
  data: WorldSummaryData,
  dismissedIds: string[]
): SuggestionRule[] {
  return SUGGESTION_RULES
    .filter((r) => r.condition(data) && !dismissedIds.includes(r.id))
    .slice(0, MAX_SUGGESTIONS)
}
