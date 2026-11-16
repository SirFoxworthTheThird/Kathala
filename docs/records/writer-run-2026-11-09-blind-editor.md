# Writer run, 2026-11-09: blind, with an editor (three rounds)

Played as Ruth Callan, a novelist. I wrote a second-world fantasy novella in the app and sent it to a freelance
editor, Margit Hale (another agent, who never saw the app), as Word. I brought her edits back twice and revised
against two editorial letters.

**Protocol.** The run was blind. I didn't read source, `CLAUDE.md`, issues, e2e or history before seeing a
behaviour, and I used `docs/GUIDE.md` the way a writer reads a manual. Every change went through the UI. I read
`window.__pwdb` only to check what was saved. Every mechanism below is marked **(read afterwards)**: I grepped for
it only after reproducing the behaviour. `docs/records/ux-review.md` and the round-trip design notes were read only
at the very end, for the "known or new" column.

Build: the frozen `dist/` served at `http://localhost:4190/`. Chromium 1243, persistent profile, 1440×900.
A usage limit interrupted round 3 after I had read Margit's second letter and before anything of round 3 touched the
app. The profile was checked on resuming and was exactly the round-2 end state, so nothing was redone.

Working files, scripts, screenshots and per-round notes (`notes-round1.md`, `notes-round2.md`, `notes-round3.md`)
are in the session scratchpad under `rounds/writer/`. The handoff files are in `rounds/handoff/`. The finished
world is `docs/records/writer-run-2026-11-09-blind-editor.pwk`: 1,171,498 bytes of JSON holding 6 chapters,
18 scenes, 9 characters, 7 drafts, 56 notes and 56 tasks.

---

## What I set out to do, and how far I got

1. **Write the book.**
   - *The Salt Ledger*: 6 chapters, 18 scenes, 9 characters, 9 places, 2 items, 6 who-knows-what facts.
   - Drafted in text files, then pasted onto the Manuscript Page a chapter at a time with `#`/`##` headings and a
     `[ … ]` header under every scene. I typed about 380 more words into one scene.
   - The book ran 12,285 words when first sent and 12,777 at the end.
2. **Send it.**
   - Saved a draft and ran the prose pass.
   - Exported Word / Submission / For an editor, with a cover note.
3. **Round 1 back.**
   - Brought in her file: 85 changes decided (67 accepted, 18 rejected) and 40 notes answered.
   - The letter became 42 tasks, 40 of them done.
   - Real revision:
     - the clock rebuilt and five scene headers retimed;
     - the ch3 flashback moved to open ch3, with its flashback flag removed;
     - 30 prose repairs, a new paragraph, and a character renamed (Tomas Brenn → Tomas Varga).
   - Saved a draft, compared, and sent it again.
4. **Round 2 back.**
   - 24 changes decided (23 accepted, 1 rejected) and 16 notes answered.
   - The second letter added 14 tasks; 51 of 56 are now done.
   - Made her four continuity repairs and the small fixes.
   - Saved the final draft, compared it with the first send and with Revision 1, and exported the `.pwk`.

All of it was completed. The app carried the whole loop, and I never had to leave it to keep the book.

---

## What stopped me (ranked by cost to the writer)

Each finding says whether it was **reproduced**, gives the evidence, and says whether `ux-review.md` (or a design
record) already knew it.

### RT-1 · high · REPRODUCED: a tracked paragraph split comes in as two changes, and taking the tracked one first runs two sentences together
- **What I did.** Margit split three paragraphs with Track Changes on. Each split is a deleted space plus a
  tracked new paragraph mark (`w:pPr/w:rPr/w:ins`).
- **What I expected.** One change: "new paragraph here".
- **What happened.**
  - Each split arrived as two items, both labelled **"time. → time."**: a "Tracked change" (the space) and an
    "Untracked edit … found by comparing the file with the book as it went out" (the break). So the app also told
    me she had edited with tracking off, which she hadn't.
  - Neither label shows a paragraph break, so neither says what it does.
  - Accepting the tracked half first left **`hard every time.At the edge of the marsh`** in the scene. The
    untracked half then refused: *"The scene no longer has these words: you have changed them since. Make this
    change by hand, or reject it."* I hadn't changed them; the app's own accept had.
  - That scene's **"Accept all 1" stayed enabled and did nothing** when clicked (the count stayed at 25).
  - With the other split, untracked half first, the result was correct (`like cloves.\n\nShe stood`).
