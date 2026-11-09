# R4: a round trip through Word

The fourth part of the editorial plan (`editorial-plan.md`).

## What was built

- **Out.** The Word export has a **For an editor** box (`ExportManuscriptDialog`, kept with the
  other submission details). Ticked, it saves the book as a draft, *Sent for editing (file name)*,
  and marks the file (`EditingMarks` in `manuscriptExport.ts`):
  - a bookmark, `KathalaScene_<n>`, starting in each scene's first paragraph and ending in its last,
    where `n` is the scene's place in that draft;
  - the draft's id and the book's id as custom document properties (`docProps/custom.xml`:
    `KathalaDraft`, `KathalaWorld`).
- **Reading the file** (`docxRead.ts`), with no dependency: `readZip` (`zip.ts`) inflates with
  `DecompressionStream('deflate-raw')` (`gzip.ts`), and `DOMParser` reads `document.xml`,
  `comments.xml` and `commentsExtended.xml`. The body is walked in document order. Each paragraph
  keeps its style, the scene bookmark it falls under, and its text in pieces: unchanged, inserted or
  deleted, with where each comment starts and ends.
  - A scene starts at its bookmark and runs until the next one, or a heading or scene break.
  - Runs are joined, and a run in italics is `_like this_`, the book's own markup.
  - `w:moveFrom` / `w:moveTo` are a deletion and an insertion; a change to formatting alone is not
    a change.
  - A reply is linked to its comment through `commentsExtended.xml`.
- **What changed** (`docxEdits.ts`). Each scene of the file is read twice: with every tracked change
  rejected (*original*) and with every one accepted (*edited*). `hunks(a, b)` compares two texts by
  paragraph, then by word inside changed paragraphs. Each change is the words it replaces, what with,
  and a little of the text either side. An insertion takes the word before it, so every change has
  words to find.
- **Planning the import** (`docxImport.ts`, `planImport`):
  - **Which scene.** By its bookmark, through the draft named in the file, if that scene is still in
    the book. Otherwise by its paragraphs: the scene in the book now that has at least half of them.
    A part that is neither is *unplaced*.
  - **Tracked changes** are *original* against *edited*.
  - **Edits made with tracking off** are the scene as it went out, from the draft, against
    *original*. They are looked for only in a part placed by its own bookmark.
  - **Comments**, each anchored on its words as a note is (`anchorFrom`), with its replies. A comment
    on a point, not a stretch, is on the word it stands before.
- **Bringing it in** (`useEditImport.ts`, `importEditedFile`):
  - A file whose book id is another book's is refused.
  - The book is saved first as a draft, *Before Ana's changes (file name)*.
  - Then, in one write (`inOneWrite`), every change becomes a row in a new table, `editSuggestions`
    (Dexie v65): untracked first, then tracked, in the file's order. Every comment becomes an R1 note
    by the editor, with replies as answers.
  - Nothing in the prose changes.
- **Deciding** (`acceptSuggestion`, `rejectSuggestion`, `acceptScene`, `rejectScene`,
  `placePassage`):
  - A change is accepted into the scene's prose as it is then (`applyHunk`). Its words are found as
    a note's are, exactly or closely, so the writer's edits elsewhere since do not stop it.
  - The prose before is kept in the scene's History, in the same write as the change and the
    suggestion's going.
  - Where its words are no longer there, it is not applied, and is kept for the writer to make by
    hand or reject.
- **On screen:**
  - **Bring in edits…**, beside **Drafts**, takes the file and says what came in.
  - On the Page (`editMarks.ts`), each change is marked where it would go: what it takes out struck
    through, what it puts in beside it. Clicking one opens it.
  - **Changes · N** opens the Changes dialog (`ChangesDialog.tsx`). Changes are listed scene by
    scene, with Accept, Reject, Accept all and Reject all. Unplaced passages come first, each with a
    choice of scene.
  - Each change is shown as one stretch out and one in, without the whole words its two sides share
    (`shownChange`). So an insertion strikes nothing.

## Where it departs from the plan

- **Bookmark names.** The plan had `kathala-scene-<id>`. A Word bookmark name may hold only letters,
  digits and underscores, and only 40 of them, so a hyphen is not allowed and a long id would not
  fit. The bookmark therefore numbers the scene within the draft saved at export, and the file names
  that draft. The cost: with that draft gone from the device (the file brought back on another
  computer, or the draft deleted), bookmarks mean nothing, and every scene is found by its
  paragraphs instead.
- **Without a bookmark, by paragraphs, not by aligning text.** A part is a scene's when that scene
  has at least half its paragraphs, word for word. That is simpler than an alignment, and a scene
  the editor rewrote past it is given to the writer to place.
