# T5.3–T5.4: the marked file coming back, and the dialog that sends it

**Plan:** `round-trip-plan-2.md`, T5.3 and T5.4, with decisions D-4, D-5 and D-6 as taken.
**Before it:** `t5-1-marked-export.md`. That part wrote the marked file. Nothing a writer could reach sent one.

Now **Export** for an editor offers the marked file once an editor's file has come back. Bringing in the file the
editor returns finds what the editor did to the writer's changes, and adds to the threads that went out.

## T5.4: the dialog (`ExportManuscriptDialog.tsx`, `markedPlan`)

- **The offer.** Under *For an editor*: **Show my changes since Ana Editor's file (the-long-road-ana.docx)**.
  - It is shown only once a file has come back. It names the newest file's editors and the file itself
    (`useLatestSentBack`: the newest draft with `sentBack`).
  - It is ticked by default.
  - It says what goes: *1 change and 1 comment thread, signed Nell Garrow: what you changed of their version, and
    their comments with your replies.*
- **What it sends** is `markedPlan` (`markedDocx.ts`):
  - **The base** is that draft's scenes (D-4).
  - **The threads** (D-5) are the notes by that file's editors (`BookDraftRecord.editors`, kept on import), or by any
    editor when the file names none.
    - Never the writer's own notes or a reader's.
    - Each is placed on its words as they are now, or quoted where they are gone. One whose scene has been deleted
      is not sent.
  - **The signature** (D-6) is the byline in *Author*, or *The author* when it is empty. The writer's replies are
    signed with it too.
  - **Changes are counted** one per stretch put in or taken out. A word replaced, out and in side by side, counts
    once.
- **The draft** saved as it goes is named *Sent marked, …* rather than *Sent for editing, …*.

## T5.3: the file back (`useEditImport.ts`, `docxEdits.ts`, `docxRead.ts`)

The file says it is marked, by whom, and against which draft, in two custom properties: `KathalaMarkedBy` and
`KathalaMarkedAgainst`. `docxRead` reads both.

- **The writer's changes are made first** (`withChangesMade(doc, markedBy)`). The file then reads as the writer sent
  it, less whatever the editor turned back.
  - The writer's insertions are made plain, and the writer's deletions are dropped.
  - A paragraph mark the writer deleted joins its paragraph to the next.
  - Everyone else's marks are left as they are.
  - This is the plan's *as sent* reading, made by rewriting the file once rather than as a third view in `docxRead`.
    Everything after it is the T1 machinery, unchanged.
- **The editor's own changes** are then found against the draft the marked file went out from, *Sent marked*, as
  for any file.
- **A change of the writer's that the editor turned back** shows as an edit with tracking off: the file has the
  writer's words gone, and the editor's back. It is told from one by where its words come from.
  - Its new words, with 16 characters either side, are in the text the marked file was measured against
    (`KathalaMarkedAgainst`: *As Ana sent it back*). An edit that only puts back the editor's own earlier words is
    that.
  - It comes in as **Turned back**: *Ana Editor turned back your change. Accept to take their words again; reject to
    keep yours.*
  - It is signed by the scene's tracked author or, failing that, the first person the file names: its changes' or
    its comments' authors. In the e2e the editor turned back the writer's line and made no tracked change in that
    scene, and the comment named the editor.
- **Threads.**
  - A root comment whose text, less any *On words since rewritten: "…"* the export put before it, is an editor's note
    by the same author is that note, and is not made again.
  - Replies not already under it are added: the writer's (`markedBy`) as the writer's, others as the editor's.
  - Resolved in the file, the note is resolved.
  - Any other comment is a new note, as before.
- **The draft** *As Ana sent it back* now keeps `editors`: the file's change and comment authors. The next marked
  export uses it to choose the threads.

## Tests

- **`markedDocx.test.ts`:**
  - **`markedPlan`:**
    - only that file's editor's threads go, with the writer's replies signed by the byline and done where resolved;
    - a thread on rewritten words is quoted;
    - with no editors named, every editor's go back, and never the writer's own or a reader's;
    - a replaced word counts once, and a new scene is all new;
    - an empty byline signs *The author*.
  - **`withChangesMade`:** one author's changes made, a deleted mark joining, and another's left as they are.
- **`editImport.test.ts`:**
  - the marked file brought back untouched gives no change and no new note, and the thread as it was;
  - one of the writer's turned back, one left, one of the editor's own, and the editor's reply and resolution each
    come in as what they are;
  - accepting the turned-back change takes the editor's words again.
- **`wordRoundTrip.spec.ts`**, the whole way back in the app:
  - sent, and no offer before anything has come back;
  - round one brought in and taken;
  - a line of the writer's typed on the Page, and the writer's reply in Notes;
  - the offer, its count and signature, and the file: that line the only change, the editor's comment with the
    reply under it;
  - *Sent marked* in Drafts;
  - round two: the line turned back, the editor's reply, the thread resolved;
  - **Turned back** in Changes, by Ana Editor, accepted;
  - the thread added to, not made again;
  - the next export offered against the newer file.

**On a production build**, see the PR for the run at the commit shipped.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`:
- T5.3, 8 of 8 killed:
  - the writer's changes not made;
  - turned back never;
  - threads made again;
  - replies doubled;
  - done ignored;
  - done never read;
  - a deleted mark not joined;
  - anyone's changes made.
- T5.4, 12 of 12 killed:
  - in `markedPlan`:
    - every editor's threads sent;
    - replies not signed with the byline;
    - a replaced word counted twice;
    - a rewritten thread not quoted;
    - done the wrong way round;
  - in the dialog:
    - the file not marked;
    - the option hidden;
    - the draft not named *Sent marked*;
  - the oldest file come back taken for the newest;
  - turned back with no editor named;
  - in Changes:
    - the turned-back label;
    - the turned-back caption.
- Three of the T5.4 mutants did not build at first: an unused binding, and a narrowing to `never`. They were redone in
  forms that build, and are counted only as redone.

## Not done here

- **A change of the writer's that the editor rewrote** comes in as the editor's change, against the writer's words, and not as
  turned back. It is not the editor's earlier text.
- **An edit with tracking off that happens to restore the editor's earlier words** is said to be turned back,
  whoever's change it undid. Only the writer's changes could be undone that way since the file went out, so this is
  what happened in every case the tests know. It is a reading, though, not a mark.
- **The screenshot of the file in LibreOffice** is of `marked-as-made.docx`, the T5.1 probe's file, rendered to PDF
  by LibreOffice 24.2 headless. That PDF does not show comments.
