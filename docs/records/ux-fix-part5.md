# UX fixes, Part 5: wrong answers

Part 5 of `ux-expert-fixes-plan.md`: the places where a screen said something that was not true. Each mechanism the
review named was found in the code at `59fd2e3` before it was fixed, and each was still there.

| Finding | What it said | Now | Test |
|---|---|---|---|
| UX-1-1 (D-1) | *Dracula* at chapter one: 14 alive, 11 dead. Anyone not yet recorded was counted by their end-of-book flag. | Before a character's first record, that record decides. | `castAtCursor.test.ts`; `momentAccuracy.spec.ts` |
| UX-2-3 (D-3) | A change still waiting in Changes was "turned back" in the tally, and signed *(edit declined)* in the file. | Its own figure, *1 still waiting*; signed as the writer's; listed apart in the cover note; **Decide in Changes**. | `markedDocx.test.ts`, `editorTold.test.ts`; `wordRoundTrip.spec.ts` |
| UX-2-14, UX-2-29 | A Library book (WebP cover) did not export with the cover box ticked, the default. The error sat 350px above the button. | A cover Word, EPUB or HTML cannot carry goes in as a JPEG. The error, if any, is beside the button. | `coverImage.test.ts`; `webpCover.spec.ts` |
| UX-3-11 | An Elven Cloak given to six read *carried by Gimli* on its own page. | Every holder, as the roster names them, with a place only where they share one. | `itemCustody.test.ts`; `collectiveItem.spec.ts` |
| UX-3-16 | Renaming a knife: *Edited item — description, icon type and 3 more*. | Only the fields whose value differs from the before-image. | `describeOperation.test.ts`; `changedFieldsSaid.test.ts` |
| UX-1-14 | Day one, 18 words: *at ~3/day you'll finish Jan 22, 2112*. | The pace is over the days since the log began, up to seven. | `writingProgress.test.ts` |
| UX-1-15 | Reading mode at Jekyll's first page: *10 chapters · 1 scene*. | *1 Book chapters so far · 1 scene*. | `readingMode.spec.ts` |
| UX-1-7 | A fling to the last page: *Moved on to chapter 4*, and Undo to chapter 2. | A burst of moves is one move: the notice names where the place ended, Undo goes back to where it began. | `readingAhead.test.ts`; `readingDrift.spec.ts` |
| UX-1-9 (D-2) | In a Word draft, *The Wreck* under *Chapter One* became the chapter's title, and the scene *Scene 1*. | That rule only in a file Kathala wrote. The preview lists the scenes' titles. | `docxDraft.test.ts`; `wordDraftImport.spec.ts` |
| UX-1-6 (D-7) | Book two of a series asked for "the first character" and made a second Anna Brisk. | *Your series' cast is here — 1 character*; a name the cast has is that person. | `seriesJoin.test.ts`, `characterNamed.test.ts`; `series.spec.ts` |
| UX-2-17 | *A run of 10 chapters between Ch. 4 and Ch. 27*: the span, not the silence. | *Ch. 8–17, 10 chapters, have no beat*. | `threadContinuity.test.ts` |
| UX-2-22 | *Act 2 Ch. 7 (4%) · Act 3 Ch. 8–27 (74%)* with Plot Point 2 not placed. | Act 3 from its own first beat, and the board says Plot Point 2 is not placed. | `structureBoard.test.ts`; `structureProportion.spec.ts` |
| UX-2-23 | The change made with tracking off, in paragraph 2, listed above two in paragraph 1. | Each scene's changes in reading order. | `changeOrder.test.ts`; `wordRoundTrip.spec.ts` |
| UX-2-18 (D-10) | Six of *Dracula*'s seven motifs amber, four for 3 or 4 quiet chapters. | The thread rule: five quiet chapters and a third of the span. 234 → 135 amber across the Library. | `motifWarning.test.ts` |
| UX-3-17 (D-11) | *Clear filter* showed with nothing filtered, and cleared the time cursor. | Shown only while the box holds text; it empties the box. | `arcRoster.spec.ts` |
| UX-3-19 | The top node under the floating toolbar; Focus did not re-fit; *Zoom in to read the labels* with no edges drawn. | Fitted below the toolbar; again on Focus; no note without edges. | `graphFit.test.ts`; `relationshipGraphScale.spec.ts` |

## The alive and dead count (D-1)

`castAliveSplit` takes a third list, each character's earliest record in reading order (`firstRecordOf`), between the
state at the cursor and the character's own flag. The dashboard gives it the book's whole records.

**Measured on *Dracula*, under the accepted rule:** at chapter one the count goes from 14 alive and 11 dead to 22 and 3.
The three are Mr Peter Hawkins (first recorded at chapter 14, dead), the Captain of the Demeter (chapter 7) and Petrof
Skinsky (chapter 26). The rule cannot tell *dead before the story finds them* from *dead the first time we hear of
them*: the Captain is the first, Hawkins and Skinsky are the second. D-1 accepted that over the *not yet met* figure,
and the three are the cost. Seward's Attendant has no record at all and is counted by their flag, alive.

