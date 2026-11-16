# T21: Create all, its note, and the suspicions measured

**Plan:** `round-trip-plan-4.md`, T21.
**Findings:** the tenth to twelfth of `loop-2026-11-14.md`: the writer's W3-10 to W3-12, their S-1 and S-2, and the
editor's S-1 and T-1. The record's own two figures, 66 against 67 and 65 against 66.

## T21.1: Create all, and its note (D-15)

### Create all names the people it makes (W3-10)

**Create all that the 2 waiting headers name** made every person a waiting header named, as well as its places,
items and facts. That was on purpose in the code (`createAllWaiting`). The guide said a name nobody answers to *is not
made for you — it is as likely misspelt as new*, and the code's own comment said the same.

**D-15, taken (a):** it makes them, and says whom first. The button reads *Create Anna Brisk, Bo Tallis and Cara Lind,
and 2 places*:
- people by name, each once, in the order the headers name them;
- then places, items and facts, counted;
- *Create 2 places* where nobody is to be made.

A name misspelt on a Cast line is on the button before the click. The guide and the comment now say what the button
does. Image 131 is retaken.

### Its note (W3-11)

After Create all had applied every header, the note above the page still said *The headers of "Alpha" and "Beta" were
not applied, and wait as typed*. Now Create all puts that sentence right (`withKeptByPaste`):
- taken out where every header is applied, and the rest of the note, what the paste made, kept;
- said again of the scenes still waiting, where some are.

## T21.2: the first scene's header (W3-12)

**Not planned**, as the plan says. Six people knowing a fact *before the story* make the book's first header ten lines
long. The guide says so.

## T21.3: the suspicions

### S8: the day's words (the writer's S-2): real, fixed

The dashboard said *+12,704 words today* for a 12,496-word book.

**Reproduced** with a chapter of three scenes, their `## ` headings and headers, pasted into a book on the Page. The
day said 43 words, and the book had grown by 37. The 6 more were the three headings' words.
- The paste is saved as text at once, headings and all, and the save logs its words.
- Each heading is then made a scene, and its line taken out of the prose, by restructuring writes (`replaceProse`).
  Those logged nothing.

**Now** each restructuring tells the day its net change once: a split, a join, a chapter joined to the one before,
and a set of scene texts replaced (`replaceSceneTexts`). Words moved from one scene to another add to nothing. Words an
act takes out, as a heading becoming a title does, are taken off. The pasted chapter's day is now the book's growth.

### S9: a header typed straight after a new scene's title (the writer's S-1): real, fixed

**Reproduced**, as the writer typed it: Ctrl+Enter, a title, Enter, `[#Cellar @@Pia Lund]`, Enter. Four times in
four, with a place and person the book had and with ones it had not, the line stayed in the prose and was never
applied. Typed 2.5 seconds after the title's Enter, it was applied.

**The cause:** the new scene is still being written when the header line is left. A line left while the page is busy
is looked at again once it is free (`revisitLeft`), but only for a heading typed on it. A header line was dropped.

**Now** `revisitLeft` applies the header of a line left while the act was written, once nothing is being written. If
a heading still has to be made first, those lines wait with the rest.

### S10: a scene's bookmark and its opening words (the editor's S-1): real with tracking off, fixed

Untested in three rounds. Now made in LibreOffice (`scripts/lo-scene-openings.py`), from the third loop's round-1
file, with tracking on and off:
- the second scene's first sentence taken out;
- its first paragraph taken out;
- its first sentence moved to the end of its second paragraph;
- the scene break taken out;
- the paragraphs either side of the break joined;
- the break taken out with the next scene's first sentence.

**Tracked**, every bookmark held, and every change came in right.

**With tracking off**, LibreOffice drops the scene's bookmark with its opening words, in four of the six. The file
then had 16 bookmarks where it had 17.
- **Where the break stayed** (three cases), the scene's prose was under no bookmark. It was matched to its scene by
  its paragraphs, and every change in it made with tracking off was dropped without a word, its opening words among
  them: those are found only against the scene as it went out, from its own bookmark.
