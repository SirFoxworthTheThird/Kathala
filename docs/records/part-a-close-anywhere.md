# Part A: closing the page loses nothing

**Plan:** `next-plan.md`, Part A. **Harness:** `e2e/closeAnywhere.spec.ts`, `e2e/helpers/closeAnywhere.ts`.

## The harness

- **Each run** is a fresh browser context (its own IndexedDB and `localStorage`), seeded with the same three-scene book and opened on the Page.
- **The action is started, then the page is closed** after a chosen delay, in one of two ways:
  - **reload:** the page's own `pagehide` and `visibilitychange` handlers run, as for a tab a person closes;
  - **crash:** the renderer is killed (CDP `Page.crash`), and nothing runs, as for a browser a script closes or a machine losing power.
- **The page is opened again**, left until the store stops changing, and read.
- **The actions:**
  - typing;
  - a paste of three scenes with header blocks;
  - a paste of a chapter (`#`) with two scenes;
  - a split (`## Title` typed and left);
  - a join (a scene heading deleted);
  - a header edit (a place changed);
  - an item hand-off (an `Items:` line added);
  - Find & replace (Replace all).
- **The invariants, after every close:**
  - **Prose:**
    - no sentence of the book is lost or stored twice, in either mode;
    - a sentence the action brought is kept by a reload, and may be lost by a crash, but never doubled.
  - **No header text** (a bracket line, or a `Place:`/`Characters:`/… line) in any scene's prose.
  - **No `#`/`##` heading line** left in any prose.
  - **The journal agrees with the store:** for each record the journal touched, its last operation is what the record shows.
  - **Per action:**
    - every pasted scene, and a typed split, exists after a reload, with its header written or remembered;
    - a join is whole or not at all;
    - a header edit or hand-off is written or remembered;
    - Find & replace is all or nothing;
    - at every scene, one pair of hands holds the ledger.
  - **Nothing the app logs as an error.**
- **In the suite:** each action is closed at 0, 200 and 800 ms in each mode.
- **The soak:** `CLOSE_ANYWHERE_RUNS=N` closes each action N times per mode, at random delays up to `CLOSE_ANYWHERE_MAX_MS` (default 2,500), drawn towards the start.

## What it found (A2)

Run against `f4a7b2e`, the sweep failed four of the seven actions it then had.

| Action | What a close did | Cause | Fix |
|---|---|---|---|
| Join | Lost the second scene **and its words** (reload and crash at 200 ms) | The second scene was removed, with its prose, in one transaction, and the joined prose written in a later one | `inOneWrite`: join, split, start chapter and join chapter are each one transaction |
| Split | New scene made empty, its prose still in the first | Same: the scene made, then the prose moved, separately | Same |
| Paste with headers | `##` lines and header blocks left as prose in the scene pasted into; once the first fixes were in, a reload at 0 ms lost every pasted scene | Headings are made one at a time; until its turn, each was a line of that scene, saved there as text, and the page's close handler had nothing owed to keep | Heading lines owed in `localStorage` until made (`owedHeadings`), and made on opening; the scene pasted into written by the act's own transaction; what an act owed before it kept for a closing page until it is written |
| Header edit, item hand-off | The edit lost (reload at 0 and 200 ms) | Leaving the line starts writes; the line was kept only while the caret was on it | The line remembered (`keptHeaderLines`) until what it says is written |
| Typing, Find & replace | Nothing | — | — |

**Two more, found while fixing:**

- **`inOneWrite` committed too early at first.**
  - Given `() => joinWithNextNow(…)`, Dexie did not follow the native `await`s inside. The transaction committed at the join's first awaited delete, and the next write threw `PrematureCommitError`.
  - Dexie follows native awaits only in a scope it can see is `async`, so the scope is now `async () => await fn()`.
  - `sceneStructure.test.ts` fails 6 tests without it.
- **The close handler emptied the stash on its second run.**
  - A closing tab runs it twice: hidden, then gone. The second time, the save the first had started had moved the base, so nothing read as owed, and the stash was emptied.
  - Typing was lost on every reload, 3 of 3, until the handler stashed only when something was owed.
  - This came in with the fix, not before it. It was hidden by a stash of in-flight writes, which was itself removed (below).

**Not kept: a stash of writes merely in flight.**
- A2 first kept every write in the stash from when it was set going until it landed.
- A spec now reloads from inside the page at the moment a save's write to `sceneTexts` is issued. The typing survived 5 of 5 with that stash and 5 of 5 without it: Chromium finishes a write issued before the page goes.
- So it was taken out. The spec stays, holding the behaviour.

## Mutation testing

**Unit tests** (`sceneStructure.test.ts`): for each of split, join, start chapter and join chapter, a sceneTexts hook makes the act's last write fail, and the test asserts nothing of the act is left.
- Each act unwrapped from `inOneWrite`: its test fails, 4 of 4.
- The non-`async` scope: 6 tests fail.

**The page's fixes, through the harness:** each one broken, gated on `tsc -b && eslint` and a check that the mutation landed. The broken action was closed 8 times per mode, up to 600 ms.

| Mutant | Result | Failures |
|---|---|---|
| M1: the line not remembered when left | killed | header edit 1, hand-off 5 (of 16 closes each) |
| M2: a paste's lines not owed | killed | chapter paste 37, scenes paste 17 |
| M3: a typed heading not owed | killed | split 10 |
| M4: the scene pasted into written before the act, not in it | killed | chapter paste 6, scenes paste 10 |
| M5: writes in flight not stashed | survived | 0; removed, as above |
| M6: the close handler keeps what an act will settle | killed | join 9 (prose stored twice), split 8 |
| M7: what an act owed before it not kept | killed | split 3, scenes paste 6 |
| M8: owed headings not made on opening | killed | split 6, chapter paste 46, scenes paste 37 |
| The close handler's guard removed | killed | typing 3 of 3 |

## The measure: 200 closes per action and mode

SOAK-RESULTS

## What it does not cover

- **A heading under a chapter that has no scenes yet** (the first-scene path; writer run 11's W-1). Its act is one transaction, but no harness action reaches it.
- **Text typed under such a heading** belongs to no scene until the scene is made, so no stash can hold it.
- **A join the page closed on before it was written** comes back unjoined, both scenes with their own words. Nothing is lost, but the join is not owed and redone, as a heading is.
- **The Cards view, Focus mode and other writing surfaces.** The harness drives the Page only.