- **Evidence.**
  - Store text before and after each click (`notes-round2.md` §3, scripts `r2s04.cjs` and `r2s05.cjs`).
  - Screenshots `shots/r2-04c-para.png` and `shots/r2-06b-done.png`.
  - The tracked-first order corrupted the text; the untracked-first order didn't. One split each way. The third I
    rejected.
- **Mechanism (read afterwards).**
  - `src/lib/docxRead.ts` `walk` skips `pPr` entirely ("pPr … say nothing about the words"). So a tracked
    paragraph-mark insertion is never read as tracked, and the break reappears only as a difference from the sent
    draft.
  - The import stores untracked items first (`r4-word-round-trip.md`), so the list order happens to be the safe
    one. But nothing stops the other order, and "Accept all" has to be pressed per scene.
- **Cost.** My prose was corrupted, silently. I found it only by scanning the store for `[a-z][.!?][A-Z]`, and
  repaired it with Find & replace. A writer working through the dialog would have shipped "time.At".
- **Known?** New. The design note lists "a change to formatting alone is not a change", but a paragraph mark
  isn't formatting.

### W-A · high · REPRODUCED ×4: after a multi-scene paste, unknown names are offered one scene at a time, and the rest go silent until the page is reopened
- **What I did.** Pasted chapters whose scene headers named people and places the world didn't have yet.
- **What I expected.** Every waiting header to be offered, or at least marked.
- **What happened.**
  - The note says *"The headers of "X", "Y" and "Z" were not applied, and wait as typed"*, but offers Create
    buttons for **one** scene's names.
  - Clicking one blanks the note; the other scenes' buttons vanish (ch2). Or the note keeps saying three headers
    wait and offers nothing (ch3).
  - Going to a waiting scene in the binder and entering and leaving its header did nothing. Only a page reload
    surfaced the next scene's names: 3 reloads for ch2, 2 for ch5.
  - A waiting header looks **exactly** like an applied one on the Page. Only the side panel betrays it:
    "Mother Gannet" had Setting *Nowhere in particular* and no cast under a header naming three people and a place.
- **Evidence.** Pastes of ch2, ch3 and ch5, plus a direct test (s19/s20). Screenshots `shots/19-mg-left.png`
  (header against panel) and `shots/20-open.png` (the offer after reload). A store dump with `3.0 Mother Gannet @- []`.
- **Cost.** Scenes sit with no cast and no place while their headers say otherwise. Character states, the
  knowledge suggestions and the checker all read the empty record. I only caught it because I was checking the store.
- **Known?** New.
- A cosmetic slip in the same note, seen once: *"Nothing in this world is called "Tomas Brenn" or "Tomas Brenn""*.

### RT-2 · medium-high · REPRODUCED (3 moves, both halves, both rounds): a tracked move arrives as an unrelated deletion and insertion, and a moved paragraph shows the *other* paragraph as cut
- **What I did.**
  - Round 1: one moved sentence (ch1).
  - Round 2: one moved sentence (ch4), and one moved paragraph (ch6). Margit moved the Black Mare's escape above
    Ilse's paragraph after the wreck.
- **What happened.**
  - Every move is two items with separate Accept buttons and no word "moved".
  - For the paragraph move, the first item is **Ilse's whole paragraph, struck through in red, "→ (removed)"**.
    That is the paragraph Margit's letter praises. The second item re-inserts it after the Black Mare's paragraph
    (`shots/r3-02-spring-tide.png`).
  - Measured in the store:
    - deletion half alone, Spring Tide: **Ilse's paragraph gone** (0 occurrences);
    - insertion half alone, ch1 and ch4: **the sentence twice** (2 occurrences);
    - both halves: correct, with clean paragraph breaks.
- **Mechanism (read afterwards).** `docxRead.ts` maps `moveFrom`→del and `moveTo`→ins, by design
  (`r4-word-round-trip.md`).
