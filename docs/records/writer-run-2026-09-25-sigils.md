# Writer run — 2026-09-25 — does typing presence feel like writing?

Tip `7730a10`, version 1.1.0, branch `claude/professional-tool-positioning-ew5ohh`.
Production build (`npm run build`) served by `vite preview` on :4173, driven with
Playwright against `/opt/pw-browsers/chromium`. One session, from an empty app.

**What I made:** *The Ash Road* — a mountain-village glassmakers' chapter,
four scenes, **1,638 words**, five characters. Genre: rural/folk fantasy, no
noir anywhere near it. Export and screenshots at the bottom.

---

## The answer

Typing presence felt like writing about a third of the time and like filing the
rest, and the split was not where I expected it. **The gesture itself is
right.** `@@` rode along with the sentence instead of interrupting it — the
picker was on screen 4–11 ms after the last keystroke (six samples, in a
383-word scene of a 1,638-word chapter), Enter took it, and by the third scene
my hands were doing it without me. Twice I reached for `@@` before I had
finished deciding the sentence, which is exactly the behaviour the idea is
betting on. But three things kept turning it back into filing. **It writes the
wrong words into the prose** — `@@Wren` inserts *"Wren Halloway"*, and adding
*Wren* as an alias does not change that, so in a book where nobody says her
surname I deleted it by hand, nine characters at a time, every time. **It goes
silent exactly where it is most wanted** — the first appearance of a character
is the moment you most want to say who is in the room, and that is precisely
the moment `@@` does nothing and says nothing, because the person does not
exist yet. **And afterwards it contradicts itself** — the scene card I was
writing in went on showing the old cast, so after four scenes of diligent `@@`
the card for *The Officer's Ledger* said the scene had no cast at all while the
panel four inches to the right listed all three people correctly. I only knew
the feature had worked because I read IndexedDB. A writer without a debugger
would have concluded `@@` was broken and gone back to the panel — and then, by
using the panel, would have silently destroyed everything `@@` had recorded.
So: keep the idea. The slice is not finished.

On the two sub-questions the brief asked about directly. **The dissolving
helps.** I never once wanted to see the marks in the prose; reading the chapter
back in the Manuscript view it is clean text, and the export contains no `@`
anywhere. Not being able to see which names I asserted was not unnerving,
because "who was in this scene" is answered without opening anything, by the
Character States panel and the collapsed scene rows. The unnerving part was not
the missing marks — it was the card disagreeing with them. **The distinction
between one sigil and two is learnable but not checkable.** I never once had to
think about which was which while typing; I *frequently* wanted to confirm what
I had just done, and there is nowhere to look. On a fully-typed existing name
the two pickers are identical — same single row, same icon, same *character*
badge (`cmp-single.png` / `cmp-double.png` differ only in the create rows,
which vanish for an exact match). The only thing on screen that distinguishes
*mention* from *in the room* is one extra `@` in the prose behind the popup.

---

## What stopped me — findings, most costly first

### S-1 · The card `@@` was typed on never sees it, and then overwrites it

**Highest cost by a distance: this is silent loss of the exact assertions the
feature exists to make.**

**Half A — the display.** From a freshly loaded page, with card and store in
agreement, I expanded *What Sal'ka Carried* and typed `@@Idri` + Enter.

```
store  : {"present":["Wren Halloway","Sal'ka"],   "mentioned":["Bell-Anselm","Idrisa Coom"]}
card   : CHARACTERS | Sal'ka | Wren Halloway | MENTIONED | Bell-Anselm | Idrisa Coom
  ... @@Idri ⏎ ...
store  : {"present":["Wren Halloway","Sal'ka","Idrisa Coom"], "mentioned":["Bell-Anselm"]}
card   : CHARACTERS | Sal'ka | Wren Halloway | MENTIONED | Bell-Anselm | Idrisa Coom
card after 3 more seconds:  (unchanged)
```

The store is right; the card is wrong and stays wrong. It is correct again
after a full page reload. Reproduced twice — once mid-draft, once from a clean
load specifically to rule out an earlier stale state.

