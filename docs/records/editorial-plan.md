# Editorial review: a plan

**Status:** decided 2026-11-02 (see *Decisions*), to be built in order.

## Where it comes from

Kathala checks whether a story holds together:
- the continuity checker;
- the AI audit, with every quote checked;
- the spoiler pass;
- reading mode, for a beta reader.

It does little for the other half of editorial review. An editor reads the prose, marks it up and writes notes, and the author works through them.

**What exists today**, read from the code at 0f2906e:
- **Scene status**, five steps from `idea` to `final`. Export can include only the scenes at or past a status.
- **Scene history.** Each scene keeps its 20 most recent revisions (`MAX_SCENE_REVISIONS`), and any of them can be compared with the current prose and restored. There is nothing for the book as a whole.
- **The operation journal** is capped at 500 operations (`JOURNAL_MAX_OPERATIONS`), and prose is not on it (`src/types/operation.ts`). So it cannot answer "what changed since I sent the draft".
- **Word export** (`compileDocx`, `src/lib/manuscriptExport.ts`) is written by hand into a store-only ZIP. It has no `styles.xml`, no header, and direct formatting on every run.
  - Nothing comes back: the guide says `.docx` import is "planned".
  - `next-plan.md` set aside paragraph styles and manuscript format as small and independent.
- **The Page** is CodeMirror 6 (`draftEditor.ts`). It can mark spans of prose: the early-reveal underline, `leakMarks.ts`, is drawn as decorations.
- **The AI audit re-places its quotes** in the prose as it is now, every time the checker runs (`placeQuote`, `auditReply.ts`). A finding follows its words through edits and splits, and goes away when they are rewritten. That is most of what anchoring a note needs.
- **Merge** unions records by id, and tombstones travel (`mergeTombstones.ts`).
- **Nothing in the prose itself is checked:**
  - no notes pinned to a passage;
  - no tracked changes;
  - no repetition or rhythm checks;
  - no task list;
  - no way for a reader's reactions to come back.

**The goal:** a writer can send the book to an editor or a beta reader, get their notes and changes back into the book, and work through them to done, without a copy of the book outside the app going stale.

## The plan

Seven parts, R1 to R7. Each is one or more PRs, in the order given. R1 is the foundation: R4, R5 and R7 put their findings into notes, and R5 turns notes into tasks.

### R1: notes on the prose

**What:** a note pinned to a passage of a scene.
- It says what the note is about: a query, a cut, a fact to check, praise. It can be answered, resolved or reopened.
- It is shown in the Page's margin, and the passage is lightly marked.
- It is listed, with filters, in a **Notes** panel: open or resolved, chapter, who wrote it.

**The anchor** is the quote, not a character position: `{ eventId, quote, prefix, suffix }`, the W3C *TextQuoteSelector* shape. It is re-placed in the current prose on every read, by `placeQuote` extended with the prefix and suffix to pick between repeats.
- So a note survives an edit around it, a scene split or join, a move to another chapter, and Find & replace.
- Its words rewritten, it becomes **unplaced**: still listed, with its quote, as the AI audit's findings are not. An editor's question is not answered by rewording the sentence it asked about.
- While the Page is open, the passage is tracked through typing by CodeMirror's position mapping. The quote is updated when the scene saves.
- *As built (`r1-notes.md`):* not this. The quote is never rewritten as the prose changes. A note whose words were edited is found with them changed, by a closest match, and moved onto them only when the writer acts on it. A prose save therefore stays off the undo journal, and edits from a scene card, Focus mode or Find & replace are followed exactly as typing on the Page is.

**Storage:**
- A new table, `proseNotes`, as a Dexie version block (v63).
- It goes on the journal (`OperationEntity: 'proseNote'`) and into `.pwk`, and its deletions are tombstoned.
- Resolving a note is an edit, not a delete, so resolved notes stay as the record of the review.

**Who wrote it:** `author: { kind: 'me' | 'editor' | 'reader' | 'check', name? }`. R4, R6 and R7 make notes of the other kinds, and the AI audit's findings can become `check` notes.

**Measure:**
- Unit tests on re-placing: edits on either side, a repeated phrase picked by its context, split, join, move, Replace all, rewording to unplaced.
- An e2e test that makes a note on the Page, edits around it, reloads, and finds it on its words.
- Mutants: prefix/suffix ignored, and position used instead of the quote.

**Size:** medium. One table, a margin, a panel.

### R2: standard manuscript format, and Word styles

**What:** a **Submission** option on Word export, in standard manuscript format (the Shunn layout, as agents and editors expect it):
- 12-point Times New Roman or Courier, double-spaced, 1-inch margins, first lines indented half an inch;
- a running header with *Surname / TITLE / page*, using a `PAGE` field;
- a title page with the author's name and contact details top left, the word count rounded to the nearest thousand (hundred under 10,000) top right, and the title and byline centred;
- chapters starting on a new page; `#` as the scene break; *END* at the close.

