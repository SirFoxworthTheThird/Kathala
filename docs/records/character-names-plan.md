# Characters' names over the book, and identities revealed — a plan

**Written:** 2026-10-04, against `development` at d29a5a2.
**Status:** agreed in outline; not built. Each part ships as its own pull
request, and a pull request that departs from this says so in its description
— this file is a record of the plan as agreed, and is not edited afterwards
(see [`docs/README.md`](../README.md)).

The decisions the author took while this was being written are in
[§6](#6-decisions-taken). The questions still open are in [§7](#7-still-open).

---

## 1. The problem

A character can be called different things at different points in a book, and
which name the book uses is part of the story:

- **A name that changes.** Gandalf the Grey becomes Gandalf the White. Strider
  is revealed to be Aragorn.
- **An alias learned late.** Aragorn is given the name Elessar in Lothlórien.
- **Two people who turn out to be one.** Hyde is Jekyll; in *Fight Club* Tyler
  Durden is the narrator.

The app has half of this. A character has **aliases** — *Also known as* —
and they are used by the `@` picker (`src/lib/mentionPicker.ts`), the scene
header line (`src/lib/sceneHeader.ts`), the mention nudges, Find & replace and
search. So "Strider" in the prose is already understood as Aragorn.

What it does not have is **when**, and in reading mode that is a spoiler:

- In the Library's *Fellowship of the Ring*, Aragorn's record is named
  **Aragorn** with the aliases **Strider** and **Elessar**. Reading mode hides a
  character until the reader has met them, and then shows the record as it is:
  the character page reads the record through `useCharacter`, which is not
  gated, and its header renders the name and every alias
  (`CharacterDetailView.tsx`, *Also known as*). A reader who has just met
  Strider at Bree is told he is Aragorn, and given a name the book has not used
  yet.
- *Strange Case of Dr Jekyll and Mr Hyde* models **Dr Henry Jekyll** and
  **Edward Hyde** as two characters, which is right — the book presents two
  men until its last chapter — but nothing records that they are one, so a
  reader who has finished the book sees two strangers.

## 2. Part 1 — names that change, and aliases learned at a scene

### Data

Two optional fields on `Character`, so a world or `.pwk` that predates them
loads unchanged and means what it meant:

```ts
/** "From this scene, called …", in any order; resolved by reading order. */
nameChanges?: Array<{ eventId: string; name: string }>
/** When an alias becomes known. An alias with no entry is known from the start. */
aliasesFrom?: Array<{ alias: string; eventId: string }>
```

`aliases: string[]` keeps its shape. Sixteen files read it, and every one of
them keeps working with no change. `aliasesFrom` sits beside it rather than
turning `aliases` into objects.

**Before the first change the character's own `name` applies.** So Aragorn is
`name: "Aragorn"` with changes *from Bree, "Strider"* and *from the reveal,
"Aragorn"*. Gandalf is `name: "Gandalf"` with *from his first scene, "Gandalf
the Grey"* and *from The White Rider, "Gandalf the White"*. The record's `name`
stays the writer's name for the character, and is what a writer sees.

### The rules, in one pure module

`src/lib/characterNames.ts`, tested without a browser:

- `nameAt(character, cursor, sortKeyOf)` — the change in effect at the cursor:
  the last whose scene is at or before it, in reading order, else `name`.
- `aliasesAt(character, cursor, sortKeyOf)` — the aliases known by then, plus
  the names of changes already passed (once a reader has met Strider *and*
  Aragorn, both are things he has been called), minus the name in effect.
- `allNames(character)` — every name and alias ever, for recognising the
  character in prose.

A change whose scene cannot be placed is treated as **not reached**. This is
the opposite of `hasReached`'s choice for events, deliberately: an unplaceable
reveal held back costs the reader one name; one let through costs them the
reveal.

### For a reader

`useCharacters` already puts every roster through the reading gate (25 files
read characters that way). After the gate decides *who* the reader has met, one
more step decides *what they are called*: `name` becomes `nameAt`, `aliases`
becomes `aliasesAt`, and the roster is sorted again by the name shown. The same
step goes on the two paths that do not use `useCharacters` — `useCharacter`,
which the character page reads, and the search palette, which reads the table
directly and already applies the gate by hand.

Search then stops finding Aragorn under *Elessar* before Lothlórien, and stops
finding him under *Aragorn* before the reveal.

### For a writer

Writers keep the character's own name everywhere (decision 1, §6).

- The character page's editor gains a **Names** section: one row per change —
  a scene, chosen from the same scene `Select` the Goals tab uses, and a name —
  and an optional *known from* scene beside each alias.
- The page's header says what the character is called at the time cursor when
  it is not their own name: *Aragorn — called Strider at Ch. 9*.

### Recognising the character in the prose

Every name and alias counts at every point: in the text they are all the same
person. The places that read `aliases` for this — `mentionPicker.ts` (the `@`
picker), `sceneHeader.ts` (the scene header line), `manuscript.ts` (the mention
nudges) and Find & replace — move to `allNames`, so a name given only as a
change (Gandalf the White) is recognised too.

### Scenes that move under a change

Deleting a scene sets a goal's start or end scene that points at it to `null`
today (`deleteEvent`). For a name change that would be wrong both ways — `null` means *from the start*, which is the spoiler,
and dropping it loses the reveal. So:

- **Deleted:** the change moves to the next scene in reading order (decision 2,
  §6). With no next scene it moves to the previous one; with no scenes at all it
  is dropped.
- **Joined** (`joinWithNext`): the change follows the joined scene, as the
  other pointers do.
- **Split:** it stays on the first half, as everything recorded at a scene
  does.

### Tests

- Unit: `characterNames` — in effect at the cursor, before the first change,
  out-of-order entries, an unplaceable scene, aliases with and without a
  *from*, names passed counted as aliases.
- Integration (fake-indexeddb): a scene with a change deleted, joined and split;
  one undo restores the change where it was.
- e2e, *Fellowship*, paired: a reader at Bree sees *Strider* and no
  *Elessar* on the roster, the page and in search; past the reveal, *Aragorn*
  with *Strider* among his names. A writer sees *Aragorn* throughout, with the
  header's *called Strider at …*. The editor's rows add, change and remove.
- Mutation runs on each rule, as for every change here.

## 3. Part 2 — revealed to be the same person

### Two records, one link

The pair stay **two characters**. The book presents two people until the
reveal, and the app holds each one's own history: Hyde's whereabouts scene by
scene, Utterson's friendship with Jekyll and his suspicion of Hyde, and — in
*Fight Club* — the narrator and Tyler on stage in the same scenes. Folding one
record into the other would destroy those, and could not be cleanly undone.
What changes at the reveal is **how a reader is shown them**, not what is
stored.

One field, on the character who is revealed:

```ts
/** "Is revealed to be …, at …". On one side only, so the two cannot disagree. */
revealedAs?: { characterId: string; eventId: string }
```

The other is the pair's **head**: Jekyll, whom Hyde is revealed to be. Refused
when setting it: a character as themself, and a chain — a character already
revealed as someone cannot be someone else's head, nor be revealed twice. A
group is one head and the characters revealed as them.

### For a reader, before the reveal

No trace anywhere. Two entries, two pages, no link in search, the relationship
graph or a character's page. The gate holds the link back until the reader has
reached its scene, exactly as it holds back a relationship.

### For a reader, from the reveal — one entry (decision 3, §6)

From the reveal on, a reader is shown **one person**: the head, with the
revealed character's name among their names. This needs one more piece in the
gate, because many screens look a character up by id — a scene's cast, a
snapshot, a map token, a faction membership — and an id that no longer resolves
would make Hyde silently vanish from his own scenes:

- `presentRoster(characters)` — the head stays and carries the other's names
  as aliases; the revealed character leaves the roster.
- `identityOf(id)` — the head's id for anyone revealed as them by the cursor;
  any other id unchanged.

Every reader-facing screen that resolves a character by id goes through
`identityOf`, so a reference to Hyde shows as Jekyll. A reader can reach
nearly every screen — the Book, Characters, Maps, Items, Relations, Arc, Lore,
Factions, Knowledge, the Calendar and the dashboard (`navItems.ts` hides only
Structure) — so each is listed with what it does:

| Surface | From the reveal, for a reader |
|---|---|
| Characters roster, dashboard counts | One entry; the count of people met drops by one. |
| Character page | The head's page, *also Edward Hyde* in the header. Hyde's address opens it. |
| Current State, History tabs | The head's own states, then the revealed character's, under *As Edward Hyde*. |
| Scene cast — cards, *In this scene*, the chapter panel | One chip for the pair; once even where both were recorded in the scene (*Fight Club*). |
| Map tokens and journeys | One token, where the head is placed; where only the revealed one is, there. |
| Relationship graph | One node; both characters' edges join it; a relationship between the two themselves is not drawn. |
| Arc grid | One row; in a scene where both are recorded, the head's state, with a mark that there is another. |
| Items, factions, knowledge, lore | Holders, members, knowers and mentions resolve to the head. |
| Search | Either name finds the head. |

**Before any of this is built, every one of the 25 `useCharacters` consumers
and the lookups beside them are audited** and the table above is checked line
by line against the code, because a screen that looks up by id and is missed
is a screen where Hyde disappears. That audit is the first commit of Part 2,
and the pull request lists what it found.

### For a writer

Two entries, always, each page saying who the other is: *Edward Hyde —
revealed to be Henry Jekyll at Ch. 10*. The link is set from either page: a
character, and a scene.

### Safety

- **Deleting a character** clears any link to or from them, as deleting one
  already clears the scene references to them (G-3).
- **The reveal scene** deleted, joined or split: the same rules as a name
  change (§2).
- The link is journalled with the character, so undo restores it, it travels
  in `.pwk`, and a merge import unions it with the record.
- Not in Part 2: continuity checks for identities. *Both on stage in different
  places in one scene* is often the point of the book, so a rule for it wants
  its own thought.

### Tests

- Unit: `presentRoster` and `identityOf` at, before and after the reveal; a
  refused chain; a group of three (two revealed as one head).
- e2e on *Jekyll and Hyde*, paired before and after the reveal, through the
  screens in the table: roster, page and Hyde's address, a scene's cast,
  search, the graph, the map, the Arc grid.

## 4. Part 3 — the Library

In `kathala-library`, its own pull request: *Fellowship* — Strider at Bree,
Aragorn from the reveal, Elessar from Lothlórien; Gandalf the Grey, and the
White in *The Two Towers*; *Jekyll and Hyde* — Hyde revealed as Jekyll at
*Henry Jekyll's Full Statement*. Each checked against the text for the scene
it is given.

## 5. Order

1. **Part 1**, one pull request: the fields, `characterNames`, the reader's
   names, the writer's editor and header, the prose, the scene rules.
2. **Part 2**, two pull requests: first the link, the writer's side, the
   reveal's safety rules and the reader's pages and search; then the grouping
   across the surfaces in the table, after the audit.
3. **Part 3** once Part 1 has shipped, and its *Jekyll* half once Part 2 has.

## 6. Decisions taken

1. **A writer sees the character's own name everywhere**, with the name at the
   cursor said on the character page. Not the name at the cursor in every list.
2. **A deleted scene's name change or reveal moves to the next scene** in
   reading order, rather than being dropped.
3. **After a reveal a reader is shown one person**, grouped, rather than two
   linked entries.
4. **This plan before any code.**

## 7. Still open

- **The Arc grid's mark** for a scene where both of a group are recorded —
  what it looks like is for Part 2's second pull request, once the audit says
  how often it happens in a real book.
- **Continuity checks for identities** — deliberately not planned (§3).
- **An identity revealed and later disproved** — a character believed to be
  someone, and then not. Nothing here models it, and nothing in the Library
  needs it yet.
