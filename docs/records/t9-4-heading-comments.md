# T9.4: a comment on a heading or the title page is a note, and goes back on its line

**Plan:** `round-trip-plan-3.md`, T9.4, with decision D-9 as taken.
**Findings:** the fifth of `loop-2026-11-12.md`: the editor's E-3 and the writer's F7. The editor sent 39 comments and
got 38 back.

## What happened

A comment on a chapter's heading came in as a row in **Changes**, with **Dismiss** (T7.6). It could be read. It
could not be answered, and dismissing it deleted it. The marked file that went back did not hold it, so the editor
never learned whether it had been seen.

## The decision: it is a note

D-9 said what had to be true of it: kept, answerable, sent back on its heading. It did not say where it is kept.
Asked, the answer was to take whichever fits the writer better. That is the Notes panel:

- **one place for everything the editor said**, answered and resolved the same way;
- **it is in a backup**, as notes are; the rows waiting in Changes are not;
- **it goes back with the other threads**, and comes back matched to its note as they are.

It leaves Changes. Resolving it is what dismissing was.

## What a note outside the scenes is

A `ProseNote` with `outside: 'heading'` or `'title page'` (`src/types/proseNote.ts`).
- **`quote`** is the line as the editor's file had it: *Ch. 2 — The Gate*.
- **`eventId`** is the first scene after that line in the file. For a heading, that puts the note in its chapter.
  For the title page it only says which book.
- **It is never placed on the Page** (`placeNotes`), though a scene may come to say the same words. The Page has
  no title page, and writes its headings another way.

## Coming in (`outsideScenes`, `planImport`, `importEditedFile`)

- Each line outside the scenes now says which scene follows it.
- A comment on such a line becomes a note, with its replies, its date, and the editor's name, as a comment on the
  prose does.
- **Where no scene of the book follows the line**, there is nothing to hang a note on: a heading whose chapter the
  writer has since emptied. That comment is still a row in Changes, to read and dismiss, as before.
- **The dialog** counts them apart: *1 comment on the title page or a chapter's heading is a note too, in Notes.*
  The count of notes *on the Page* no longer includes them.

## In Notes (`noteRows`, `NotesPanel`)

- **Where it says it is:** *The title page*, or *Ch. 2 · its heading*.
- **Order:** the title page's first of all; a heading's before the notes in its chapter. Neither is with the
  unplaced.
- **The chapter filter:** a heading's note is in its chapter's. The title page's is in no chapter's.
- **It is not called unplaced**, and has no **Go to it**. It says: *On the chapter's heading, as the file had it.
  It is not on the Page: answer it here.*
- **Reply, Resolve, Edit, Delete, Make a task** as on any note. A task made from a heading's note is linked to the
  chapter, not to the scene under the heading.

## Going back (`markedPlan`, `compileDocx`)

- **A heading's thread is written on its chapter's heading**, whatever the heading now says: the chapter that
  holds the note's scene. Under a heading of two lines, a number over a title, it is on the line that still says
  what it was made on, and on the first line otherwise.
- **A title page's thread is written on the line it was made on**, where that line is still there word for word.
  On a submission, one made on the line of the name and the count goes on that line whatever the count now is.
  Where its line is gone it goes on the title, which every title page has.
- **Each thread is in the file once**, though two lines of a title page may say the same words.
- **The replies and the resolved mark** go with it, as with any thread.
- **A title page's thread goes whatever scenes go.** A heading's goes with its scene, like a thread on the prose.
- **In a file made without chapter headings** there is no line for a heading's thread. It goes at the start of its
  scene, with a reply signed by the writer under the editor's comment: *On the chapter's heading: "…"*. Coming
  back, that line is known for the app's, like the line on words since rewritten (T9.2), and is not made a reply.

## Found on the way: a thread on a paragraph put in first in its scene

The probe (`npm run probe:marked`) gained cases for these threads, and one failed that was not this part's doing.

- **What it is.** A thread whose words are gone went at its scene's start: on the scene's first paragraph. Where
  the writer had put a new paragraph first in that scene, LibreOffice's reject-all took the new paragraph's words
  and left the paragraph, empty. It is the same fault T8.4 put right for a new paragraph *after* a commented one.
- **Since when.** Since the marked export first wrote threads (T5), for any thread on words since rewritten. The
  empty paragraphs in the run's files were all accounted for by the other cause (`t8-0-measure.md`), so it did
  not show there.
- **What the export does now.** Such a thread goes at the start of the scene's first paragraph that was there
  before. Only where every paragraph of the scene is new does it go on the first.
- **Measured, LibreOffice 24.2.** Rejected is the base and accepted is the book in all five new cases: a new
  paragraph first; in a second chapter; two new paragraphs first; the paragraph after it changed too; every
  paragraph new.

**The probe's table is now 42 export-made cases, all the same both ways**, and the four rows that are wrong on
purpose. The new ones besides those five: a heading with a thread and nothing new; a new paragraph first under a
commented heading, in a first and in a second chapter; a thread on the title; two on a submission's title page;
a file without headings, plain, with a heading's thread, and with that and a new first paragraph.

