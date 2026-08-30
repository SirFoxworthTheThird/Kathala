import type { OperationEntity } from '@/types/operation'

/**
 * Which table each journalled entity group lives in.
 *
 * The Dexie table name and the `.pwk` export array name are the same string for
 * every group on the seam, so one map serves both the merge path (which reads
 * export arrays) and undo (which writes Dexie tables). Keeping it in one place
 * means a new entity group can't be added to the journal while being invisible
 * to one of them.
 */
export const ENTITY_TABLE: Record<OperationEntity, string> = {
  character: 'characters',
  characterGoal: 'characterGoals',
  item: 'items',
  location: 'locationMarkers',
  timeline: 'timelines',
  chapter: 'chapters',
  event: 'events',
  relationship: 'relationships',
  lorePage: 'lorePages',
  faction: 'factions',
  plotThread: 'plotThreads',
  motif: 'motifs',
  knowledgeFact: 'knowledgeFacts',
  characterMovement: 'characterMovements',
  mapRoute: 'mapRoutes',
  mapRegion: 'mapRegions',
  mapAnnotation: 'mapAnnotations',
  factionMembership: 'factionMemberships',
  factionRelationship: 'factionRelationships',
  knowledgeReveal: 'knowledgeReveals',
  timelineRelationship: 'timelineRelationships',
  crossTimelineArtifact: 'crossTimelineArtifacts',
  characterSnapshot: 'characterSnapshots',
  itemPlacement: 'itemPlacements',
  locationSnapshot: 'locationSnapshots',
  itemSnapshot: 'itemSnapshots',
  relationshipSnapshot: 'relationshipSnapshots',
  mapRegionSnapshot: 'mapRegionSnapshots',
}

/**
 * Human-readable singular names, for describing an operation in the UI.
 *
 * These are the words the app says, not the words it stores: `event` is a
 * *scene* to a writer, and the table above keeps the storage name. Changing
 * one must never change the other — an earlier pass at this rename did exactly
 * that and pointed undo at a table called `scenes`.
 */
export const ENTITY_LABEL: Record<OperationEntity, string> = {
  character: 'character',
  characterGoal: 'goal',
  item: 'item',
  location: 'location',
  timeline: 'timeline',
  chapter: 'chapter',
  event: 'scene',
  relationship: 'relationship',
  lorePage: 'lore page',
  faction: 'faction',
  plotThread: 'plot thread',
  motif: 'motif',
  knowledgeFact: 'knowledge fact',
  characterMovement: 'character route',
  mapRoute: 'route',
  mapRegion: 'region',
  mapAnnotation: 'map label',
  factionMembership: 'faction membership',
  factionRelationship: 'faction relationship',
  knowledgeReveal: 'knowledge reveal',
  timelineRelationship: 'timeline link',
  crossTimelineArtifact: 'cross-timeline artifact',
  characterSnapshot: 'character state',
  itemPlacement: 'item placement',
  locationSnapshot: 'location state',
  itemSnapshot: 'item state',
  relationshipSnapshot: 'relationship state',
  mapRegionSnapshot: 'region state',
}
