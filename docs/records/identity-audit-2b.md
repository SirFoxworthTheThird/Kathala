# Part 2b audit — where a reader is handed a character by id

The plan (`character-names-plan.md`, §3) requires this before any grouping is
built: every screen a reader reaches that resolves a character by id, checked
against the table there, because a screen that looks Hyde up by id and is missed
is a screen where Hyde disappears once he has left the roster.

## How it is handled

The roster a reader is given (`useCharacters`) is grouped after a reveal they
have reached (`gate.group` → `presentRoster`): Hyde leaves it and Jekyll carries
his names, and who he also is (`alsoAs`). Rather than finding every
`characters.find(c => c.id === …)` in thirty files, the **records that carry a
character id are resolved in the hooks that hand them to a reader**, so the id
arrives already saying Jekyll. Reading mode offers no edits
(`e2e/readingNoEditing.spec.ts`), so a record rewritten on its way to a reader is
not one anything writes back; a writer's gate is open and every hook returns the
records as stored.

| Field carrying a character id | Hook(s) | Resolution |
|---|---|---|
| `event.involvedCharacterIds`, `mentionedCharacterIds`, `povCharacterId` | `useEvents`, `useTimelineEvents`, `useWorldEvents`, `useEvent` | `resolveCast` — each id to its head, the pair once even where both were cast. `useAllWorldEvents` stays raw: it is the time cursor's, and displays nothing. |
| `characterSnapshot.characterId` | `useEventSnapshots`, `useChapterEventSnapshots`, `useWorldSnapshots`, and through it `useBestSnapshots` | `resolveRecords` by scene — where both were recorded at one scene the head's own is kept, and says `alsoRecordedAs`. |
| — the same, for one person | `useCharacterSnapshots` | `gate.selves` — the head's records and anyone revealed as them, **not** rewritten, so History can group them under *As …*. `useResolvedCharacterSnapshot` reads only the character's own. |
| `relationship.characterAId/BId` | `useRelationships`, `useCharacterRelationships` (selves) | `resolvePairs` — an edge to Hyde is Jekyll's; one between the two is not drawn. |
| `factionMembership.characterId` | `useFactionMemberships`, `useMembershipsForFaction`, `useMembershipsForCharacter` (selves) | `resolveRecords` by faction — one member per faction. |
| `knowledgeReveal.characterId` | `useKnowledgeReveals`, `useRevealsForFact` | `resolveRecords`; the Knowledge screen then counts each knower once, at the earliest (`firstLearned`). |
| `lorePage.linkedEntityIds` | `useLorePages`, `useLorePage`, `useLorePagesForEntity` (selves) | `resolveIds`. |
| `characterMovement.characterId` | `useEventMovements`, `useWorldMovements`, `useCharacterMovement` (selves) | `resolveRecords` by scene. |
| `characterGoal.characterId` | `useCharacterGoals`, `useGoalsForCharacter` (selves) | `resolveRecords`. |

## The plan's table, checked against the code

| Surface | Reads | From the reveal, for a reader |
|---|---|---|
| Characters roster, dashboard counts | `useCharacters` | One entry; the count drops by one. |
| Character page | `useCharacter`, `useCharacters` | Hyde's address redirects to Jekyll's page, tab kept. Header: *Also Edward Hyde*, from `alsoAs`. Tabs read through the hooks above, with `gate.selves`. |
| Current State, History | `useResolvedCharacterSnapshot`, `useCharacterSnapshots` | The head's own state and records, then each other self's under *As Edward Hyde*. |
| Scene cast — cards, *In this scene*, chapter panel | `useEvents` / `useWorldEvents`, `useChapterEventSnapshots` | One chip. |
| Map tokens and journeys | `useBestSnapshots`, `useEventMovements`, `useCharacterMovement` | One token: the most recent record of either, and the head's where both were recorded at a scene. |
| Relationship graph | `useRelationships`, `useCharacters` | One node; both men's edges join it; the edge between them is gone. |
| Arc grid | `useWorldSnapshots`, `useCharacterGoals`, `useFactionMemberships` | One row; where both were recorded at a scene, the head's state with **+1** and *Also recorded here as …*. |
| Items | `useBestSnapshots`, `useWorldSnapshots` | A holder of Hyde's is Jekyll. |
| Factions, Knowledge, Lore | the hooks above | Members, knowers and linked entities resolve to the head. |
| Search | `gate.group` on its own query | Either name finds the head; a relationship result names the pair as shown. |

## Not reached by a reader, so not changed

The Writer's Brief, the Continuity Checker, the chapter diff, Structure, the AI
dialogs, the Page and scene drafts, Find & Replace, Settings' editing sections
and the sequel wizard are hidden while reading (`TopBar`, `navItems`,
`readingNoEditing.spec.ts`). Their hooks are the same ones, with an open gate.

## Left as they are

- **A frame narrative's character anchor** (`TimelineAnchor.entityId`) is not
  resolved; no book in the Library both reveals an identity and anchors a frame
  on that character.
- **The world shelf's counts** (`useWorldSummary`) count every character stored,
  revealed or not, as they did before; they are not the reader's cast.
