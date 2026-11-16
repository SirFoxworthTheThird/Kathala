# T20: revision tasks from a letter

**Plan:** `round-trip-plan-4.md`, T20.
**Findings:** the ninth of `loop-2026-11-14.md`; the writer's W3-6 to W3-9. Each was seen in both of Maren Hollis's
letters, which are fixtures (`run-2026-11-14-loop3/round{1,2}-editorial-letter.txt`).

## What happened, and now

### "Ch3" is a chapter (W3-6)

This editor writes chapters as *Ch3*, *Ch5, scene 3* and *in Ch6*. `CHAPTERS` took *ch. 3*, *ch.3* and *ch 3*. It did
not take *Ch3*, with no stop and no space. T7.6 had left that out on purpose.

**Now** a number in figures straight after *ch* is a chapter. The match does not count a *ch* inside a word (*church4*,
*branch4*), and a number in words still needs a space.

| | Tasks naming a chapter | Linked to one, before | Now |
|---|---|---|---|
| First letter | 21 | 4 | 21 |
| Second letter | 3 | 2 | 3 |

The writer counted 18 from the stored tasks, after their own edits to them. Their round-3 case,
*Ilse goes to the Exchange (Ch5, scene 3) … One line in Chapter Seven*, now links to chapters 5 and 7, where it linked
to 7 alone.

### A sign-off read by where it is (W3-7)

*With warm good wishes, and congratulations on a very good first draft,* and *Maren* under it were ticked as tasks, in
three splits across both letters. T11.2 had listed phrases, and *warm good wishes* was not one of them.

**Now** a line among the letter's last few that opens with *With* and ends at a comma is the sign-off, whatever its
wishes, where nothing under it is a sentence. A line opening *With* elsewhere in the letter is not one. Neither is a
last instruction that opens *With* and has no comma at its end. In both letters, the sign-off and the name are
offered unticked.

### A long numbered heading (W3-8)

*1. The scheme: told too often, and never quite pinned down (your question 1)*, 74 characters, came in as a point.
Sections 2 to 7 came in as headings, and the seven scheme tasks sat under no heading of their own.

**Now** a numbered line standing over a paragraph is a heading up to 120 characters, rather than 60, where:
- the letter has another numbered heading, short enough to be one anyway;
- the line holds no sentence: no stop followed by a capital.

Alone, a long numbered line is still a point.

**The first loop's first letter had the same**: *1. The fraud has to make sense on one sheet of paper (structure and
plot logic)*, 77 characters. It is a heading now. The tasks under it are filed under it, where they were under
*WHAT MOST NEEDS WORK*, and there is one task fewer: 59, where it was 60. The other five earlier letters read exactly as
before, every item and every task, compared whole before and after.

### Which letter (W3-9)

Both letters were from Maren Hollis, both dated 14 November. Every task from either said *From the letter: Maren
Hollis*, what the writer typed both times.

**Now** a letter's tasks say which letter (`letterName`):
- **whose**: what is typed under **Whose letter**; or, where that is empty, the name in the letter's head before its
  date (*Maren Hollis, 14 November*, or *Margit Hale to Ruth Callan, 9 November 2026*), or the name it is signed with;
- **when**: the date in its head;
- **which round**: where the book already has tasks from a letter from the same hand, its round.

The first letter gives *Maren Hollis's letter of 14 November*, and the second *Maren Hollis's second letter, of 14
November*. A name typed with a date in it is taken as typed. The dialog says what the tasks will say before they are
added, and each task says *From Maren Hollis's second letter, of 14 November*. A task made before this keeps what it
said: *From the letter: Ines, 3 November*.

## Tests

- **`letterLoop3.test.ts`:**
  - every task in both letters that names a chapter is linked to it; *Ch3* and its kin, and not inside a word;
  - the sign-off and the name unticked in both letters; a line opening *With* mid-letter, or at the end with no comma,
    kept;
  - *The scheme…* a heading, with its seven tasks under it; a long numbered line alone, or holding a sentence, a point;
    the first loop's *The fraud…* a heading;
  - `letterName`: both letters, by their heads and as typed in the run; a third; a typed date; no name; a signature
    alone; the earlier runs' letters.
- **`editorialLetter.test.ts`**: the T7.6 assertion that *ch3* is no chapter now says it is one, with *church4* and
  *such.4* still none.
- **`revisionTasks.spec.ts`**, in the app: both letters pasted with no name typed. The heading, the sign-off and the
  name read right; the dialog says what each letter's tasks will say; and in the one list each task says which letter
  it is from.

**Mutants**, in a separate worktree, gated on `tsc && eslint && echo MUTANT-OK && grep`. 16, all killed, 4 by the e2e:
- **chapters (1):** *Ch3* not read;
- **the sign-off (2):** not read by where it is; read without its comma;
- **the heading (3):** never longer than 60; longer alone too; one holding a sentence;
- **the letter's name (6):** no date; no round; the one written to kept as whose; no signature; a typed date not taken
  as typed; a letter named before by its name alone not counted;
- **the dialog and the list (4, by the e2e):** the name not used; the book's letters not asked; not said before adding;
  the list saying it as before.

## Not done here

- **A round is counted from the tasks the book holds.** Delete every task from an editor's first letter, and their
  second is named as the first.
- **The name read from a letter's head** needs the date on the same line. A head that gives the name and the date on
  two lines gives the name from the signature, where it has one.
