# A family tree (issue #702)

**Asked:** a family tree built from parents, children and partners, with generations and heirs. It is drawn as a tree
and follows the story over time. People who never appear can be kept out of the cast. The measurements and decisions
are in `family-tree-plan.md`, D-1 to D-7.

**Code:**
- `src/types/relationship.ts`: `Kinship` on a relationship, and `partner` on a relationship's state.
- `src/types/succession.ts`: a succession.
- `src/lib/kinship.ts`: parent and partner links read from relationships, ancestors, birth order, and why a link is
  refused. Pure.
- `src/lib/family.ts`: the family at a scene, what a reader sees, the tree's layout with folding, and a succession's
  line at the cursor. Pure.
- `src/db/hooks/useKinship.ts` and `useSuccessions.ts`: every write, journalled.
- `src/features/family/`: the hook that reads the family at the cursor, the character page's *Family* section, the
  tree, and the succession panel.
- *Never on stage* is applied in Cast Balance (`castBalance.ts`), the header suggester (`headerSuggest.ts`), the `@@`
  picker (`mentionPicker.ts`, `DraftBook`), the scene cast pickers (`SceneDetails`, `EventCard`), and the Characters
  screen.

## What it does

**Kinship** (D-1, D-4).
- On a character's page, **Add a parent**, **Add a partner** and **Add a child** ask who, of what kind and from which
  scene.
  - A parent is by birth, adoptive, or a step-parent.
  - A partner is married, partners or betrothed.
- A pair that already has a relationship gets the kinship on it, keeping its words. A pair without one gets a
  relationship made for it (`own`), which goes again when the kinship is taken off.
- A parent link names its parent (`parentId`). The plan said *A is B's parent*. Naming the parent holds whichever way
  round the relationship was written, and the Library writes *son and father* six times.
- Someone made their own parent, a link made twice, a parent made of an ancestor, and parent and partner on the same
  pair are each refused with the reason.
- Children are in birth order, changed with the arrows.
- With the cursor on a scene, a partnership can become another kind from there, or end, as a state of the
  relationship.

**At a scene** (D-2).
- Someone is born at their birth parent's link's first scene. Before it a writer sees them faded, marked *not born
  yet*, and a reader doesn't see them.
- An adoption or a step-parent counts from its scene, and so does a partnership.
- The dead are marked †, from their state at the cursor.

**The tree** (D-7).
- **Family** in the rail. **Around them** shows a chosen person, one to six generations each way, with partners
  beside. **Whole family** shows everyone joined to them.
- A row a generation; adoptive and step lines dashed; a partnership a line between the two, dashed once it has ended.
- A fold control on anyone with children says how many it hides. **Open** goes to their page, and the pencil opens
  their *Family* beside the tree.

**Succession** (D-3).
- **Eldest first** or **chosen by hand**, from a founder.
- At the cursor, the first in the line born and alive holds it and the rest are heirs, so a death moves everyone up.
- Adopted children inherit by the rule and stepchildren don't.

**Never on stage** (D-5).
- Ticked on the character's page.
- Left out of:
  - a scene's cast pickers, on the card and in the scene details, for present and on the phone;
  - the Page's `@@`;
  - the header's suggestions;
  - Cast Balance.
- `@` still names them as mentioned. The Characters screen lists them apart.

**Reading mode** (D-6).
- Only people met, links reached, and no one unborn.
- After a reveal, Hyde's family is Jekyll's.
- A succession is counted over those people only, and nothing can be changed.

**Data.**
- Dexie v70 adds `successions`, shared in a series.
- The journal has a new `succession` group.
- `.pwk` is version 24, with a `successions` array.
- A merge unions successions by id, applying tombstones.
- A character's delete takes the successions they founded and takes them out of any other line.
- A sequel points kinship and successions at its own people.
- Series join and leave rewrite the ids inside kinship with the rest.

## Found on the way

