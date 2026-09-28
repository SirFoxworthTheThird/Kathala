# Editor spike — 28 September 2026

Step 1 of *One screen for the book* in `ROADMAP.md`: before the Timeline and the
Manuscript become one continuous document, pick the editor that can carry a
whole book, with every chapter and scene heading keeping the id of the record
behind it. The roadmap recommended CodeMirror 6 on argument alone and said to
choose it with a spike, not a paragraph. This is the spike.

The harness is in [`spikes/editor/`](../../spikes/editor/README.md), and its README says
how to run it again.

## Decision

**CodeMirror 6.** It is the only candidate that stays fast on a whole book.
Typing costs about 4 ms a keystroke at any point in *The Count of Monte Cristo*;
the other two cost a median of 70–145 ms. It loads in about 50 ms, and it stores exactly
what the app stores — plain text — so nothing about a scene's prose has to be
translated on the way in or out.

What it costs, and what step 2 therefore has to carry:

1. **Heading ids are ours to keep.** In CodeMirror a heading is text, so its id
   is a marker beside the text, and the rules for when an edit keeps or drops it
   are code we own. Six rules, all tested below. ProseMirror gets most of that
   for nothing, because a heading is a node and the id is an attribute of it.
2. **The browser's Ctrl+F cannot see most of the book.** CodeMirror only puts
   the visible part in the page. A phrase from the last scene was found by
   `window.find` in the textarea and in ProseMirror, and not in CodeMirror; a
   phrase near the top was found by all three. Step 2 needs CodeMirror's own
   search bound to Ctrl+F.
3. **Recheck on a real machine.** Every number here comes from headless,
   software-rendered Chromium in a four-core container. The comparison between
   the candidates is what this spike can support. The absolute numbers are not
   what a writer's laptop will show.

## The book

*The Count of Monte Cristo* from the Library: 117 chapters, 149 scenes, 459,375
words. Composed as one document — `# Chapter`, `## Scene`, then the prose, a
blank line between each — it is 2,620,833 characters on 29,363 lines.

Every scene round-trips exactly in all three editors: 149 of 149, read back out
of the editor and compared with what went in. No prose in any of the 2,710
scenes in the Library has a line starting with `#`, so the syntax
collides with nothing that exists today. Step 5 still needs an escape for it.

## What it costs

Chromium 141, headless, 1440×900, spellcheck on, as the app has it. Three runs of
each; the ranges are across the runs. Typing is 84 keystrokes of one sentence at
the end of a paragraph, 60 ms apart. It is measured from the key to the first
moment after the frame that shows it, and the caret was checked to be on screen
before and after.

| | Load | DOM elements | JS heap | Typing, middle of the book (p50 / p95) | Typing, near the end (p50 / p95) |
|---|---|---|---|---|---|
| `<textarea>` | 571–612 ms | 11 | 6.8 MB | 112–132 / 141–259 ms | 127–144 / 246–276 ms |
| CodeMirror 6 | 48–87 ms | 33 | 13.7 MB | 4.0–4.6 / 5.7–7.5 ms | 3.8–3.9 / 4.9–5.3 ms |
| ProseMirror | 539–590 ms | 14,694 | 16.9 MB | 71–82 / 85–100 ms | 79–85 / 105–107 ms |

Scrolling was not a differentiator. Forty wheel steps of 1,200 px from the top
produced no frame over 50 ms in any of the recorded runs (an earlier trial run
had one 67 ms frame in CodeMirror). Setting the scroll
position to the very end took 17–40 ms in all three.

Minified, the spike's CodeMirror bundle is 267 kB (86 kB gzipped) and
ProseMirror's is 208 kB (64 kB gzipped).

**Why ProseMirror is slow here.** A trace of 34 keystrokes puts the time in
Chromium's own editing code, not in ProseMirror: 1,567 ms in
`TypingCommand::InsertText` and 970 ms in `Editor::SyncSelection`. For the same
keys in CodeMirror, `InsertText` took 32 ms and `SyncSelection` was not among the
entries over 29 ms. That cost grows with
the size of the editable region, and any editor that puts the whole book into
one editable element pays it. Two remedies were tried and neither helped.
`content-visibility: auto` on every block gave 90 / 130 ms (p50 / p95), and
turning spellcheck off gave 73 / 101 ms, against 68–70 / 86–93 ms without either
in the same sessions. The textarea was not traced.