The worst single picture is `sc2-card-cast.png`: the right-hand **Character
States** panel reads *The Officer's Ledger — 3 · Idrisa Coom, Wren Halloway,
Yevet*, while the scene card on the same screen has **no CHARACTERS section at
all** (`+ Characters` sits among the empty ADD chips), shows *MENTIONED: Yevet
×*, and offers *"Named in the text — click to record as mentioned: + Idrisa
Coom"*. Three claims, all wrong, all beside a panel that is right.

**Half B — the loss.** `EventCard` keeps `involvedIds`/`mentionedIds` as
`useState` seeded from the prop (`src/features/timeline/EventCard.tsx:56-57`),
re-synced only in `startEdit`, `cancelEdit` and `saveEdit` (lines 182, 237 and
the save block). The `@@` write lives in `SceneDraftSection.handlePick` and
calls `updateEvent` directly; it never touches those setters. So every later
use of the card's own controls writes the stale array back over the store.

Measured, twice, both with the card's ordinary `+ Add character…` picker:

```
before: present = [Wren Halloway, Sal'ka]                     (both set by @@)
add "Idrisa Coom" from the card picker
after : present = [Idrisa Coom]                                ← Wren and Sal'ka gone
```

```
before: present = [Wren Halloway, Sal'ka, Idrisa Coom]  mentioned = [Bell-Anselm]
add "Bell-Anselm" from the card picker
after : present = [Wren Halloway, Sal'ka, Bell-Anselm]  mentioned = [Bell-Anselm]
        ← Idrisa gone; Bell-Anselm now present AND mentioned
```

There is no warning, no toast, nothing on screen changes except a name
appearing. Toolbar undo restores it, but only if you know to look. The picker
even *offers* people who are already in the cast, which is the visible tell —
and reads as the app helpfully listing everyone.

**Half C — the same bug produces the state the design forbids.** The guide says
of present and mentioned: *"they cannot be both."* They can, by two ordinary
routes, and I hit the first one without trying, inside twenty minutes of
writing:

- `@Bell-Anselm` (creates, mentions) → `@@Bell-Anselm` (promotes; store removes
  the mention) → later in the same scene `@Sal'ka` (creates, mentions). That
  last write uses `EventCard`'s stale `mentionedIds`, which still contains
  Bell-Anselm, so he is resurrected into MENTIONED while remaining in the cast.
  `sc1-both-lists.png` shows *Third Firing* with **Bell-Anselm in CHARACTERS
  and Bell-Anselm × in MENTIONED**, simultaneously.
- One click on the *"Named in the text — click to record as mentioned"* chip
  for somebody the store already has as present. Measured: before
  `present:[Wren, Sal'ka], mentioned:[]`; after one click on the Wren chip,
  `mentioned:["Wren Halloway"]`. The chip's own tooltip reads *"…If they are in
  the room, add them to the cast instead"* — she is in the room and in the
  cast; the card just cannot see it.

Nothing reports the contradiction. The Continuity Checker ran on this chapter
and produced *1 observation, 4 warnings* — four "no snapshot yet" notices and
one genuinely useful prose-vs-record catch — and said nothing about a character
being in two mutually exclusive lists in the same scene.

**Cost to me:** I wrote all four scenes believing the feature had probably not
worked, checking the right-hand panel each time to reassure myself. Then I
destroyed two scenes' worth of presence with two ordinary clicks and did not
notice either until I read the database.

---

### S-2 · `@@` on a character who does not exist does nothing, and says nothing

Third paragraph of scene one. I typed `@@Bell-Anselm` for a boy who had not
been invented yet.

```
rows after "@@Bell-Anselm": []
prose: "…which was how Wren knew this firing was hers.\n\n@@Bell-Anselm"
```

No picker, no row, no message (`w05-double-unknown.png`). The prose keeps a
literal `@@Bell-Anselm`. The limit is deliberate and documented — `@@` sets
`allowCreate:false` and `kinds:['character']`, so `matches.length === 0` and
`SceneDraftEditor` renders nothing — but the *silence* is not designed, it is
just what falls out of rendering nothing. It looks exactly like having finished
typing a name.

The recovery is worse than the failure. Repairing `@@Bell-Anselm` to
`@Bell-Anselm` by arrowing back twelve and pressing Backspace leaves the caret
*before* the surviving `@`, so no token is found; pressing End does not reopen
the picker either, because `refresh` only runs on change and on click. I had to
delete and retype the last letter to wake it. Full sequence for one character's
first appearance:

1. `@@Name` — nothing happens
2. arrow back, delete a sigil, retype a letter to wake the picker
3. **Tab** to create (Enter refuses, rightly)
4. delete the name it just inserted
5. `@@Name` again, **Enter**

The second time (Sal'ka) I skipped ahead to the learned two-step — `@Name` to
create where she first appears, `@@Name` a few sentences later where she speaks
— which is tolerable, and is what I would do from now on. But it has to be
learned by failing, and the failure is invisible.

---

### S-3 · At the moment of choosing, the two sigils look the same

With a partial query the lists differ, because `@` appends create rows:

```
"@Idrisa"   -> [Idrisa Coom | character, Idrisa | new character, Idrisa | new item]
"@@Idrisa"  -> [Idrisa Coom | character]
```

With the name fully typed — which is what happens whenever you are naming
somebody who already exists, i.e. most of the time — they are identical,
because the `taken` guard suppresses the create rows:

```
"@Idrisa Coom"   -> [Idrisa Coom | character]
"@@Idrisa Coom"  -> [Idrisa Coom | character]
```

Same row, same icon, same *character* badge, same highlight. Nothing says which
claim Enter is about to make. When I made the slip S-4 is about — a `@@` I
meant as `@` — there was nothing on screen to catch it, and nothing after it
either, because of S-1. I found it by querying IndexedDB.

A word in the row would fix it: *in the room* on the `@@` rows, or a one-line
header over the list. It does not need a new mechanism.

---

### S-4 · The documented repair for a slip does not work where slips happen

`SceneDraftSection.tsx:114` states, of the presence write: *"One `updateEvent`,
so one journal operation: a mistyped `@@` is a single Ctrl+Z, not two."* The
toolbar's own tooltip advertises the shortcut:

```
Undo: Edited scene "What Sal'ka Carried" — involved characters and mentioned characters (Ctrl+Z)
```

Measured. I typed `@@Bell` in a scene Bell-Anselm is not in, pressed Enter,
then pressed Ctrl+Z with focus still in the prose box:

```
after slip : present = [Wren Halloway, Sal'ka, Bell-Anselm]
after Ctrl+Z in the prose box : present = [Wren Halloway, Sal'ka, Bell-Anselm]
prose unchanged as well
```

Nothing happened — not the record, not the text. Mechanism is explicit and
deliberate: `AppShell.tsx:121-131` returns early when the event target is an
`INPUT`, `TEXTAREA` or contenteditable, on the reasoning that *"inside a text
field the browser's own undo is the one the user means"*. That reasoning is
sound for typing, but the prose box is now the only place in the app where you
can assert presence, and the browser's native undo is inert against a
React-controlled `value`, so Ctrl+Z there does nothing at all.

Clicking the toolbar button works perfectly and the tooltip is genuinely good.
The defect is that a comment and a tooltip both promise a keystroke that is
switched off in the one place the mistake is made.

---

### S-5 · The picker inserts the record's name, not the word you were writing

This is the thing that most made it feel like filing, and it is the cheapest to
fix.

`select()` inserts `suggestion.name + ' '` — always the canonical record name.
My apprentice is recorded as *Wren Halloway*; nobody in the book calls her
that. So:

```
"I know what it is." Wren Halloway did not look up.
```

I had to go back and cut the surname. I tried the obvious remedy — I gave her
the alias *Wren* on the Characters screen (a 1.7 s navigation plus an edit
form) — and it changed nothing:

```
"@@Wren" -> [Wren Halloway | character]      ← the alias matches
pick     -> inserts "Wren Halloway "         ← the alias is not what is written
```

`rank()` searches aliases; `select()` ignores them. So there is no way to have
the picker write the name your prose actually uses. Three times in 1,638 words
I had to undo the app's edit to my own sentence — nine backspaces, plus
attention to the trailing space it adds (my first attempt left *"Wren  went
up"* with a double space). That is small each time and it is exactly the kind
of small that decides whether a gesture feels like writing.

Suggested: insert the matched alias when the match was on an alias. One line,
and it would change the character of the whole feature.

---

### S-6 · Names with a lowercase particle or a digit cannot be created at all, silently

My excise officer is *Yevet du Marr*. The token dies at the particle:

```
"@Yevet"          -> [Yevet | new character, Yevet | new item]
"@Yevet "         -> [Yevet | new character, Yevet | new item]
"@Yevet d"        -> []
"@Yevet du"       -> []
"@Yevet du Marr"  -> []
```

`@@Yevet du Marr` likewise: nothing, and a literal `@@Yevet du Marr` left in
the prose. I created him as **"Yevet"**, wrote *du Marr* by hand, and renamed
him on the Characters screen afterwards (5.2 s round trip). The same rule
catches props, where it bites harder because props are common nouns:

```
"@ash ledger"     -> []                                   ← the first prop I tried to name
"@Ash Ledger"     -> [Ash Ledger | new character, new item]
"@pontil"         -> [pontil | new character, new item]
```

and real catalogued names from the repo's own fixtures:

```
"@Nimbus 2000" -> []   "@Mirror of Erised" -> []   "@Rupert of Hentzau" -> []
"@Castle of Zenda" -> []   "@Flourish and Blotts" -> []
```

Measured over the four `.pwk` fixtures in `src/test/fixtures/worlds/` (the
`Kathala-Library` repo is not checked out in this environment, so I could not
use the 21 shipped worlds): **4 of 100 character names, 6 of 51 item names and
12 of 140 location names** cannot be created from the picker. That is a modest
percentage over an already Title-Cased catalogue; the figure in a writer's own
draft will be much higher, because I hit it on the second character I invented
and on the first prop I tried to name.

**On `W19-2`, which I checked before filing.** I am *not* saying it was closed
wrongly. Its close note is accurate: the lowercase clause keeps *Renée de
Saint-Méran* **selectable**. What it does not say is that the same names remain
**un-creatable**, and creation was the finding's own stated purpose — *"what
was impossible was the one thing the picker exists for — creating a record
without leaving the sentence."* The residue was real and was not recorded. It
matters more now than it did then, because `@@` deliberately cannot create, so
every `@@` depends on `@`-create having worked first.

---

### S-7 · The nudge chips invite you to contradict yourself

Same root cause as S-1, but a one-click path with an encouraging label. On a
card that has had `@@` used on it, the *"Named in the text — click to record as
mentioned:"* row lists people who are already present:

```
Sal'ka · Wren Halloway · Bell-Anselm · Idrisa Coom     (Wren and Sal'ka are in the cast)
```

Clicking one writes it into `mentionedCharacterIds`, producing the
present-and-mentioned state. `addMention`'s guard (`if
(involvedIds.includes(id) || mentionedIds.includes(id)) return`) reads the same
stale arrays, so it cannot stop it.

---

## What I only suspect

Kept separate on purpose. Each of these is a guess.

**G-1 — an alias does not suppress the duplicate-create row.**
`@Wren`, with *Wren* an existing alias of *Wren Halloway*, offers *"Wren | new
character"*. The mechanism is visible: `mentionSuggestions` builds
`taken` from `candidates.map(c => c.name…)` and never looks at `c.aliases`,
while `rank()` does. **I did not produce a duplicate.** I pressed Tab on that
token and it took the *existing* row, because `highlight` defaults to 0 and the
existing match sorts first — so creating the duplicate needs a deliberate
ArrowDown. My suspicion is only that a writer who aliases short forms will
eventually arrow onto it, and that the row should not be there. *Settled by:* a
unit test that an exact alias match suppresses the create row, paired with one
that a non-matching query still offers it.

**G-2 — the Character States panel may cap its rows.**
In `sc1-both-lists.png` the *Third Firing* section reads **3** and I can see two
names; *The Officer's Ledger* reads **3** and shows two. Every text dump I took
listed all of them, so this may be nothing more than the section being cut off
by the viewport in that particular screenshot. I did not chase it because it is
not about the sigils. *Settled by:* open a chapter with a four-person scene at a
known viewport and count rendered rows against the count badge.

**G-3 — whether `@@` would be found by someone who was not told.**
I cannot test my own discovery, since the brief told me. What I can say is
where it is named: the placeholder, *"(@ names a character or item; @@ says who
is here)"* — and a placeholder is only visible in an **empty** prose box. From
the second paragraph of the first scene onward, nothing on any screen mentions
`@@` again. The guide describes it well, but the guide is not open while you
write. *Settled by:* give it to someone with the guide closed and watch scene
two.

**G-4 — whether the silence in S-2/S-6 is read as "nothing to offer" or as
"I have finished typing the name".** I know it cost me a repair each time; I
don't know which mental model a writer forms, and that decides whether the fix
is a message or a different token rule. *Settled by:* two writers, unprompted.

---

## What worked, honestly

These are the parts I would protect from a fix to the parts above.

- **It does not interrupt the sentence.** Picker visible **4, 5, 5, 6, 6 and
  11 ms** after the last keystroke, measured six times in a 383-word scene of a
  1,638-word chapter. Typing 66 characters of ordinary prose through the React
  controlled textarea took 377 ms. At no point in 1,638 words did I wait for
  the app.
- **The dissolving is complete and verifiable.** No `@` survives anywhere:
  checked programmatically across all four `sceneTexts` in the exported `.pwk`
  (`any @ left in prose: false`), and the Manuscript view reads as clean
  typeset prose (`manuscript.png`).
- **`@@` alone is a better cast picker than the cast picker.** Two keystrokes
  and the whole cast is under the caret, characters only, no create rows to
  arrow past, Enter takes it (`probe-double-empty.png`). If the rest of this
  were fixed, that alone would earn the feature.
- **Tab-not-Enter holds.** I pressed Enter for paragraph breaks constantly,
  including immediately after names, and never once invented a character. The
  `W23-4` fix is doing real work.
- **Three-or-more sigils is not a token.** `@@@Wren` → nothing, so an emphatic
  or a typo cannot half-assert something.
- **The Continuity Checker earned its place.** It found the one thing I
  genuinely missed — *"2 names in the prose of 'What Sal'ka Carried' are not in
  its cast: Bell-Anselm (2×), Idrisa Coom (2×)"* — with wording that
  distinguishes mention from presence, and a *Record all 2 as mentioned* button
  that did exactly the right thing.
- **Undo tooltips name the scene and the fields changed.** *"Undo: Edited scene
  'What Sal'ka Carried' — involved characters and mentioned characters"* is the
  reason I could repair the damage in S-1 at all.
- **The Character States panel was the one surface that never lied.** Every
  time I doubted whether `@@` had worked, it was right.
- **The `@` picker's create flow is genuinely pleasant** when the name is a
  plain capitalised run. `@Idrisa Coom` + Tab made the record, filed her as
  *mentioned* rather than present, and returned me to the sentence. That is the
  feature working as advertised, and it is the reason the `@@` idea is worth
  finishing.

---

## Where I wanted to say something the syntax could not

Recorded as observations, not as requests.

- **Somebody leaving.** Scene three: Sal'ka steps off the road and is gone nine
  steps later, and Wren is alone for the last three paragraphs. There is no way
  to say that, and **I minded less than I expected**, because presence is per
  scene and the scene is the unit I actually think in. If I had needed it I
  would have split the scene, which is what I would do anyway. **I would not
  build a departure sigil.**
- **Present but unnamed.** Scene two: Wren is on the stairs, listening, and the
  prose deliberately does not name her. `@@` cannot say this, because picking
  writes the name. There *is* a workaround and it works: type `@@Wren`, Enter,
  then delete the fourteen characters it inserted. The record stands, the prose
  stays anonymous, total keystroke time about 1.3 s. It felt like a trick I had
  discovered rather than something the app offered. This is the one place I
  wanted a *command* rather than a completion.
- **Mentioned in one paragraph, present in another.** Scene four: `@Idrisa` in
  the opening line (she is being talked about), `@@Idrisa` at midnight when she
  comes down the stairs. The second replaces the first, which I think is
  correct — by the end of the scene she *is* in the room, and that is the true
  statement about the scene. But note it is only correct in that order. `@@`
  then `@` leaves her as both (S-1, half C), and that is the order a writer will
  hit whenever a character arrives early and is discussed later.

---

## Should `#Place` and `^Item` be built?

**Not yet, and `^Item` probably not in this form.** Five reasons, in order of
how much they weigh.

**1. The presence slice is not finished.** The app currently disagrees with
itself, on one screen, about what `@@` recorded (S-1), and an ordinary click
destroys it. Adding two more sigils triples the number of assertions made
through a path the scene card does not see and then overwrites. Whatever else
happens, S-1 has to be fixed before anything else writes through `handlePick`.

**2. The token grammar is built for proper names, and props are not proper
names.** `#Place` would mostly be fine — places tend to be capitalised. `^Item`
would not: the first prop I tried to name in my own chapter was *the ash
ledger*, and `@ash ledger` returns nothing, silently. 12% of item names in the
repo's own Title-Cased fixture books are already un-creatable, and a working
draft is far worse than a catalogue. A sigil that silently fails on the
majority of a writer's props will teach them not to use it in a week.

**3. `#Place` cannot work at all in a world without a map.** `canCreateLocation
= mapLayers.length > 0`, and the picker rightly withholds the row — my own
world had no map, so *place* never appeared in the placeholder or the list. Most
writers do not have a map in week one. And `handlePick` deliberately declines to
overwrite an existing `locationMarkerId`, so `#Place` in a scene that already has
a place would be a silent no-op too. That is a sigil whose common case is doing
nothing without saying so — the third such case in the same box.

**4. `^Item` has a semantics problem `@@` did not have.** `@@` asserts one bit:
in the room. The brief's own phrasing — *"this item is in the scene / in her
hands"* — is two different records (`involvedItemIds` versus a character's
snapshot inventory) and the second one needs a *whose*. One sigil cannot say
which, and guessing from the sentence is precisely the thing this design
correctly refuses to do. If `^` is built it should mean exactly one of those,
stated plainly, and the other should stay in a panel.

**5. The evidence for the thesis is not in yet.** The bet is that bookkeeping
expressed in the act of writing beats a panel beside it. I believe that bet —
`@@Idri`⏎ genuinely is better than opening a picker — but I cannot yet confirm
it, because on this build I could not *see* that it had worked without a
debugger. Fix S-1, S-2, S-3 and S-5 and give a writer a fortnight with `@@`
alone; if they stop touching the cast picker, that is the answer, and then
`#Place` is worth doing.

**What I would build before a third sigil**, in order:

1. Make the scene card read the event rather than a copy of it (S-1). This is
   one defect producing four symptoms, including data loss.
2. Say something when a sigil finds nothing (S-2, S-6) — a single line under the
   caret would do: *no character called Bell-Anselm — press `@` to make one*.
3. Insert the matched alias instead of the canonical name (S-5). Smallest change
   here, largest effect on whether it feels like writing.
4. Put *in the room* on the `@@` rows (S-3).
5. Either honour Ctrl+Z in the prose box for the last sigil write, or stop the
   comment and the tooltip claiming it (S-4).

---

## Artefacts

- Export: `/home/user/PlotWeave/docs/records/writer-run-2026-09-25-sigils.pwk`
  — `type: full`, version 18, 5 characters, 4 events, 4 `sceneTexts`, 1,638
  words, no `@` in any scene's prose.
  The export hit the `showSaveFilePicker` `AbortError` earlier runs recorded —
  headless Chromium auto-rejects the picker and the app correctly reads
  `AbortError` as *cancelled*, so nothing happens. **I used the same
  workaround:** `page.addInitScript(() => delete window.showSaveFilePicker)`
  followed by a full document reload (a hash-route `goto` does not re-run init
  scripts), which drops the app to its anchor-download path.
- Screenshots, in
  `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/shots/`:
  - `sc2-card-cast.png` — S-1: the panel right and the card wrong, one screen
  - `sc1-both-lists.png` — S-1C: Bell-Anselm in CHARACTERS *and* in MENTIONED
  - `w05-double-unknown.png` — S-2: `@@Bell-Anselm` with no picker and a literal sigil left in the prose
  - `cmp-single.png` / `cmp-double.png` — S-3: the two pickers
  - `probe-double-empty.png` — `@@` alone, the whole cast under the caret
  - `manuscript.png` — the chapter read back, clean
  - `continuity.png` — the checker's prose-vs-record catch
