# After Part G: what the app writers ran into, fixed

The three app writers of Part G (`part-g-results.md`) reported, unasked, three problems with the
app, and the judges' commonest complaint about every book was an early reveal. Each is taken in
turn here.

## Find & replace turned line breaks into spaces

**What happened.** Writer A3 used Find & replace to add a passage: it replaced a line with three
paragraphs. Its two boxes were one-line inputs, and an input cannot hold a line break, so the
paragraph breaks became spaces before the replace ran, and the passage went in as one run-on
paragraph. A3 then split those paragraphs by hand on the Page.

**Fixed.** Both boxes are textareas, one line tall until a break is typed or pasted. A replacement
keeps its paragraphs, and a search can find a phrase across a paragraph break.

**Checked.** `e2e/findReplaceLines.spec.ts`: a replacement with a paragraph in it is stored and
shown as its own paragraph; a search across a break finds it, and the same words joined by a space
do not. With the inputs put back, both tests fail.

## The world backup did nothing in an automated browser

**What happened.** Writers A1 and A3 drove the app from Playwright's Chromium. Export a .pwk copy
asked the File System Access "Save as" picker where to save. Under automation, Chromium refuses the
picker at once, with the same AbortError a person's Cancel gives, and the export took it for one and
did nothing.

**Fixed.** A browser with `navigator.webdriver` set has nobody to answer the picker, so it is not
asked; the file downloads (`src/lib/download.ts`). Every export now downloads through one helper,
which keeps the link in the document while clicking it and releases its URL a minute later rather
than at once.

**Not reproduced:** the writers' report that real downloads crashed the browser. A manuscript
download in the same kind of browser and profile worked here. The helper's later release is a
precaution, not a fix for a crash seen.

**Checked.** `e2e/exportAutomated.spec.ts` runs the backup in Playwright's Chromium with the picker
present, as the writers had it, and reads the downloaded world back. `download.test.ts` covers the
helper. Mutants: the automation check removed (the e2e test times out waiting for a download); the
URL released at once (the unit test fails).

## Early-reveal warnings were mostly noise

**What happened.** The check matched a fact's tags as well as its spoiler words. A tag sorts a fact;
writer A1 tagged its facts with era names and labels (*Concession*, *Severance*, *anchor*, *core*),
words its prose used on every page.

**Measured** (`npm run probe:leaks`, on the three app worlds):

| World | Warnings, tags matched | Of them a tag | Warnings now |
|---|---|---|---|
| A1 | 90 | 67 | 23 |
| A2 | 0 | 0 | 0 |
| A3 | 0 | 0 | 0 |

A2 and A3 had no tags. A1 had no way to remove its tags in the app: tags on a fact are not shown or
edited anywhere, and their only effect was this matching.

**Fixed.** The check matches a fact's spoiler words and its exact title only. A fact with a reveal
scene and no spoiler words is listed as one the check cannot look for, tagged or not. Tags stay on
the fact, inert. Mutant: tags matched again, four tests fail.

## Does the check catch the early reveals the judges found?

**Mostly not.** The judges named the chapters in which each app book gives an earlier era away:

| World | Judges' leak chapters | Chapters the check warns in |
|---|---|---|
| A1 | 2, 3, 8, 9, 14, 17 | all six, and 1, 6, 7, 10, 11, 19 |
| A2 | 2, 6, 8, 11, 12, 14, 17 | none |
| A3 | 3, 5, 6, 9, 12 | none |

- **A2 and A3:** no warning anywhere. Their writers gave spoiler words to 10 of 20 and 11 of 29
  facts, and none of those words appears before its fact's reveal.
- **A1:** of the eight warnings in the judges' six chapters, one is the leak the judges describe:
  *Inheritance* in ch 17, the founder's book that spells out the plan. Another (*sleeve*, ch 8) is a
  real early mention of the rigged Draw, but not the leak the judges cite there. The rest match
  common words the writer chose: *covenant*, *breathing*, *scar*, and *sleeve* in ch 9, meaning a
  coat sleeve.

The leaks the judges found are mostly told as in-world legend or carried by an object: a later era's
catechism naming the earlier heroine a traitor, a relic engraved "FOR CL", a body found in a vault.
A list of words cannot see those. Catching them takes a reader, which the AI audit (Part F3)
already is.

## The AI audit asks for early reveals

**Changed.** The audit's prompt (`src/lib/auditPrompt.ts`) asked for "the book saying something
before the chapter in which the reader is meant to learn it", against the fact schedule only, and
excluded "in-world myth" from everything it counted, the form most of the judges' leaks took. It now
asks for early reveals as a kind of finding of their own:

- a fact in the schedule given away before its chapter;
- in a book told in more than one era, a later era giving away how an earlier era's story turns
  out, or a secret its chapters have not yet revealed, when the reader reaches the later passage
  first;
- however it is told: narration, dialogue, history, legend, rumour, song, inscription, a name on a
  building, a relic or a body, or what a later character simply knows. A legend the book bears out
  counts; one it shows to be false does not. Myth is still no contradiction.
- only where a reader could take the answer from the passage: a hint or a mood is not one.

A contradiction still quotes both sides; an early reveal quotes the passage that gives it away, so
the reply check (`auditReply.ts`) keeps one on a single quote. Every quote is still looked for in
the book, and a finding with none is dropped. The checker titles one **Early reveal:**.

**Checked.** Unit tests on the prompt, the reply check, the checker and the stored finding. Mutants:
one quote required of every finding, a contradiction kept on one quote, every reply read as a
contradiction, the checker's prefix removed, the prompt's "however it is told" sentence removed, and
the era clause narrowed to any later chapter: each fails a test.

**Not measured.** Whether an assistant given this prompt finds the leaks the judges found in the
three app books needs an API key, and is left until there is one: run the audit on
`docs/records/part-g/books/A1`–`A3` and compare its early reveals with the chapters in the table
above.
