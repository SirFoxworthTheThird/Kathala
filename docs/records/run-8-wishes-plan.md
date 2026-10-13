# What writer run 8 wished for — a plan

**Status:** 1–3 built (same-name places; the start date; pasted headings). 4–5 proposed.
**Decided 2026-10-13:** every recommendation below was taken — a non-flashback
pin re-anchors the clock; paste undoes per heading for now, with a notice;
verse is indented lines; presence by phone is `:phone` (`:remote` accepted),
counted apart from on-stage. Five features, each its
own PR, in the order below. Decisions the author owns are marked **Decide** and listed together
at the end.

Writer run 8 wrote *Slack Water*, a full psychological thriller, inside the app.
Its bugs are fixed (#608). What is left is what it *wished for*: things the app
does not do, not things it does wrong. They are features, so they are planned
here before anything is built.

Every number below was measured on 2026-10-13 against `development` and against
the 47 `.pwk` books in the reading library. None is an estimate.

---

## 1. Two places with the same name

**What happened.** A second "The Beacon" ended up on the main map. Nothing
said so, and the scene header resolved `#The Beacon` to whichever came first.

**Where it lives.** Header place resolution is `world.places.find(...)`, first
match wins, in two places: the scene's Place line (`sceneHeader.ts`, the
`place` lookup in `planHeader`) and an item put down at a place (`planItems`).

**Why not just forbid it.** Two places can rightly share a name on different
maps: "The Kitchen" in two houses, each a sub-map. A world-wide uniqueness rule
would refuse a real book. A clash *on one map* is almost always a mistake.

**Plan.**
- **Resolution prefers what the scene already has.** If the scene's place is
  one of the places with that name, it stays. Today, the code allows a header
  edit on any line to silently move the scene to the other place. `planHeader`
  takes the first match's id as `nextPlace`, compares it with the scene's own,
  and writes it when they differ. That was found by reading, not reproduced;
  the PR's first test reproduces it. It is a correctness fix and lands
  regardless of the rest.
- **An ambiguous name is a note, not a guess.** When two or more places match
  and none is the scene's own, the header note says so and lists them by map
  ("The Beacon — on Hollin Sands, on Scaur House"). Picking one sets it. This
  uses the note the header already has for unknown names.

  *As built:* a shared name is written with its map in brackets,
  `#The Kitchen (Scaur House)`, and the header draws it that way. Two places of
  one name on the *same* map cannot be told apart in text, so for those the
  note asks for one to be renamed instead of offering buttons.
- **Add Location and rename warn on the same map.** "Another place on this map
  is already called The Beacon." It is a warning, not a refusal.
- **Maps lists a clash.** The not-on-a-map section and each map's list mark
  duplicate names.

**Tests.** Unit tests for resolution (prefers the scene's own; reports
ambiguity; one match is unchanged). An e2e test for the dialog warning and the
header note, with the absence paired with a presence: no warning for the same
name on two different maps.

---

## 2. A start date for a one-timeline book

**What happened.** The writer pinned the first scene to 1 November 2011. Every
later scene stayed on the derived clock, counting from 1 January of year 1.

**Where it lives.** `computeInWorldDays` (`src/lib/inWorldTime.ts`). A pinned
`inWorldTime` sets that event's day but "does not disturb the running derived
clock". That rule was written for flashbacks, and the existing test pins only a
flashback (`inWorldTime.test.ts`, "honors an explicit inWorldTime…").

The timeline's own start, `dayOffset`, is in World Settings, but that section
only renders when `timelines.length > 1`, and it takes a raw day number, not a
date. A one-timeline book has no way to set it.

**Plan.**
- **A pin on a scene that is not a flashback re-anchors the clock.** The next
  scene's travel days count from the pinned day. A flashback's pin keeps today's
  behaviour, so the existing test still holds unchanged. Pinning the first scene
  then *is* setting the start date, which is what the writer tried.
  **Decide:** this changes dates in any existing book with a non-flashback pin
  mid-story. I recommend it, because a story that says "3 March" and then
  "two days later" means 5 March. The alternative is to leave pins alone and
  only add the setting below.
- **"The story begins on" in World Settings, for every timeline.** This is shown
  even when there is only one, and is entered as a date in the world's calendar
  (`dateToDay` / `dayToDate` in `calendar.ts`), not as a day number. It writes
  `dayOffset`; no schema change.
- `provisionallyDatedEvents` follows the same ordering, so the "provisional
  date" marks stay consistent. It needs a matching test.

**Tests.** Unit tests: a non-flashback pin moves later scenes; a flashback pin
does not (the existing test); an offset and a pin together. An e2e test for the
settings date.

---

## 3. Pasted `##` and `#` lines become scenes and chapters

**What happened.** The writer pasted a drafted chapter with `## Scene` lines. They
stayed prose, and were counted as words.

**Where it lives.** A heading *typed* on the Page takes effect when its line is
left (`typedHeading` → `make` in `DraftBook.tsx`). Lines left while a split is
still being written wait in `leftWhileBusy`. `revisitLeft` makes them one at a
time, bottom-up, so making one leaves the positions of those above it
unchanged.

**Plan.** That queue already does this job. On an `input.paste` transaction,
every pasted line matching `## Title` or `# Title` is pushed into it, and it is
run. Each heading becomes a split or a chapter, exactly as if typed and left,
through the same journalled writes (`splitScene`, `startChapter`). Bottom-up
order puts the scenes in the right order, because `splitScene` inserts directly
after the scene it cuts.