- **No fixture from Word itself.** There is no Word in the container. The fixtures are:
  - a real LibreOffice round trip (`scripts/docx-fixture-edit.py`, run in LibreOffice 24.2): a
    tracked insertion and deletion, an edit with tracking off, a comment, a lost bookmark end;
  - Word-shaped XML written by hand from the OOXML standard: a moved paragraph, a formatting-only
    change, italics added, a reply, split runs and spell-check marks, a bookmark between paragraphs,
    a comment across two paragraphs, a deleted scene break.

  What Word itself writes that the standard does not lead one to expect has not been seen. A file
  from Word is the first thing to try when one is to hand.
- **Unplaced passages carry their tracked changes only.** An untracked edit cannot be found without
  the passage's own draft scene. Their comments are not brought in either, there being no scene to
  put the note on. The import counts them and says so: *1 comment was on words that matched no
  scene, and is not brought in: read it in the file.*
- **Changes waiting stay on this device.** They are not in a `.pwk` or `.pwb`, and not journalled.
  They are a working state between a file and the book, which the file can recreate. A world deleted
  takes them with it.

## Found while building it

- **History lost the writer's last edit.** History runs saves made close together into one version,
  so an accept straight after typing folded the typing into the version before. Accepting now always
  keeps the prose before as a version of its own.
- **A rewritten phrase came out as two changes.** "belonged to her" made "was hers" split at the
  space between "to" and "her". The second change was then anchored on words the first had just
  replaced. Changes with only spaces between them are now one. Changes with a word kept between them
  are still two: "like she was" made "as if she were" is "like" made "as if" and "was" made "were".
- **The Changes dialog was unreadable for a rewritten phrase.** It diffed each change word by word,
  interleaving struck and new words. An insertion showed the word it was anchored on twice, struck
  and new. Both now show one stretch out and one in (`shownChange`).
- **A comment on an unplaced passage was dropped without a word.** It is now counted and said.
- **"2 changes in 0 scenes"** was said when every change was in an unplaced passage. The count of
  scenes is now left out when there are none.
- **LibreOffice** keeps bookmarks and custom properties through an editor's work. It lost the end
  of one bookmark and opened it again under the same name on the next paragraph. That is why a
  bookmark is read as where a scene starts, not as a range. It also wrote an empty `w:ins` around a
  comment, which reads as nothing.

## Checked

- `docxRead.test.ts`:
  - the LibreOffice file: its scenes, the lost bookmark end, the comment, its changes as hunks;
  - Word-shaped files: a bookmark between paragraphs; a heading ending a scene; a moved paragraph; a
    formatting-only change; a reply; italics added; a comment across two paragraphs; a scene break
    deleted;
  - a file that is not Word, and a deflated archive;
  - change granularity, and `shownChange`.
- `docxImport.test.ts`:
  - placing by bookmark, by paragraphs without the draft, and a scene gone from the book;
  - a scene rewritten since still placed by its bookmark;
  - a reply not a note of its own, and a comment on a point;
  - `applyHunk` with the writer's edits around a change, a change whose words are gone, and a
    paragraph taken out.
- `editImport.test.ts`, against the real store:
  - the draft saved first, suggestions and notes written, the prose untouched;
  - accept with History, reject, a stale change kept;
  - a scene accepted whole in order;
  - without the draft; a file from another book refused.
- `e2e/wordRoundTrip.spec.ts`:
  - exported for an editor, and the file and draft checked;
  - edited as Word writes it: a tracked insertion and deletion, an edit with tracking off, and a
    comment;
  - brought back. The marks on the Page are checked, one is clicked open and its change rejected,
    and the rest are decided from Changes, with Accept and Accept all. The prose and the editor's
    note are checked.
  - A second test loses a bookmark and rewrites a passage. The passage is placed by the writer; one
    change is applied, one cannot be and says so, and the lost comment is reported.
- Mutants, each caught:
  - reading: deletions read as text; a move's insertion ignored; a heading not ending a scene;
    italics lost; replies unlinked;
  - planning: the bookmark ignored; no match by paragraphs; no untracked edits; replies as notes; a
    point comment; changes split at spaces; a change shown cut inside a word, or without its shared
    tail;
  - applying: blank lines left by a paragraph taken out; a stale change applied; no History; the
    wrong order in a scene; a file from another book accepted; unplaced comments not counted;
  - on screen:
    - the file not marked for an editor; no marks on the Page; marks not redrawn; a mark's click
      ignored;
    - Accept rejecting; Accept all rejecting; the clicked change not picked out; no Changes button;
    - placing a passage doing nothing; the stale warning not shown; the lost comment not said;
      "in 0 scenes".

  Six mutants did not compile at first, and were redone until they did.
