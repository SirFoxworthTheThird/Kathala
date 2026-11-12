# Editor run, 10–12 November 2026 (loop 2): three rounds on *The Salt Ledger*

I am Ines Marlowe, a freelance fiction editor. An author I had not worked with, Elin Ashgrove, sent me a
novella as a Word file with a note. I edited it with tracked changes and margin comments, wrote her a
letter, and did the same twice more on her revisions. I never saw the program she writes in. Everything
below is from the files, her notes, and what my own tools did.

I have no Word. I worked in LibreOffice 24.2, driven from Python, signing as "Ines Marlowe". Where a
statement is about what Word would do, I say it is a guess.

The book is not on trial here. My view of the novel is in the two letters and the margins.

## Summary

- The round trip works for the things that matter most. Every edit I made came back exactly as I made
  it, in both revisions (60 of 60, then 20 of 20). Every edit she declined was really gone. Her replies
  came back under the comments they answered, and resolved threads stayed resolved.
- The costly problem is that a marked revision cannot be checked from the file alone. My accepted edits
  are unmarked, her declined ones look like any other change of hers, and her rewriting is marked word
  by word (113 marks in one paragraph in round 2, 95 in round 3). I needed a scripted comparison in both
  rounds.
- The clean reading copy in round 3 fixed reading. It did not fix verifying.
- Three smaller things changed that neither of us changed: one comment on a heading was dropped, ten of
  my comments gained a line I did not write under my name, and every comment date was restamped twice.
- Separately, LibreOffice's scripting interface cost me more time than her files did. Those problems are
  listed apart from the findings about the file.

## What I was sent, round by round

### Round 1: `round1-from-writer.docx`

A clean manuscript. I could start at once and would not have asked for a different file.

| Measure | Value |
|---|---|
| Size, sha256 | 102,261 bytes, `15af6768…70df6558` |
| Package | 7 parts, all stored uncompressed, all dated 1980-00-00 |
| Pages (LibreOffice PDF) | 44, US Letter |
| Words | 12,432 |
| Paragraphs | 379 |
| Headings (Heading 1) | 6, reading "Ch. 1 — The Ninth Bell" and so on |
| Scene breaks | 10 "#" paragraphs plus "END", in a "Scene Break" style |
| Empty paragraphs | 0 |
| Tracked changes, comments | 0, 0 |
| Quotes | straight only: 712 double, 341 single |

Things in the file a reader of the book has no use for:

- Two custom properties: `KathalaDraft` = `RaGjYZrf5OV-jE6GRF8SU` and `KathalaWorld` =
  `foAA-e0BfCHw7HM7C_gzA`.
- Sixteen hidden zero-width bookmarks, `KathalaScene_0` to `KathalaScene_15`, one at the start of each
  scene.
- No `core.xml`, so no author or title in the document properties.
- Language tagged en-US on British prose ("harbour" 22 times), so a spellchecker underlines throughout.

None of this got in my way. Scene breaks were real paragraphs in their own style, so a break could not
be mistaken for a typo. Italics on ship names were consistent (Heron 16 of 16).

Her note asked that I edit this file with Track Changes "rather than editing a copy" and that "the file
keeps its name".

### Round 2: `round2-from-writer.docx`

Her program rebuilt the package; it was not my LibreOffice file coming back.

| Measure | Value |
|---|---|
| Size, sha256 | 189,954 bytes, `4145706f…a91d4405` |
| Package | 9 parts; everything LibreOffice had added was gone; no `settings.xml` |
| Words | 13,361 with her changes accepted (her note: "about 13,360") |
| Paragraphs | 395 |
| Tracked changes (XML) | 174 insertions + 110 deletions = 284, all "Elin Ashgrove", one timestamp |
| Tracked changes (reopened) | 247: 138 Insert, 109 Delete |
| Tracked paragraph marks | 16 inserted, 0 deleted |
| Comments | 62: 38 mine, 24 hers |
| Threads | all 24 of her replies under the right comment; 36 resolved, 2 open |
| Styles, headings, breaks, bookmarks, header | unchanged; `styles.xml` byte-identical |

Custom properties gained `KathalaMarkedBy` = "Elin Ashgrove" and `KathalaMarkedAgainst`, and
`KathalaDraft` had a new value. The cover block's word count changed from 12,400 to 13,400 without a
mark. The file did not open with Track Changes on.

### Round 3: `round3-from-writer.docx` and a clean reading copy