- The pasted line the caret ends on is left alone until it is left, as a typed
  one is.
- A `[ … ]` header block pasted under a heading is not interpreted in this PR.
  It stays prose, as now.
- Paste on the Page only. The per-scene editor has no headings. A paste there
  that contains them gets a notice offering the Page.

**Decide: undo.** Each heading is one structural act today, so pasting ten
scenes is ten undo steps. One step per paste is better, but needs the acts
batched into one write, which is a larger change to `make`. I recommend shipping
per-heading first, with the notice "Pasted 10 scenes — Undo takes them back one
at a time", and batching later if it bothers anyone.

**Tests.** An e2e test (paste is a browser event): paste three scenes and a
chapter, then assert on the records (titles, order, chapter, prose and word
counts), and on the same text pasted as one paragraph without `##`, which stays
prose.

---

## 4. Verse: lines that keep their breaks

**What happened.** A ballad's lines ran together in Read and in the export. The
writer worked around it by making every line its own paragraph, which spaces and
indents them like prose.

**Why a single newline cannot simply become a line break.** `splitParagraphs`
deliberately treats one newline as a space, because pasted text arrives
hard-wrapped. Measured: of 86,719 paragraphs in the library, **10,830 (12.5%)
contain a single newline**, across 9 hard-wrapped books. Breaking on every
newline would turn each of those into ragged one-line verse.

**What the library already does.** **85 paragraphs have every line indented**,
and the ones sampled are verse ("    One is gone; one is wele sped; / Old
Apulyaird is ded." in *The Black Arrow*). That is the Project Gutenberg
convention, and it is visible on the page. **No paragraph uses `\` or two
trailing spaces** (the CommonMark hard breaks).

**Plan.** A paragraph whose every line starts with indentation is verse. Its line
breaks are kept and it is set as a block: no first-line indent, lines as
written. This one rule is shared by Read, the compile (HTML/ePub) and
`manuscriptExport` through `manuscriptParagraphs.ts`, as the paragraph rule
already is. The Markdown export writes such a paragraph with `\` line ends (four
spaces would make it a code block), and the import reads that back as indented
lines, so the round trip from Step 6 holds.

**Decide: the convention.** I recommend indented lines, since it is what 85
library paragraphs already are and what a writer sees. The alternative is a
trailing `\`, which is CommonMark but invisible in intent, and appears nowhere in
the corpus.

**Tests.** Unit tests in `manuscriptParagraphs` (indented → verse, mixed →
prose, a hard-wrapped corpus paragraph → prose). A round-trip test through
Markdown export/import. An e2e test for Read showing the line breaks.

---

## 5. Present by phone

**What happened.** A character who is on the phone through a scene can be only
*on stage* (then the header places them at the scene's place, and continuity
says they are somewhere they are not) or *mentioned* (then Cast Balance says
"only mentioned, never on-stage").

**Plan.** A third kind of presence beside on-stage and mentioned: *present
remotely* (phone, radio, a letter read aloud are all the same to the records). It
is a new optional field on the scene, `remoteCharacterIds`, added the way
`mentionedCharacterIds` was. That field reaches 23 non-test files today, which
is the honest size of this change, so it is two PRs.

- **PR A — the record and its meaning.**
  - Dexie `version(57)` (no index change).
  - Journal and merge fields (`operations.ts`, `mergeFields.ts`), `.pwk`
    import/export.
  - Not placed: no character snapshot at the scene's place, and continuity does
    not flag them as elsewhere.
  - Counted where hearing matters: Knowledge in the room, so what is said on the
    call reaches them.
  - Cast Balance and the Appearances tab say "on the phone in N" apart from
    on-stage, as mentions now are.
- **PR B — writing it.**
  - The header suffix on the Characters line, drawn and parsed like `:dead`.
  - The scene panel's cast picker gets the third state.
  - The guide, with a screenshot.

**Decide.**
- **The suffix.** `@@Ilse:phone` reads naturally and is the case the writer had;
  `:remote` also covers letters and radios. I recommend `:phone`, accepting
  `:remote` as a synonym.
- **Does it count as an appearance?** I recommend it stays apart from on-stage
  in every count, as mentioned does, so "never on-stage" stays true and gains
  "on the phone in 3".

**Tests.** Unit tests for the header parse/draw round trip, castBalance,
knowledgeInRoom, and the continuity rule. An integration test for the journalled
write and merge. An e2e test for the picker and the header.

---

## Also open, and not planned here

- **Known by: move a reveal to another scene.** Removing one was fixed in #608.
  Moving one is a small add-on to the Knowledge panel, and can ride with PR 2 if
  wanted.
- **F7, relationship graph labels under nodes**: needs a layout decision of its
  own.
- **S5**, no space after a name made in an open one-line header, and the two
  run-8 console errors: neither reproduced. Left until one does.

## Order and decisions

| # | Feature | PRs | Decide first |
|---|---|---|---|
| 1 | Same-name places | 1 | — |
| 2 | Start date / pins | 1 | Does a non-flashback pin re-anchor the clock? |
| 3 | Paste into scenes | 1 | Undo per heading now, batched later? |
| 4 | Verse | 1 | Indented lines, or trailing `\`? |
| 5 | Present by phone | 2 | `:phone` or `:remote`; apart from on-stage in counts? |

1 is first because part of it is a correctness fix (a header edit can move a
scene to the other place). 2 and 3 are small and well-contained. 4 touches every
output path, so it comes after the others have settled. 5 is the largest and the
only one with a schema change.