Every Word export also gets real paragraph styles (`styles.xml`: *Normal*, *Heading 1*, *Title*, *Scene Break*, *Verse*) in place of direct formatting, so an editor can restyle the whole file at once.

**New fields:** the author's name for the byline and their contact block, kept per world in World settings and remembered for the next export. They go into the file and nowhere else.
- *As built (`r2-manuscript-format.md`):* kept per book on this device, in the export dialog, not in World settings. World settings travel in the `.pwk`, which goes to beta readers, and so would the writer's address and telephone number.

**Measure:**
- Unit tests that read the generated XML: the styles, the header field, the rounded word count, the scene break.
- An e2e test that downloads the file and reads its XML back.
- Once R4's reader exists, R4's tests read R2's files too, so the export and the import check each other.

**Size:** small.

### R3: named drafts of the book

**What:** **Save a draft** — "Draft 2, sent to Ana, 3 Nov" — keeps the whole book's prose, scene structure and chapter order as it is now. Then:
- **Compare** any draft with now, or two drafts with each other. Changed scenes are listed with their word-count change; moved, added, removed, split and joined scenes are named; each scene opens in the existing history diff.
- **Restore a scene** from a draft, which first saves the current prose as a revision, as scene history's restore does. Restoring a whole draft is not offered: it would bury every record written since.
- Exporting for an editor (R4) offers to save a draft first, and applying an editor's changes saves one automatically, so there is always a way back to before.

**Storage:**
- A new table, `bookDrafts`: name, date, and a compressed snapshot (`CompressionStream('gzip')`; a 460,000-word book is about 2.6 MB of text before compression).
- Drafts are device-local history like operations, and stay out of `.pwk` by default. A *Include drafts* box on the full backup (`.pwb`) carries them.

**Measure:**
- Unit tests on the comparison: edits, moves, a split recognised as one scene becoming two, a join, a renamed scene.
- An integration test that saves, edits and restores one scene.
- An e2e test that runs the compare across a split.

**Size:** medium.

### R4: a round trip through Word

**What:** an editor's Word file, with their tracked changes and comments, comes back into the book.

- **Out.** *Export for editing* writes the R2 file with a Word bookmark around each scene (`kathala-scene-<id>`). A bookmark says which scene a passage came from. Whether Word and LibreOffice keep them through an editor's work is the first thing R4's fixtures establish, and the text alignment below is there for when they do not.
- **Back.** *Import an edited file* reads the `.docx` in the browser, with no dependency: `DecompressionStream('deflate-raw')` for the ZIP (checked available in Node 22, which the unit tests run on; Chromium has had it since version 80), and `DOMParser` for `document.xml` and `comments.xml`. Then:
  - Each scene's text is matched to its scene by bookmark. A scene whose bookmark was lost is matched by aligning its text with the current prose, and one that cannot be matched is shown for the writer to place.
  - **Tracked changes** (`w:ins`, `w:del`) become suggestions on the Page. Each is shown inline and can be **accepted** or **rejected**, one at a time or a scene at a time.
  - **Comments** become R1 notes by the editor, anchored on the commented range, with the editor's replies as answers.
  - **Untracked edits**, made with tracking off, are found by comparing the scene's text with the draft saved at export. They are offered the same way, so nothing changes silently.
- **Applying** writes through the existing scene-save path, in one transaction per act (`inOneWrite`). It is recorded in scene history, and the R3 draft saved first is the way back.
- **Safe to close.** What has been imported and not yet decided is kept until it is decided, closing the page included: the suggestions sit in their own table, `editSuggestions`, until accepted or rejected.

**Measure:**
- Fixtures from real Word and LibreOffice files: insertions, deletions, a comment across two paragraphs, a moved paragraph, italics added, tracking off, a scene break deleted, a bookmark lost.
- Unit tests for the parser, and integration tests for applying.
- An e2e test that exports, edits the file the way Word does, imports, accepts one change and rejects one, and checks the prose and the notes.
- Mutants on matching and on applying.

**Size:** large. The parser and the matching are most of it. This is the part that makes Kathala usable with a real editor.

### R5: a revision checklist

**What:** the work a review asks for, as tasks:
- A task says what to do, links to the chapters, scenes or characters it is about, and is open or done.
- **Paste an editorial letter** and it is split into tasks, one per paragraph or bullet, for the writer to keep, merge or drop.
- **Any R1 note** can become a task, and so can an AI audit finding or a continuity issue, keeping a link back to it.
- Tasks are shown on the dashboard, filtered to the chapter in its panel, and counted against the book: *12 of 31 done*.