| Measure | Marked file | Clean copy |
|---|---|---|
| Size | 206,167 bytes | 108,534 bytes |
| Package | 9 parts | 6 parts, no `docProps` at all |
| Paragraphs | 399 | 398 |
| Words (accepted) | 13,695 (her note: 13,693) | 13,695 |
| Tracked changes (XML) | 135 + 113 = 248, all hers, one timestamp | 0 |
| Tracked changes (reopened) | 235: 124 Insert, 111 Delete | 0 |
| Comments | 94: 60 mine, 34 hers | 0 |
| Bookmarks | 16 | 0 |
| Custom properties | 4 | none |

The clean copy was genuinely clean. All 53 comment threads in the marked file were resolved. The cover
word count again changed without a mark (to 13,700).

## What I did

| | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| Her tracked changes | none to deal with | accepted all 247 | accepted all 235 |
| My edit operations | 60 | 20 | 6 |
| Replacements / deletions / insertions | 49 / 6 / 3 | 15 / 2 / 2 | 5 / 0 / 1 |
| Paragraph split / join / moved sentence | 1 / 1 / 1 | 1 / 0 / 0 | 0 / 0 / 0 |
| My tracked changes, XML | 111 (53 ins, 56 del, 1 moveFrom, 1 moveTo) | 38 (18 ins, 20 del) | 13 (6 ins, 7 del) |
| My tracked changes, reopened | 111 (54 Insert, 57 Delete) | 35 (17, 18) | 11 (6, 5) |
| New comments | 39 | 15 | 6 |
| Replies | 0 | 7 | 2 |
| Comments in the file I sent | 39 | 84 (60 mine, 24 hers) | 102 (68 mine, 34 hers) |
| Letter | 3,610 words | 1,239 words | none |
| Reply email | 489 words | 655 words | 496 words |

All tracked changes and comments in every file I sent are signed "Ines Marlowe" in the XML and on
reopening. Each edit was found by enough words to be unique, counted to be found exactly once, and
checked against the expected text before it was changed. No edit failed silently in the files I sent.

Round 1's edits by purpose: 12 cuts of "look", 11 word choice, 9 continuity, 9 cuts, 3 rewrites,
3 consistency, 2 tightening, 2 paragraph, 2 plants, 2 punctuation, and one each of tense, cliché,
dialogue tag and moved sentence. Round 1's comments: 17 queries, 12 praise, 7 remarks, 3 timeline notes.

I returned each file under a new name (`roundN-from-editor.docx`) and never opened hers for writing.
Their checksums were unchanged after each round.

## What I could and could not verify from the file alone

| Question | From the marked file alone | How I settled it |
|---|---|---|
| Did the edits she accepted land as I made them? | No. Accepted edits are unmarked by design. | Her file with changes rejected against my last file with changes accepted. Identical both rounds, cover word count aside. |
| Are the edits she declined really gone? | Partly. They appear as her tracked changes, mixed with her new writing. | Diff of her rejected text against her accepted text, read against her note. |
| What did she change? | Not in the rewritten passages. One paragraph had 113 alternating single-word marks. | Same diff: 57 lines in round 2, 32 in round 3, both readable. |
| Is the clean copy the book as revised? (round 3) | Not knowable from either file. | Marked file accepted against clean copy: 0 lines differ. |
| Are replies under the right comments, and resolved as she says? | Yes. | Read `commentsExtended.xml`; confirmed on reopening. |
| Did all my comments come back, once each? | Yes, by counting. | 38 of 39, then 60 of 60. |

The cost was a scripted comparison in each of rounds 2 and 3: two LibreOffice text exports per file and
a word-level diff. A human editor would have used Word's Compare for the same reason. In round 3 I read
the clean copy and still ran the comparison to be sure the clean copy and my own edits could be trusted.

Her account was right in every particular but one. In round 2 a sentence of mine was turned back that
her note did not list ("Nessa looked at her with an expression Tamsin couldn't read"). She confirmed in
round 3 that it was deliberate and left off the list by mistake.

## What got in the way: findings about the file

Most costly first. "Measured" means counted in the XML or on reopening; "reproduced" means it happened
again when the same thing was done again.

### E-1. A marked revision cannot be checked without a comparison

- **What I did:** opened her round-2 file to see what she had taken, declined and written.
- **What I expected:** to read that from the markup.
- **What happened:** her changes were fragmented and carried one timestamp. The worst paragraph (ch6,
  "She went down…") had 113 marks alternating single deleted and inserted words, beginning
  `She [-did-]{+was+} not [-know-]{+calm.+} [-afterwards-]{+She+} [-why-]{+was+}`. The old paragraph's
  words were then inserted again as the next paragraph. Other paragraphs had 36, 15 and 13 marks.
- **Reproduced:** yes. Round 3 had a 95-mark paragraph (ch4 opening), then 40 and 20.
- **Note:** she warned of this in both cover notes, and it happens where a new paragraph is put in
  front of an old one.

### E-2. Declined edits and new writing look the same

