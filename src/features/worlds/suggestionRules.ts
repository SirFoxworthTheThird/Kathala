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

/**
 * Which nudges a writer is allowed to say no to.
 *
 * The first three are not choices: a world with no character, no scene, or no
 * character *in* a scene is a world the app cannot do anything with, and each
 * banner disappears the moment the thing exists.
 *
 * Relationships and maps are choices, and used not to be. A memoir with two
 * named people does not need a relationship graph, and a writer who does not
 * think spatially may never want a map — the banner then sits on the dashboard
 * permanently, telling them to do something they have decided against, with no
 * way to answer it. That is the shape a blind run kept finding elsewhere in the
 * app: a warning with no reply except compliance.
 */
export const SUGGESTION_RULES: SuggestionRule[] = [
  { id: 'add-character',     title: 'Add your first character',               dismissible: false, condition: (d) => d.characterCount === 0,                                        navigateTo: 'characters',    navLabel: 'Go to Characters' },
  { id: 'add-first-event',   title: 'Add your first scene',                   dismissible: false, condition: (d) => d.characterCount > 0 && d.eventCount === 0,                   navigateTo: 'timeline',      navLabel: 'Go to Timeline'   },
  { id: 'place-character',   title: 'Place a character on the timeline',      dismissible: false, condition: (d) => d.eventCount > 0 && !d.hasCharacterAtAnyEvent,                 navigateTo: 'timeline',      navLabel: 'Go to Timeline'   },
  { id: 'add-relationships', title: 'Define how your characters relate',      dismissible: true,  condition: (d) => d.characterCount >= 2 && d.relationshipCount === 0,            navigateTo: 'relationships', navLabel: 'Go to Relations'  },
  { id: 'add-map',           title: 'Add a map to track where things happen', dismissible: true,  condition: (d) => d.eventCount > 0 && d.mapLayerCount === 0,                    navigateTo: 'maps',          navLabel: 'Go to Maps'       },
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
