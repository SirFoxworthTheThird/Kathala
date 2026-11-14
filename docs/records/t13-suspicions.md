# T13: the suspicions, each measured

**Plan:** `round-trip-plan-3.md`, T13.
**Findings:** S2 to S7 of `loop-2026-11-12.md` and the writer's report of the second loop
(`writer-run-2026-11-10-loop2.md`). Each was seen once, or was not settled. Each was reproduced first.

| | The suspicion | Found | Done |
|---|---|---|---|
| S2 | *7 alive · 1 dead* at *All chapters*; two die | A fault | Fixed |
| S3 | *Not backed up* after exporting a copy | A fault in what the pill said | Fixed |
| S4 | The cursor on *All chapters* after a bring-in | Not reproduced | A test keeps it |
| S5 | A fact's notice in place of what a paste made | A fault | Fixed |
| S6 | A version of a scene for each replacement | A fault | Fixed |
| S7 | The other exports and a single line end | As T12.1 said | A test for each |

## S2: All chapters is the book's end

**Reproduced** on the run's `.pwk`: at *All chapters* the cast read 7 alive and 1 dead. Two die in the book,
Idris Mallory and Orrin Hask.

**Why.** With no cursor, each person's state was their record **changed last**, wherever it stood in the book. The
writer recorded Orrin's death in chapter 6, then went back and touched his record in chapter 5. That record was the
newer one, and it had him alive.

**Now** (`lastKnown`, in `stateEngine.ts`): with no cursor, each entity's last record **in the book's order**; of two
at one place, the one changed last. It is the rule for every kind read through it: people, custody, items, places,
relationships, regions.

**Measured after:** 6 alive and 2 dead, at *All chapters* and at the book's last scene alike.

## S3: a copy exported is said

**What the pill said.** With no folder chosen: *Not backed up*, and *this world exists only in this browser*. After a
`.pwk` was exported by hand that is not true, and the pill said it anyway.

**Whether a copy counts.** Not as a backup: it is not kept up to date as the writer writes, as a folder is. So the
pill does not say *Backed up*.

**Now** it says **Copy exported** *2 minutes ago*, and that anything written since is only in this browser, with what
to do: choose a folder, or, where the browser cannot keep one, export again. The export notes when, on this device and
not in the file (`noteExported`, in `backupStanding.ts`). A save dialog the writer cancels notes nothing. The pill
hears of it at once, not at its next look.

## S4: the cursor through bringing a file in, not reproduced

**Tried:** the cursor on a scene; a file brought in; the changes reviewed and one accepted; a second file brought in
and left for later. The cursor stayed on its scene throughout.

**Read in the code:** two things set the cursor to *All chapters*. Opening a world with no remembered place, and the
guard that clears a cursor whose scene was deleted. Bringing a file in does neither.

**Kept** as a test, so a change that makes it true is seen: `wordRoundTrip.spec.ts`, *the time cursor stays on its
scene through bringing a file in twice, reviewing and accepting*.

## S5: a fact's notice beside what the paste made

**Reproduced:** a pasted chapter with a fact known before the story, `[@@Nell Garrity ?The kiln was fired twice:@Nell
Garrity:before]`. The status line said only *Known before the story: shown on the first scene, Arrival.* What the
paste had made, and that Undo takes it back, was gone.

**Now** the fact's notice is said after it: *The pasted headings made 2 scenes and 1 chapter. Undo takes them back one
at a time. Known before the story: shown on the first scene, Arrival.* (`DraftBook.tsx`).

## S6: a run of replacements keeps one version

**Measured:** a scene with four versions kept from four days of writing. Twenty-one single replacements in it, five
seconds apart. Before: each kept a version of its own, forced past the grouping, and the scene's twenty held none of
the four.

**Now** a run of replacements is one version, the text from before its first. A replacement within two minutes of the
run's last carries the run on (`captureSceneRevision`, in `useManuscript.ts`; `run` and `runUntil` on the revision).
After a longer pause, another run, another version. Writing after a run is kept as ever.

**Replace all** was already one version a scene.

## S7: one Enter in each export

T12.1 said what each other format does with a single line end, by reading the code. A test for each now holds it
(`lineEndsEveryExport.test.ts`):
- **Markdown and plain text** keep the line as typed;
- **HTML and EPUB** join it to the line before with one space, as Read does: the run's scene is one paragraph;
- **verse** keeps its lines in all four: Markdown with a break at each line, plain text as written, HTML and EPUB a
  `<br/>` between lines.

## Tests

- **`stateEngine.test.ts`:** with no cursor, the last record in the book and not the one changed last; two at one
  place, the one changed last; a record of a scene that is gone.
- **`personState.test.ts`:** each person at their last record in the book, whole at its own scene.
- **`castAllChapters.test.ts`:** the run's people, at *All chapters* and the last scene, 6 alive and 2 dead.
- **`backupStanding.test.ts`:** a copy exported, said with when, and never as backed up; with none, as before; with a
  folder, the folder's standing and not the copy's; the time kept on the device and said at once.
- **`backupNudge.spec.ts`:** a copy exported is said on the chip at once.
- **`wordRoundTrip.spec.ts`:** S4, above.
- **`pasteHeadings.spec.ts`:** the paste's notice and the fact's, both.
- **`sceneRevisions.test.ts`:** a run of replacements, as measured; another run after a pause; writing after.
- **`lineEndsEveryExport.test.ts`:** S7, above.