**One was the probe's own.** A file made without headings read as *not the same* by the app's reader, thread or
no thread. The unmarked files it is compared with have no bookmarks, so their scenes are told apart by headings,
and without headings two chapters read as one scene. Those cases are now compared as one text.

## Coming back again

The thread is matched to its note by the editor's words and name, like every thread. A reply the editor added is
added to the note, and a thread the editor resolved is resolved. No second note is made.

## Tests

- **`headingComments.test.ts`**, against the real store:
  - **in:** a comment on the second chapter's heading and one on the title are two notes, each with its line, its
    scene, the editor's name and the file's date, and no row in Changes;
  - **never placed**, though its scene says the heading's words; a note on the prose with the same words is placed;
  - **no scene after its line:** a row in Changes with the comment, and no note;
  - **there and back:** answered and resolved, the chapter retitled; the marked file holds the heading's thread on
    the heading as it now reads, with the reply and done, the title's on the title, and neither in a scene. Brought
    back as it went: two notes still. Brought back with the editor's reply and resolved: the reply on that note,
    the note resolved, and still on the title page;
  - **a file without headings:** the thread at its scene's start, before the first word, with the writer's line
    under it, though the scene says the heading's words; back, the same note and the line no reply;
  - **the title page's lines:** each thread on the line it was made on, one on a line since gone on the title;
    on a submission, the count's line whatever the count, a contact line, the byline; once where the title and
    the byline say the same words; under a heading of two lines, the line it was made on, else the first.
- **`markedRunFiles.test.ts`:** round 1's file from the second loop. Its 39 comments make 39 notes, one on a
  heading. Sent back, the file holds 39 threads, each as the editor wrote it, and the heading's on the heading of
  its own chapter. It was 38.
- **`markedDocx.test.ts`**, the thread whose words are gone: at the scene's start as before with no new paragraph
  first; after one new paragraph, and after two; at the scene's start where every paragraph is new.
- **`markedDocx.test.ts`:** the plan passes `outside` on with the line as the file had it; a title page's thread
  goes though its scene does not, and a heading's goes with its scene; the heading's line is known for the app's.
- **`noteList.test.ts`:** the title page's note first, a heading's before its chapter's notes, neither with the
  unplaced; the chapter filter.
- **`wordRoundTrip.spec.ts`**, in the app: the dialog's sentence, and none saying it is on the Page; the comment
  is no row in Changes; in Notes it says *Ch. 2 · its heading* and the line, is not called unplaced and has no
  **Go to it**; replied to and resolved; the marked file has both comments on the second heading and none on the
  first, the reply under the editor's comment, and every one done.

- **Two older tests compared an outside line's whole shape** (`docxRead.test.ts`, `docxRunFiles.test.ts`). Each
  line now says the scene after it, and in a plan its threads, so their expectations say so too.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. 32, all killed in the end:
- **coming in (6):** no note made of it; a note and a row both; the note not said to be outside; the scene before
  the line taken, not the one after; a scene gone from the book still taking the note; outside notes not counted
  apart;
- **the Page and the list (5):** an outside note placed on like words; a title page's note with the unplaced; a
  heading's with the unplaced; a heading's after its chapter's notes; a title page's note in its scene's chapter;
- **the plan (3):** `outside` not passed on; a title page's thread dropped with its scene; a heading's kept with
  no scene;
- **going out (10):** a heading's thread in its scene as well; none in a file without headings; on the first
  chapter's heading; always on the first line; the line saying *words since rewritten*; placed on like words in
  the scene; a title page's thread on every line that says its words; always on the title; the count's line's on
  the title; one on a line since gone lost;
- **coming back (1):** the heading's line read as a reply;
- **the thread on a new first paragraph (1):** put on the scene's first paragraph whatever it is;
- **the screens, by the e2e (6):** called unplaced; not said to be on the heading; where it is, said as a scene;
  counted as on the Page; the dialog silent on it; the thread on the first chapter's heading.

**One survived at first.** With the heading's thread placed on like words in the scene, every test passed: no
scene in them said the heading's words. The test of a file without headings now has the scene say them, and it
was killed.

Five did not build as first written (a binding left unused, a comparison narrowed to `never`) and one target
string did not match. All six were redone and killed.

**The round-1 test** passed the first time it ran, so it was broken on purpose too: with `outside` not passed on
by the plan, it fails with no thread on a heading.

**The first e2e draft held a check that could not fail:** no note mark on the Page, looked up by a class the Page
does not use. It was taken out. The rule it meant to hold is in `headingComments.test.ts`, with both halves.

## Not done here

- **A comment already listed in Changes** from a file brought in before this stays a row there. Only a file
  brought in from now on makes a note of it.
- **A change to a heading or the title page** is still a row in Changes to make by hand (T1.4). Only comments
  moved.
- **A heading's note follows its scene.** If the writer moves that scene to another chapter, the thread goes back
  on that chapter's heading.
- **No screen shows the title page or a heading with the note on it.** The note says the line; it is not marked
  anywhere but in Notes.