- **Cost.**
  - Margit's email warned me, so I was careful. Without that warning, "Reject" on a paragraph the editor
    apparently cut is the natural reaction: it leaves the paragraph in place with the insertion still pending, and
    accepting that later duplicates the paragraph.
  - Reading a move as a cut is a misreading of the editor, not just a UI wrinkle.
- **Known?** The mapping is documented design. The cost isn't recorded in `ux-review.md`, so it's new as a finding.

### W-G · medium-high · REPRODUCED (deterministic): italics written `*like this*` reach Word as literal asterisks
- **What I did.** Wrote my draft with asterisk italics (a letter, interior thoughts, a marginal note: 19 spans in
  6 scenes) and exported Word for the editor.
- **What happened.**
  - The Page and Read show the asterisks literally.
  - The `.docx` had **0 italic runs and 19 asterisk spans** (`docx-r1.txt`).
  - The guide says `_underscores_` are italics. Nothing on the Page, in the paste, or in the export says asterisks
    are not.
- **Mechanism (read afterwards).** `src/lib/proseEmphasis.ts` parses underscores only, deliberately, because the
  Library's Gutenberg corpus has no `*italic*` and `* * *` is a separator. The reasoning comes from the Library's
  books, not from a writer's own drafts, where asterisks are common.
- **Cost.**
  - I nearly sent a new editor a manuscript with 19 asterisk spans. I noticed only because I opened the file.
  - Fixed with Find & replace (`*`→`_`, "Replaced 38 occurrences in 6 scenes") and a second export, which then
    caused W-H.
- **Known?** New.

### LT-1 · medium · REPRODUCED (two letters): the letter splitter misses numbered and question headings, ticks the greeting and sign-off, and files tasks under the wrong heading
- **What I did.** Paste an editorial letter… with each of Margit's letters.
- **What happened.**
  - **Numbered section headings** ("1. THE CLOCK" … "9. PROSE") became **ticked tasks**, and the unnumbered
    "WHAT'S WORKING" became a heading. After adding, the clock, who-knows-what and structure tasks were all listed
    under **WHAT'S WORKING**, and everything after them under a sentence the splitter had taken for a heading
    ("The storm is where it feels rushed…").
  - In letter 2, question headings ("DOES THE CLOCK HOLD?") were ticked points too.
  - There is "Not a heading" but no "make this a heading", so the grouping can't be repaired.
  - **"Dear Ruth," and "With best wishes," came ticked** in both letters. The signature "Margit" became a heading
    (letter 1) and then a ticked point (letter 2).
    - The guide (line 2588) and `r5-revision-tasks.md` both say the greeting and sign-off are offered unticked.
    - Both letters open with a title line before the greeting, which may be what defeats it. That's a guess.
  - The day-by-day clock table (indented lines) became one point whose **checkbox has no accessible name**
    (aria snapshot: `checkbox [checked]`).
- **Cost.** 81 points → 39 unticked by hand → 42 tasks. 30 points → 16 unticked → 14 tasks. The headings stay
  wrong for the life of the list.
- **Known?** New. It contradicts a documented claim.
- **Related, observed only.** The ship-italics task now exists twice, once from each letter, with nothing to show
  they're the same work. The combined list puts round 1's open tasks first, under round 1's wrong heading.

### RT-3 · medium · REPRODUCED: one tracked replacement becomes several word-level changes, each acceptable on its own
- **What happened.**
  - "in his hand" → "under his seal" arrived as `in → under` and `hand → seal`. Accepting the first alone left
    **"a letter under his hand"** in the scene, as the store showed.
  - "Tomas looked at the satchel and then at her" became 2 items; the clerk's line in round 2 became 4.
  - This is why the app counted **85 against about 67 edits** (round 1) and **24 against 14** (round 2).
- **Cost.** Declining one of her edits often takes 2–4 clicks, and a partly taken edit is nonsense that the app
  accepts without comment.
- **Known?** Documented design in `r4-word-round-trip.md` ("Changes with a word kept between them are still two").
  It's not in `ux-review.md`.

