# T19: bringing in a move

**Plan:** `round-trip-plan-4.md`, T19.
**Findings:** the eighth of `loop-2026-11-14.md`; the writer's W3-3.

## What happened

In round 2 the third loop's editor made three moves. LibreOffice wrote each one as a real move (`w:moveFrom` and
`w:moveTo`), the first time in any loop.

- **One came in as three changes**, two of which read as nonsense: `Hanne grunted. "WhenThe gate's at the river…`.
  Accepting all three gave the editor's text.
- **One was refused** as *Made here, this would run two sentences together*. The two spacing edits beside it were
  refused as *you have changed them since*, in a scene the writer had not touched. The writer made all three by hand.

## Why

Each was measured on the round-2 file, against the book as it was when the file came in.

**The first.** The move's two halves were not paired, and the half put in was split in pieces.
- The record said the space fell on the other side, ` The gate's at … gate.` out and `The gate's at … gate. ` in.
  That is so, but the halves are already paired with their spaces set aside (`moveWords`).
- What kept them apart: the half put in was read from a comparison of the text before the moves were made with the
  text after. That comparison took the common word *the* as a fixed point, and found the insertion as two changes
  around it: `"When ` made `"The gate's at `, and `the ` made `the cellar end, … `. Neither was the moved words, so
  neither paired, and both were listed apart.

**The second.** The move took `" Vael set the lamp down on a pallet. "`, quotation marks and spaces with it. That left
`coat.I had` where it was, and `ring. "` where it went. The editor then put the spaces right with two small edits,
which the file measures with the move made. The move alone runs two sentences together; each spacing edit, alone,
finds words that are not there yet.

## Now

**A move's halves are placed by their words** (`placeRun`, `docxImport.ts`). Each half is found in the text where
its words are, as words, with any whitespace between them, including a line break. The whitespace either side goes
with it where taking it out leaves what the other text has there. The words must be in the text once. The comparison
is used, as before, only for a scene where some half cannot be placed this way.

**A change touching a half is made with its move** (`MovePart` `'with'`). A tracked change whose place, in the text
with the moves made, touches where a half was taken out or put in becomes part of that move:
- it is made after the move's halves (`MOVE_ORDER`), from whichever of them is accepted;
- it is rejected with them;
- it is counted once with them, as one change;
- the list shows the move alone, with **⇄ Moved**;
- where the half has no partner, the change stays a change of its own.

**A change is refused as running two sentences together** only for what its rows put in. One row putting right what
another made, as the space after a move does, no longer counts against it.

### The round-2 file, now

- **The first move is one change.** Its half put in is the whole sentence, placed after `Hanne grunted. "`, and no
  piece of it is left in the list.
- **The second move is one change, with its two spaces, and it can be made**: `coat. I had`, and
  `ring." Vael set the lamp down on a pallet. "All they needed`.
- **The third**, which came in right before, is unchanged.
- **The file counts 23 changes in 12 scenes**, from 27: the first move's three pieces are now one, and the two
  spaces belong to their move. The editor counted 26 changes in 23 acts.
- In every scene with a move, making its changes in turn gives the editor's text.

## Tests

- **`movesBroughtIn.test.ts`**, on the round-2 file:
  - the first move: one change, its words whole, and no piece of it left;
  - the second: its four parts in order, `from`, `to`, `with`, `with`, and it can be made, with the text it makes;
  - every move can be made, and each scene with one, its changes made in turn, is the editor's;
  - `placeRun`: the space after or before, across a line break, not where the rest is not the other text, not twice,
    not absent.
  - a change touching the end of the words put in is made with the move, as one at their start is; one apart is a
    change of its own.
- **`editImport.test.ts`**: a change made with a move is counted once, made after the move's halves when accepted from
  itself, and rejected with them. It is stored ahead of the halves, with the id that comes first, so that the store's
  own order is the wrong one.
- **`wordRoundTrip.spec.ts`**, in the app: the editor's move from between two speeches, with the two spaces put
  right, comes in as *1 change*. It is one item in **Changes** and is accepted whole.

**Mutants**, in a separate worktree, gated on `tsc && eslint && echo MUTANT-OK && grep`. 16, all killed, 4 of them by the
e2e as well or alone:
- **placing (6):** halves not placed by their words; the space after not taken; the space before not taken; the rest
  not checked against the other text; the first of two places taken; not across a line break. The e2e's move is
  placed rightly by the comparison too, so the first is the unit tests' alone;
- **touching (4):** never (and again by the e2e); the cut not where it was; the half put in only at its start; a
  change touching an unpaired half not kept apart;
- **making (3):** what was made with a move made first; a change refused for what one of its rows puts right; the
  rows of an accepted move not put in order;
- **counting (1):** a change made with a move counted apart;
- **the list (2, by the e2e):** what was made with a move shown apart; tried out of order.

Two survived as first run, and the tests were made to catch them:
- **the half put in only at its start:** no test had a change at the end of the words put in;
- **the rows not put in order:** the test's ids came out of the store in an order that happened to work.

Four did not build as first written, leaving a name unused or narrowing a type to `never`. They were redone and
killed.

## Not done here

- **A change beside a move is joined to it by place alone.** One the editor made for its own sake, touching where a
  move's words were or went, is made and rejected with the move.
- **Words moved twice in one scene, the same words**, cannot be placed, since `placeRun` needs them once. Such a scene
  is read by the comparison, as before.
