# Part E: the reader's knowledge, while writing

`next-plan.md`, Part E, after D. It answers run 10's spoiler gap, the judges' worst score: *The Cold Choir* braids three strands, and the Compact named the Opener chapters before the Mercy was to reveal her. Part 3 of the run-10 plan gave facts spoiler words and taught the continuity checker to say which era gives a fact away. Part E puts that check where the book is written, and draws it across the whole book.

## E1: the check on the Page, as it is written

A fact's spoiler words, in a scene before the one where the reader is set to learn it, are underlined in amber on the Page as they are typed. Holding the pointer on one says *Gives away "…": the reader learns this in Ch. 19*. Where the reveal is in another strand, the strand is named as well: *in Ch. 19, The Mercy*. At the reveal and after, the same words are the book telling it, and are not underlined.

- **One check, not two.** The matching moved into `factMatches` (`src/lib/spoilerWords.ts`), which returns every place a fact is given away, not only whether it is. The checker (`computeKnowledgeLeaks`) and the Page (`sceneLeaks`) both read it, so they cannot disagree. The existing checker tests pass unchanged, and they are what showed the refactor kept the checker's behaviour: the title as a phrase first, then each spoiler word and tag as a whole word, with the first match named.
- **Against the whole book.** The reveal may be in another strand's chapter, so the Page orders scenes over every timeline (`positionLookup` over all of the world's scenes), whichever timeline it is showing.
- **On the scenes in view** (`src/features/timeline/leakMarks.ts`), redrawn as the text changes and when the facts do.

## E2: the reader's schedule

**Reader's schedule**, in the Knowledge screen's header, draws each fact the reader is set to learn against the chapters in reading order (`src/lib/readerSchedule.ts`, `src/features/knowledge/ReaderSchedule.tsx`):

- **●** at the reveal, in its strand's colour;
- **!** at each earlier chapter whose prose gives it away, one per chapter, by the same check.

How early is counted in chapter numbers, since the book numbers its chapters across every strand. Above the grid, **What the reader knows** lists the facts told by the time cursor's scene, each with where it was first told. A fact a strand gave away before its reveal says so: *told early by Ch. 2, The Compact — its reveal is Ch. 19, The Mercy*.

The schedule is every reveal in the book at once. Its button is a page-header action, and a page header shows none to a reader in reading mode. An earlier draft also checked reading mode itself, a second guard that a mutant showed did nothing, so it was taken out.

## The plan's measure, on run 10's book

The plan: *Run 10's book, with Part 3's spoiler words added, flags the judges' cases (Ilse named as the Opener in chapters 11–12).* `readerSchedule.test.ts` reads *The Cold Choir* (`e2e/fixtures/cold-choir.pwk`) with the spoiler word *Opener* added to *Ilse Varga flew Deck Nine down to Ninefold*.

- **The judges' chapters are on the schedule.** The reveal is Ch. 19, The Mercy. Ch. 11, The Compact, gives it away 8 chapters early, and Ch. 12, The Quiet, 7. Every chapter that gives it away is in a strand other than the reveal's.
- **Without the word, there is nothing to see.** The schedule shows what the check finds, not a guess.
- **The word is earlier still, in the Compact's Ch. 2,** which the judges did not single out. By the check's rule that is where a reader first meets it, and a reader at Ch. 12 is shown as told it early, there.
- **The schedule's screenshot is of this book** (`docs/images/113-reader-schedule.png`), and so is the Page's (`112-page-early-reveal.png`, the Compact's Ch. 11).

The plan's other measure, the app books' "no spoilers" score in the next comparison, waits for that comparison.

## Tests

- **Unit:**
  - `sceneLeaks.test.ts`: every match, case-insensitive and whole word, with the title first; only before the reveal; only for a fact with a reveal in the book.
  - `readerSchedule.test.ts`: a small braided book; run 10's book, above; what the reader knows at a point, with and without a leak.
- **e2e:**
  - `pageEarlyReveal.spec.ts`: a word already in the prose is underlined, saying where; the same words at the reveal are not; a word typed now is underlined as it is typed, naming the other strand's chapter; deleted, it goes.
  - `readerSchedule.spec.ts`: the reveal and leak cells, read by their names; what the reader knows at chapter 12, and at chapter 1; a reader is not offered the schedule, paired with a writer who is.
- **Mutants:**
  - Leaks counted at or after the reveal: turns the Page spec and the unit test red.
  - `knownBy` ignoring leaks: turns the schedule spec red.
  - A page header showing its actions to a reader: turns the reading-mode test red.