**Storage:** a new table, `revisionTasks`, journalled, in `.pwk`, with tombstones.

**Measure:**
- Unit tests for splitting a letter: bullets, numbered points, paragraphs, a heading line kept as a group.
- Integration tests for create, link and complete.
- An e2e test that pastes a letter, links a task to a chapter and finds it in that chapter's panel.

**Size:** small to medium.

### R6: line-level checks on the prose

**What:** the checks an editor makes on the sentences, which nothing in the app makes today:
- **Echoes:** the same uncommon word, or a phrase of three words or more, repeated within a short span. A rare word repeats at a greater distance than a common one.
- **Pet words:** words and phrases the book uses far more often than books in general. The baseline is the Library's 33 books, which are already in the app.
- **Sentence rhythm:** a run of sentences of nearly the same length, or a scene whose sentences are much longer or shorter than the book's own.
- **Dialogue tags:** adverbs on tags, and tags other than *said* and *asked* past a share the writer sets.
- **Lengths:** a scene or chapter far longer or shorter than the book's usual. These lengths are measured against the book itself, as plot-thread silence already is.

**Where:**
- A **Prose pass** on Read, like the spoiler pass, underlines what each check finds in the scene in view and lists it in the margin.
- The checker gets a summary per chapter, as *craft* observations, never as warnings.
- Any finding can be dismissed, or made into an R1 note.

**Noise is the measure** (Part G: the early-reveal check lost the writers' trust at 90 warnings, 67 of them tags):
- Each check is pure logic in `src/lib/proseChecks/`, run over the Library.
- A check ships only if it finds few enough on published novels to be worth reading. The bar is set from that run, written down, and held by a test that runs the checks over a Library sample.
- Every threshold is a setting with a tested default.

**Size:** medium. Small code per check. Most of the work is tuning against the Library.

### R7: notes from beta readers

**What:** a reader in reading mode can leave notes as they read, and they come back to the writer.
- **Reactions:** *lost*, *slow*, *loved*, *didn't believe it*, *where am I?*, with a line of text if they want. Each is an R1 note anchored on what they selected, or on the paragraph.
- **Send notes to the author** writes a small file holding the world's id, the reader's name, their notes, and how far they read. The world and its prose are not in it.
- The writer **imports** it:
  - Each note is anchored by its quote, so a reader on an older copy of the book still lands on the right words or is listed unplaced.
  - Each reader is a filter in the Notes panel.
  - A **reactions map** shows, chapter by chapter, where readers stopped, were lost or loved it.
  - A second file from the same reader replaces their earlier notes.

**Measure:**
- An e2e test that reads in reading mode, leaves two reactions, sends the file, imports it in another world copy, and finds the notes on their words and on the map.
- An import test against a copy where the prose has changed since.

**Size:** medium. It rests on R1.

## Order

**R1 → R2 → R3 → R4 → R5 → R6 → R7.**
- R1 first, because R4, R5 and R7 build on notes.
- R2 is quick and independent, and R4's export is built on it.
- R3 comes before R4 so that importing an editor's changes always has a draft to go back to.
- R5, R6 and R7 depend only on R1.

As in `next-plan.md`, each part ships with:
- its tests;
- its mutants, gated (`tsc -b && eslint && grep`);
- its section of `docs/GUIDE.md`, with screenshots;
- a record in `docs/records/`.

## Not in this plan

- **Live collaboration** with an editor in the same book. Local-first stays. A Word file and a notes file are how review travels; the journal leaves sync possible later.
- **Grammar and spelling.** The browser's spellcheck is on. Grammar checking means a model or a large rule set, and is a different project.
- **Suggestions written in the app** (a suggesting mode for the writer's own edits). R4's suggestions come from an editor's file. A writer editing their own book edits it, with history and drafts to go back to.
- **Comments in exported EPUB or HTML.** Review goes through Word.

## Decisions (made 2026-11-02)

The writer took every recommendation.

- **D-1. The order is R1 → R2 → R3 → R4 → R5 → R6 → R7**, as above. R2 is its own PR, straight after R1: it is small, and R4's export is built on it.
- **D-2. Drafts stay out of `.pwk`.** A `.pwk` is what goes to a reader, and a reader should not get the writer's earlier drafts. The full backup (`.pwb`) carries them only when *Include drafts* is ticked.
- **D-3. A beta reader's file holds notes only**: the world's id, the reader's name, their notes and how far they read, never the world or its prose. It stays small, and a reader's copy cannot overwrite the writer's book by being merged.
- **D-4. The prose checks' baseline is the Library's books.** They are already on every device. A standard English frequency list would be a new download.
