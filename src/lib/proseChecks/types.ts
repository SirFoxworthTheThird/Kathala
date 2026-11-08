/*
  The prose checks' shared shapes (editorial-plan.md, R6): what a finding is,
  the settings every threshold lives in, and the baseline the checks measure a
  word's commonness against.
*/

export type ProseCheck = 'echo' | 'pet' | 'rhythm' | 'tag' | 'length'

export interface ProseFinding {
  check: ProseCheck
  eventId: string
  /** Where it is in the scene's plain text (`plainScene`). Equal for a finding about the whole scene. */
  start: number
  end: number
  /** The words it is about, as written; empty for a whole scene. */
  text: string
  /** Where else in the scene the same thing is: each use of a pet word after the first. */
  more?: Array<[number, number]>
  /** What it says, in a line. */
  message: string
  /**
   * Stable across edits elsewhere in the scene, for dismissing it: the check,
   * the scene, the words, and which time in the scene this check found them.
   */
  key: string
}

/**
 * Every threshold, each a setting (editorial-plan.md, R6). The defaults are
 * set from the run over the Library (`docs/records/r6-prose-checks.md`).
 */
export interface ProseCheckSettings {
  echoes: boolean
  /** How near, in words, a common word's second use is an echo. Rarer words reach further: ×2 and ×4. */
  echoSpan: number
  /** How near, in words, a phrase of three words used again is an echo. */
  phraseSpan: number
  petWords: boolean
  /** How many times its usual rate a word is used before it is a pet word. */
  petRatio: number
  /** How many times in the book, at the least. */
  petMinCount: number
  /** How many pet words, at the most: the book's worst. */
  petMax: number
  rhythm: boolean
  /** How many sentences in a row of nearly the same length. */
  rhythmRun: number
  /** How many words apart, at most, the longest and shortest of them. */
  rhythmSpread: number
  /** How many times longer or shorter than the book's a scene's sentences are on average. */
  sceneSentenceFactor: number
  tags: boolean
  /** Adverbs on dialogue tags: "said softly". */
  tagAdverbs: boolean
  /** The share of a scene's tags, 0 to 1, that may be other than said and asked. */
  tagShare: number
  lengths: boolean
  /** How many times longer or shorter than the book's usual a scene or chapter is. */
  lengthFactor: number
}

/** How common each word and pair of words is in books in general: uses per million words. */
export interface ProseBaseline {
  /** Words the rates were counted over. */
  total: number
  words: Record<string, number>
  bigrams: Record<string, number>
}
