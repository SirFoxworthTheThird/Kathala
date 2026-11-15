# T16: a comment on the words that took its words' place

**Plan:** `round-trip-plan-4.md`, T16.
**Findings:** the fourth of `loop-2026-11-14.md`; the editor's F-1.

## What happened

8 of the third loop's editor's 40 round-1 comments went back at their scene's start, as points, with the app's line.
The farthest was about 35 paragraphs from its words. The editor: *"on the replacement text when the words are
replaced."*

## Why

A note whose words are gone was placed in two ways only: by its words, a little edited (`byLikeness`), and between its
surroundings where most of its words still stood (`bySurroundings`, T11.3). In 5 of the 8 the words either side still
stood, in its own scene, with the writer's rewrite between them. One of the five kept every word and was more than twice
as long; the others were new words.

## Now

**A note whose words are gone, with the words either side of it still standing in its own scene, goes on what lies
between them** (`replacedBetween`, `noteAnchor.ts`):
- the words before and the words after both stand whole, in that order;
- what lies between is some words, and within a paragraph: never across a paragraph break, never nothing;
- a side the note had no words on is the scene's start or end. Both sides empty is the whole scene, and no place;
- between two places as good, neither;
- it is tried only where `bySurroundings` placed nothing, so a note whose words still mostly stand is placed by them.

**It says so** (`NotePlace.replaced`):
- **in Notes**, the card says *Its words have been rewritten since: it is on the words that took their place.* The
  quote it was made on is the card's quote, as before;
- **in the marked file**, the comment is ranged on the new words, and the app's line (T9.2) says the words it was made
  on, as it did at the scene's start (`MarkedThread.was`). A comment placed on its own words, a little edited, goes as
  before, without the line.

## Measured before it was kept

On the four runs with an editor's notes — the blind-editor run and the three loops — each note's words against the
book as it stood when the note's round went back, and each placement the rule made read against the note:
- **19 notes** went from unplaced to placed, **35 placements** across the rounds in all, since a note stands in each
  round after its own;
- **none wrong**: in each, the words between are the writer's rewrite of the words the note was about. Among them:
  *Tomas Brenn* → *tomas varga*; *in my office* → *at sorrel house, in her own room*; *That was what the forty crowns…*
  → *there were forty crowns in his coat pocket…*;
- the third loop's round 2, the finding's own book: the plan's 5 placed, each on the words in its table, and the other 3
  unplaced, their surroundings gone too.

The probe was a scratch script and is not kept. The third loop's 5 are the test.

## Tests

- **`noteReplaced.test.ts`:**
  - the third loop's round-2 book and its notes: the 5 on the words that took their place, and 3 unplaced;
  - the marked file: two of the five ranged on their new words, the app's line naming the words they were made on;
  - `replacedBetween`: within a paragraph; a side empty; both empty; across a break; nothing between; a surrounding
    gone; two places as good.
- **`noteAnchor.test.ts`:** nine cases that said *unplaced* for words rewritten between surroundings that stood now say
  where the note is, on the new words, and `replaced`: a word changed for another (*ferry* → *berry*), a sum rewritten,
  a passage rewritten at more than twice its length, and the rest. They were left unplaced on purpose, by T7.2 and
  T11.3, for want of a rule that could say a note was on the words that took its words' place; this part is that rule.
  One case added: the same rewrite with a surrounding gone too, still unplaced.
- **`proseNotes.spec.ts`**, in the app: a note's words rewritten on the Page, the lines either side as they were; the
  note is on the new words, and its card says so. The test before it, whose surroundings were edited first, still has
  the note unplaced.

**Mutants**, in a separate worktree, gated on `tsc && eslint && echo MUTANT-OK && grep`. 11, all killed, 2 by the e2e:
- **the rule (6):** not used (and again by the e2e); tried over `bySurroundings`'s place; across a paragraph break;
  nothing between taken for a place; the first of two places as good; both sides empty not refused;
- **the place (1):** not said to be replaced;
- **the marked file (2):** the words it was made on not handed on; no app's line on the new words;
- **Notes (1, by the e2e):** the card not saying it.

## Not done here

- **A note whose surroundings went too** stays unplaced: 3 of the third loop's 8. Where its words and both
  surroundings are gone, nothing on the page says where it was. The app's line, with the words it was made on, is at
  its scene's start, as before.
- **A rewrite that ran into the next paragraph** is not placed: the rule stops at a paragraph break, so that a note is
  never spread over more than its own paragraph's worth of the writer's words.
