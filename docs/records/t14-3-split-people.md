# T14.3: a split records its people, and notes follow their words

**Plan:** `round-trip-plan-4.md`, T14.3.
**Findings:** the third and thirteenth of `loop-2026-11-14.md`; the writer's W3-1 and W3-13.

## What happened

The third loop's writer split *The Magistrate* and changed the first half's place to the Customs House. The second
half's header still said the Salt Exchange. The Characters screen, at the second half, said *Ilse Marrow — The Customs
House, carried forward*.

The writer reproduced it in a scratch world: *Hall* `[#Kitchen @@Pia Lund]`, split into *Hall* and *Garden*, then *Hall*
changed to `#Cellar`. At *Garden*, Pia was in the Cellar. A scene pasted with its own header kept its people.

## Why

`splitScene` gave the new scene its place and cast fields (`splitCarries`), so its header drew them, and wrote no record
of anyone being there. Where a person is at a scene is read from the records, so at the new scene they were carried
from the first, and went wherever the first was later said to be.

## Now

**Where its people are, as the scene it came from said** (`splitScene`):
- for each of the cast carried over, the place the first scene's record says is said at the new scene, as a header
  says it (`sayPerson`, with `says: ['place']`), so that it stands whatever the first scene is later changed to say;
- only the place: what else the first scene recorded of them stays with it, as before;
- someone the first scene put elsewhere than the scene's place is said to be there, not at the scene's place;
- nobody outside the cast; nobody where nothing is carried: a scene made at the end of another, or a pasted heading
  (`carry: false`).

The plan said *the scene's place, for each person of its cast*. What the first scene's records say is that wherever the
writer said nothing else, and right where they did.

**Notes follow their words:**
- **a split:** a note on words that went to the new scene is filed under it (`placeNote`, on the two halves);
- **a join:** a note on the scene joined in is filed under the scene that took it in. Neither did before: a joined
  scene's notes pointed at a scene that no longer existed, and were found again only by their words.

**One Undo** takes all of it back, and Redo puts it back.

## Tests

- **`sceneStructure.test.ts`:**
  - the writer's case: the second half keeps the person where the first said, after the first is moved;
  - one of the cast put elsewhere at the first scene: there at the second;
  - only the place said;
  - nobody outside the cast, and nobody when nothing is carried;
  - a note on words that went is filed under the new scene, one on words that stayed is not;
  - one undo takes the scene, its people and its notes' filing back, and redo puts them back;
  - a join: a note on the scene joined in is filed under the scene that took it, and undo files it back.
- **`splitPeople.spec.ts`**, the writer's steps on the Page: a header typed above the scene, Ctrl+Shift+Enter, then the
  first half's `Place:` line changed. The first half's person is in the Cellar, the second half's in the Kitchen.

**Mutants**, in a separate worktree, gated on `tsc && eslint && echo MUTANT-OK && grep`. 7: 6 killed, 1 by the e2e, and
one equivalent:
- **killed:** the people not said (by the unit tests, and apart by the e2e); anyone, not the cast; said as a change and
  not a statement; a note not refiled in a split; a note not repointed in a join;
- **equivalent:** the first scene's status passed along with the place. `sayPerson` stores a facet only where it differs
  from the state before or is named in `says`; the status passed is the first scene's own, so it is never stored, and
  the record says the place alone either way.

## Not done here

- **A split made before this** keeps what it has. Its new scene has no records, and the header of a split that old has
  nothing to say it was one. Retyping a letter of its `Place:` line, as the writer found, records them.
