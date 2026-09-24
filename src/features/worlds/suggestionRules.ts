export interface WorldSummaryData {
  characterCount: number
  eventCount: number
  hasCharacterAtAnyEvent: boolean
  relationshipCount: number
  mapLayerCount: number
  lorePageCount: number
  factionCount: number
  /** This browser can hold a folder handle at all — Safari and Firefox cannot. */
  canBackUp: boolean
  /** A folder has been chosen for this world. */
  hasBackupFolder: boolean
}

export interface SuggestionRule {
  id: string
  title: string
  dismissible: boolean
  condition: (d: WorldSummaryData) => boolean
  navigateTo: string
  /**
   * A section within `navigateTo` to arrive pointed at, where the screen is
   * long enough that the top of it is not an answer. World settings has eleven
   * sections and the backup panel is the last of them.
   */
  navigateSection?: string
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
  /*
    The one nudge that is not about making the world richer.

    A world lives in one browser's IndexedDB; clearing site data takes it. The
    folder-copy machinery has existed for a long while and nothing ever
    mentioned it, so the only writers using it were the ones who went looking
    through World Settings. It waits for a scene to exist — there is no point
    asking somebody to protect an empty world — and it is dismissible, because
    a writer who keeps their own backups has already answered it.
  */
  { id: 'back-up',           title: 'Keep a copy of this world in a folder',  dismissible: true,  condition: (d) => d.canBackUp && !d.hasBackupFolder && d.eventCount > 0,          navigateTo: 'settings',      navLabel: 'Choose a folder', navigateSection: 'settings-cloud-sync' },
  /*
    And its twin, for the browsers that have no folder to offer. Brave blocks
    the File System Access API with no flag to re-enable it, and no Chromium on
    Android exposes it — so gating the nudge above on `canBackUp` alone left the
    writers with the *fewest* routes to a second copy the only ones never asked
    about it. They are not out of options; a `.pwk` export works everywhere.

    The two conditions are each other's negation, so exactly one can ever fire.
  */
  { id: 'export-copy',       title: 'Keep a copy of this world somewhere safe', dismissible: true, condition: (d) => !d.canBackUp && d.eventCount > 0,                              navigateTo: 'settings',      navLabel: 'Export a copy',   navigateSection: 'settings-cloud-sync' },
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
