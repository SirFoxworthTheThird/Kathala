# Part 6, first attempt: what survived

Part 6 of `run-10-plan.md` was pre-registered in `run-10-part-6-preregistration.md` (9a65f19) and
started on 2026-10-19. It did not reach evaluation:
- Three of the six books were finished: A1, A2 and C1.
- Three more, C2, A3 and C3, were close to finished when the weekly usage limit stopped every
  writer.
- During the six-day wait, the session's container was reclaimed. The scratchpad held every
  book, every browser profile with the app books' worlds, the writers' notes, and the saved
  prompts, and all of it went with the container.

What survives is the writers' own final reports, kept in the session transcript. This file keeps
them, and says what they can and cannot support. **No book was audited or judged**, so the
question Part 6 asks — did the app books move from worst to within the controls' range? — has
no answer from this attempt.

## The books, as their writers reported them

All three finished books passed the pre-registered format check. That covered 21 chapters, an
italic era line after each heading, and `* * *` between scenes. The check also found no scene
headers, sigils or other app markup left in the prose. Word counts are `wc -w` on each
`book.md`.

| Book | Side | Title | Words | Eras |
|---|---|---|---|---|
| A1 | app | *Quietus* | 86,867 | The Concern · 2391; The Silence · 2706; The Lane · 3051 |
| A2 | app | *What the Throat Keeps* | 89,497 | The Tally · 61 WY; The Siege · 388 WY; The Cinder · 1003 WY |
| C1 | control | *Burning Night* | 83,250 | The Severance · RY 1; The Wardenry · RY 312; The Unsealing · RY 771 |

When the limit stopped them:
- **C2** (control) was starting chapter 16.
- **A3** (app) was entering factions and lore into the app.
- **C3** (control) was starting chapter 21.

## What the reports say about using the app

- **Length.** Run 10's app book was 47,000 words, against 87,000 and 93,000 for its controls.
  Both app books here are 87,000–89,500 words, beside one control of 83,000. The first
  comparison's largest gap is gone.
  - A cause is likely but not proven. The paste and numbering fixes (#622, #628) remove the
    overhead run 10's writer spent its actions on.
  - The writing duty is also different. Run 10's app writer was the `writer-review` agent,
    which has a bug-reporting job; these app writers had none.
- **The spoiler check was used, and caught one.**
  - **A2:** the Continuity Checker's early-reveal check flagged a line in Ch. 2 that named the
    Sodality's first Keeper of the key, giving away the twist at the end of Ch. 19. The
    writer took the line out.
  - **A1:** it used the same check as a guard and reported "no real leaks across eras".
  - Run 10's check found 0 leaks because no fact had tags (Part 3's finding).
  - A1 says it gave each of its 16 facts spoiler words. A2 says its 14 facts record who learns
    each one and when the reader does; it does not say whether they have spoiler words.
- **A1 met a bug.**
  - Pasting chapters onto the Page lost the scene header in about 30 later scenes. Header text
    landed in the prose, and some fact lines were never recorded.
  - The writer repaired it by hand. It re-applied or merged headers, removed the fragments
    with Find & replace, and entered the missing facts on the Knowledge screen.
  - This is the one app problem either app writer reported. It is still open: run 11's paste
    fixes did not prevent it.
- **C1** fixed continuity and spoilers as it read back chapter by chapter. It did not reread the
  assembled book cover to cover.

## What this can and cannot support

- **It can support:**
  - Two app writers using this version of the app on this brief produced novels of control
    length.
  - Both used the knowledge model and the early-reveal check as intended.
  - The check stopped at least one real spoiler from reaching a book.
- **It cannot support** any claim about continuity, spoilers on the page, or quality. Those
  need the audits and the blind judging, which never ran. Two app books and one control,
  unaudited and unjudged, are not a comparison.

## For the next attempt

- **Keep the evidence in the repository, not the scratchpad.**
  - Commit the prompts, the audit and judge prompts, and `quotes.py` before the first writer
    starts.
  - Commit each finished `book.md`, and each app book's `.pwk`, as it arrives. The letters
    and the sealed mapping can be committed after shuffling, since evaluators read only their
    own files.
- **Don't leave the container idle across a long limit.** It is reclaimed when idle. A
  half-written book in the scratchpad has no protection unless it is committed.
- **Fix A1's paste bug first.** Otherwise the next app writers will pay for it too.