- **Where the break went too**, the scene's prose ran on under the scene before's bookmark. It came in as words added
  to that scene, and made, the scene's prose would have been in the book twice.

**Now** a scene whose bookmark the file lost is given back its prose from the draft the file was made from
(`withLostBookmarks`):
- **by place:** prose under no bookmark, between two scenes with exactly one scene missing between them in the draft,
  is that scene, where at least 60% of its longer words are that scene's;
- **run on:** where the break went too, the paragraphs at the end of the scene before that are the missing scene's
  own, and not the scene before's, are the missing scene's, from the first of them.

All six cases now come in as LibreOffice reads them, and every word is in the book once. None of the 37 files the
earlier loops kept has a bookmark missing, so none of them reads differently.

### S11: 66 against 67 (the record): not grouping, fixed

The editor made 67 edits. The import counted 66. The record put it down to grouping: two of the editor's acts as one
run in the file.

**Found:** the file has 67 runs, one for each act. In *The North Quay* the editor cut a clause and, a full stop later,
took a sentence out to move it: *all and had never once in his life managed to. In the lamplight his face was grey.*
became *all.* The stop between the two runs is unchanged. But the words kept compare as well with the stop at the end,
and the comparison found one deletion across both.

**Now** a change found across two or more of the file's runs is cut into one per run (`byRuns`), where the runs, each
made in turn, give what the one change gives. Round 1 is 67 changes, and either of those two can be made alone.

### S12: an empty insertion at each comment (the editor's T-1): not a fault

The copy the editor kept, saved by LibreOffice with tracking on, has an empty insertion at each of its 40 comments. It
read as 65 where the file sent read as 66. The sent file now reads as 67, after S11, and the copy as 66.

**Compared change by change, it is another copy of the edits**, not the same edits read differently:
- *its* made *their* is not in it;
- two cuts of a beat between two quotations keep the quotation marks the file sent joins. Each is still one change.

|  | Insertions | Empty | Deletions |
|---|---|---|---|
| File sent | 42 | 2, the paragraph marks | 65 |
| The copy | 79 | 42, the 40 comments' and the paragraph marks | 64 |

The empty insertions are read as nothing, and all 40 comments are read.

## Tests

- **`createAll.test.ts`:** what Create all will make, each name once, in order; its label; the note after it, taken
  out, said again, or left as it was.
- **`pasteHeadings.spec.ts`**, in the app:
  - Create all names the people before the click, and the note no longer says the headers wait;
  - a chapter pasted with headings and headers adds to the day what it adds to the book (S8).
- **`sceneStructure.test.ts`:** a split that takes a heading's words out takes them off the day (S8).
- **`pageHeader.spec.ts`**, in the app: a header typed under a title just made, before the scene is written, is
  applied once it is (S9). Without the fix it fails three times in three, on the dev server and on a production build.
- **`lostBookmarks.test.ts`:** the twelve LibreOffice files, each scene with every change made; the bookmark lost only
  with tracking off; by place, not where two are missing or the words are another's; run on, not from the first
  paragraph, nor where the scene before has the paragraph too (S10).
- **`roundOneCounted.test.ts`:** round 1 is 67, the two runs two, either made alone, and every scene the editor's with
  every change made (S11); the copy with empty insertions, compared change by change (S12).

**Mutants:** see below.

## Not done here

- **Undo of a restructuring** puts the prose back by `restoreProse` (`useOperations.ts`), which tells the day nothing:
  undo a split that took a heading's words out, and they are back in the book and not in the day. Its transaction
  holds only the batch's tables.
- **A scene break taken out with tracking off** is not said. Tracked, it is listed for the writer, as T15 lists it.
- **The paragraphs either side of a break joined with tracking off** come in as the scene before's last line moved to
  the start of the scene after, which is where LibreOffice's file puts it. The break taken out is not said.
- **A scene whose bookmark was lost, matched by its paragraphs alone** (not by place, not run on) still brings in only
  its tracked changes. The guide says so.