**A number that was thrown away.** The browser's Event Timing API was measured
too, and reported waits of up to 3.8 s while typing near the end of the book in
CodeMirror. A trace of the same typing showed a frame drawn for every keystroke
(85 frames for 84 keys) and no task on any thread over 8 ms. The same API also
reported 120–256 ms waits at that depth for the other two editors. It is treated
as an artefact of headless software compositing at scroll offsets near 1.5
million pixels, and it is the first thing to look at again on a real machine.

## Whether the ids survive

Nine edits, each on a fresh load, against a scene heading in the middle of the
book that follows another scene rather than its chapter's heading:

| Edit | CodeMirror | ProseMirror |
|---|---|---|
| Retype the title | kept | kept |
| Select the whole line and retype it | kept | kept |
| Clear the line, then type a new heading | kept | kept |
| Enter in the middle of the title, then undo | first half keeps it; undo restores | first half keeps it; undo restores |
| Enter at the start of the heading | pushed down with its id | pushed down with its id |
| Backspace until it joins the scene above, then undo | dropped (2 presses); undo restores | dropped (1 press); undo restores |
| Cut the heading line, then undo | dropped; undo restores | dropped; undo restores |
| Copy the heading and paste it elsewhere | the copy has no id; the original keeps it | the same |
| Type a new heading in the prose | a heading with no id; nothing else changes | the same |

Nine of nine pass in both. The textarea cannot hold an id at all.

**CodeMirror's rules** (the top of `codemirror.js`): an id sits at the start of
its heading's line. A line break typed there pushes the heading down, and the id
goes with it. Anything else typed there leaves the id at the start of its line.
Merging the line into a non-empty line above drops the id, and so does deleting
the whole line with its break. Undo puts a dropped id back.

The first run failed one of these. Backspace twice — once for the blank line,
once for the join — then undo, and the text came back without its id. CodeMirror
had grouped the two keystrokes into one undo step, and mapped the second one's
restore back through the first one's inverse. That inverse inserts a line break
exactly where the heading starts, and a plain position mapping stayed in front
of it, so the id landed on the blank line. The fix was to map a waiting restore
with the same "a line break pushes it down" rule the markers use. It is the kind
of mistake the rules invite, which is why step 2 must test them against real
transactions. `undo` and `redo` in `@codemirror/commands` are state commands, so
that can be done in Vitest without a DOM.

**ProseMirror's one addition**: splitting a heading copies its attributes to
both halves, so a plugin keeps the id on the half that sits where the heading
was.

**Each rule was broken on purpose**, rebuilt, and run against the nine edits:

| Mutant | Caught by |
|---|---|
| CodeMirror: no "line break pushes it down" | Enter at the start; Backspace-join-undo |
| CodeMirror: no "whole line deleted" | cut, then undo |
| CodeMirror: keep an id that is no longer at a line start | Backspace join |
| CodeMirror: no undo restore | Backspace-join-undo; cut, then undo |
| ProseMirror: no duplicate-id plugin | Enter in the middle of the title |
| ProseMirror: write the id into the copied HTML | **survived** |

The survivor is not a gap. Keeping the id out of the HTML was meant to stop a
pasted copy carrying it, but the duplicate-id plugin takes it off the copy
anyway. The comment claiming more was corrected.

## Not measured

- A real GPU, Electron, and a phone. The phone matters: the Timeline is used on
  one, and nothing here says how either editor behaves under a touch keyboard.
- IME and composition input, and screen readers. CodeMirror only rendering what
  is visible affects both, and neither was tried.
- Memory outside the JavaScript heap. ProseMirror's 14,694 elements cost
  renderer memory that `usedJSHeapSize` does not count.
- The scene header line (`[#Place @@Name]`) and the `@` mention picker. Both are
  text today, so they suit CodeMirror's model. Neither was built into the spike.
