/**
 * A compact, genre-agnostic three-act beat sheet. Each event may be tagged with
 * at most one beat; the curve and timeline surface them as structural landmarks
 * so a writer can see whether their intensity actually peaks where the structure
 * says it should.
 */
export interface StoryBeat {
  id: string
  label: string
  /**
   * Compact label for tight spots like the pacing-curve annotations.
   *
   * Compact, not clipped: a short form has to still be the beat's name. "Incite"
   * for *Inciting Incident* and "Resolve" for *Resolution* were the verb where
   * the beat is a noun, and "Cat" for *Catalyst* was three letters that read as
   * the template it belongs to (**TL-6**).
   */
  short: string
  /** Which act the beat conventionally sits in (1–3) — drives grouping/tint. */
  act: 1 | 2 | 3
  /** One-line reminder of the beat's job, shown as a hint. */
  hint: string
}

export const STORY_BEATS: readonly StoryBeat[] = [
  { id: 'hook', label: 'Hook', short: 'Hook', act: 1, hint: 'Opens the story and poses its question.' },
  { id: 'inciting-incident', label: 'Inciting Incident', short: 'Inciting', act: 1, hint: 'The scene that disrupts the ordinary world.' },
  { id: 'plot-point-1', label: 'Plot Point 1', short: 'PP1', act: 1, hint: 'The protagonist commits — end of Act 1.' },
  { id: 'midpoint', label: 'Midpoint', short: 'Mid', act: 2, hint: 'A reversal or revelation that raises the stakes.' },
  { id: 'plot-point-2', label: 'Plot Point 2', short: 'PP2', act: 2, hint: 'The low point that launches Act 3.' },
  { id: 'climax', label: 'Climax', short: 'Climax', act: 3, hint: 'The final confrontation — peak intensity.' },
  { id: 'resolution', label: 'Resolution', short: 'Resolution', act: 3, hint: 'The aftermath and new normal.' },
] as const

/** Blake Snyder's 15-beat "Save the Cat" sheet. */
const SAVE_THE_CAT: readonly StoryBeat[] = [
  { id: 'stc-opening-image', label: 'Opening Image', short: 'Open', act: 1, hint: 'A snapshot of the world (and hero) before the change.' },
  { id: 'stc-theme-stated', label: 'Theme Stated', short: 'Theme', act: 1, hint: 'The story’s argument, hinted early.' },
  { id: 'stc-setup', label: 'Setup', short: 'Setup', act: 1, hint: 'Establish the hero, world, and what’s missing.' },
  { id: 'stc-catalyst', label: 'Catalyst', short: 'Catalyst', act: 1, hint: 'The inciting scene that upends the status quo.' },
  { id: 'stc-debate', label: 'Debate', short: 'Debate', act: 1, hint: 'The hero hesitates — should they go?' },
  { id: 'stc-break-into-two', label: 'Break into Two', short: 'B2', act: 1, hint: 'The hero commits and enters the new world.' },
  { id: 'stc-b-story', label: 'B Story', short: 'B-Story', act: 2, hint: 'A secondary (often relationship) thread begins.' },
  { id: 'stc-fun-and-games', label: 'Fun and Games', short: 'F&G', act: 2, hint: 'The promise of the premise — the set-pieces.' },
  { id: 'stc-midpoint', label: 'Midpoint', short: 'Mid', act: 2, hint: 'A false victory or defeat; stakes escalate.' },
  { id: 'stc-bad-guys-close-in', label: 'Bad Guys Close In', short: 'BGCI', act: 2, hint: 'Pressure mounts, internally and externally.' },
  { id: 'stc-all-is-lost', label: 'All Is Lost', short: 'AIL', act: 2, hint: 'The low point — a whiff of death.' },
  { id: 'stc-dark-night', label: 'Dark Night of the Soul', short: 'Dark Night', act: 2, hint: 'The hero’s despair before the answer.' },
  { id: 'stc-break-into-three', label: 'Break into Three', short: 'B3', act: 3, hint: 'The insight that launches the finale.' },
  { id: 'stc-finale', label: 'Finale', short: 'Finale', act: 3, hint: 'The hero storms the castle and proves the theme.' },
  { id: 'stc-final-image', label: 'Final Image', short: 'Final', act: 3, hint: 'The mirror of the opening — how far they’ve come.' },
] as const