### W-D · medium · REPRODUCED (same controls every time): saying where an off-stage person is needs a place, and the picker can't make one
- **What I did.** Asked *where was Tomas when Ilse found the letter gone?* The app said "The Drowned Chapel,
  carried forward". That was correct for what I had recorded, but my prose has him at the Pans.
- **What happened.**
  - Current State explains the off-stage case well ("not in this scene's cast … where they are while it
    happens"), but the Current Location picker lists only existing places, with no "new place…".
  - The route was Maps → Add a place → back to Characters → Tomas → Current State → pick → Save: **six steps**
    for one fact.
  - The scene header has no token for "X is elsewhere, at Y".
- **Known?** Related to **W19-3** ("by design: locations only on maps"). **W19-3's premise has since changed**:
  the Maps screen now says *"A place does not need a map"* and adds places with no map, and my picker listed nine
  unmapped places. So W19-3's "by design" status is out of date. My finding is the narrower one that remains: no
  create-in-place.

### W-H · low-medium · REPRODUCED: every Word-for-an-editor export saves a draft with the same name, and nothing shows which one a file came from
- Two real exports gave two drafts named **"Sent for editing (the-salt-ledger.docx)"**, with minute-level times
  (08:59 and 09:44) as the only difference.
- The file carries the draft id (`docProps/custom.xml` `KathalaDraft`), but the Drafts list and the delete
  confirm ("Delete this draft?") never show it.
- After failed downloads (see Environment) there were 8 such drafts. I kept the newest only after checking its id
  in the store, which a writer can't do.
- Deleting the wrong draft would cost Bring in edits its ability to find untracked edits.
- **Known?** New.

### W-C · low-medium · REPRODUCED ×2: the dashboard's "Recently edited" ignores prose written on the Page
- **What happened.**
  - I typed about 380 words into *The Empty Bolster*; it didn't appear in the five.
  - I edited *The Quay at Low Water* at 09:03:30, and it was saved, but the dashboard still listed five scenes
    "6m ago".
  - Find & replace did move scenes up.
- **Mechanism (read afterwards).** `WorldDashboardView.tsx` sorts by `event.updatedAt`. Typing on the Page writes
  `sceneTexts` only, so the event keeps its old time (Quay: event 08:40:07, text 09:03:30).
- **Known? A closed finding, fixed incompletely.** **DASH-3** was closed as *fixed* by renaming the list
  **"Recently edited"** and defining *recent* as "most recently updated scenes". Measured, the main act of
  editing (writing prose) doesn't count as updated, so the label promises something the list doesn't do.
- **Cost.** Low, because the Manuscript itself reopens at the scene last written.

### RT-4 · low · REPRODUCED: the editor's title-page edits vanish without a word, and the title-page count can't be set
- Margit's two title-page edits (my name printed twice, "about 12,000" → "about 12,300") weren't offered and
  weren't counted. Nothing said they had been left out.
  - The design note says unplaced passages are counted and reported; front matter isn't.
  - Margit concluded on her own to put title-page matters in her cover note next time.
- She asked for "about 12,700" on the title page. The export says "about 13,000" and has no field for it.
- **Mechanism (read afterwards).** `manuscriptExport.ts`: "the nearest hundred under 10,000, else the nearest
  thousand".
- **Known?** New.

### R2-D · low · REPRODUCED: replying to a note rewrites its quote
- After I replied, Margit's note *"Three? We only ever meet two…"* quotes **"the two tallyclerks"**, my fix, not
  the words she commented on.
- The guide describes this ("answering … moves it onto them as they now read"). As the record of what was asked,
  it now misquotes the editor.
- **Known?** New, as a cost of designed behaviour.

### W-E · low · REPRODUCED: the flashback warning names the wrong thing and doesn't lead to the fix
- The text read *"Ch. 3 is set on day 4, and Ch. 3 ("The Year of the Big Tide") on day 6"*. It names the chapter
  where it means the scene *What the Kestrel Carried*.
- There's no "mark as flashback" action. Enter didn't navigate, though the footer says "Enter go to scene", and
  "Go to chapter" opened the chapter rather than the scene.
- On the card, "+ Flashback" only reveals the toggle; a second click marks it. The toggle has no `aria-pressed`.
- **Known?** It's the same pattern **HB-1a** fixed for another check (the warning that sends you away). The
  flashback check still has it.

### Small things (reproduced, low cost)
- The first-run guide's step 3, "Place them in the story", asks only for a moment, not a place.
- In Current State, `checkbox.check()` on a task fails because a ticked task leaves the list at once. That
  affects a script, not a person.

---

## What I only suspect

These are not reproduced. Each says what would settle it.

- **S1. The side panel followed the wrong scene after a paste.** After pasting ch3 at the end of the Page, the
  panel said "This scene: The Reeve's Seal" (ch2) while the caret was in ch3's last scene (`shots/18-ch3-b.png`).
  Seen once. To settle: paste a chapter at the end again and read the panel before clicking anything.
- **S2. "+12,710 words today" against a 12,285-word book** on the first day. Perhaps a paste's heading and header
  lines were counted before being taken out. To settle: on a fresh day, paste a chapter of known length and
  compare the writing log with the word count.
- **S3. A "Sent for editing" draft is saved even when no file is delivered.** Seen only because the browser
  crashed mid-download. To settle: cancel a real browser's save dialog during a Word-for-an-editor export and look
  at Drafts.
- **S4. A typed header line vanished.** A `Facts: ?…:@Corin Ashe` line vanished entirely when my script left it
  by the arrow keys while the autocomplete list was open. Typed again with Escape first, it applied. To settle:
  type a `?fact:@name` line, leave it with ↓ while the list is open, and see whether the line survives.
- **S5. Why the greeting is ticked** (LT-1). Perhaps a title line above "Dear …" stops the greeting being
  recognised. To settle: split the same letter with and without its first two lines.

**Withdrawn on measurement:** W-B, "relative `When:` lines are not stored". `inWorldTime` is null for them, but
they're stored as `travelDays`, and the Chronological view showed Days 1–22 (later 1–5 + 26) correctly.

---

## The round trip with the editor, as a whole

| | Round 1 (her first edit) | Round 2 (her second read) |
|---|---|---|
| What I sent | 12,285 words, 18 scenes, 18 bookmarks, 13 italic paragraphs, draft `mY6D…` | 12,724 words, 0 markup, draft `D80i…` |
| In her file (XML) | 52 `w:ins`, 66 `w:del` (3 and 2 of them paragraph marks), 1 move pair | 10 `w:ins`, 12 `w:del`, 3 move pairs (one moved sentence; one moved paragraph, text and mark) |
| Her count | "about 65 edits … roughly 115 insertions and deletions", 40 comments | "14 small tracked edits", 16 comments |
| My count of edit sites | 64 in scenes + 2 on the title page + 1 move = 67 | 14 |
| App's count | **85 changes in 18 scenes**, of which **3 "made with tracking off"**; 40 notes | **24 changes in 9 scenes**, 0 untracked; 16 notes |
| Scene placement | 18/18 scenes and 40/40 notes in the right scene | 9/9 and 16/16 |
| My decisions | 67 accepted, 18 rejected (about 12 of her edits declined) | 23 accepted, 1 rejected |

**Where the counts disagreed, and why:**

- **85 against 67, and 24 against 14:** word-level splitting (RT-3).
- **"3 made with tracking off":** her tracked paragraph splits, misread (RT-1). She never edited untracked.
- **The 2 title-page edits:** dropped silently (RT-4).
- **Each move:** shown as 2 unrelated changes (RT-2).
- **Nothing came in against the wrong scene or no scene.** That held in both rounds, even though LibreOffice
  rewrote every scene bookmark as a duplicate pair, and even after I had moved a scene to another place in its
  chapter between rounds. The importer anticipates the duplicates (read afterwards).

**The line I changed after sending** ("He whistled, low." → "…low and long.") was respected throughout. It wasn't
shown as one of her untracked edits, no accept overwrote it, and it's in both later exports.

**What of hers survives into what I sent back:** no markup at all. My round-2 export has 0 `w:ins`, `w:del` or
moves, no `comments.xml`, and her name nowhere.

**Margit's own check of my round-2 file.** She reported every edit I took present as she made it, every one I
declined back to my wording, and the moved ch1 sentence present once. My own scan of the book agrees: no
run-together words and no double spaces after the repair. The split that ran together on my side was "the hard
every time." (ch4), not the "cloves" split she asked about, which misbehaves in her own LibreOffice.

**Notes and tasks after all three rounds:** 56 notes, all resolved, 36 with replies. 56 tasks, 51 done. Open are
the repeated-phrases pass, the ship italics (twice), my own "looked" pass, and the title-page count, which the
app won't let me set.

---

## What worked

These carried the work and should not be lost to a later change.

- **Pasting a drafted chapter with `#`/`##` and `[ … ]` headers** built 18 scenes with casts, places, items,
  facts and days from six pastes. The header cheat sheet is exactly the vocabulary a who-knows-what book needs.
- **Knowledge, "Might also know"** caught that Wren was in the tower and I had forgotten to record that he heard.
  "Who knew Fenn was in it, by the hearing?" took two screens.
- **Item whereabouts** answered "who had the letter in ch5" in one screen. **Ctrl+K** answered "what was the
  weather" in one.
- **Chronological view and the flashback check** caught a real ordering problem. After the restructure they
  confirmed the clock Margit and I agreed (Days 1–5, coda Day 26).
- **The Continuity Checker's "named in the prose, not in the cast"** was right all 8 times. The prose pass found
  my real tic ("looked at" 8.2× normal). After her line edits its per-chapter findings fell from 7/6/9/6/7/5 to
  2/2/3/2/2/1.
- **Word for an editor**: real standard manuscript format, with a title page, running header, double spacing,
  `#` breaks and scene bookmarks. Margit could work in it as sent.
- **Bring in edits**:
  - right scene every time, in both rounds;
  - the automatic "Before Margit Hale's changes" draft;
  - the per-scene Changes dialog;
  - a clean export with nothing of hers left behind.
- **Notes follow their words.** Seven said "Its words have been edited since", and six were kept *Unplaced* with
  the words they were made on. None was lost.
- **Drafts and Compare**: "18 scenes changed · 12,285 → 12,777 words (+492)", with the moved scene marked
  *Moved*.
- **Find & replace**: one match in one scene, verifiable before replacing. It takes line breaks, and it is
  rename-aware: Tomas Brenn → Tomas Varga carried into the character and every scene header.
- **The binder's Alt+↑** moved a scene to the top of its chapter, and the Manuscript reopens at the scene last
  written.

---

## Against `ux-review.md`: new or known

| Id | Status against the backlog |
|---|---|
| RT-1 paragraph split misread, order-dependent corruption | **New** |
| W-A waiting headers one at a time, silent until reload | **New** |
| RT-2 moves as unrelated del + ins; moved paragraph reads as a cut | Mapping is documented design (`r4-word-round-trip.md`); **the cost is new** |
| W-G asterisk italics literal in Word | **New** (deliberate rule in `proseEmphasis.ts`) |
| LT-1 letter splitter: headings, greeting, sign-off, unnamed checkbox | **New; contradicts GUIDE line 2588 and `r5-revision-tasks.md`** |
| RT-3 word-level split changes | Documented design in `r4`; not in `ux-review.md` |
| W-D off-stage place needs six steps | Related to **W19-3, whose "by design" premise is now out of date** (places exist without maps); the remaining gap is new |
| W-H identical "Sent for editing" drafts | **New** |
| W-C "Recently edited" ignores Page prose | **DASH-3 closed as fixed, but the fix is incomplete**: the label promises edits, and the list sorts by a record that prose writing doesn't touch |
| RT-4 title-page edits dropped; count not settable | **New** |
| R2-D reply rewrites the note's quote | **New** (cost of designed behaviour) |
| W-E flashback warning wording and route | Same pattern as **HB-1a** (fixed for another check); new for this one |

**Environment, not the app.** On the second and later downloads in this persistent profile, Chromium's
*browser* process segfaulted. A Markdown download crashed the same way, which ties it to Chrome's own download
`History` database. Moving `Default/History` aside cleared it each time. Those crashes are where 6 of the 8
duplicate drafts in W-H came from. They are the only evidence for S3.
