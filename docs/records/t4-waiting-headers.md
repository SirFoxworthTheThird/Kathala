# T4: headers a paste left waiting

**Plan:** `round-trip-plan.md`, T4.
**Finding:** W-A in `writer-run-2026-11-09-blind-editor.md`.

## What happened, and why

The writer pasted chapters whose scene headers named people and places the world did not have yet. The note above
the page said three headers waited, but offered **Create** buttons for one scene's names only. Once those were made
it went blank, and the other scenes were offered only after a reload, one reload each. On the Page, a waiting header
looked exactly like an applied one, while its scene had no cast and no place.

**Reproduced first** (`e2e/pasteHeadings.spec.ts`, *headers a paste left waiting*): three scenes pasted, each naming
a place the world has not got. With the code as it was, after the offered place was made, no button for another
waiting scene appeared.

**The mechanism**, in `DraftBook.tsx`:
- **One note at a time.** The note was one scene's: `headerWarning`, a single `{ sceneId, unknown }`. Each scene a
  paste applied and could not apply set it, so the last one won.
- **Settling cleared it.** When that scene was settled, `forgetKept` cleared the note.
- **The rest were looked at only on opening.** The other kept lines were read again only by an effect that runs
  once, when the page opens.
- **The waiting lines were unmarked.** Nothing on the page drew them.

## What was done

- **Every waiting scene is kept** in `waiting`, a set held in state. A scene is added when its header is applied
  with something the world has not got, and on opening for every kept line that still waits. It is dropped when its
  line is forgotten.
- **Each is marked on the Page.** Its header is underlined in amber, titled *Not applied: it names something this
  world has not got* (`keptHeaderMarks.ts`). An applied header is not marked.
- **The note moves on.** When the scene the note is about is settled — what it names made, or the line put right by
  hand — `surfaceWaiting` plans the next waiting scene against the records as they are now, and puts its note up.
- **Every waiting header is read again** after anything is made from the note (`reapplyWaiting`), since a place made
  for one scene may be the one another waits on.
- **Create all that the N waiting headers name**, shown when more than one scene waits (`createAllWaiting`). It
  makes every place, item, fact and person their lines name, each place in the first scene that names it as its own
  button would, and then reads every waiting header again.
  - A cast name nobody answers to is not made. It is as likely misspelt as new, as the note already says, and it
    waits for the writer.

## A test changed, on purpose

`e2e/headerPickerRun4.spec.ts`, *a place made from the note: the note says so no longer*, kept a second scene's line
waiting ("Nobody Knownat"), made "Quay", and asserted that no note at all remained. Its point was that the note must
stop saying "Quay" does not exist. It now asserts that, and that the note has moved on to the other scene that still
waits — the behaviour this part adds.

## Tests

- **`e2e/pasteHeadings.spec.ts`, *each waiting scene is offered in turn without a reload…*:**
  - three pasted scenes wait, and all three lines are marked, titled;
  - the applied scene's line is not marked;
  - after a reload, still three;
  - one place made from the note: it moves on to another scene's place, and one line fewer is marked;
  - **Create all**: every scene is set at its place with its cast, no line is marked, and no Create button is left.
- **`e2e/pasteHeadings.spec.ts`, *a waiting header put right by hand…*:** two scenes wait. The note's scene has its
  line retyped by hand to a place the world has, and is left. The note moves on to the other scene, and one line is
  still marked.
  - That test waits until the paste has finished reading every header. Without the wait, the second scene's own
    apply could put its note up after the fix, and a mutant that stopped the note moving on survived twice before
    the wait was added.
- **The specs that touch header notes** — 13 files, 69 tests — pass in dev, including the changed one. The two T4
  tests passed six runs out of six.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`, all e2e. All six were killed:
- the note going quiet when its scene is settled (killed three times out of three once the test waited for the
  paste);
- no re-reading of the waiting headers;
- **Create all** doing nothing (redone once in a form that built);
- marks on the wrong scenes;
- waiting scenes not added;
- waiting scenes not marked on opening.

## Not measured here

The plan asked for three of the writer's suspicions to be settled with this part. They were not, and remain open:

- **S1**, the side panel following the wrong scene after a paste;
- **S2**, "+12,710 words today" on a 12,285-word book;
- **S4**, a header line lost when it is left with the autocomplete open.
