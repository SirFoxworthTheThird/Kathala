# T7.3–T7.6: the header line kept, Undo after an Accept, before the `[`, and the small ones

**Plan:** `round-trip-plan-2.md`, T7.3 to T7.6.
**Findings:** N1, R2-2, N2, R2-4, R3-1, R2-5, R2-6 and S2 in `writer-run-2026-11-10-loop.md`.

## T7.3: a header line being typed survives a retitle saving (N1)

**What happened.** The writer retitled a chapter heading on the Page, then typed a name on a scene's Characters line.
About a second later, as the title saved, the line went back to the records' and the name was gone. Reproduced 3 of 3.

**Reproduced first** (`e2e/headerLinesKept.spec.ts`). It failed on the first run, with the line back to
`Characters: @@Teodora Vance`. The writer's own control, the same typing with no retitle first, passed.

**Why.** When the store changes, `sync()` rebuilds the page with `view.setState`, and `bookToShow` draws every header
line from the records. `syncHeaders`, which spares the line the caret is on, runs only after the rebuild.

**What was done** (`DraftBook.tsx`, `draftEditor.ts`).
- **The lines the writer is typing are carried through.** The rebuild keeps, as they stand, the header lines that
  `syncHeaders` would have spared (`headersNotToTouch`): the caret's own, those kept as typed, and those being
  applied.
- **The line being typed is still being typed** (`stillTyping`). `setState` starts `lineTyped` afresh. Without the
  effect, the name survived the rebuild, but leaving the line did not apply it. The test found that half on the
  second run.

**Tests.** The pair passed 10 of 10. Mutants: the lines not carried, and `stillTyping` not said; both were killed.

## T7.4: Undo after an Accept takes the Accept back (R2-2)

**What happened.** Undo straight after an Accept undid an older Find & replace in another chapter.

**Why.** An Accept wrote prose with no journal entry. Find & replace writes through `replaceSceneTexts`, which journals
each scene's prose before and after, so it was the last thing on Undo.

**What was done.**
- **One journalled step each.** Accept, Accept all on a scene, Reject and Reject all are each one step of Undo. Each
  carries the scene's prose before and after, as Find & replace does.
- **The change comes back too.** The suggestion rows the act removed travel in a new `Operation.rows`
  (`RowsChange`). Undo puts them back and Redo takes them away again, so an Accept undone is a change waiting
  again.
- A new journalled entity was considered and not built: it would have reached into `.pwk` export, tombstones and
  merge, for records that never travel.

**Tests** (`editImport.test.ts`).
- Undo after an Accept: the prose back, the change back, the older Replace all untouched. Redo makes it again.
- Accept all on a scene is one step. A Reject undone brings the change back.

**Mutants.** All six were killed: rows not kept, the Accept not journalled, rows not inverted, rows not restored,
Accept all not grouped, Reject not journalled. A first form of the grouping mutant was equivalent, with `.then()` on
a group that was still a group, and it was redone.

## T7.5: words typed in front of a header's `[` (N2)

**What happened.** The writer clicked the `[` line, pressed Home, typed `Fog. ` and arrowed away. The lines stopped
reading as a header and became prose. They were counted as words, and a fresh header was drawn above them.

**What was meant** is a first line of prose. `typedBeforeHeader` moves the words to a paragraph of their own under the
header when the line is left, and the header is applied as usual. An aside in square brackets within prose is left
alone.

**Tests.**
- Unit: the words become the first paragraph; a scene with no prose; nothing to move; a line with no header; an aside.
- e2e, on the writer's own steps: the prose is *Fog.* then *She counted.*, with one header and the cast unchanged.
- **Mutants.** All three were killed: not moved on leaving, never anything to move, and moved where the rest is no
  header. A first form of the last did not build, and the aside test was added for it.

## T7.6: the small ones

- **"ch.3" (R2-4).** `CHAPTERS` lets "ch." run straight into its number. The loop letter's nine `ch.N` references all
  link now. "each.3", "ch3" and "such.4" do not.
- **A comment on a heading or the title page (R3-1).** `outsideScenes` keeps which comments, and the import brings
  each in as an item in *Changes outside the scenes*: the line, the comment and its author, with **Dismiss**.
  - It is not a change (`changeCount`).
  - The summary says *N comments are on the title page or a chapter's heading: read them in Changes*. It no longer
    counts them under *matched no scene*.
  - Both of the loop's rounds had one, by Jonah Pryce, and both are found.
- **Two drafts in one minute (R2-5).** The second takes *(2)*, the third *(3)* (`freshSentDraftName`).
- **Italics alone (R2-6).** A change whose text is the same once the `_` and `*` are set aside is shown as *Italics
  changed* (`italicsOnly`). Before, a bare mark was all that showed. The e2e test italicises a word in Word, which
  comes in as an edit made with tracking off.

**Mutants.** All six were killed: "ch." needing a space, drafts in a minute alike, heading comment ids lost, heading
comment not stored (redone once to build), italics never recognised, and the italics chip not shown.

## S2: "+13,460 words today" on a 13,083-word book (measured, not built)

- **Header lines are not what is counted.** A chapter of three scenes pasted onto the Page, with header blocks and
  without, logged exactly the book's words both times: 21 and 21 (a probe, not kept).
- **The day's count is only what prose saves on the Page add** (`setSceneText`).
  - Deleting a scene does not subtract its words.
  - Find & replace, splits, joins and Undo are not counted at all.
- **That fits both of the loop's figures, but is not proven to explain them.** The count was over by 377 after
  scenes were pasted again, and under (13,789 against 14,201) after a revision made largely with Find & replace.
- It is left as a finding about what the count means, not a fix.

## The production run

At 4fb1177, on a production build, the specs that touch the Page, its headers, pasting, Undo, the round trip and a
letter's tasks passed: 31 files, 153 tests (`header*`, `page*`, `paste*`, `undo`, `closeAnywhere`,
`wordRoundTrip`, `revisionTasks`). The full unit suite passed (3,504 tests).

## Not done here

- The suspicion that the right scene's panel follows the wrong scene after a paste (T4's S1) is still unmeasured.
