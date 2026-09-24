# Continuity Checker

The **Continuity Checker** (the shield icon in the top bar) scans your whole world for contradictions and surfaces them **grouped by category**, with an error/warning count.

Each finding links straight to the offending event so you can fix it in context.

---

## What it catches

### Characters

- A character who is **alive after dying** in an earlier chapter.
- A **dead character appearing** in a later scene — with a one-click *"mark as flashback"* if it's intentional.
- A character who **appears before their first snapshot**.
- A character at a **destroyed location**.
- A character who **travels through a destroyed or abandoned region**.
- A character whose state has gone **stale** — no snapshot for longer than the world's threshold.

### Travel

- A character who **can't reach a location in time**: the move covers more map distance than their travel mode can cross in the in-world days available, using the map scale, the mode's speed, and any road, river, or trail along the way.

The finding offers a one-click **"Allow N more days"** that lengthens the event so the journey becomes possible.

### Items, relationships, and factions

- An **item used before it was acquired**, or an impossible handoff.
- An **object in two places at once** — in two people's hands in one scene, or placed somewhere its holder is not. An item recorded both in a hand and at the place that hand is standing in is *not* a contradiction and is not reported. A thing there is more than one of — lembas, a cloak every member of the company has — is marked as a **kind of thing** on the item, and then several people carrying one is what it means.
- A **relationship or faction membership starting at an invalid moment**, or a relationship snapshot naming somebody who is dead by that scene.
- A character who **joins a faction before they appear** — the membership starts earlier than their own first scene.
- A character who **learns something while the record places them somewhere else** — not learning it off-stage, which is ordinary, but a reveal set in one place while the character's last recorded position is another.
- A **POV character** who should not be available at that event.

### Observations

Ranked below the faults, and counted separately, because "yes, I meant that" is the usual answer:

- **Names in the prose that the scene's cast does not account for** — one observation per scene, listing them, and only for names that appear more than once. It offers **Record as mentioned**, which claims only what the check saw: the name is in the text.
- A **point of view who is not in the scene's cast** — right for a narrator reporting a scene from outside it, and worth a look if the POV is a leftover from an edit.
- A **subplot that goes quiet or is never resolved**, and a **character who leaves a faction with nothing following it**.
- A scene **marked revised or final with nothing written in it**, in a world that has prose somewhere.

### Plot threads

The [plot thread](Plot-Threads) cadence analysis is reported here too, so it's actionable rather than just visible:

| Finding | Condition |
|---|---|
| **left dangling** | Raised, then quiet for the last three chapters or more |
| **goes quiet mid-story** | A run of three or more chapters with no beat |
| **has no scenes** | A thread that exists but was never tagged onto an event |

---

## What the travel checks need

The travel checks are the ones with prerequisites:

1. A **map scale** — set one on the map.
2. **Travel modes with speeds** — defined in [World Settings](World-Settings).
3. **Travel days** on the events.

Without all three, distance checks can't run meaningfully.

---

## The stale-snapshot threshold

A character with no snapshot for more than N events is flagged as possibly forgotten. **This is not necessarily an error** — they may simply be off-stage.

Set N under *Continuity* in [World Settings](World-Settings). Default is 5.

---

## Suppressing a finding

If a finding is intentional, **suppress** it and add an optional reason. The checker can **show suppressed findings** later so you can review or restore them.

Suppressions are stored with the world and travel through [export/import](Export-and-Import).

---

## Flashbacks

Events marked **Is flashback** are excluded from travel-distance and staleness checks. Set the flag on the event card in the chapter detail.

---

## Not available while reading

[Reading mode](Reading-Mode) removes the Continuity Checker from the top bar, along with the dashboard's continuity card.

---

## Common problems

**Travel violations for every character.**
Confirm the map scale, travel-mode speeds, and travel days are all set. Any one missing skews the arithmetic.

**Nothing is reported but something is wrong.**
The checker only detects the categories above. For anything else, use the [Chapter Diff](Chapter-Diff) to compare two moments, or the [Character Arc grid](Character-Arc) to scan the whole book.

---

## Related pages

- [Knowledge](Knowledge) — catching a character who acts on what they shouldn't know
- [Chapter Diff](Chapter-Diff) · [Character Arc Grid](Character-Arc) · [World Settings](World-Settings)
