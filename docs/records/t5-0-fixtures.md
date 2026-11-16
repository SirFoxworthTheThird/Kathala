# T5.0: Word's reply comments, and what LibreOffice does with a marked file

**Plan:** `round-trip-plan-2.md`, T5.0. This was to be done before any of T5's code (D-2).

## Word's own replies

We cannot run Word here, so the shape of a reply comment is taken from a file Word made.

**The file.** `fixtures/docx/word-replies/word16-replies.docx` is the test fixture `test-docx_comments.docx` of the R
package *officer* 0.7.8 (MIT, © 2022 ArData), saved by Microsoft Word 16.
- **Changed:** its `people.xml` and `docProps/core.xml` named the real person who saved it, with their sign-in. Both
  are replaced by the comments' own author, "Author Me", and the company is emptied.
- **Kept as it was:** everything else. Its README says so.

**What it shows** (`docxReplies.test.ts`, which pins these facts):
- 16 comments, four of them replies, one of those a reply to a reply.
- Every comment, reply or not, has its own `commentRangeStart` and `commentReference` in the text. A reply sits
  around the same words as the comment it answers.
- A reply is linked in `commentsExtended.xml` by `w15:paraIdParent`, which is the `w14:paraId` of the parent's last
  paragraph. Word writes `w15:done` on every comment.
- Word 2019's `commentsIds.xml`, `commentsExtensible.xml` and `people.xml` are there too. None of them is needed to
  thread a reply.

**The reader already threads it.** Replies 8 and 9 come under comment 7, 11 under 10, and 13 under 12. Word flattens a
reply to a reply to its thread's first comment, and the reader takes it the same way.

## What LibreOffice does with a file marked as T5 will mark it

`npm run probe:marked` (`scripts/marked-probe.ts`) builds, by hand, the shape T5.1 and T5.2 mean to write. It does so
on the loop's own export, which was made after T1.6:
- the writer's tracked changes, signed *Nell Garrow*: a word replaced, and a paragraph inserted with its mark;
- the editor's two comments with her replies, linked as Word links them, one thread resolved.

It opens the file in LibreOffice 24.2, headless, saves it as Word, and reads both with the app's reader.

| | As made | Saved by LibreOffice |
|---|---|---|
| Threads | 2, each with its reply | **2, each with its reply** |
| Comment order | comment, reply | **reply, then the comment it answers**, renumbered |
| Done | open, open, resolved, resolved | **the same** |
| How *open* is written | `w15:done="0"` | **no flag, or no entry at all** |
| Tracked changes | 3 insertions, 1 deletion, by Nell Garrow | **the same** |
| Scene bookmarks | 13 starts, 13 names, 13 ends | **the same, all whole** |
| Parts | `comments.xml`, `commentsExtended.xml` | the same |

**So the shape holds through LibreOffice.**
- T5.2 needs to write only `comments.xml` and `commentsExtended.xml`.
- T5.3 must read a missing done flag as open, not as unknown.
- T5.3 must thread replies whatever order they come in. The reader already does.

**The first run of the probe was on the wrong file.** It used the first run's export, from before T1.6, and
LibreOffice broke its range bookmarks into 34 starts for 18 names, as T1.6 found. The probe now uses an export from
after T1.6, whose point bookmarks come through whole.

**Both files are kept as fixtures**, `run-2026-11-10-loop/marked-as-made.docx` and `marked-through-libreoffice.docx`,
for T5.3 to read back. The test requires the same two threads from each.

## Also fixed here

`npm run probe:emphasis` did not exist, although T2's record and `proseEmphasis.ts` both say to run it: the script was
never added to `package.json`. It is added now, beside `probe:marked`. `tsconfig.node.json` gains `DOM.Iterable`,
because the probe reads Word files with the app's reader.

## Tests

- **`docxReplies.test.ts`:**
  - Word's replies threaded as Word means them;
  - the shape the export must write, counted from Word's file;
  - the marked file's threads, the same as made and as LibreOffice saved them, with LibreOffice's order.
- **Mutant:** the reader ignoring `w15:paraIdParent` fails two of the three tests.

## Waiting

T5.1 waits on decisions D-4, D-5 and D-6 in the plan.
