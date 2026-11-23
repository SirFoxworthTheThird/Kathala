# UX expert run — 2026-11-23, part 2 of 3

Reviewer: the `ux-review` agent. The guide sections I was given are *The book: goals, reading and export*, *Find & replace*, *Scene history*, *Drafts of the book*, *Focus mode*, *Notes on the prose*, *An editor's changes, through Word*, *Revision tasks*, *The prose pass*, *Notes from beta readers*, *Characters*, *Viewing pictures full size*, *Generate characters with AI*, *Goals & motivations*, *Cast Balance*, *Plot Threads* (with its three subsections), *Motifs & Themes*, *Structure board* and *How the book divides*.

**Setup.** I used the shared production build at `http://localhost:4173`, with the Library staged. I did not build, and I did not start or stop the server. I drove my own Chromium (`/opt/pw-browsers/chromium`) with Playwright scripts in the scratch directory. The sizes were:
- **Laptop:** 1280×800.
- **Phone:** iPhone 13 (390×664 viewport), touch on.
- **Smaller phones:** 360 and 320 wide, touch on.
- **Small laptop:** 1000×800.
- **Touch laptop:** 1280×800 with touch on.

I installed Library worlds through the `__pwlibrary` seam, without images. Those worlds open in reading mode, so for the writer's screens I turned reading mode off with `__pwdb.worlds.update(id, { readingMode: false })`. *Strange Case of Dr Jekyll and Mr Hyde* was the small world and *Dracula* the large one. The Library has no *Middlemarch*. For the empty states I made a blank world from a two-chapter imported manuscript.

**Scratch paths.**
- Scripts: `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/ux2/s*.mjs`.
- Screenshots: `…/ux2/shots/NN-*.png`.
- Downloads: `…/ux2/dl/`.

All screenshots are at `deviceScaleFactor: 1`, and I looked at each one I cite.

**Word round trip.** I did not use a repository `.docx` as the editor's file. Every fixture in `src/lib/__tests__/fixtures/docx/` is tied to its own book, and I needed one tied to a book I could open:
- The `import/` files are inputs to *Import Manuscript*.
- The `run-*` folders are rounds of the *Salt Ledger* writer runs, made from drafts that exist only inside those runs' `.pwk`.
- `word-replies/` is a Word 16 replies sample.

Instead I exported Jekyll for an editor and rewrote the downloaded file with `ux2/editdocx.py`, the same way `e2e/wordRoundTrip.spec.ts` does. The rewrite adds:
- a tracked replacement (*rugged → craggy*);
- a tracked deletion (*and yet somehow lovable*);
- one comment (on *drank gin*);
- one edit with tracking off (*well-known → celebrated*).

I then brought that file back in. I used the editorial letter fixture `run-2026-11-14-loop3/round1-editorial-letter.txt`, which is plain text, for *Paste an editorial letter…*.

**The run was interrupted once** by a usage limit. After it, the server came back on the same build and every browser was relaunched, so every world was set up again from scratch. No result here depends on state from before the break.

---

## What I covered

### Coverage ledger

| | means |
|---|---|
| ✓ | checked |
| ◐ | partly: what was left is said in the notes |
| ✗ | not checked |
| n/a | the check does not apply to the section |

**Theme columns:**
- **Dark** means the world's own dark theme: Gothic for the Library worlds, Default for the blank world.
- **Light** means *Paper*, the one light theme.

**Notes column.** It lists what I did, and what I left undone, for each section.