Her method leaves my accepted edits unmarked and shows declined ones as her own tracked changes. So a
reversal of my edit and a new sentence of hers are indistinguishable in the file. The unlisted "Nessa"
reversion in round 2 is the one case where it mattered: I could not tell from the file whether she had
chosen it or her program had produced it in a heavily re-marked passage. Measured once; confirmed by
her as deliberate.

### E-3. A comment on a heading did not come back

I sent 39 comments in round 1; 38 returned. The missing one was anchored on the Heading 1
"Ch. 1 — The Ninth Bell". It is not in `comments.xml` and left no trace in `document.xml`. Her round-2
note answered its content, so she had seen it. Her round-3 note explains that her program "keeps
heading comments apart from the text" and she had dismissed it there. Measured; I made only one such
comment, so not reproduced.

### E-4. Words I did not write appeared under my name

Five of my comments came back in round 2 with a paragraph prepended, signed as me:
`On words since rewritten: “you've been here since before light”`. Each had been moved to a zero-width
point at the start of its scene. Round 3 added five more, for ten in all; the first five were not
doubled. She disclosed it both times and said the line is the program's. The bodies of all 60 of my
comments were otherwise identical to what I sent. Measured in both rounds.

### E-5. Every comment date was restamped, twice

In round 2 all 62 comments, mine and hers, carried her export time (`2026-11-11T00:36:31.466Z`); mine
had been `00:12:19Z`. In round 3 all 94 carried `2026-11-11T17:35:28.419Z`. A round-1 comment of mine
has now had three dates. Neither of us can tell from the file which pass a comment belongs to.
Reproduced.

### E-6. Rejecting her changes does not give back her starting text

- Some whole-paragraph insertions had their text marked as inserted but not the paragraph mark, so
  rejecting them left an empty paragraph: two in round 2 (ch5 and ch6), one in round 3 (the coda).
  Other new paragraphs in the same files did have tracked marks (16 and 4).
- The cover word count changed without a mark in both rounds.

Reproduced. I saw the empty paragraphs with LibreOffice's reject-all; the XML shows the same thing.

### E-7. The file opens with Track Changes off

Her marked files have no `settings.xml`. I turned tracking on myself. An editor who assumed it was on
would make untracked edits. Measured in rounds 2 and 3; no harm occurred.

### E-8. The file-name request

Her first note asked that the file keep its name, and her third said "if you edit, please edit this
one: it's the one my program can take back". I returned every round under a new name, as I always do,
and said so. My edits came back correctly both times, so the name evidently did not matter to her
program. No harm observed; I cannot say why she asked.

### E-9. Things in the file that are not the book

The custom properties, hidden bookmarks, missing title and author, the en-US tag and the zero zip dates
described above. Measured; harmless to me. The round-3 clean copy carried none of them.

### E-10. "How many changes" has several honest answers

For my round-1 file: 60 edit operations in my list, 111 tracked-change elements in the XML, 111 on
reopening. For her round-2 file: 284 in the XML, 247 on reopening, and about 30 real changes by my
reading of the diff. Anyone checking the author's side against mine should compare XML to XML.

## Editor-side tool problems

These are about LibreOffice's scripting interface and file format, not about her files. They are here
because another scripted editor would hit them.

| Id | Problem | Evidence | Reproduced |
|---|---|---|---|
| T-1 | A comment cannot be anchored to a range from `findAll()` or `getAnchor()`. | First round-1 run: 60 edits applied, 0 of 39 comments, each failing with `no SwTextAttr inserted?`. A range from `findFirst()` works. | Yes (`r1/ctest.py`) |
| T-2 | With tracking on, each inserted comment is wrapped in an empty tracked insertion. | Trial file had 150 change elements instead of 111; 39 changed no text. I inserted comments with tracking off thereafter. | Yes |
| T-3 | A reply made through the API is saved as a separate top-level comment. | Trial file: 7 replies with no parent link, even with `ParentName` and `ParaIdParent` set. I wrote the links into `commentsExtended.xml` after saving. | Yes |
| T-4 | A tracked replacement that starts at the first character of an italic run comes out roman. | Wren's note in round 2 lost its italics on the new sentence. Fixed by inserting inside the run and deleting separately. | Yes |
| T-5 | In a file that already holds comments, character offsets shift by one per comment mark. | An assertion caught `" and I've been paying them since"` where `"and I've been paying them since."` was expected. | Yes |
| T-6 | Reject-all leaves my round-2 paragraph split in place, though its mark is tracked. | Round 1's identical split was removed by reject-all; round 2's was not. Her program handled it correctly: she turned it back in round 3. | Once; unexplained |
| T-7 | Reopening its own output, LibreOffice shows replies under zero-width comments as top-level. | 2 of her replies in round 2, 6 in round 3: exactly those under relocated comments. The XML holds every parent link. | Yes, twice |
| T-8 | One probe hung for 200 seconds with no output. | Not seen again after I gave each run a fresh profile and a timeout. | No |