- **The tree's people could not be pressed.** React Flow sets `pointer-events: none` on a node that is neither
  selectable, draggable nor connectable, as these are, so Open, Fold and Edit took no clicks, from a mouse as from a
  test. The card takes pointer events again.
- **React Flow is handed nodes it holds, not new ones each render.** It keeps each node's measured size on the node,
  and needs `onNodesChange` to do so.
- **The tree did not refit after a fold.** A fit keyed on what was asked for ran before React Flow had the new
  people, and `fitView` refuses while any node is unmeasured, returning false. The fold was counted as fitted anyway,
  and two people sat in a view zoomed to a speck, off the screen. Fitting now waits until every person React Flow holds
  is measured, and counts only a fit that happened.
- **Ending a marriage at the scene it began undid the marriage.** `partnershipAt` carried the state *before* the scene
  forward, over the state the scene itself had just said. It starts from the scene's own state where there is one.
- **A partnership's kind is a change of state.** The relationship-state write skipped a state equal to the one before,
  and betrothed then married was otherwise equal. `partner` is now part of the comparison.
- **A read of the series' tables through a variable** was caught by `bibleReads.test.ts`, which wants every such read
  to say `bibleOf(...)` where it reads. `useKinship` read the relationships and the cast through a local `bible`. It
  says it in place now.
- **200 people at once are drawn, not read.** *Whole family* fits them at a scale of 0.04, where a person's controls are
  under a pixel. *Around them* is the view to work in, and the e2e folds there.

## Measured

- **The layout** (`familyLayout`, Vitest, seven runs each): 200 people take 7.3 ms median and 16.9 ms at worst; 500
  take 24 ms; 1,000 take 95 ms. The unit test's ceiling for 200 is 100 ms.
- **Drawn** (e2e, production build): all 200 people on screen 217 ms after *Whole family* is pressed. Folding a branch
  and opening it again takes 151 ms. The e2e's ceiling is 3 s.

## Tests

- `src/lib/__tests__/family.test.ts`, 19:
  - **kinship:** a parent link read either way round and a broken one ignored; birth order; each refusal with its
    reason;
  - **at a scene:** birth from the birth link's scene, adoption and partnership from theirs, the dead, a partnership
    ended or changed, and no one outside the family;
  - **a reader:** no one unborn, no one unmet, no link to either, nobody left hanging;
  - **the layout:** rows a generation, partners and in-laws level, no overlaps, siblings in order, a child under the
    middle of its parents, a founder with no parents just above their child, *around* with as many generations as asked
    and *whole*, folding with its count and a partner kept by the fold, edges with their kinds, and 200 people timed;
  - **succession:** eldest first and by hand, the holder at the cursor as people die and are born, and a hidden heir
    passed over.
- `src/db/hooks/__tests__/kinship.test.ts`, 13, against the real hooks:
  - a parent link made and ordered with undo;
  - kinship put on the writer's relationship, either way round, and taken off it;
  - a made one removed with its relationship;
  - every refusal writing nothing;
  - a partnership betrothed, married and ended at scenes;
  - *never on stage* journalled;
  - successions made, changed and deleted with undo, and their cascades;
  - a `.pwk` round trip and a file before them;
  - a merge with a deletion;
  - a series;
  - a sequel.
- `castBalance`, `headerSuggest` and `mentionPicker` tests: someone never on stage left out, and on stage again
  counted; `@@`'s `exclude` leaving a name taken.
- `e2e/familyTree.spec.ts`, 4:
  - **a writer:** three generations from the pages; a cycle refused with its reason; the tree at three scenes, across a
    birth and two deaths; a succession moving from Mr Earnshaw to Hindley to Hareton; a branch folded and unfolded;
    editing from the tree; and a person's page opened;
  - **a reader:** someone unmet and someone unborn left out, then shown when reached; no edit control on the tree or
    the page;
  - **never on stage:** offered for a scene's cast, then not once ticked, and listed apart on Characters;
  - **200 people:** all drawn, timed, and a fold and unfold timed.

## Mutants

MUTANTS