## The change still waiting (D-3)

Part 0 opened the marked file and found the waiting change signed *The author (edit declined)*.

- **The tally.** `editVerdicts` takes the changes still in Changes (the `editSuggestions` rows of a scene, matched to
  the file's `editorChanges` by the same hunk). One that does not stand is `waiting`, not `turnedBack`. One the writer
  typed in by hand stands, since the file shows it standing. A move waits as one.
- **The file.** `markDeclined` is given the waiting changes and does not sign the change at their words. Their words
  are found in the editor's text by the words either side. Those are kept as the text had them *before* the editor's
  other changes, so in the e2e, " now" cut a paragraph after " in the rain" put in, the full context was not in the
  editor's text. Fewer words either side are tried (32, 16, 8 characters), so long as they are found once. The e2e
  found this. The first unit tests passed without it.
- **The dialog** says *The one still waiting goes marked as the book has it for now, not signed as declined*, with
  **Decide in Changes**, which closes Export and opens Changes.

## Smaller ones

- **WebP cover.** `exportableCover` passes a JPEG or PNG through and draws anything else again as a JPEG on white,
  since a JPEG has no transparency. All 29 Library covers are WebP.
- **Collective whereabouts.** `itemCustodyChain` takes `collective`, keeps every holder of the scene's rows in the order
  they took one, and drops one whose row says `has: false`. A row with no holder puts every one somewhere, or out of
  everybody's hands. That is said, never shown as the dashed *gap* row.
- **Fields that changed.** `fieldsThatDiffer` compares each named field with the operation's before-image. Unset,
  `false`, empty text and an empty list count as the same, so a box going from unset to unticked is no change.
  `null` is not among them: a person's place `null` is "nowhere", and is said. `changedFields` stays whole, since it
  is what undo restores.
- **The fling.** `continueBurst`: a move within 800ms of the last continues the burst. A fling's steps come tens of
  milliseconds apart, a reader's seconds. *Reading on is never interrupted* stepped a scene every 220ms, which a
  1.5s window, the first one tried, read as a fling. It steps a scene a second now, still far quicker than reading.
- **D-2.** Part 0 measured that Kathala's own export puts each scene in a `KathalaScene_` bookmark and a draft has
  none, so the bookmark decides and D-2's fallback (a scene heading that repeats the chapter's title) was not needed.
- **D-7.** "A name typed later anywhere" is two places: the guide's character step, if it is reached, and **Add
  Character**. Both use `characterNamed`, which looks only in a book of a series. Outside a series two people may share
  a name, and do. Other ways in (a scene header's *Create*, AI generation, import) are not changed.
- **Plot Point 2.** An act ends after its last beat only where the act's closing beat (the last of the act in the
  template) is placed. Otherwise the next act is measured from its own first beat, and `missing` names the beat when
  that made a difference.
- **The graph.** `fitBelow` fits the nodes into the pane below the toolbar, measured with a `ResizeObserver`. It fits
  again when Focus changes, once the focused nodes are drawn (the key carries their count, since they arrive a render
  after the choice). The *Clear filter* box's own ✕ had no name and did the same thing, so it went.
- **Not done here:** the review also saw a *Resolves at Ch. 14* offer reorder the checker's groups under the pointer
  (UX-2-17, "Also seen"). It is not in the plan's Part 5 and is left for the layout part.

## Motifs on the Library (D-10)

Counted with each book's motifs and scenes, the old rule and the new, from a measuring test kept out of the
repository (it reads `KATHALA_LIBRARY`):

| | Motifs | Amber before | Amber after |
|---|---|---|---|
| *Dracula* | 7 | 6 | 1 |
| *Strange Case of Dr Jekyll and Mr Hyde* | 8 | 5 | 1 |
| *Twenty Thousand Leagues Under the Seas* | 6 | 6 | 1 |
| *Pride and Prejudice* | 16 | 16 | 9 |
| *Treasure Island* | 18 | 18 | 15 |
| *The Odyssey* | 6 | 6 | 6 |
| All 53 books with motifs | 299 | 234 | 135 |

Of the 135 still amber, 96 are *fades out* (absent for the last three chapters or more), which D-10 did not
change; 12 have no scene tagged; 27 vanish mid-story by the new rule. If *fades out* should follow the thread's
*left dangling* too, it is a decision of its own.

## The guide

`docs/GUIDE.md` says each of these where it describes the screen: the cast tile, reading mode's dashboard and the
skip notice, the Word draft's headings and preview, a series' new book, the tally's *still waiting*, the Changes
list's order, the cover in an export, a collective item's Whereabouts, Recent changes, the pace, goes quiet, motifs,
the act band, the Arc's *Clear filter*, and the graph's fit and note.

No screenshot changed. `22b-import-word-draft` is a draft with no scene headings, so its preview lists no scene
titles. `135-marked-back` is of a revision with nothing waiting. `33-motifs` ends at the Motifs heading, before
any motif row. `55-structure-proportion` has no beat placed, so no band is drawn, and says so as before.

## Mutants

To come.

## Checks at the commit shipped

To come.
