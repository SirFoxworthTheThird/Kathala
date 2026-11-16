# T6: smaller findings

**Plan:** `round-trip-plan.md`, T6.
**Findings:** W-C, W-D, W-E and R2-D in `writer-run-2026-11-09-blind-editor.md`.

## W-C: *Recently edited* ignored the Page

**What was wrong.** The dashboard sorted its five scenes by the scene's record (`event.updatedAt`). Typing on the
Page saves only the prose (`sceneTexts`). The writer typed about 380 words into *The Empty Bolster* and it never
appeared in the five.

**DASH-3** had been closed as fixed by naming the list *Recently edited*. The name promised what the list did not
do. It is reopened in `ux-review.md` and closed again with this change.

**What was done.** `recentlyEdited` (`src/lib/recentlyEdited.ts`) takes each scene's time as the later of its record's
and its prose's. Each row's age, *just now* or *5m ago*, is that time.

## R2-D: a note's quote followed the reply

**What was wrong.** Answering a note moves it onto its words as they now read, by design (R1). The editor's *"Three?
We only ever meet two…"* came to quote the writer's fix, *the two tallyclerks*, and the record of what was asked
misquoted her.

**What was done.**
- A note gains `madeOn`: the words it was on the first time it moves off them (`updateProseNote`). It is set once,
  and later moves leave it.
- The note's card shows *Made on: "…"* under its quote, once the two differ.
- **The file.** `madeOn` travels in `.pwk` and `.pwb` with the rest of the note. EXPORT_VERSION is not bumped,
  as it was not for R7's `reaction`: an optional field on a record any version since 20 reads. An older Kathala
  would keep the note and lose only the line.

## W-D: an off-stage place

**What was wrong.** Saying where a person off stage was needed a place. A place the book did not have yet took six
steps: Maps → Add a place → Characters → the person → Current State → pick it → Save.

**What was done.**
- **Current Location** in Current State ends with **New place…**. It opens a name field. **Make it** makes the place,
  on no map, and picks it. **Save State** then saves it like any other choice.
- A name the book already has, whatever its case, picks that place rather than making a second.
- **W19-3** in `ux-review.md` ("a place is a pin, by design") is marked out of date. The writer read it as current.

## W-E: the flashback warning

**What was wrong.**
- It named the chapter twice where it meant two scenes: *"Ch. 3 is set on day 4, and Ch. 3 ("The Year of the Big
  Tide") on day 6"*.
- It told the writer to mark the scene a flashback, and gave no way to.
- **Go to chapter** opened the chapter, not the scene.
- Enter did nothing, though the footer says *Enter go to scene*.
- On the card, **+ Flashback** only showed the toggle, so a second click marked it. The toggle had no `aria-pressed`.

**What was done.** It is the HB-1a pattern, for another check.
- **The detail names both scenes**, each with its chapter: *"What the Kestrel Carried" (Ch. 3) is set on day 4, and
  the scene before it, "The price" (Ch. 3), on day 6.*
- **Mark as a flashback** on the warning marks the scene (`fix.kind: 'flashback'`). The warning then goes.
- **Go to scene** — the arrow's name wherever a finding has a scene — opens the book at the scene, with the Page's
  caret in it (`state.reveal`). It had opened only its chapter.
- **Enter** with no row chosen goes to the first finding. It had acted only on a row chosen with the arrow keys, and
  on opening none is chosen. Enter on one of the panel's own buttons is still that button's.
- **+ Flashback** marks the scene in its one click. The toggle it leaves has `aria-pressed`, and clicking it again
  unmarks the scene.

## Tests

- **`recentlyEdited.test.ts`:** prose newer than the record puts a scene first; a scene's latest prose is used; five
  at most.
- **`proseNotes.test.ts`:**
  - a note moved onto the same words keeps no `madeOn`;
  - the first move keeps the words it was made on, and a second move keeps the same;
  - `madeOn` survives a `.pwk` round trip.
- **`computeIssues.test.ts`:** the time-backwards warning names both scenes and carries the flashback fix.
- **`e2e/dashboardTiles.spec.ts`:** prose typed on the Page into the scene that is not first puts it first, *just
  now*.
- **`e2e/proseNotes.spec.ts`:** before the reply, the note has no *Made on*; after it, it says *Made on: She did not
  look back.*
- **`e2e/currentStateNewPlace.spec.ts`:**
  - **New place…** "The Pans" is made, picked, saved, and still there after a reload;
  - **New place…** "the quay" picks *The Quay* and makes no second place.
- **`e2e/flashbackWarning.spec.ts`:**
  - the warning's text names both scenes;
  - **Go to scene** opens the scene's chapter, with the cursor on the scene and the caret on the Page;
  - Enter, with no row chosen, does the same;
  - **Mark as a flashback** marks it, and the warning goes;
  - **+ Flashback** marks the scene in one click; the toggle says `aria-pressed="true"`, and a click unmarks it.

**A test changed, on purpose.** `e2e/pickerFilter.spec.ts`, *N9*, counted the location picker's options as the
places plus *Unknown / not set*. The picker now ends with **New place…**. The count includes it, the test asserts it
is last, and the places are still checked in name order.

**The specs that touch these screens** passed on a production build at f375939: 26 files, 66 tests, except N9, which
was then changed as above and passed. Three more specs that use the same picker passed as well (9 tests).

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. All fifteen were killed.
- Unit:
  - prose ignored by `recentlyEdited`;
  - `madeOn` not set;
  - `madeOn` rewritten on every move;
  - no flashback fix;
  - the detail not naming the earlier scene.
- e2e:
  - the dashboard given no prose times;
  - the *Made on* line never shown;
  - **New place…** making the place and picking nothing;
  - a name told apart by case, making a second *Quay*;
  - **Mark as a flashback** writing `false`;
  - **Go to scene** going without `reveal`;
  - the arrow named *Go to chapter* again;
  - Enter needing a row chosen, as before;
  - **+ Flashback** only showing the toggle;
  - no `aria-pressed`.

## Not done here

The plan put three cosmetic findings here, to be fixed only if they came up in the same files. None did, and they
are left:
- the splitter's twin task, the same task from two letters (in T3's record);
- W-A's *"Tomas Brenn or Tomas Brenn"*;
- the first-run guide's step 3, *Place them in the story*, which asks only for a moment, not a place.