/** The Hero's Journey (Campbell / Vogler), condensed to 12 stages. */
const HEROS_JOURNEY: readonly StoryBeat[] = [
  { id: 'hj-ordinary-world', label: 'Ordinary World', short: 'Ordinary', act: 1, hint: 'The hero’s normal life before the adventure.' },
  { id: 'hj-call', label: 'Call to Adventure', short: 'Call', act: 1, hint: 'A challenge or quest presents itself.' },
  { id: 'hj-refusal', label: 'Refusal of the Call', short: 'Refusal', act: 1, hint: 'The hero hesitates or resists.' },
  { id: 'hj-mentor', label: 'Meeting the Mentor', short: 'Mentor', act: 1, hint: 'Guidance, a gift, or training arrives.' },
  { id: 'hj-threshold', label: 'Crossing the Threshold', short: 'Threshold', act: 1, hint: 'The hero commits to the special world.' },
  { id: 'hj-tests', label: 'Tests, Allies, Enemies', short: 'Tests', act: 2, hint: 'The rules of the new world are learned.' },
  { id: 'hj-approach', label: 'Approach to the Inmost Cave', short: 'Approach', act: 2, hint: 'Preparation for the central ordeal.' },
  { id: 'hj-ordeal', label: 'Ordeal', short: 'Ordeal', act: 2, hint: 'The greatest trial — a brush with death.' },
  { id: 'hj-reward', label: 'Reward', short: 'Reward', act: 2, hint: 'The hero seizes the prize.' },
  { id: 'hj-road-back', label: 'The Road Back', short: 'Road Back', act: 3, hint: 'The return begins, often pursued.' },
  { id: 'hj-resurrection', label: 'Resurrection', short: 'Resurrect', act: 3, hint: 'A final test; the hero is transformed.' },
  { id: 'hj-return', label: 'Return with the Elixir', short: 'Return', act: 3, hint: 'The hero returns changed, boon in hand.' },
] as const

export interface BeatTemplate {
  id: string
  name: string
  /** One-line description of the template. */
  blurb: string
  beats: readonly StoryBeat[]
}

/** The structure templates offered on the Structure board. */
export const BEAT_TEMPLATES: readonly BeatTemplate[] = [
  { id: 'three-act', name: 'Three-Act', blurb: 'The classic seven-beat, three-act spine.', beats: STORY_BEATS },
  { id: 'save-the-cat', name: 'Save the Cat', blurb: 'Blake Snyder’s 15-beat sheet.', beats: SAVE_THE_CAT },
  { id: 'heros-journey', name: "Hero's Journey", blurb: 'Campbell / Vogler, in 12 stages.', beats: HEROS_JOURNEY },
] as const

export function beatTemplateById(id: string | null | undefined): BeatTemplate | undefined {
  return BEAT_TEMPLATES.find((t) => t.id === id)
}

// Every beat across all templates, so a tagged event resolves regardless of the
// template currently shown.
const BEAT_BY_ID = new Map(BEAT_TEMPLATES.flatMap((t) => t.beats.map((b) => [b.id, b] as const)))

/** Look up a beat by id, or undefined for null/unknown ids. */
export function beatById(id: string | null | undefined): StoryBeat | undefined {
  if (id == null) return undefined
  return BEAT_BY_ID.get(id)
}

/** Human label for a beat id; falls back to the raw id, or 'None' for null. */
export function beatLabel(id: string | null | undefined): string {
  if (id == null) return 'None'
  return BEAT_BY_ID.get(id)?.label ?? id
}

/** A subtle per-act accent color (hsl string) for tinting beat chips/markers. */
export function beatActColor(act: 1 | 2 | 3): string {
  switch (act) {
    case 1: return 'hsl(200, 70%, 55%)'
    case 2: return 'hsl(275, 60%, 60%)'
    case 3: return 'hsl(15, 75%, 58%)'
  }
}