| Section | Laptop | Phone | Keyboard | Screen reader (aria snapshot) | Dark | Light | Notes |
|---|---|---|---|---|---|---|---|
| The book: goals, reading and export | ✓ | ✓ | ◐ | ✓ | ✓ | ✗ | Page, Read, book goal, header counts, *In this scene* (looked at, not clicked into), Spoiler pass and the whole Export dialog in all six formats. Markdown and Word downloaded; PDF and EPUB not downloaded. Submission and print-interior fields not filled in. Keyboard: the dialog's selects only (UX-2-1). |
| Find & replace | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | Replace all, undo, and the rename offer. One-at-a-time replace not pressed. |
| Scene history | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | Opened from the chapter panel's *History (1)* after a replace. Restore not pressed. |
| Drafts of the book | ✓ | ✗ | ◐ | ✓ | ✓ | ✗ | Save, compare with now, the delete confirm, Escape. *Restore this scene* not pressed. |
| Focus mode | ✓ | ✓ | ✓ | ◐ | ✓ | ✗ | Enter, next scene, typing, Esc, and Tab out. Split and new-scene keys not tried. |
| Notes on the prose | ✓ | ✓ | ◐ | ✓ | ✓ | ✗ | Ctrl+Alt+M, the kind picker, save, reply, resolve, and the *Show* filter. Phone path through Book tools. Go to it, Edit and Delete not pressed. |
| An editor's changes, through Word | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | Send, bring in, marks on the Page, Changes, accept, reject, reject all, Drafts after bring-in, the delete-sent-draft confirm, and the *Show my changes since* option. Not tried: moves, heading comments, LibreOffice files, the clean copy's download, and a missing draft. |
| Revision tasks | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | Add one, paste and split the letter, add 44, tick, and the Link picker. Not tried: the chapter panel's task list, and *Make a task* from a note or a finding. |
| The prose pass | ◐ | ✗ | ✗ | ◐ | ✓ | ✗ | Turned on at Ch. 1, where it said *Nothing found in this scene*. Did not scroll to a scene with findings. Did not open the *Prose checks* settings. |
| Notes from beta readers | ✓ | ◐ | ✗ | ✓ | ✓ | ✗ | Reader side: react, *Your notes*, send. Writer side: bring in, *Readers · 1*, and the reactions map, which I also checked on a phone. Did not try replacing a reader's earlier file. |
| Characters | ✓ | ✓ | ◐ | ✓ | ✓ | ✗ | Blank and Dracula rosters, search and no-match, Add / Add another, detail tabs with counts, the reveal header, and the Edit form's names and reveal pickers. Keyboard: tab arrows, the add dialog and the pickers. Not exercised: Current State, History, *Carry … forward*, and reading-mode grouping. |
| Viewing pictures full size | ✓ | ✓ | ◐ | ✓ | ✓ | ✗ | Character portrait only, after an upload. Items, world cover and map pictures not checked. |
| Generate characters with AI | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | Copy prompt, paste JSON inside a fence, add (*Added 1 · updated 1*). The bad-JSON message was not confirmed. |
| Goals & motivations | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | Tab, an existing goal, and the add form. |
| Cast Balance | ✓ | ✓ | n/a | ◐ | ✓ | ✓ | Rows read as text; the strip is `aria-hidden`. |
| Plot Threads | ✓ | ✓ | ✗ | ◐ | ✓ | ✓ | Checked at 1000px as well. *Attach scenes* and *New thread for this scene* not opened. |
| Filtering the timeline to one thread | ✓ | ✗ | ◐ | ✓ | ✓ | ✗ | Pills, *+3 more*, filtering by one thread. |
| A lane per thread in the Arc grid | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | Looked at only. |
| Threads in the Continuity Checker | ✓ | ✗ | ✗ | ◐ | ✓ | ✗ | Took the *Resolves at Ch. 14* offer, and checked its undo label. |
| Motifs & Themes | ✓ | ✓ | ✗ | ◐ | ✓ | ✓ | Same component as Plot Threads. |
| Structure board | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | Assigned a beat through the filter. Did not switch templates. Could not produce *out of order* in the time I had. |
| How the book divides | ✓ | ✓ | n/a | ✓ | ✓ | ✓ | |

**Totals across the 22 sections.**

| Check | ✓ | ◐ | ✗ | n/a |
|---|---|---|---|---|
| Laptop | 21 | 1 | 0 | — |
| Phone | 13 | 1 | 8 | — |
| Keyboard | 2 | 7 | 11 | 2 |
| Screen-reader snapshot | 15 | 6 | 1 | — |
| Dark | 22 | — | — | — |
| Light (Paper) | 5 | — | 17 | — |

**Least covered:**
- Paper everywhere outside the dashboard and the Structure board.
- The keyboard on the Word round trip and the Revisions list.
- The phone on Find & replace, Scene history, Drafts and Generate with AI.

---

## Findings

Ranked by what each one costs the person using the app. Cost is **high**, **med** or **low**.

### UX-2-1 — high — A keyboard cannot choose an option in any of the app's dropdowns

**Screen and guide section:** every custom `Select`. In my sections:
- Export's *Scenes to include*, *Chapter headings*, *Paper* and *Trim size* (*The book … export*);
- the Notes *Kind*, *Show*, *Chapter* and *From* pickers;
- the Drafts *From* and *To* pickers;
- *Whose reactions*;
- the reveal and names-over-the-book scene pickers;
- the Goals *From* and *until* pickers;
- the Revisions *Link* picker;
- the Structure template and *Assign a scene…* pickers.

**What I did.** In the Export dialog at 1280, I focused *Scenes to include* and pressed Enter. The list opened. Then I tried four things:
- ArrowDown;
- typing `f` (for *Final only*);
- Tab, 25 times;
- Escape.

I repeated Tab, 40 times, on the Notes panel's *Show* picker, which is outside a dialog.

**What I expected.** Arrows move through the options, Enter picks one, and Escape closes the list and only the list.

**What happened.**
- **Arrows.** ArrowDown left focus on the trigger.
- **Typing.** It changed nothing: the trigger still read *Every scene*.
- **Tab.** No Tab press ever reached an option, inside a dialog or outside one.
- **Escape in a dialog.** It closed the list and the whole Export dialog together. Afterwards there were 0 listboxes and 0 dialogs.
- **Escape in the filtered scene picker.** On Hyde's Edit form, with focus in the *Filter scenes…* box, two Escapes left the list open (`72-reveal-after-esc.png`).

