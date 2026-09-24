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

---

## 1. Global undo

The operation journal (#115) was built for this: every journalled mutation
already records enough to invert itself, and `invertOperation` exists. Today the
only history a writer can reach is per-scene revisions, so a mis-click on the
Characters screen or a wrong bulk tag is unrecoverable.

The infrastructure is paid for. Not exposing it is leaving the value of #115 on
the floor.

## 2. Full-text search across prose

`Ctrl+K` finds entities; find-and-replace works inside one scene. Neither
answers *where does this phrase appear in the book* — for a writer chasing a
repeated image, or a reader who remembers a line and not the chapter.

Thirty-nine Library books carry complete novels and a writer's own manuscript
can run to hundreds of thousands of words, so this is a real gap rather than a
convenience. Reading mode makes it delicate: results must respect the spoiler
cursor, or search becomes the hole in the gate.

## 3. Export by scene status

The DOCX/EPUB compile filters written against unwritten. It should also be able
to take only `final` or `revised` scenes, so a draft can be sent out without the
scenes that are not ready.

Small, self-contained, and the status field it needs already exists.

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
