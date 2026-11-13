# T9.5: replies and a resolved thread are announced, shown, and dated

**Plan:** `round-trip-plan-3.md`, T9.5.
**Finding:** the tenth of `loop-2026-11-12.md`. In the second loop's third round the editor answered seven of the
writer's replies. Six of them were in threads the editor had resolved. *Edits brought in* spoke only of changes and
new comments, and Notes hides resolved threads, so nothing said the replies had come. The writer found them by
opening resolved notes one by one.

## What bringing a file in says now

**The dialog.** Under the changes and the new comments: *7 replies were added to your notes, and 1 thread was
resolved.* Each half is said only when it is so, and agrees with its count (`answeredSentence`). It counts what the
file did to threads already in the book:
- a reply added to a note already here. A reply already there, word for word, is not added again and not counted;
- a thread already here that the file resolved, and that was open.

A new comment's own replies are part of that new note, which the dialog already counts, so they are not counted
again here.

**Show the replies.** Beside **Later**, where the file answered or resolved anything. It opens the Page with Notes at
those threads. From **Read**, which has no Notes, the Page is opened first. Where there is no Page to open (*All
timelines*, Chronological) the button is not offered.

## In Notes

- **Those threads, open and resolved alike** (`NoteFilter.fromFile`). A bar says so, *Answered or resolved in
  the-long-road-ana-2.docx. The new replies are marked.*, with **Show every note** to go back. Choosing a status
  goes back too. The Chapter and From filters still narrow it.
- **Each reply from that file is marked New**, with a bar beside it. The writer's own replies, and an earlier file's,
  are not.
- **A thread the file resolved says *Resolved in this file*.** Resolved by hand, it says *Resolved*.
- **Every reply has its date**, always: the day and the month, and the year where it is not this year
  (`replyDate`). It is the date the file gives the reply (T9.3), or when the writer typed it.

## What is kept

- **A reply says which file brought it** (`NoteReply.broughtIn`: the id bringing it in gave its changes). Replies
  under a note new in that file say so too.
- **A note says which file resolved it** (`ProseNote.resolvedIn`). Reopened, it says none. Resolved by hand, none.
- Both are optional fields on records that already travel in a backup, so a `.pwk` carries them. Notes brought in
  before this have neither, and are shown as they were.

## Tests

- **`noteList.test.ts`:**
  - **the file's threads:** a thread replied in, one replied in and resolved, one only resolved, are that file's,
    whatever the status filter says; an earlier file's are its own; without the file, the status filter as before;
    the Chapter filter still narrows it;
  - **the sentence:** both halves, each alone, singular and plural, and nothing for neither;
  - **the date:** the day and month this year, and the year added for another.
- **`editImport.test.ts`**, against the real store: a file with a reply to the thread already here, the thread
  resolved, and a new comment with a reply of its own. The result is one note, one reply, one resolved. The reply,
  and the new note's reply, say that file; the writer's earlier reply does not; the thread says that file resolved
  it, and the new note says nothing was resolved. The same file brought in again says none of each, and leaves the
  first file's mark. Reopened, then resolved by hand, the thread says no file.
- **`wordRoundTrip.spec.ts`**, the marked round trip, in the app: the second file brought in from Read; the dialog's
  sentence; **Show the replies** opens the Page with Notes at the one resolved thread, *Resolved in this file*;
  the editor's reply marked **New** and dated *2026-11-08T10:00:00Z* as the file has it, and the writer's own not
  marked; **Show every note** gives the open notes again, among which the resolved thread is not.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`:

24, all killed:
- **bringing in (6):** replies not counted; a thread resolved not counted; a reply already there counted again; a
  reply not marked with its file; a new note's reply not marked; a thread resolved without saying which file;
- **the note (2):** reopened, still saying the file resolved it; a reply never marked;
- **the list (7):** the file filter ignored; the file filter still held to the status; a thread only resolved not
  the file's; a thread only replied in not the file's; *1 reply were*; both halves without *and*; the year never
  said;
- **the screens, by the e2e (9):** the dialog silent on them; no **Show the replies**; Read not left for the Page;
  Notes not opened; the file's threads not shown; every reply marked new; no date; never *Resolved in this file*;
  **Show every note** keeping the file.

Three did not build as first written (a count left a `let` never changed, and a parameter left unread), and were
redone in forms that build. All three were then killed.

## Not done here

- **A thread the editor reopened** is not reopened here. Bringing a file in resolves; it has never reopened. That is
  as it was before this part.
- **A new comment the editor resolved** comes in as an open note, as before.
- **Only the latest file can be shown this way.** Notes has no list of files to choose from: **Show the replies** is
  offered once, in the dialog that says what came.