**Evidence.**
- The options are `DIV tabindex=null` (*Every scene*, *Revised and final*, *Final only*), portalled to the end of `<body>`.
- `s42.mjs` and `s43.mjs` print `reached an option by Tab: false` for both cases.

**Mechanism.** `src/components/ui/select.tsx` has no key handling at all:
- the only listener it adds is `mousedown`, at line 72;
- `SelectItem` is a `div` with `role="option"`;
- `SelectContent` portals the list, so a dialog's focus trap keeps it out of reach.

F16 in `writer-run-2026-08-23-blind.md` fixed the trigger's *semantics* (`aria-haspopup` / `aria-expanded`). Operating the list from the keyboard was never filed.

**Who it costs.** Keyboard users and screen-reader users, everywhere a choice is a dropdown. Neither can export *Final only*, make a note a *Query*, or place a beat on the Structure board.

### UX-2-2 — high — On a phone, the Export dialog's PDF button (and at 320px Word and EPUB too) cannot be reached

**Screen and guide section:** Export manuscript (*The book: goals, reading and export*).

**What I did.** I opened Export from Book tools at 390×664 and at 320×640, with touch on.

**What I expected.** The six formats, all reachable.

**What happened.** The format row is a single row whose overflow is `hidden`.

| Width | Row's inner width | Visible width | What is lost |
|---|---|---|---|
| 390 | 371px | 306px | EPUB is cut at its right edge; PDF (362–413) lies wholly past the row's right edge at 348. |
| 320 | 371px | 236px | Word, EPUB and PDF are all past the edge. |

`overflow: hidden` cannot be swiped, so a touch user has no way to PDF, which is the format the guide gives three layouts and a page of explanation. Tab focus would scroll the row, but a phone has no Tab.

**Evidence.** `11-export-phone.png`, `11-export-p320.png`, `08-export-phone.png`; the measurements are printed by `s7.mjs`.

**Mechanism.** `ExportManuscriptDialog.tsx:252`: `flex overflow-hidden` holding six `flex-1` buttons with `px-3`.

**Who it costs.** Phone users.

### UX-2-3 — high — *What became of their changes* counts a change still waiting as "turned back", and the file signs it so

