# Part G: the results

The rerun of Part 6 (`run-10-part-6-preregistration.md`), as run under `part-g-rerun.md`. Every
pause, change and decision on the way is in `part-g/events.md`; the books, audits, verifications
and judgements are in `part-g/books/` and `part-g/evaluation/`.

## The answer

**Within the controls' range**, under the pre-registered rule. The app books won 7 of the 18
app-vs-control judgements, inside the band of 6 to 11.5. Their mean error rate is 1.28 times the
controls', under the 1.5 limit. In the first comparison the app book was the worst of three; here
the app books are neither worst nor above.

**What the judgements measured, though, is mostly which book a judge read first.** In 22 of the 24
judgements the first book won. That is not part of the rule, and the rule was applied as written,
but it changes what the 7 of 18 means:

- **Seven of the nine app-vs-control pairs split:** each book won once, when it was read first.
- **The other two went the same way in both orders, and both to the same control book:** C1 beat
  A3 and A1 whichever came first. No app book won a pair in both orders.
- **The six control-vs-control judgements split exactly:** each control won the two it was read
  first in and lost the two it was read second in.

So the app wins 7 because it was read first in 9 of the 18 and lost two of those to C1. The
judging cannot tell these six books apart, except that C1 was consistently preferred to A1 and A3.
Judging each pair in both orders, as pre-registered, is what makes this visible; a single order
per pair would have reported the order effect as a verdict.

## The books

| Book | Side | Title | Words | Letter |
|---|---|---|---|---|
| A1 | app | *What the Needle Keeps* | 90,316 | S |
| A2 | app | *The Long Round* | 97,538 | P |
| A3 | app | *What the Dark Is Owed* | 74,547 | Q |
| C1 | control | *The Merciful Increase* | 99,106 | T |
| C2 | control | *Count It Back Down* | 101,948 | U |
| C3 | control | *Surety* | 97,949 | R |

Word counts are `wc -w` on each writer's `book.md`. Removed or changed before evaluation: no scene
headers or titles (none were left in); in A2, 597 italics written `_x_` and 6 trailing backslashes;
in A3, 242 italics written `_x_`. The normalisation is in `part-g/prepare.py`, and the mapping, now
opened, in `part-g/evaluation/mapping.json`; its SHA-256 matches the one committed at the shuffle.

## Measure 1: verified continuity errors

Two auditors per book, the run-10 audit prompt, every claim checked under the pre-registered
rules (`part-g/evaluation/verified-*.md`, each verdict with its reason). The 192 claims merged
into 123 distinct ones; 74 were accepted and 49 rejected.

| Book | Side | Serious | Minor | Trivial | All per 10k words | Serious + minor per 10k |
|---|---|---|---|---|---|---|
| A1 | app | 0 | 3 | 9 | 1.33 | 0.33 |
| A2 | app | 0 | 7 | 7 | 1.44 | 0.72 |
| A3 | app | 1 | 4 | 8 | 1.74 | 0.67 |
| C1 | control | 0 | 5 | 6 | 1.11 | 0.50 |
| C2 | control | 0 | 4 | 8 | 1.18 | 0.39 |
| C3 | control | 0 | 7 | 5 | 1.23 | 0.71 |
| **App mean** | | | | | **1.50** | **0.57** |
| **Control mean** | | | | | **1.17** | **0.54** |

- Every book has 11 to 14 verified errors; the rates differ mostly by length. A3, the shortest, has
  the highest rate and the one serious error (its Tally built "ninety years ago" by a man of fifty).
- Serious + minor, the errors a careful reader could notice, are level between the sides.
- **My verification was not blind** (`events.md`): I knew each book from its writer's report. It is
  held instead to rules written before any book existed, and each accepted and rejected claim is
  in the evaluation files with its reason.

## Measure 2: blind pairwise judging

The run-10 judge prompt, unchanged; 24 judgements (`part-g/evaluation/judge-*.md`, recorded by
letter in `verdicts.json` before the mapping was opened). No judgement was "equal".

Each pair was judged in both orders. The winner of each:

| Pair | First-named book read first: winner | Other order: winner | Same both ways? |
|---|---|---|---|
| A1 / C1 | ST: C1 | TS: C1 | **yes, C1** |
| A1 / C2 | SU: A1 | US: C2 | no |
| A1 / C3 | SR: A1 | RS: C3 | no |
| A2 / C1 | PT: A2 | TP: C1 | no |
| A2 / C2 | PU: A2 | UP: C2 | no |
| A2 / C3 | PR: A2 | RP: C3 | no |
| A3 / C1 | QT: C1 | TQ: C1 | **yes, C1** |
| A3 / C2 | QU: A3 | UQ: C2 | no |
| A3 / C3 | QR: A3 | RQ: C3 | no |
| C1 / C2 | TU: C1 | UT: C2 | no |
| C1 / C3 | TR: C1 | RT: C3 | no |
| C2 / C3 | UR: C2 | RU: C3 | no |

(The letters are the judgement's file name, first book first: P = A2, Q = A3, R = C3, S = A1,
T = C1, U = C2.)

**Mean scores, app vs control judgements only:**

| | Interlacing | Pacing | No spoilers | Coherence | Craft | Overall |
|---|---|---|---|---|---|---|
| App | 9.33 | 8.78 | 6.22 | 8.17 | 8.56 | 8.17 |
| Control | 9.56 | 9.00 | 6.61 | 8.28 | 8.89 | 8.61 |

The control books score a little higher on every measure, by 0.1 to 0.45. "No spoilers" is the
lowest score on both sides: the judges found every book letting a later era give away an earlier
one, mostly through in-world legends.

## The rule, applied

- **Above the controls** needs the app to win 12 of 18: it won 7. Not met.
- **Within the controls' range** needs 6 to 11.5 wins, and neither side's error rate more than
  1.5 times the other's: 7 wins; 1.50 against 1.17 is 1.28 times. **Met.**
- **Still worst** needs 5.5 wins or fewer, or the app's rate more than 1.5 times: neither.
- **The control-vs-control reading:** the controls split their own pairs exactly evenly, so by the
  pre-registered reading a 12-of-18 result would have been a real difference. It was not reached.

## Secondary measures

- **Length.** App 87,467 words on average, control 99,668. Run 10's app book was 47,000 against
  87,000 and 93,000; the gap has mostly closed. A3 is the one short book.
- **Use of the app** (from each `backup.pwk`):

  | Book | Facts | With the scene the reader learns it | With spoiler words | Reveals recorded | Scenes |
  |---|---|---|---|---|---|
  | A1 | 15 | 15 | 14 | 60 | 77 |
  | A2 | 20 | 20 | 10 | 45 | 89 |
  | A3 | 29 | 29 | 11 | 121 | 105 |

  - All three writers report using the Continuity Checker (runs are not stored, so they cannot be
    counted).
  - **None ran the AI audit.** No writer had an API key, and none reports pasting the prompt out.
  - **The spoiler cases the judges listed in the app books** are mostly later-era legends and
    artefacts that imply an earlier ending. Whether the facts' spoiler words would have matched
    any of them was not measured.
- **Problems the app writers reported, unasked:**
  - in a headless browser, the export buttons opened a save dialog and real downloads crashed
    Chromium (A1, A3);
  - Find & replace turned line breaks into spaces (A3);
  - the checker's "possible early reveal" warnings were mostly noise, and a fact's tags could not
    be removed (A1).

## What this can and cannot support

- **It can support:**
  - App books written in Kathala after Parts A–F are of control length and control quality, by
    both measures. They are no longer the worst.
  - The app did not make them better. No measure favours the app side, and the one consistent
    preference was for a control.
- **It cannot support:** any finer ranking of these six books from the judgements. The order
  effect is larger than any difference between them.
- **For the next comparison:**
  - Pairwise judging by this prompt needs a fix for order before it can rank books this close:
    more judgements per pair, or a different design, such as each judge scoring one book.
  - The judges' commonest complaint on both sides was an early reveal told as legend. Whether the
    app's early-reveal check can catch that is worth measuring against these books' spoiler lists.
- **Caveat, as pre-registered:** three books a side is a small sample. This is evidence about this
  model and this brief, not proof.
