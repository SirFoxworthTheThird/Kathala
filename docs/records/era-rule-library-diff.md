# The era rule, measured on the library

**What this is:** the check that `docs/records/run-10-plan.md` (Part 1) asked for before the era-aware
state engine (`src/lib/stateEngine.ts`) replaced the book-order rule. It covers every scene of every
multi-timeline book, with the old resolution against the new, counted, and the changes read by hand.

**How:**
- A probe loaded each `.pwk` and resolved every record kind at every scene, both ways:
  - the old way, `selectBestSnapshots` in book order across all timelines;
  - the new way, `lastKnown`, with people kept to their era and things carried by in-world time.
- A *cell* is one entity at one scene.
- *Dropped* means the old rule gave a record and the new rule gives none. *Swapped* means the two
  rules give different records.
- The probe is not in the suite: the library is a separate checkout.

## Books whose timelines overlap: no change

Spans in in-world days, from `storyOf`.

| Book | Timelines (span) | Cells | Changed |
|---|---|---|---|
| *The Name of the Wind* | Waystone 0–4, Kvothe's Story 0–1704 | 7,660 | 0 |
| *The Two Towers* | Rohan 0–7, Mordor 3–15 | 4,996 | 0 |
| *The Time Machine* | Richmond 0–1103, Journey 7–12,000,000,000 | 576 | 0 |
| *Journey to the West* | Monkey −314,205–4,430, Journey −2,495–9,545 | 16,785 | 0 |

## *The Odyssey*: Homecoming 3240–3291, Wanderings 0–456

Character states: 801 of 1,830 cells changed. 750 were dropped and 51 swapped.

- **Swapped (51):**
  - Zeus at every Homecoming scene from ch. 13: the old rule gave his Wanderings record (ch. 12, *Helios Demands Justice*), the new one his Homecoming record (ch. 1, *The Gods Debate Odysseus*).
  - Hermes, the same way: from ch. 10, *Moly Defeats the Spell*, to ch. 5, *Hermes Reaches Ogygia*.
  - A recounted adventure three thousand days earlier is no longer read as where a god is now.
- **Dropped at Wanderings scenes:**
  - The people with records only in the present: Penelope, Telemachus, the suitors, Nestor, Menelaus, Helen, the Phaeacians, Athena, Calypso and others.
  - These are 20–22 scenes each (Hermes 10).
  - The old rule put Telemachus in Sparta during the Cyclops.
- **Dropped at Homecoming scenes:**
  - The people with records only in the Wanderings: Polyphemus, Circe, Aeolus, Elpenor, Tiresias, Agamemnon, Achilles, Scylla, Helios and others.
  - These are 27 scenes each.
  - They are no longer "carried forward" into Ithaca.

## *The Wise Man's Fear*: Waystone 200000–200130, Kvothe's Story 1000–14900

- **Character states:** 1,309 of 5,663 cells changed. 1,285 were dropped and 24 swapped.
  - **Dropped at the tale's scenes:** Bast, Graham, Chronicler, Aaron, Old Cob, Jake and Carter, the inn's people (126–140 scenes each).
  - **Dropped at Waystone scenes:** the tale's people, such as Denna, Simmon, Wilem, Auri, the Masters, the Maer and Felurian (3–11 scenes each).
  - **Swapped (24):**
    - Tempi, Marten, Dedan and Hespe at six Waystone scenes from ch. 105.
    - Old: their latest record in the tale (ch. 95, 109, 127 or 130).
    - New: their record at ch. 85, *Interlude—Fences*.
    - That record is the **library's** mistake, not the rule's. It places all four at the Waystone Inn, in an interlude where Kvothe only talks about them, and every one of its status notes says "…through Interlude—Fences". It is listed for the library, not fixed here.
- **Relationship states:** 73 dropped, all at Waystone scenes. Examples are Kvothe and the Maer, Kvothe and Felurian, and nine more of the tale's relationships.
- **Item states:**
  - 140 dropped: the Holly Crown, at every scene of the tale. Its one record is at the Waystone, in-world day 200,000 or later, and nothing carries backwards in time.
  - 72 cells resolve from the tale into the Waystone, now marked as carried from *Kvothe's Story*. They are the same records the old rule gave.

## *The Cold Choir* (writer run 10): Mercy 301–365, Compact 113525–113549, Quiet 271041–271060

- **Character states:** 455 of 691 cells dropped, none swapped.
  - Every drop is somebody from another era: Isidor, Mother Calloway, Neve, Hal, Jory and Rhee outside the Compact; the Mercy's people outside the Mercy; the Quiet's people outside the Quiet.
  - At a Quiet scene, Isidor and Mother Calloway still resolve wherever the hand-offs of run 10 wrote them a state **at a Quiet scene** (ch. 18 and 21). Those records are in the wrong era, and no read rule can tell them from the writer's word. Removing them is Part 1c's repair list.
- **Relationship states:** 61 dropped, all across eras.
- **Item states:** 24 cells are now marked carried. None changed record.
