# A family tree: the plan (issue #702)

**Asked:** a family tree: parents and children, partners, generations and heirs, drawn as a tree and following the
story over time. Kinship is structured data rather than a relationship's free-text label. A person who never
appears, such as an ancestor, can be kept out of the cast.

## Measured

On the 58 Library books (`/home/user/kathala-library/library/*.pwk`), with a probe in the scratchpad:

- **Writers already record families, as free text.** 191 of 951 relationships (20%), in 50 of the 58 books, have a family
  word in the label:
  - the commonest are *husband and wife* (15), *father and son* (15) and *mother and son* (14);
  - the same link is written in both orders: *father and son* 15 times, *son and father* 6;
  - so the label says that a link is family, and never which end is the parent.
  - *ward and guardian*, *foster mother* and *adoptive siblings* appear too, kinship that isn't by birth.
- **Nobody has a birth date.** None of the 1,824 characters has `birthDate`, while 5,775 of 6,056 scenes (95%) have an
  in-world date. So *not born yet* cannot rest on birth dates.
- **People who are never on stage exist.** 67 characters (3.7%) are in no scene's cast or mentions, and count as cast
  everywhere anyway.
- **Death is recorded.** 311 characters are dead by the end of their book. A person's state at a scene already says
  whether they are alive (`personAtScene`).
- **No character records a sex or gender,** which matters for D-3.
- **The largest cast is 121 characters,** so the issue's 200 people is above any Library book.
- ***Wuthering Heights* has the family the guide needs:**
  - three generations: Mr and Mrs Earnshaw; Hindley, Catherine and Heathcliff; Hareton, Cathy and Linton;
  - an adoption: Mr Earnshaw brings Heathcliff home;
  - births, deaths and a second marriage inside the story;
  - all 12 of its relationships are free text, so its kinship will be entered for the screenshot.

## Decisions

- **D-1: a parent is a birth, adoptive or step parent.**
  - Adoptive and step links are drawn dashed and named on the line.
  - Foster and guardian are left to ordinary relationships. They are care, not descent, and the tree is descent.
  - The app does not cap a person at two birth parents, since a fantasy world may have more.
- **D-2: someone is born at their birth parent's link's first scene.**
  - A birth-parent link's starting scene is the birth.
  - Before it, a writer sees the person faded, marked *not born yet*. A reader doesn't see them at all.
  - Someone with no birth scene, such as an ancestor or anyone born before the story, is always there.
  - So a birth needs no field of its own, and has only one place to say it.
  - The dead are marked †, from the scene their state says they died.
- **D-3: succession is by eldest first, or chosen by hand.**
  - A succession names what is inherited (*the Heights*), its founder and a rule.
  - **Eldest first:** the founder, then each child in birth order, each followed by their own line before the next
    sibling (absolute primogeniture). Birth order is the order the children are listed under a parent, which the
    writer can change.
  - **Chosen by hand:** a list the writer orders.
  - At the cursor, the holder is the first person in the line who is born and alive, and the heirs are those after
    them. So a death moves everyone up.
  - **Eldest son first is not offered.** It needs to know who is a son, and no character records that (Measured).
    Adding a sex field to every character for one rule is a bigger change than this issue. A writer whose world uses
    it can order the line by hand.
- **D-4: kinship lives on the relationship (option a).**
  - `Relationship.kinship` is one of two things:
    - `{ kind: 'parent', parent: 'birth' | 'adoptive' | 'step' }`: A is B's parent;
    - `{ kind: 'partner', partner: 'married' | 'partnered' | 'betrothed' }`.
  - There is one graph of relationships, and the tree is a view of it. The Relationships graph still shows these
    links, and their strength, sentiment and notes stay.
  - **A partnership over time** uses what a relationship already has:
    - it starts at `startEventId`;
    - it ends where a relationship snapshot says it is no longer active;
    - betrothed becoming married is a snapshot's `partner`, read at the cursor as every relationship state is.
  - **Birth order** is `Relationship.kinship.order`, on the parent link.
  - **A cycle is refused when entered,** with the reason: someone their own parent, or the parent of an ancestor.
- **D-5: never on stage.**
  - `Character.offStage`, set on the character's page.
  - Such a character is left out of:
    - the scene cast pickers;
    - the header suggester's cast;
    - Cast Balance.
  - They can still be named with **@** as mentioned, since mentioning an ancestor is what prose does.
  - They are listed apart, under *Never on stage*, on the Characters screen, so they can still be found and edited.
  - They show in the tree as anyone does.
- **D-6: reading mode.** The tree is built only from what the reader may see:
  - people revealed to them;
  - links whose starting scene they have reached, with both ends revealed;
  - no one not yet born.

  Succession is worked out over that same tree, so a hidden heir does not leave a gap that gives them away.
- **D-7: the view.**
  - **Family** in the rail opens the tree.
  - It can show *around a person*, with ancestors above, descendants below and partners beside, three generations
    each way by default.
  - Or it can show *the whole family*, everyone joined by kinship.
  - Branches collapse and expand, it pans and zooms, and clicking a person opens their page.
  - The layout is a pure function, tested apart from the drawing, and drawn with React Flow as the Relationships
    graph is.
  - The 200-person check is measured on that function and on the drawn screen, in part 2 and part 4.

## Data

- **Dexie v70:** `successions: 'id, worldId'`, shared in a series as relationships are.
- **New fields, no index:**
  - `Relationship.kinship`;
  - `RelationshipSnapshot.partner`;
  - `Character.offStage`.
- **The journal:** a new group, `succession`. Kinship and *never on stage* are fields of records already journalled.
- **`.pwk`:** a new array, `successions`, and file version 24. A file without it imports as none.
- **Cascades:** deleting a character takes it out of every succession: as founder, the succession goes; in a hand-made
  line, it leaves the list. Its relationships, kinship with them, already go.

## Parts

1. **Data:**
   - the types and v70;
   - kinship written through the relationship hooks, with the cycle refused;
   - *never on stage*;
   - successions, journalled, with cascades, `.pwk` and merge.
2. **Logic, pure:**
   - kinship at a scene (born, alive, partners as of then);
   - the two layouts, with collapse;
   - succession;
   - unit tests, and the 200-person layout timed.
3. **Screens:**
   - a *Family* section on the character's page (parents, partners and children, added and ordered there);
   - the Family tree screen, with succession;
   - *never on stage*, and where it leaves people out.
4. **e2e, mutants, GUIDE, record, PR:**
   - e2e: a three-generation family, the cursor moved across a birth and a death, reading mode, and 200 people drawn;
   - mutants: the cycle check, the rules over time, the reading gate;
   - the guide's *Family tree* section with a *Wuthering Heights* screenshot.
