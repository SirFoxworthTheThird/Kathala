# T2: what goes out

**Plan:** `round-trip-plan.md`, T2.1 to T2.4.
**Findings:**
- W-G, W-H and RT-4 in `writer-run-2026-11-09-blind-editor.md`;
- E-6 and E-9 in `editor-run-2026-11-09.md`.

## T2.1: italics typed with asterisks

**What was wrong.** `proseEmphasis.ts` read `_underscores_` only. The writer's draft had 19 italics typed as
`*like this*`, and they went to the editor as asterisks. The rule had been decided on the Library's Gutenberg books,
which use underscores.

**The measure (decision D-1).** `npm run probe:emphasis` reads every paragraph of every Library book, in every
language, with asterisks as emphasis and without, and prints each one that reads differently.

| | |
|---|---|
| Books | 51 |
| Paragraphs | 98,474 |
| With an asterisk | 150 |
| **Reading differently** | **32, all in *The Undersong*** |

**What changes, and what does not.**
- *The Undersong* is an original book written with asterisks. Every span that reads differently there is meant as
  italics: the ships *Grace Ainsley* and *Mary Vane*, thoughts, diary entries, a shouted *Now.* Its italics had been
  showing as asterisks.
- Every other asterisk in the Library stays literal. Each one was listed and read:
  - Moby-Dick's and *The Moonstone*'s footnote marks;
  - the `* * *` lines of nine books;
  - *Pride and Prejudice*'s NIND markers;
  - *The Three Musketeers*' notes.

**What was done.**
- `*` wraps emphasis by the same rule as `_`, and `emphasisSpans` takes which delimiters to read.
- An asterisk beside another is never one, so `**bold**` and `f***` stay as written. That is also why `* * *` can
  open nothing: each asterisk in it is followed by a space or another asterisk.
- A first version also checked for a line of nothing but asterisks. A mutant showed that check could never be the
  one that decided, so it was taken out rather than kept as a claim.
- Read, the HTML, the Word file and the EPUB all set asterisked words in italics, through the same parser.

**The import, so the round trip stays clean.** The Word file's italics are read back as `_so_`. For a scene that
writes its italics `*so*` (`italicMark`), they are now written as asterisks instead (`withAsterisks`). Both marks are
one character, so no place in the text moves. Without this, every italic in such a scene would have come back as an
edit made with tracking off.

## T2.2: the title page

**The name printed twice (E-6).** The contact block's first line is the writer's name, and writers begin their
contact details with their name. `contactLines` drops a first contact line that is the name, whatever its case and
spacing. The dialog now says *Your name is put above these lines*.

**The count.**
- `roundedWordCount` now rounds to the nearest hundred under 20,000 words, where it had stopped at 10,000. The
  run's book of 12,724 words now reads *about 12,700*, not *about 13,000*, which both the writer and the editor had
  asked for.
- **Word count on the title page** (`SubmissionDetails.wordCount`) says it as the writer wants. A bare number reads
  *about 12,700 words*, other words are used as written, and an empty field gives the count, rounded. Its
  placeholder is that rounded count.

## T2.3: which draft a file came from (W-H)

- **The name.** A draft saved as a file goes to an editor is named for when, to the minute, and for the file:
  *Sent for editing, 9 Nov, 14:05 (the-salt-ledger.docx)* (`sentDraftName`).
- **What the draft knows.** It records the file's name (`BookDraftRecord.sentAs`). Each suggestion brought in
  records the draft its file was made from (`EditSuggestion.fromDraft`).
- **In Drafts**, that draft says *Sent as …*, and while changes from it wait, *Changes waiting from this draft*.
  Deleting it says the file was made from it for an editor, and that without it, edits made in that file with
  tracking off cannot be found.
- **S3** — a draft saved when no file was delivered — is not measurable from the page. A download started by
  clicking a link tells the page nothing about a cancelled save dialog. It is left as it is, and the warning on
  deleting a sent draft covers the cost.

## T2.4: Normal is the default style (E-9)

`styles.xml` marks Normal `w:default="1"`, and no other style. A tool reading styles found no style on the body
paragraphs without it.

## Tests

- **`proseEmphasis.test.ts`:**
  - asterisks wrap emphasis, alone and beside underscores;
  - `* * *`, `***`, footnote marks, a sum, `f***`, `**bold**` and an asterisk inside a word stay as written;
  - so does an opened `*` reaching a `***` (`*what the f*** was that`);
  - only the delimiters asked for are read.
- **`manuscriptExport.test.ts`:**
  - an asterisked italic is an italic run in Word;
  - the rounding at 12,724, 19,949 and 20,499 words;
  - the count as the writer says it;
  - the contact block without the name again;
  - the file with one name and the writer's count;
  - Normal as the only default style.
- **`docxImport.test.ts`:** a scene in asterisks gets its italics back as asterisks, with no edit made with tracking
  off and a tracked change in its own markup; a scene in underscores keeps underscores.
- **`bookDrafts.test.ts`:** the sent draft's name, unique to the minute, and `sentAs` kept only where given.
- **`editImport.test.ts`:** every suggestion says which draft its file came from.
- **`submissionDetails.test.ts`:** the word count is remembered with the other details.
- **`e2e/wordRoundTrip.spec.ts`:**
  - an asterisked italic goes out as an italic run, and comes back as no change;
  - the sent draft says what it was sent as;
  - deleting it warns, and deleting a plain draft does not;
  - after the file comes in, the sent draft — not the draft saved as it came in — says its changes are waiting.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. All twelve were killed:
- asterisks not delimiters;
- an asterisk beside another closing;
- the import keeping underscores;
- rounding to the thousand from 10,000;
- the name printed twice;
- the writer's count ignored;
- sent drafts all named alike;
- `sentAs` not kept;
- `fromDraft` not kept;
- Normal not default;
- no warning on deleting a sent draft (e2e);
- waiting changes never marked (e2e).

A first form of four mutants did not build, and they were redone. One more, the line-of-asterisks check, survived
because that check could never decide anything. It was removed rather than kept.

The probe's count is kept above and in `proseEmphasis.ts`, and it is re-runnable with the Library beside the
repository.

## Not done here

- **Italics in a moved text's words.** The words a move is paired by are read from the file's runs, which have no
  italic marks, while the texts compared have them. A moved passage with italics in it could fail to pair, and would
  then come in as two changes. No file in hand has one.