**Screen and guide section:** Export for an editor, *Show my changes since …* (*An editor's changes, through Word*).

**What I did.** I brought in the edited file (3 changes). I accepted *craggy*, rejected the *lovable* deletion, and left the untracked *well-known → celebrated* undecided: the Page's button still read **Changes · 1**. Then I opened Export, chose Word, and ticked *For an editor*.

**What I expected.** The tally either leaves an undecided change out, or says that one is still waiting before the revision goes back.

**What happened.** The status reads: *"Of Ana Editor's 3 changes: 1 stands, 2 turned back. The copy lists the 2 not taken…"*. The option itself says that changes which turn an edit back are signed *The author (edit declined)*. Nothing in the dialog mentions the change still waiting in *Changes*.

**Evidence.** `s28.mjs` prints `pending: [ ' Changes · 1' ]` immediately before that status text. Screenshot `45-export-marked.png` is from the same flow (`s26.mjs`).

**Mechanism.** By the guide's own rule, the tally "reads each in the book as it is now". An undecided change leaves the book as it was, so it reads as turned back. The rule is applied as written. The trouble is that the writer has not decided anything yet, and the editor is about to be told they did.

**What I did not check.** I did not open the marked `.docx` to see whether that change really carries the *(edit declined)* author. That is listed under *What I only suspect*.

**Who it costs.** Writers sending a revision back, and their editors' trust.

### UX-2-4 — med — Plot Threads and Motifs lose the cadence strip on a phone, and lose their warnings below 1024px

**Screen and guide section:** the dashboard (*Plot Threads*, *Motifs & Themes*).

**What I did.** I opened Dracula's dashboard at 390, 1000 and 1280, and measured the first three thread rows.

**What happened.**

| Width | Strip width | Row overflow | Warning shown |
|---|---|---|---|
| 390 | **0px** | the row's last control ends at x=418, though the row ends at 366 (52px clipped) | no |
| 1000 | 481px | none | **no**: the second row's *dangling* warning is not drawn |
| 1280 | shown | none | yes |

So on a phone the widget is names, the *resolved at Ch. N?* links, and counts clipped at the right edge (`81-PlotThreads-phone-Dracu.png`). The guide's "draws a cadence strip per thread … and flags trouble" is neither, and the only remaining sign of trouble is a 40%-alpha amber border.

**Mechanism.** `src/features/worlds/CadenceManager.tsx`:
- the strip is `flex-1` beside fixed-width neighbours that do not shrink: the name is `w-28`, the count is `w-16`, plus the *resolved at Ch. N?* link and two icons;
- the warning is `hidden lg:flex w-56` (line 167);
- the strip is `aria-hidden` (line 91).

Below `lg`, no width gives the warning back as text, and at any width the cadence is not given to a screen reader.

**Who it costs.** Phone and tablet users. Screen-reader users get the cadence at no width.

### UX-2-5 — med — On any touch device, every dialog's ✕ falls to the bottom-left, and the full-size picture is pushed off-centre

**Screen and guide section:** every `Dialog`, and the image lightbox (*Viewing pictures full size*, and every dialog in my sections).

**What I did.** I opened *Add Character* three times, at 1280 with a mouse, at 390 touch, and at 1280 *with touch on*, and measured the Close button. I also opened a portrait full size on a phone.

**What happened.**

| Device | Close button `position` | Where it lands |
|---|---|---|
| Mouse, 1280 | `absolute` | top-right, x=471 of 512 |
| Phone, 390 | `relative` | bottom-left, x=9, y=385 of 421 |
| Touch laptop, 1280 | `relative` | bottom-left, x=9, y=297 of 333 |

In flow, the ✕ lands after the content, at the dialog's bottom-left, in every dialog:
- Export: `08-export-phone.png`;
- Add Character: `10-addchar-phone.png`;
- Changes: `41-changes-phone.png`.

In the lightbox the 36px button joins the image's flex row. The image is pushed against the left edge of the screen and the ✕ sits beside its middle (`75-phone-lightbox.png`, button at x=340, y=330, `position: relative`).

**Mechanism.**
- `.pw-tap { position: relative; }` sits inside `@media (hover: none), (pointer: coarse)` in `src/index.css` (from line 1385). On touch it beats the `absolute` it is combined with.
- Three call sites combine the two: `dialog.tsx:169`, `ImageLightbox.tsx:63` and `HistoryTab.tsx:160`.
- The class's own comment says it only adds a centred `::after`. Its `position: relative` is there so the `::after` can be placed against the button.

**Who it costs.** Phone, tablet and touch-laptop users.

### UX-2-6 — med — Escape on the *Delete this draft?* confirm closes the Drafts dialog too

**Screen and guide section:** Drafts (*Drafts of the book*; also *An editor's changes, through Word*, where deleting a sent draft asks first).

**What I did.** I saved a draft, pressed its Delete, and with *Delete this draft?* open on top of *Drafts of the book*, pressed Escape once. I reproduced it twice in `s27.mjs`, and once on a *Sent for editing* draft in `s26.mjs`.

**What I expected.** The confirm closes, and Drafts stays open.

**What happened.** Both dialogs closed: `dialogs with confirm 2 … after Esc 0`.

**Mechanism.**
- `Dialog` (`dialog.tsx:107`) derives `close` with `useCallback(…, [onOpenChange])`.
- `DraftsDialog.tsx:45` passes an inline `onOpenChange`, so every re-render of Drafts gives `close` a new identity.
- `useModalLayer`'s effect then cleans up and re-pushes the outer dialog onto `openDialogs`.
- Opening the confirm re-renders Drafts. In that commit the confirm's own effect runs first (children before parents), so the outer dialog is pushed back on top of it.
- Escape is answered by whichever layer is last, which is now the outer one.

`e2e/dialogA11y.spec.ts` "Escape closes only the innermost of two stacked dialogs" passes because its parent dialog's `onOpenChange` is stable.

**Who it costs.** Keyboard users, who lose their place and the list they were working in.

### UX-2-7 — med — A reply typed under a note is thrown away when you press Resolve

**Screen and guide section:** the Notes panel (*Notes on the prose*).

**What I did.** I made a note on *rugged countenance*, pressed **Reply**, typed *"Yes, a little."*, and pressed **Resolve**, which sits just under the reply box.

**What I expected.** The reply saved with the resolve, or a warning that it would be lost. Reply-then-resolve is the usual end of a thread in Word.

**What happened.** The note resolved with `replies: []` (read from `__pwdb.proseNotes`). The typed reply was gone, without a word.

**Evidence.** `s18.mjs`; `30-note-reply.png`; `31-note-resolved-all.png`.

**Mechanism.** `NotesPanel.tsx:303` keeps the reply in local state, and only its own form's submit saves it. Resolve (line 331) does not look at it.

**Who it costs.** Everyone who answers notes, and editors through Word, since replies travel back to them.

### UX-2-8 — med — *Also rename*, on by default, silently gives an existing character's name to another character

**Screen and guide section:** Find & replace (*Character-rename aware*).

**What I did.** In Jekyll I replaced *Poole* with *Bradshaw*. Both are characters in the book. *Also rename "Poole" → "Bradshaw"* was ticked by default.

**What happened.** The characters went from `['Bradshaw', 'Poole']` to `['Bradshaw', 'Bradshaw']`. The dialog said only *"Replaced 61 occurrences in 15 scenes and renamed 1 character."*

The rest of the app avoids this case. The guide's Characters section explains why two records with one name are "two different objects" to the hand-off and the checker, and refuses the same thing when an item is named.

**Evidence.** `s10.mjs`; `17-two-bradshaws.png`.

**Mechanism.** `FindReplaceDialog.tsx`: the rename offer (line 159) does not check the replacement against the cast.

**Who it costs.** Writers renaming. `@` mentions and search then see two people under one name.

### UX-2-9 — med — On a phone, tapping a character's portrait opens the image menu, not the picture

**Screen and guide section:** the character header (*Viewing pictures full size*: "Click the portrait on a character's page to open it full size").

**What I did.** I uploaded a portrait to Hyde at 390 with touch, then tapped the centre of the 48px portrait.

**What happened.**
- `elementFromPoint` at the centre is `BUTTON "Portrait for Edward Hyde"`, the ⋯ image-options button. The tap opened its menu: 1 menu, 0 dialogs.
- Only a tap at the portrait's top-left corner opened the picture.
- On a laptop, a click at the centre is intercepted by the same button. Playwright's `click()` timed out on it, reporting that the ⋯ button's subtree intercepts pointer events.

**Evidence.** `s45.mjs`; `74-phone-portrait-tap.png`.

**Mechanism.** The 24px ⋯ button sits at `-bottom-1.5 -right-1.5` on the 48px portrait and carries `.pw-tap`, whose centred 44×44 `::after` covers the portrait's centre. `.pw-tap`'s own comment warns against exactly this: "only apply to well-spaced, standalone controls so hit areas never overlap."

**Who it costs.** Phone users. Mouse users too, if they click the middle of the portrait.

### UX-2-10 — med — The dashboard's amber warnings are 2.10:1 on the Paper theme

**Screen and guide section:** the dashboard (*Cast Balance*, *Plot Threads*, *Motifs & Themes*).

**What I measured.** With the world on `theme-paper`, I read the computed colours and converted the `oklch` values through a canvas.

| Text | Size | Colour on background | Ratio |
|---|---|---|---|
| Cast Balance's *drops out for 4 chapters*, *never appears*; Plot Threads' *dangling …*; Motifs' *vanishes …* | 10px | `rgb(254,154,0)` on `rgb(253,253,251)` | **2.10:1** |
| The same warnings on the Gothic theme | 10px | | 8.54:1 |
| The grey *dies in Ch. 7* beside them, on Paper | | | 5.51:1 |

**Evidence.** `s57.mjs`; `93-theme-theme-paper-threads.png`.

**Mechanism.** These warnings use a hard-coded `text-amber-500`:
- `CastBalance.tsx:83`;
- `CadenceManager.tsx:167`.

The other text in the widget follows the theme tokens.

**Who it costs.** Everyone on Paper, the one light theme. These are the widget's whole point.

### UX-2-11 — med — Cadence strips do not line up from row to row, so one chapter is in a different place on each

**Screen and guide section:** the dashboard (*Plot Threads*, *Motifs & Themes*).

**What I did.** I measured where Ch. 14's cell starts in the first three Plot Threads rows at 1280.

| Row | Strip width | Ch. 14 starts at |
|---|---|---|
| *Dracula Moves West* | 709px | x=643 |
| *Jonathan's Captivity…*, which has a warning | 473px | x=529 |

That is 114px apart. Motifs do the same: *Documents and Modern Media*, with no warning, runs to x≈1115 while its warned neighbours stop at x≈880 (`81-Motifs-laptop-Dracu.png`). The guide offers the strips for spotting a rhythm across the book, and reading down a column is how that is done.

**Mechanism.** `CadenceManager.tsx:91` makes the strip `flex-1` in a row whose other parts change width per row:
- the `w-56` warning appears only on warned rows;
- the *resolved at Ch. N?* control comes and goes.

**Who it costs.** Everyone reading the widget.

### UX-2-12 — med — Focus mode is not a modal, so Tab walks into the hidden app behind it

**Screen and guide section:** Focus mode.

**What I did.** I entered Focus from the Page, typed, and pressed Tab 8 times.

**What happened.**
- The first Tab put focus on `BODY`.
- The next seven went to *Go to world list*, the cursor pill, *Next moment*, *View all chapters*, *Backup*, *Recent changes* and *Search*. All of them sit under the full-screen overlay, with no visible focus.
- The page's aria snapshot during Focus still lists the top bar and the main navigation. There is no `role="dialog"` or `aria-modal`.

**Evidence.** `s14.mjs`, `s13.mjs`; `23-focus-laptop.png`.

**Mechanism.** `FocusMode.tsx` portals a plain `div` (line 195), with no `useFocusTrap` and no dialog semantics. The app's own dialogs gained both under X-10.

**Who it costs.** Keyboard and screen-reader users.

### UX-2-13 — med — The Revisions *Link* list is as narrow as its 70px trigger, one word per line, with no filter

**Screen and guide section:** the Revisions task list (*Revision tasks*: "**Link** adds a chapter, a scene or a character").

**What I did.** I added the letter's 44 tasks to Jekyll and opened **Link** on one.

**What happened.**
- The list opened the width of the dashed *Link* chip, and wrapped *Ch. 1 · Story of the Door* one word per line (`52-link-menu-laptop.png`; phone `52-link-menu-phone.png`).
- It holds every chapter, every scene and every character: 10 + 47 + 15 in Jekyll, more in a long book.
- Unlike the scene pickers elsewhere, it has no filter box.

**Mechanism.** `TaskList.tsx:180`, `LinkPicker`, uses `SelectContent` without `filterPlaceholder`. `select.tsx` gives a minimum width of 320 only to filtered lists ("The trigger that opens it is often much narrower than the options it holds"), so this unfiltered one takes the trigger's width.

**Who it costs.** Everyone linking a task.

### UX-2-14 — med — Exporting a Library book fails by default: its cover is WebP

**Screen and guide section:** Export (*The book: goals, reading and export*).

**What I did.** In Jekyll, with reading mode off, I exported Markdown and Word with *Include world cover* left ticked, which is the default.

**What happened.**
- No file came down in 20 seconds.
- A red *"Cover must be a JPEG or PNG image"* appeared under the cover checkbox, about 350px above the button that was pressed (`37-export-cover-error.png`).
- With the box unticked, Word downloaded in 47ms.

All 29 covers under `kathala-library/library/*/art/generated/cover.*` are `.webp`.

**Mechanism.** `ExportManuscriptDialog.tsx:157–163`, `loadCover`, accepts only `image/jpeg` and `image/png`. The cover checkbox is enabled whenever a cover URL exists, whatever its type.

**Who it costs.** Anyone exporting a Library book, and anyone whose own cover is a linked WebP or GIF. The second case is a suspicion: uploads are recompressed to JPEG.

### UX-2-15 — low — Find & replace and Scene history are unnamed dialogs, with fifteen identical *Replace* buttons and a silent result

**Screen and guide section:** *Find & replace*, *Scene history*.

**What I found.**
- **Unnamed dialogs.** The aria snapshot gives a bare `dialog:` for both. They render a plain `<h2>` instead of `DialogTitle`:
  - `FindReplaceDialog.tsx:116`;
  - `SceneHistoryDialog.tsx:54`.
  
  These are the only two `DialogContent` users without one, out of every dialog in `src/`.
- **Identical buttons.** In Find & replace, every scene's button is named **Replace**: 15 of them for *Poole*.
- **Silent result.** The result, *"Replaced 61 occurrences in 15 scenes…"*, is a plain `span` (line 197), not a status, so it is never announced.

**Who it costs.** Screen-reader users.

### UX-2-16 — low — The dialog ✕ shows no focus ring

**What I did.** I tabbed through *Add Character* to its ✕.

**What happened.** The ✕ took focus with `outline: none` and no box-shadow, which `tabWalk` reports as `NO-RING` (`s34.mjs`).

**Mechanism.** `dialog.tsx:169` has `focus:outline-none` and nothing to replace it, unlike `SelectTrigger`'s `focus-visible:ring-1`.

**Who it costs.** Keyboard users, on every dialog.

### UX-2-17 — low — *Goes quiet mid-story* does not say where the silence is

**Screen and guide section:** the Continuity Checker (*Threads in the Continuity Checker*).

**What happened.** The finding reads: *"A run of 10 chapters between Ch. 4 and Ch. 27 has no beat on this thread, out of the 24 it runs across."* Ch. 4–27 is the thread's span, not the gap, so the writer still has to find the ten quiet chapters themselves.

**Also seen.** Taking a *Resolves at Ch. 14* offer reorders the section's groups under the pointer: *Subplot goes quiet* jumps above *Subplot raised and never resolved*.

**Evidence.** `s53.mjs`; `86-continuity-threads.png`.

**Who it costs.** Everyone.

### UX-2-18 — low — Motifs warn of a 3-chapter absence; threads need 5 chapters and a third of their span

**Screen and guide section:** the dashboard (*Motifs & Themes*).

**What happened.** In Dracula (27 chapters), 6 of 7 motifs are amber. Four of them are for *"vanishes for 3 chapters"* or *"4 chapters"* (`81-Motifs-laptop-Dracu.png`).

The guide spells out why threads were made stricter: "three quiet chapters of a five-chapter thread is not a stretch". The motif rule was not given the same treatment, and with nearly every row warned, the warning stops telling one row from another.

**Who it costs.** Everyone.

### UX-2-19 — low — Notes beside the Page at 1280 leaves the prose 364px wide

**Screen and guide section:** *Notes on the prose*.

**What I did.** At 1280, with the binder and the chapter panel open, I pressed Ctrl+Alt+M.

**What happened.**
- The editable page shrank to 364px, narrower than a phone (`28-note-panel.png`).
- The chosen words scrolled out of view.
- The panel's *Chapter* picker clips its own value: scroll width 95px against a client width of 91px, so *Every chapter* runs under the chevron.

**Who it costs.** Laptop users.

### UX-2-20 — low — Each revision task is the whole paragraph, four times, to a screen reader

**Screen and guide section:** Revisions (*Revision tasks*).

**What happened.** For a letter's task, the group, the *Done:* checkbox, the edit button and the *Delete:* button are each named with the full point. For the first point that is 470 characters each. The letter-split dialog truncates the same text (*"Keep: Thank you for sending me Ilse. I read the book…"*).

**Evidence.** `s30.mjs`.

**Who it costs.** Screen-reader users.

### UX-2-21 — low — In a prose diff, an insertion is shown only by colour

**Screen and guide section:** *Scene history*, Drafts' compare, and Changes.

**What happened.**
- **To a screen reader.** The diff reads *"Mr. UttersonUtterton the lawyer…"*.
- **On screen.** Removed words carry `line-through`, but added words are only green-tinted.

**Mechanism.** `ProseDiff.tsx:24–28` renders plain `span`s, not `del`/`ins` or hidden text.

**Who it costs.** Screen-reader users, and colour-blind readers of the added text.

### UX-2-22 — low — How the book divides: a 4% Act 2 gets no label, and an unplaced Plot Point 2 hands Act 3 74%

**Screen and guide section:** *How the book divides*.

**What happened.** Dracula as installed has only the Midpoint (Ch. 7), the Climax and the Resolution placed. The band reads *"Act 1 Ch. 1–6 (22%) · Act 2 Ch. 7 (4%) · Act 3 Ch. 8–27 (74%)"*, and draws only *Act 1* and *Act 3* (`87-structure-laptop-Dracu.png`).

That follows the guide's rule, but the picture claims an Act 2 of one chapter when the real answer is "Plot Point 2 not placed yet". The guide's *"the board says so rather than guessing"* covers only the case with no Act 3 beat.

**Who it costs.** Everyone.

### UX-2-23 — low — Changes are not listed in reading order

**What happened.** In *Changes from the editor*, the change made with tracking off (*well-known*, paragraph 2) is listed above the two tracked changes in paragraph 1 (`41-changes-laptop.png`).

**Who it costs.** Everyone working down the list against the Page.

### UX-2-24 — low — On a phone, the Changes list and the Goals form are cramped

**What happened.**
- **Changes.** The context text gets about 125px beside the buttons (`41-changes-phone.png`), and *Accept* and *Reject* are 28px tall and side by side.
- **Goals at 390.**
  - The existing goal is a single-line field 188px wide that cuts its text off (`scrollWidth > clientWidth`).
  - The new goal's field is 94px wide (`80-goal-form-phone.png`, `s48.mjs`).
- **Structure.** The ✕ is 14×14 with no `.pw-tap` (`StructureView.tsx:237`).

None of these is a control the app claims as 44px.

**Who it costs.** Phone users.

### UX-2-25 — low — Unnamed or misnamed controls in Characters and the Arc grid

**What I found.**
- **Arc colour.** The swatch in the character Edit form is an `input type=color` with no label and no `aria-label` (`s38.mjs`).
- **Overview vs Edit naming.** The Overview calls it *Colour … on the map and the Arc grid*; the Edit form calls it *Arc colour*.
- **Arc grid filter.** In *Threads* rows, the box still says *Filter characters…* (`84-arc-threads-laptop.png`).
- **Goals.** The goal's textbox is named after its placeholder, *What drives them…*, rather than its kind (*Want*).

**Who it costs.** Screen-reader users.

### UX-2-26 — low — Character tab counts are 3.70:1 at 10px

**What I measured.** The counts on the character tabs (*History 42*, *Appearances 42 · 2 mentioned*) are 10px at `opacity: 0.7`. Blended, `rgb(131,119,112)` on `rgb(40,31,33)` gives **3.70:1**, under 4.5:1 for small text.

**Mechanism.** `CharacterDetailView.tsx:331–334` and the matching count spans.

**Who it costs.** Low-vision readers.

### UX-2-27 — low — Three date formats for the same kind of fact

**What happened.**
- In Drafts, one row reads *"Sent for editing, 23 Nov, 18:10"* above *"Nov 23, 2026, 6:10 PM"*: two formats, one 24-hour and one 12-hour, for the same instant.
- Beta readers says *"sent 11/23/2026"*, the US numeric form X-6 removed from world cards.

**Evidence.** `s26.mjs`, `s33.mjs`.

**Who it costs.** Everyone outside the US.

### UX-2-28 — low — The reader's *Send to the author* says nothing; the reactions map reads "dot"

**What happened.**
- After *Send to the author*, the file downloads (`…-notes-from-bea.json`) and the dialog is unchanged: nothing says it was saved, or that sending it is now up to the reader.
- In the reactions map, empty cells are a `·`, so a screen reader reads every zero as *"dot"* (`60-reactions-map-laptop.png`).
- On a phone the table scrolls sideways, and *Stopped here*, its key column, starts off-screen (`60-reactions-map-phone.png`).

**Who it costs.** Beta readers; screen-reader and phone users of the map.

### UX-2-29 — low — The Export dialog never warns before the cover failure in UX-2-14

**What happened.** *Include world cover* stays enabled for a cover the export cannot use. The dialog could say so, or untick the box, before Download is pressed rather than after.

**Who it costs.** The same people as UX-2-14. Fixing one finding may fix both.

---

## The guide out of step

1. **Viewing pictures full size.** "Click the portrait on a character's page to open it full size." On touch, and at the portrait's centre with a mouse, this opens the image menu instead (UX-2-9). **The app is wrong.**
2. **Plot Threads / Motifs.** "The dashboard widget then draws a cadence strip per thread … and flags trouble." Below 1024px there are no flags, and at 390 there is no strip (UX-2-4). **The app is wrong.**
3. **Cast Balance.** "a presence strip showing which chapters they appear in." The strip is `hidden md:flex` (`CastBalance.tsx:118`), so phones never see it. **The guide is incomplete:** this looks deliberate, and the guide should say it is a wide-screen view.
4. **Structure board.** "Each row also carries a dot on a track." The track is `hidden … sm:block` (`StructureView.tsx:205`), so there is none on a phone. **The guide is incomplete**, as in item 3.
5. **Scene history.** "A **History** link appears above the scene draft once there are saved versions." On the Page with a chapter open, it is *History (1)* in the chapter panel's *This scene* block, not above any draft. **The guide is out of date** for the Page.
6. **Export.** The guide does not mention three things the dialog shows:
   - the *Include chapter titles*, *Only written scenes* and *Include world cover* options;
   - that a cover must be JPEG or PNG (UX-2-14);
   - for Markdown, that "Chapter headings" is replaced by *Include chapter titles*.

   **The guide is incomplete.**
7. **The prose pass and Spoiler pass.** On the writer's Read, both sit in a header row that also holds Find & replace, Export, Drafts, Bring in edits…, the readers' button, Read aloud, New Timeline, Generate with AI and Add Chapter. That is three rows of buttons before the book starts at 1280 (`05-read-writer.png`). The guide's "beside **Spoiler pass**" is true, but the screenshots crop this. **This is a design note, not a correction.**

## What I only suspect

- **The marked file and undecided changes.** The marked `.docx` probably signs a still-waiting change *(edit declined)*, following UX-2-3's tally. I did not open the downloaded file. Unzip it and look at the `w:author` of the change on *well-known*.
- **Other nested dialogs and Escape.** Any dialog that hosts a `ConfirmDialog` and passes an inline `onOpenChange` should close with its confirm on one Escape, as in UX-2-6. I reproduced only Drafts. To settle it, run the same test (open the confirm, press Escape, count dialogs) on every dialog that nests one; `grep -l ConfirmDialog` inside files that render `<Dialog onOpenChange={(` lists them.
- **Own-world covers.** An own world with a *linked* `.webp` or `.gif` cover should fail export the same way as UX-2-14. I verified only Library covers. Link a WebP cover in World settings and export to Word.
- **The other `.pw-tap` + `absolute` call site.** I have not opened the History tab's ✕ (`HistoryTab.tsx:160`) on touch. It should drop into flow like the dialog's (UX-2-5).
- **Reply lost on Edit as well.** A reply typed and then abandoned by pressing **Edit** is probably lost the same way as in UX-2-7. Untested.

## What worked

- **Dialogs, in the large.**
  - Every dialog I opened, apart from Find & replace and Scene history, is a named `role="dialog"` with `aria-modal`.
  - Focus moves in, and Tab stays inside (X-10 has held).
  - A single Escape closes a lone dialog.
- **Bringing an editor's file back.** It was the strongest flow in my sections on a laptop:
  - the count *"3 changes in 1 scene from Ana Editor"*;
  - the untracked edit found against the sent draft;
  - the two automatic drafts;
  - marks on the Page that match the list;
  - each change a named list item with a scene-region heading;
  - the Drafts list saying *Sent as …* and *Changes waiting from this draft*;
  - a delete confirm that names the consequence.
- **Splitting an editorial letter.** On a real 3,000-word letter, it put the greeting, title and sign-off unticked, turned *WHAT'S WORKING* into a heading, and linked *Chapter Two* to Ch. 2 by itself. The status names whose letter and when (*Maren Hollis's letter of 14 November*).
- **The Drafts compare view.** It was clear, with *Edited, same length* per scene and the totals as a status.
- **Spoiler pass.** It lists *told so far* and *still to come*, with chapters, and says *no words to mark* honestly.
- **Generate characters with AI, without AI.** The prompt copies (*Copied!*), a fenced paste is accepted, and the result *"Added 1 character · updated 1."* matches the guide.
- **Filtered scene pickers.** Their filter grammar works in either order: *"poole 8"* and *"1 rail"* both find their one scene. Opening one focuses the filter.
- **Character tabs.** They are a real `tablist` with arrow-key movement, counts in the accessible name, and zeros drawn.
- **Beta readers, end to end on a laptop.** React, list, name, send, bring in, and the reactions map as a real table with column headers.
- **Contrast on the dark themes.** The muted text I measured was 6.0–8.5:1. That covers *dies in*, *resolved at*, the amber warnings on Gothic, and tab counts before opacity.
- **No page scrolls sideways.** None of the screens I opened scrolls horizontally at 390. Every `documentElement.scrollWidth` equalled the viewport. The overflow problems are all inside components: UX-2-2, UX-2-4 and UX-2-28.