Three things LibreOffice does that are not problems but that the author's side has to read: it writes a
replacement as the insertion followed by the deletion; it saved my moved sentence as a move
(`moveFrom`/`moveTo`); and it added parts and settings of its own on every save. All three round-tripped:
the moved sentence, the paragraph split and the paragraph join from round 1 were in her round-2 base
exactly as made.

## What I only suspect

- **Automatic hyphenation.** LibreOffice writes `autoHyphenation` = true into a new `settings.xml`. In
  Word that may switch hyphenation on for her manuscript. Her program discards the setting on re-export,
  so it can only matter if she opens my file in Word. To settle it: open a returned file in Word and
  look at the hyphenation setting.
- **`KathalaMarkedBy`.** This property still says "Elin Ashgrove" in the files I return, though the only
  tracked changes in them are mine. Her program took both files back correctly, so no harm was
  observed. To settle it: her side's import.
- **Everything about Word.** Where the properties and bookmarks show, how Word displays the relocated
  comments, and whether Word rejects my round-2 paragraph split are all from memory or inference.

## What worked

- Every edit I made round-tripped exactly: 60 of 60 in round 1, 20 of 20 in round 2. That includes a
  tracked paragraph split, a tracked paragraph join and a moved sentence.
- Every declined edit was really gone, and shown as a change of hers.
- None of my tracked changes ever came back still pending.
- Comments came back once each, never duplicated: 38 of 39, then 60 of 60 with bodies unchanged.
- Threading held. All her replies were under the comments they answered. My seven round-2 replies came
  back under the right threads. The thread I resolved stayed resolved, and the one I left open came
  back answered and closed.
- The clean reading copy was exactly the marked file with her changes accepted.
- Styles, headings, scene breaks, bookmarks and the header were byte-stable across all three of her
  files. Scene breaks as real "#" paragraphs meant structure was never in doubt.
- Her bookmarks and custom properties survived LibreOffice untouched.
- Her word counts matched mine each time.

## On receiving a revision with the author's changes marked

**What it gave me.** I could see where she had worked, which was useful for finding my place. Her
declined edits were visible as changes. Her replies sat in the margin under my comments, with resolved
threads marked, which is the part of the round trip that worked best.

**What it did not give me.** It could not tell me which of my edits she took, since those are unmarked.
It could not separate "she turned my edit back" from "she wrote something new". Where she had rewritten
or inserted, the marks were unreadable. And rejecting her changes did not quite return the text she
started from.

**What would have made it usable without a comparison:**

1. Mark a whole inserted paragraph as one insertion, instead of re-aligning it word by word against
   its neighbour. This is the single change that would have saved the most.
2. Mark a rewritten sentence at phrase or sentence level, not per word.
3. Distinguish a declined editor's edit from the author's own change, in the mark or in a margin note.
4. Track paragraph marks consistently, and track the cover word count or leave it alone.
5. Keep the original date on each comment.
6. Keep program-added text out of comments signed by someone else, or sign it as the program.
7. Send the clean copy every time. It made round 3 an hour's reading instead of an afternoon's.
8. State the tally in the cover note. Her round-3 note did ("fifteen of your nineteen"), and it was
   the quickest thing to check.

## Interruptions

Three usage-limit stops, none caused by the work.

1. **Round 2, early.** I had measured her file, dumped the comments and diffed her text. A LibreOffice
   probe of her comment threads was running (and had hung) when I was stopped and the machine restarted.
   Nothing had been edited.
2. **Round 2, a few minutes after resuming.** The edit, comment and reply lists were written and two
   trial files existed. The second had just shown my replies saving unthreaded (T-3). Nothing was in the
   handoff folder.
3. **Round 3, near the end.** The edited file, closing note and notes were handed back. Only this report
   remained.

Nothing was redone after any of them, and no round 1 work was interrupted.

## Where the evidence is

All under `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/loop2/`:

- `handoff/`: her three files and notes, the clean copy, my three edited files, two letters, three
  replies.
- `editor/notes-round1.md`, `notes-round2.md`, `notes-round3.md`: working notes with the measurements.
- `editor/r1/`, `r2/`, `r3/`: edit, comment and reply lists (each edit with old words, new words and
  reason), the scripts, apply logs, text exports and diffs.
- `editor/r1/trial-comments-tracked.docx`, `editor/r2/trial2-replies-flat.docx`,
  `editor/r2/final2-roman-note.docx`: the files that show T-2, T-3 and T-4.
