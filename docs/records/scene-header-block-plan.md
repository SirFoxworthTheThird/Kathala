# The scene header as a block — a plan

**Written:** 2026-10-06, against `development` at 84c2a19.
**Status:** agreed in outline. Each part ships as its own pull request, and a
pull request that departs from this says so in its description. This file is
a record of the plan as agreed and is not edited afterwards (see
[`docs/README.md`](../README.md)).

---

## 1. The problem

The third blind writer run wrote a 20-chapter, 45,415-word book on the Page,
and the scene header line (`[#Place @@Name]`) created all of its 12 characters
and 12 places without the writer leaving the prose. Everything else the book
says happened was entered a second time, scene by scene, after the prose was
done:

| In the prose | Recorded afterwards, in a panel | How many |
|---|---|---|
| Idris pockets the vial; the pistol is left in the chapel | item hand-offs and placements | 22, plus 17 *Carry forward* |
| Dask dies | character state, *Deceased* | 1 |
| Augusta learns the Notary's secret | knowledge reveals | 24 |
| Two allies fall out | relationship states at a scene | 18 |

Each of those meant setting the time cursor to the scene, opening a panel and
entering what the prose already said. That pass is where the run's slowest
work was, and where its data loss happened.

## 2. The block

The header becomes a labelled block, one line per kind of record:

```
[
  Place: #Drowned Chapel
  Characters: @@Corwen Dask:dead @@Sabine Varro
  Items: ^Warden's Pistol:#Drowned Chapel ^Ash Ledger:@Sabine Varro
  Facts: ?Dask is the Grey Notary:@Sabine Varro
  Relationships: ~Sabine Varro/Idris Quell:estranged
]
```

It stays what the header line is today: **drawn from the scene's records,
never stored in the prose**, and read back into the records when the writer
leaves it. So nothing in it reaches the manuscript, an export, the word count
or the continuity checker, and deleting a token is how a record is taken back.

### Rules

1. **Only the lines a scene uses are drawn.** An empty template on every scene
   would put about 400 lines of scaffolding into a 63-scene book.
2. **The sigil decides what a token means, not the line it is on.** The
   labels are for the eye: a token typed on the wrong line is read the same
   way and drawn on the right line next time. The one-line form
   (`[#Kitchen @@Wren]`) stays valid input.
3. **A sigil starts a token only at the start of a line or after a space,
   and only when a name follows it.** A fact titled *Who killed Varro?* does
   not start a new token at its question mark.
4. **A name runs to the next token or the end of its line.** Names do not run
   across lines.
5. **Place and Characters describe the scene; everything else is a change that
   happens at it.** A token after the first two lines is drawn only on the
   scene where the change is recorded, and later scenes look back for it, as
   every state in the app already does.
6. **A name nothing answers is kept as typed and said**, as the header does for
   people and places today. A fact title nothing answers may be created, as
   `@` creates a person.

### What each token writes and reads back

| Token | Writes, at this scene | Drawn when |
|---|---|---|
| `#Place` | the scene's setting | the scene is set there |
| `@@Name` | the scene's cast | they are in the cast |
| `@@Name:dead` | their state: not alive | their state here says dead and the one before said alive |
| `@@Name:alive` | their state: alive, *revived* | their state here says revived |
| `^Item` | the scene's items (`involvedItemIds`) | the item is in the scene |
| `^Item:@Name` | the item is in Name's inventory from here, as a hand-off does today | Name's state here lists it and the one before did not |
| `^Item:#Place` | the item is placed there (`ItemPlacement`) | a placement here says so |
| `?Fact:@Name` | Name learns the fact (`KnowledgeReveal`) | a reveal here says so |
| `?Fact:reader` | the reader learns it here (`readerLearnsAtEventId`) | the fact says so |
| `~A/B:label` | the relationship's state here; a new relationship starts here | a state here, or a relationship that starts here |

## 3. Decisions taken

- **The block, with labels**, rather than one longer line.
- **Item custody stays where it is** — in each character's inventory. Moving it
  onto the item was discussed (it would remove *Carry forward* and the gaps
  that need it) and left for later. `^Item:@Name` writes what a hand-off writes
  today, and the gaps and *Carry forward* stay as they are.
- **The relationship's state is its label.** Sentiment and strength stay in the
  panel.

## 4. Build order

1. **The block.** Place and Characters only: the multi-line form, its labels,
   the boundary rule for sigils, on the Page and on a scene card. No new
   records.
2. **`:dead` and `:alive`** on the Characters line.
3. **The Items line.**
4. **The Facts line.**
5. **The Relationships line.**

Each one: unit tests on the parse and the plan it makes, an e2e spec on the
Page and a card, the guide's header section and its screenshot.

## 5. Still open

- **Taking back a hand-off.** Deleting `^Item:@Name` takes the item out of
  Name's state at this scene. The previous holder's state at this scene, which
  the hand-off rewrote without it, is not put back. Whether it should be is
  decided in the Items pull request.
- **Offstage deaths.** `:dead` sits on a person in the scene. A death reported
  elsewhere stays a knowledge fact tagged `offstage-death:` (main's b507d0a).
- **A new scene's empty template.** Whether a scene with nothing recorded shows
  the labels once, as a prompt.
