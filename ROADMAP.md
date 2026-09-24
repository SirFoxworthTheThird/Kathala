# Kathala Roadmap

What is left, in the order I would do it. Everything shipped up to 23 September
2026 is in
[`docs/records/roadmap-2026-09-23.md`](docs/records/roadmap-2026-09-23.md),
archived whole — 184 completed items, with the reasoning written at the time.

**A shipped item is removed from this file rather than moved into that one.**
`docs/records/` is never edited, deliberately — see
[`docs/README.md`](docs/README.md) — so appending to it would break the one rule
that makes a record worth keeping. The short list below is where a finished item
goes instead: one line and the pull request that carries the reasoning, which
keeps this file about what is left without pretending the work never happened.

## Shipped since the split

- **Automatic local backup** — #465. The folder copy already worked; it was
  silent. The chip beside a world's name now says whether it is backed up and
  when the last copy was written, the dashboard offers a folder once there is a
  scene to lose, and browsers without the folder picker are told what they *can*
  do instead of being told they need a different browser.
- **Finish testing the continuity checks** — #467. The seven rules with no
  issue-level coverage have it: travel distance, region traversal, characters
  inside a region, cross-timeline artifacts, and the three thread cadence rules.
- **Export by scene status** — #473. *Scenes to include* sends a partial draft
  without the scenes that are not ready, on all five formats, and the word and
  scene counts beside the button now describe the export rather than the book.

---

## What is left

**Nothing.** Every item this file was split to track has shipped, and the two
that were never open are recorded below.

That is a statement about this list, not about the app. The section at the foot
of this file makes the case that a list written from the code and the guide is
the weakest kind of evidence there is — and the two writer runs since bore that
out, finding thirteen things between them that no amount of reading the source
would have surfaced. The next entries here should come from somebody using the
app, not from somebody reading it.

---

## Already shipped, and listed here by mistake

Two items were carried into this file when the roadmap was split on 23
September, from unchecked boxes at lines 610–612 of the archive. Neither box had
ever been ticked; both features had been in the app for weeks. The split trusted
the checkbox instead of the code, which is the whole of the error, and it is
recorded rather than quietly deleted so the next reader of that archive treats
its `[ ]` marks as claims rather than facts.

- **Global undo** — shipped 29 July 2026 as #137, *Local undo, built on the
  operation journal*. Undo and redo in the top bar, each labelled with what it
  will take back; `Ctrl+Z` and `Ctrl+Shift+Z`, which leave text fields to the
  browser; undo on the delete toast; a Recent Changes panel listing the stack;
  and a phone path, where there is no keyboard. Bulk edits route through
  journalled singles sharing a `groupId` and `undoableBatch` returns the whole
  group, so the roadmap entry's own example — a wrong bulk tag — was covered
  too. Eight e2e tests in `e2e/undo.spec.ts`.
- **Full-text search across prose** — `e2e/searchProse.spec.ts` finds a scene by
  a word that appears only in its draft, previews the line that matched rather
  than the opening of the scene, and does not search prose the reader has not
  reached. The entry's stated worry — that results must respect the spoiler
  cursor — is the thing that spec's last test exists to check.

---

## Considered and not doing

Recorded so they are not proposed again from scratch. Any of them can come back
with a reason; none has one now.

- **Physical description snapshots** — an `appearance` field on every character
  snapshot. It adds a fifth thing to fill in on the most-written table in the
  app, to serve the handful of stories where how someone looks changes as they
  go. Status notes already carry it for those. The proposed companion check —
  nudging when appearance is *never* recorded — would nag every writer who
  reasonably does not want the field.

- **Character-goal contradiction check** — warn when a character acts against a
  declared fear or goal. It needs events tagged with motivations to work, which
  the original entry admits ("may stay manual"). A check that only runs when
  somebody has done bookkeeping first is a check that does not run.

- **Calendar continuity: season mismatches and age-inappropriate actions** —
  same dependency on manual tagging, and the second half misreads fiction. A
  fifteen-year-old commanding an army is a genre, not a continuity error, and a
  checker that says otherwise trains writers to ignore it.

- **Proactive travel-day suggestion** — offering a `travelDays` value in the
  editor before anything is wrong. The reactive path already exists and is the
  better interaction: the checker flags the impossible journey and offers the
  one-click fix. A suggestion on every scene is noise attached to the case that
  is usually fine.

- **Cross-map/floor travel estimates** — skipped today because map layers share
  no metric. That is a modelling problem, not a missing feature, and inventing a
  conversion would put confident wrong numbers inside the continuity checker,
  which is the one component that must not guess.

- **Multi-user collaboration (the rest of #124)** — the valuable near-term
  increment for one author is durability, which is item 1. Multi-user editing
  needs a server or a CRDT, and both cost the no-backend property that makes
  this app what it is.

- **"Push map logic into pure units"** — true, and an engineering preference
  rather than a plan. It happens when the map code is next touched; a standing
  line saying *write more tests* is the kind of roadmap entry nobody ever
  closes.

---

## Before any of this

The last blind writer run is
[`docs/records/writer-run-2026-08-25-blind.md`](docs/records/writer-run-2026-08-25-blind.md),
about fifty pull requests back. Since then the app has gained a name, a tagline,
a reading mode, three books and two different Library layouts.

Everything above is a judgement made from the code and the guide, which is
exactly the evidence that makes a product look better than it is. A fresh writer
run and a reader run at the current tip would either confirm this list or
replace it, and that is worth more than any item on it.
