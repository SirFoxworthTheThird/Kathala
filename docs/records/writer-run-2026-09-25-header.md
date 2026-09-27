# Writer run — 2026-09-25 — is the scene header part of writing the scene?

Tip `7b23bbc` ("Say where a scene happens and who is in it, in one line", #481),
version 1.1.0, branch `claude/professional-tool-positioning-ew5ohh`. Production
build (`npm run build`, no `VITE_E2E`) served by `vite preview` on :4173, driven
with Playwright against `/opt/pw-browsers/chromium` at 1440×950, `deviceScaleFactor: 2`.
One session from an empty app. Records read straight out of IndexedDB with the
raw `indexedDB` API rather than through `window.__pwdb`, so everything below was
measured against the bundle as it ships.

**What I made:** *The Salt Assize* — a tide-city courtroom fantasy. Muren Hollow,
where a junior advocate defends a lighterman against a drowning charge and the
tide-table is the only witness that has never been paid. One chapter, four
scenes, **1,428 words**, six characters, three places, no map. Not the
glassmakers, not the noir.

---

## The answer

**It is a form.** Not because it is bracketed, and not because it sits at the
top — I stopped noticing the brackets by the second scene, and naming the room
before I wrote in it genuinely helped me commit. It is a form because of one
specific thing: **it is a validated field wearing prose.** The header and the
prose are the same `<textarea>`, so the line is rendered in the same serif at
the same 14px/22.75px in the same `rgb(225, 231, 239)` on the same background as
the sentence under it — measured, and unfixable in that element, since a
textarea has exactly one text style. And then it is validated like a form: a
missing letter deletes a character from the scene, a comma between two names
deletes a character from the scene, and a line of ordinary bracketed prose
deletes *your prose* and puts the header into your book. My hand could not tell
which of the two modes the box was in, because nothing on screen distinguishes
them.

The split is clean and worth stating as two verdicts, because the fix is
different on each side.

**The read direction is writing, and it is the best thing in the feature.** The
line is drawn from the records, and that half is exactly as advertised. I
changed the cast from the card picker and the line said so in **2.3 s**; I
removed somebody and it said so in **1.5 s**; I changed the Setting chip and the
line changed in **2.6 s**. I never touched the text and the text was right. That
reads as magic, not interference, and I could not produce the "stale draft wins"
failure the commit message describes as a false start — every path to the panel
goes through a click, and a click blurs the box first. That half is finished.

**The write direction is a form, and right now it is the most dangerous field in
the app** — the only one that can destroy prose. Three of the four things I did
to it by accident cost me data (**H-1**, **H-2**, **H-3**), and the one that
cost most produced the single outcome the design says is structurally
impossible: `[#Dogtooth Stair @@Teodora Vance @@Juno Skelling]` is a paragraph
of my manuscript, in the Markdown export, counted in my word count.

On the sub-questions the brief asked directly.

**Naming everyone at the top.** It helped, *once my cast existed*. Writing the
header first in scene two took **2.1 s** and I liked doing it — it settled the
room before the first sentence, which is a thing I do in a notebook anyway. But
in scene one, where I had invented nobody, it was a dead end: I typed the place
and two characters, and on blur **every word of it was discarded and the line
snapped back** (**H-5**). The header cannot create, and a new world contains
nothing for it to name. So the honest answer is that it helps you commit to a
cast you already have, and cannot help you invent one — which is the moment a
writer most wants to say who is in the room.

**Present and never named.** Yes, I wanted it, twice, without looking for it:
Mother Quill is the court's recorder, she is in two scenes, and the prose only
ever says "the recorder in the corner". The line gave it to me with no trick at
all — I typed `@@Mother Quill` in the brackets and that was the whole gesture.
It then held all the way through: the Continuity Checker does not complain about
her, Cast Balance credits her with 719 words of being in the room, search finds
no trace of her in the prose, and the export is clean. **This is the thing worth
protecting.** It is strictly better than the fourteen-backspace workaround the
previous run found, and nothing else in the app can say it.

**Did I believe it was not in my book?** No. I checked. The Manuscript view, the
word count, search for `[#` and `@@`, the Markdown export and the `.pwk` all
came back clean, and I believed it *afterwards*. Before checking I assumed it
was in there, because it looks exactly like a first line and the only cue is a
10px muted "416 words" readout 677px away. That instinct turned out to be right
for the wrong reason: it *can* get in there (**H-1**).

**Where it goes wrong.** On a typo it deletes somebody. On a name you have not
created it deletes what you typed. On a place that does not exist it is
merciful and keeps the old one — the right rule, applied to places and not to
people, in the same function.

---

## What stopped me — most costly first

### H-1 · A bracketed note eats the prose, empties the scene, and puts the header into the book — **reproduced**

This is the whole design's stated invariant failing, and it costs prose,
records, and the export all at once.

**What I did.** The ordinary thing: typed a note to myself in square brackets at
the top of a scene, the way you scribble in a margin. Then clicked away.

**What I expected.** A note at the top of my draft.

**What happened**, on a throwaway scene created for the second reproduction
(cast `Teodora Vance, Mother Quill`, setting *The Salt Court*, 10 words):

```
HEALTHY : present [Teodora Vance, Mother Quill]  place set  words 10
          prose  "The assize rose at noon and the water came back."
          box    "[#The Salt Court @@Teodora Vance @@Mother Quill]\n\nThe assize rose at n…"

type "[check: does the assize sit through low water or after it?]" on line 1, blur

AFTER   : present []                              place null words 17
          prose  "[#The Salt Court @@Teodora Vance @@Mother Quill]\n\nThe assize…"
          box    "[#The Salt Court @@Teodora Vance @@Mother Quill]\n\nThe assize rose at n…"
```

Four things happened and three of them are losses:

1. **My note is gone.** Not stored, not warned about, not recoverable from the
   box.
2. **The cast is empty and the setting is null.** Two people and a place, gone.
3. **The header is now prose.** It is in `sceneTexts.text`, in the word count
   (10 → 17), in the Manuscript view, and in the Markdown export. I downloaded
   the `.md` and grepped it:

   ```
   …that was how she knew the room had believed her.

   * * *

   [#The Salt Court @@Teodora Vance @@Mother Quill]

   The assize rose at noon and the water came back.
   ```

4. **The box looks identical before and after.** Same first line, same
   everything. Compare the two `box` lines above — they are the same string. The
   only tell on screen is the CHARACTERS section quietly emptying.

**Reproduced twice**, on two different scenes with different note text. The
first time it was not deliberate: I did it to scene two of my actual chapter
while trying something else, and `[#Dogtooth Stair @@Teodora Vance @@Juno
Skelling]` shipped into my manuscript. Screenshot `s42-leak-in-manuscript.png`
is that line set as the opening paragraph of *What the Stair Kept* in the
Manuscript view, above "The stair went down in eleven steps".

**The tell, when there is one.** Once it has happened, the box shows the header
**twice** — once rendered, once as the leaked prose:

```
"[#Dogtooth Stair @@Teodora Vance @@Juno Skelling]\n\n[#Dogtooth Stair @@Teodora Vance @@Juno Skelling]\n\nThe stair went down…"
```

That only appears after you put the cast back. While the cast is empty the
rendered header is `''` and there is one line, which is why I did not notice.

**Mechanism.** `splitSceneHeader` (`src/lib/sceneHeader.ts`) matches
`/^[ \t]*(\[[^\n\]]*\])[ \t]*(?:\r?\n)?/` — the first complete `[…]` on the
first line, whatever is in it. Its doc comment says *"Anything else is prose
that happens to start with a bracket, which is a thing prose does"*, but the
guard is on the *shape* and not on the *content*, and a note in brackets has the
shape. `parseSceneHeader` then finds no `@@` and no `#`, returns
`{place: null, characters: []}`, and `applyHeader` writes
`involvedCharacterIds: []`, `locationMarkerId: null`. `unknown` is empty, so
nothing is said. Meanwhile `handleChange` has already put the note in
`headerDraft` and everything below it in `draft`, so the note never reaches
`sceneTexts` and the real header line does.

The reachable-state test is worth spelling out: with **no** cast and **no**
place the rendered header is `''`, so the writer's own first line *is* line one
— that is a brand-new scene, which is exactly where a note-to-self goes. With a
cast, the note has to be typed *above* the rendered line, which is also where
you would put it.

**Cost to me.** Twelve words of my own text, a scene's cast and setting, and a
line of machine syntax in my book that I found by grepping an export. A writer
without a debugger finds this when they read their chapter back, and by then it
is in every copy they have made.

---

### H-2 · A header edit is lost on reload while the box says "Draft auto-saved" — **reproduced (paired)**

**What I did.** Typed a name into the header, waited for the save indicator to
settle, reloaded.

**What I expected.** The same thing the prose gets. `SceneDraftSection`'s own
comment says blur used to be the only way this box reached the database and that
*"the box holding the novel was the only one that could lose it"* — and then
fixes that for prose with a 1 s debounce plus an unmount flush.

**What happened.** The header still has exactly that bug, and the fixed prose
autosave now covers for it by printing a reassurance that is about the other half
of the box. Both halves in one run, at the tip:

```
type " @@Mother Quill" into the header, wait 3 s
  save indicator : "Draft auto-saved"
  line on screen : "[#The Salt Court @@Teodora Vance @@Mother Quill]"
  reload
  ABSENCE  → present [Teodora Vance]                  ← she is not there

same edit, press Tab to blur first, then reload
  PRESENCE → present [Teodora Vance, Mother Quill]    ← she is
```

**Mechanism.** The autosave timer calls `saveScene`, which writes
`latestDraft.current` — the **prose**, split out by `handleChange`. The unmount
effect flushes the same thing. `applyHeader` is called from `onBlur` and from
nowhere else. So reloading, closing the tab, or a crash keeps every word of the
prose and silently discards the declaration above it.

**Cost to me.** A whole scene. I wrote scene two's header first, wrote the
scene, and closed the browser; next time I opened it the prose was there and the
cast and setting were empty. I found out by reading IndexedDB, not by looking at
the screen — the line had simply gone, which looks like a scene that never had
one.

---

### H-3 · Following the notice's own advice, inside the brackets, empties the cast — **reproduced (×2)**

**What I did.** Typed `@@Sella` in the header for somebody who does not exist.
The app told me, under the caret, in its own words:

> Nobody called "Sella" yet — type a single @ to create them.

So I did that, in the place the advice was given.

**What happened.**

```
before Tab : "[#The Salt Court @@Teodora Vance @Juno Skelling]"
after  Tab : "[#The Salt Court @@Teodora Vance Juno Skelling ]"   ← the sigil is gone
after blur : "[#The Salt Court]"
records    : present []   (was [Teodora Vance])
warning    : Nothing in this world is called "Teodora Vance Juno Skelling"
             — the rest of the line was recorded.
```

The `@` picker is doing its job — it strips the sigil and inserts the plain name,
because in prose that is exactly right. Inside the brackets it **glues the new
name onto the previous one**, `parseSceneHeader` reads one name that nobody
answers, and the cast is emptied. Nothing was recorded, and the message says
otherwise while quoting a person who does not exist.

The first time I hit this I was not probing — it was my first ten minutes,
following the notice literally, and it took Teodora Vance out of scene one and
filed the created character as *mentioned* rather than present, which is the
opposite of what a header means.

**And it means the guide is wrong about the mechanism.** `docs/GUIDE.md` line
1070:

> …and cannot create anybody: **there is no picker inside the brackets** to
> catch a typo, so it says so instead of quietly dropping somebody.

There is a picker inside the brackets. `findMentionToken` runs on the whole
textarea value and does not know about the header, so `@@Mother Quill` inside
the brackets opens the character picker over the prose (`s23b-picker-in-header.png`)
and Enter commits it. That is *useful* — it is the only spell-check the line has
— but the doc says it is not there, and the notice it renders gives advice that
is correct for prose and destructive in the header.

**Same shape, cheaper, one more time.** Any name typed into the brackets without
its `@@` glues onto the one before it. The comma a writer naturally puts between
list items does it too (**H-4**).

---

### H-4 · A typo, or a comma, deletes a character from the scene — **reproduced (paired)**

The line is a declaration, so a name that leaves it leaves the scene. A typo is
not a declaration. Measured on scene two (`present [Teodora Vance, Juno Skelling]`,
place *Dogtooth Stair*), each edit applied and blurred:

```
[#Dogtooth Stair @@Teodora Vance @@Juno Skeling]     → present [Teodora Vance]
   notice: Nothing in this world is called "Juno Skeling" — the rest of the line was recorded.
   line after blur: "[#Dogtooth Stair @@Teodora Vance]"       ← the misspelt name is erased too

[#Dogtooth Stair @@Teodora Vance @@Juno Skelling]    → present [Teodora Vance, Juno Skelling]   (repair works)

[#Dogtooth Stair @@Teodora Vance, @@Juno Skelling]   → present [Juno Skelling]
   notice: Nothing in this world is called "Teodora Vance," — …

[#Dogtooth @@Teodora Vance @@Juno Skelling]          → present unchanged, place unchanged
   notice: Nothing in this world is called "Dogtooth" — …
```

Two things about this.

**The name is not left on the line to be corrected.** After blur the mistyped
name is gone from the box, so the repair is not "fix one letter" — it is "notice
the amber line, work out who is missing, retype the whole name". On a five-name
header that is a real hunt.

**The same function already knows better.** `applyHeader` keeps the existing
place when the header names one it cannot find, with this reasoning in the
source:

> A place the header names but the world does not have keeps the setting it
> had: the writer meant to put the scene somewhere, and clearing it would
> answer a typo by throwing away the answer.

That sentence is true of people word for word, and people are the case that
drops. One rule, applied to one of the two things it is about.

**Cost to me.** Small each time and constant. The comma one is the one I would
bet a writer hits first, because the rendered line uses spaces but nobody typing
a list of names from scratch knows that yet.

---

### H-5 · In a new world the header can name nothing, and discards everything you typed — **reproduced**

My actual first encounter, ten minutes into a fresh world that contained one
character and no places. I typed the header I wanted:

```
[#The Salt Court @@Teodora Vance @@Amaline Dusk @@Kesh Ardent-Bray]
```

2.4 s of typing. On blur the box read:

```
[@@Teodora Vance]
```

and underneath, in amber:

> Nothing in this world is called "Amaline Dusk" or "Kesh Ardent-Bray" or
> "The Salt Court" — the rest of the line was recorded.

The message is accurate and reasonably worded, but "the rest of the line was
recorded" is doing something unkind here: the rest of the line was *already*
recorded — Teodora was in the cast before I typed — so nothing at all happened,
and the sentence reads like a partial success. And everything I typed was
erased from the screen, so there is nothing to fix; I have to go and make three
records elsewhere and then type the line again from memory.

**The place half is worse, and it is not the header's fault.** There is no way
to create a place in a mapless world except by typing its name into the prose.
Maps → empty state still says:

> Places in Kathala are pins on a map, so **a scene can only be given a setting
> once the world has one.** Upload a picture of your world, start a blank map…

(`src/features/maps/MapExplorerView.tsx:1461`) — which has been false since
`dab1edc`, two commits earlier, and the screen offers *Add Map*, *Start a blank
map*, *Generate locations with AI* and nothing else. The scene card's
**+ Setting** chip is also withheld (`available: locationMarkers.length > 0`,
`EventCard.tsx:172`). So the only route to a first place is `@Name` in the scene
draft — and there the create rows are ordered *new character, new item, new
place*, with the first highlighted, so **Tab, the documented create gesture,
makes a character out of a place name**. I did exactly that twice in my first
pass and had to go and delete "The Salt Court" and "Dogtooth Stair" from my cast
(`s19b-place-picker.png`).

**Cost to me.** About eight minutes, two junk characters, and the conclusion —
which I held for a while — that `#Place` did not work.

---

### H-6 · The header leaves a character present **and** mentioned; `@@` does not — **reproduced (paired)**

The guide, on `@@`:

> If the character was recorded as merely mentioned, saying they are present
> replaces that rather than sitting beside it — **they cannot be both.**

They can, by the header. Same claim, two gestures, same scene, one run:

```
1. mentioned only          present [Teodora, Juno]        mentioned [Kesh Ardent-Bray]
2. promote via the HEADER  present [Teodora, Juno, Kesh]  mentioned [Kesh Ardent-Bray]   ← both
3. reset                   present [Teodora, Juno]        mentioned []
4. mentioned only          present [Teodora, Juno]        mentioned [Kesh Ardent-Bray]
5. promote via  @@  in prose  present [Teodora, Juno, Kesh]  mentioned []                ← correct
```

`handlePick` strips the mention explicitly, with a comment saying why.
`applyHeader` writes `involvedCharacterIds` and `locationMarkerId` and never
touches `mentionedCharacterIds`.

It is not theoretical: *The Court Takes the Tide* carries it in my finished
chapter, and it travels — the `.pwk` beside this file has
`involvedCharacterIds` and `mentionedCharacterIds` both containing Amaline Dusk
for that event. Nothing reports it. The Continuity Checker ran over the chapter
(1 observation, 4 warnings, 4.1 s) and said nothing about a character being in
two mutually exclusive lists.

---

### H-7 · Nothing says the line is not the book, and in that element nothing can — **measured**

Computed styles of the scene-draft textarea, which contains header and prose
together:

```
font-family : ui-serif, Georgia, Cambria, "Times New Roman", Times, serif
font-size   : 14px          line-height : 22.75px
color       : rgb(225, 231, 239)      background : rgba(0, 0, 0, 0)
```

Those are the header's values because they are the prose's values; it is one
`<textarea>` and a textarea has one text style. There is no background, no rule,
no gutter, no colour, no indent, nothing. The nearest cue is the word count —
`10px`, `rgb(148, 163, 184)`, at `x=677, y=240`, i.e. across the card and above
the box.

I am filing this as a measurement rather than a complaint about polish, because
the mechanism matters to whoever fixes it: **this cannot be styled where it
lives.** Distinguishing the line means an overlay, a separate control, or a
different editor — not a class.

The consequence I actually felt is **H-1**: because the line looks like a first
line, a first line looks like the line.

**A smaller side effect, same cause.** The prose box's placeholder —
*"Write or paste this scene's prose… (@ names a character, item or place; @@
says who is here)"* — is the only place in the app that names the sigils. A
textarea shows its placeholder only when empty, and a scene with any cast or any
place is never empty now. The first-run guide puts your first character into
your first scene, so on the world I built **the hint was invisible from the
first moment I opened the box** (`s11-expanded.png`: value `[@@Teodora Vance]\n\n`,
no placeholder). It reappears on a scene with no cast and no place
(`s19a-empty-box.png`). Presence and absence both seen.

---

### H-8 · Focus mode has no header at all — **reproduced**

The app calls Focus mode *"the best writing surface in the app"* and the card
promotes it with the only outline button in the row. Opened on a scene whose
card line reads
`[#The Salt Court @@Teodora Vance @@Amaline Dusk @@Kesh Ardent-Bray @@Mother Quill]`:

```
focus overlay value : "The Salt Court stood on piles, and at low water you could hear it thin…"
overlay chrome      : "The Court Takes the Tide" · "416 words" · "Esc to exit"
```

No header, and nothing else in the overlay says who is in the room or where the
scene is. `FocusMode` is handed `initialText={sceneText?.text}`, which is the
prose by definition.

The round trip is safe — I wrote a sentence in Focus mode, pressed Escape, and
came back to cast 4, place set, 420 words — so this is not a data finding. It is
the answer to "is the line part of writing the scene": in the surface the app
itself calls writing, it does not exist.

---

### H-9 · The unknown-name warning goes stale, and survives the one gesture the guide recommends — **reproduced (paired)**

```
1 header with a bad name       → "Nothing in this world is called "Nobody At All" — …"
2 delete the whole line, blur  → "Nothing in this world is called "Nobody At All" — …"   ← still there
     (line comes back correctly as "[#The Salt Court @@Teodora Vance]")
3 type a good header, blur     → (none)
```

The guide says deleting the line is how you clear your screen and that nothing
changes. Nothing does — except that the accusation stays on it, now describing
an edit that no longer exists. `applyHeader` returns at `if (!header) return`,
which is *before* `setHeaderUnknown(unknown)`, so the no-header path cannot
clear the message it left behind.

---

### H-10 · The guide says joining the cast makes the Writer's Brief list them; it does not — **reproduced (paired)**

> Two say the character is present, and they join the scene's cast: the map
> places them, **the Writer's Brief lists them**, and the Character States panel
> starts asking what state they are in.

At the *Low Water at Four Eleven* cursor, cast of five put there by the header:

```
ABSENCE  (Amaline in the cast, no snapshot)   Brief → CHARACTERS | 1 | Teodora Vance | carried forward
record Amaline's state in that scene
PRESENCE (snapshot recorded)                  Brief → CHARACTERS | 2 | Amaline Dusk | Teodora Vance | carried forward
```

`WritersBriefPanel.tsx:196` is explicit — *"Characters present this chapter
(have a snapshot)"* — and builds the list from `useBestSnapshots`, not from the
cast. The third clause of the guide sentence is true; the second is true only
after you have answered the Character States panel. I did not test the map half
(my world has no map) and am not claiming anything about it.

This is not a header defect, but the header makes it routine: five names in one
line is now five cast members and one Brief entry, where before you would have
added them one at a time and probably recorded a state as you went.

---

## What I only suspect

Separate on purpose. Each of these is a guess.

**G-1 — that the header's real cost is downstream, in snapshots.** Typing five
names took 3.5 s and produced five *"no state recorded — record it"* rows in the
Character States panel, and the Continuity Checker's four warnings are all
"appears before any snapshot record" for people the header put in scenes. The
line makes asserting presence nearly free and leaves the expensive half exactly
where it was, so it may simply move the backlog rather than reduce it. **I did
not measure this over a book** — one chapter is not evidence about a debt that
accumulates. *Settled by:* someone drafting ten chapters with the line and then
counting how many scenes have a full cast and no snapshots, against a run
without it.

**G-2 — that H-1 is undiscoverable without reading the database.** I believe a
writer finds the leak only on reading their chapter back or opening an export,
because the box is byte-identical before and after and the Continuity Checker
says nothing. I cannot test my own noticing, and I found it by grepping.
*Settled by:* give somebody the build, ask them to draft a scene with a
bracketed note in it, and see whether they mention it unprompted.

**G-3 — deleted characters leave ghost ids in `mentionedCharacterIds`.** Not a
header finding, found in passing. `deleteCharacter`
(`src/db/hooks/useCharacters.ts:75`) cascades over snapshots, movements,
memberships, goals and relationships and never touches `events`. Two characters
I deleted early are still ids in *The Court Takes the Tide*'s mentioned array
and travel in the `.pwk`. Every view I looked at maps ids to records and drops
the misses, so nothing renders wrong — **I did not find anything that misreads
them**, and the `involvedCharacterIds` half would be self-repairing under the
header anyway. *Settled by:* check whether any count or export path uses
`.length` on those arrays rather than the resolved names.

**G-4 — whether the picker firing inside the brackets is intended.** The guide
says it is not there, the behaviour says it is, and the behaviour is the better
of the two. I do not know which was meant, and that decides whether H-3's fix is
in the parser or in the picker. *Settled by:* ask.

---

## What worked, honestly

Things I would protect from a fix to the above.

- **The read direction is finished and it is the reason to keep the feature.**
  Cast picker add → line updated, **2.3 s**. Row remove → **1.5 s**. Setting
  chip changed to *The Lighterman's Rest* → line said `[#The Lighterman's Rest …]`
  in **2.6 s**, and back again. One copy of the fact, and the line is a view of
  it, exactly as the commit claims.
- **The "stale draft wins" failure the commit describes as a false start is
  genuinely fixed, and I could not reach it.** Every route to the cast panel,
  the Setting chip and the picker goes through a click, and the click blurs the
  box first, so a record change always reaches the line. Two drafts rather than
  one is doing real work.
- **Present and never named works end to end.** `@@Mother Quill` in the
  brackets, and she is in two scenes whose prose never says her name. Continuity
  Checker: silent about her, correctly. Cast Balance: 719 w, where without it
  she would read "never appears". Search for her name: the character record, no
  scene hits. This is the one thing no sigil could say and it needed no trick.
- **When it works, the line really is not in the book.** Manuscript view: 1,428
  words, no `[#`, no `@@`. Search: *No results for "@@"*, *No results for "[#"*.
  Markdown export and the `.pwk` beside this file: clean, verified
  programmatically across all four `sceneTexts`.
- **Deleting the line changes nothing and it comes back**, exactly as
  documented. Measured: records unchanged, `[#Dogtooth Stair @@Teodora Vance
  @@Juno Skelling]` back on the next paint.
- **An unknown *place* keeps the setting it had.** The merciful branch, and the
  right call. It is only a finding because people do not get the same treatment.
- **Unmapped places render in the line.** All three of my places have
  `mapLayerId: null` and `[#The Salt Court …]` is correct on every scene — the
  two commits fit together.
- **The Continuity Checker's prose-vs-record catch is still good.** *"Hollis Rem
  is named in the prose but not in the cast"* with wording that distinguishes
  mention from presence, on the one character where that is exactly the right
  question (he is the corpse).
- **Nothing was slow.** Cold loads 2.4–2.9 s; chapter detail and Manuscript
  under 3 s; Continuity 4.1 s; the mention picker appeared and took Enter
  without ever making me wait mid-sentence in 1,428 words.

---

## What I would fix, in order

1. **Stop `splitSceneHeader` claiming a bracket that asserts nothing** (H-1). A
   `[…]` containing no `#` and no `@@` is prose. That one condition removes the
   prose loss, the cast wipe and the leak into the manuscript, and it is the
   only finding here that puts machine syntax in a book.
2. **Apply the header on the same autosave the prose gets**, or say plainly that
   it has not been applied (H-2). "Draft auto-saved" under an unsaved
   declaration is the app telling me it has kept something it has not.
3. **Make the brackets safe for the picker** (H-3). Either the picker keeps the
   `@@` inside a header, or the header notice stops recommending a gesture that
   empties the cast there.
4. **Keep a name the header cannot match, the way the place is kept** (H-4).
   Same function, same reasoning, two lines apart.
5. **Let the header do what the line above it says** — `@`-create from inside
   the brackets, or at least do not erase what was typed (H-5).
6. **Strip the mention when the header asserts presence** (H-6), so both routes
   make the same claim.
7. **Say which half of the box is the book.** (H-7) Not a class; a decision.

And one thing I would *not* build: a second way to declare the cast. The Add
Scene dialog already asks for characters and setting before the scene exists,
the card asks again, and the line asks a third time. The line is the best of the
three because it is where the writing is. It should replace one of the others,
not join them.

---

## Artefacts

- Export: `/home/user/PlotWeave/docs/records/writer-run-2026-09-25-header.pwk`
  — `type: full`, version 18, 32 KB. 6 characters, 1 chapter, 4 events, 4
  `sceneTexts`, **1,428 words**, 3 `locationMarkers` (all `mapLayerId: null`), 2
  `characterSnapshots`, 8 `sceneRevisions`, 5 tombstones. No `[#` or `@@` in any
  scene's prose. Carries the H-6 contradiction (Amaline Dusk present *and*
  mentioned in *The Court Takes the Tide*) and the G-3 ghost ids, deliberately
  left in as evidence.
  The export needed the workaround earlier runs recorded: headless Chromium
  auto-rejects `showSaveFilePicker` with `AbortError`, which the app correctly
  reads as *cancelled*, so `page.addInitScript(() => delete window.showSaveFilePicker)`
  before the load drops it to the anchor-download path.
- Screenshots in
  `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/drive/shots/`:
  - `s42-leak-in-manuscript.png` — H-1: the header set as a paragraph of the book
  - `r02-leak-repro.png` — H-1, second reproduction
  - `s27a-typed-saved.png` — H-2: "Draft auto-saved" over an unsaved declaration
  - `r07a-notice-in-header.png` / `r07b-glue.png` — H-3: the advice, and what following it does
  - `s38a-typo.png` / `s38b-commas.png` — H-4
  - `s12c-header-typed.png` / `s12d-after-blur.png` — H-5: the whole line typed, and discarded
  - `s51a-present-and-mentioned.png` — H-6, on the finished chapter
  - `s23b-picker-in-header.png` — the picker the guide says is not there
  - `s47a-focus.png` — H-8: Focus mode, no header
  - `r08-stale-warning.png` — H-9
  - `s18-maps.png` — H-5: the Maps empty state that still says places are pins
  - `s36a-manuscript.png` — the chapter read back clean, when it works
  - `s55-continuity.png` — the checker on the finished chapter
- Markdown export used for the H-1 grep:
  `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/drive/dl/salt-assize-leak.md`

*H-1 through H-10 were each reproduced in the running app; H-1 and H-3 twice on
independent scenes, and H-2, H-4, H-6, H-9 and H-10 as paired
absence/presence tests in a single run. H-7 is a measurement. G-1 to G-4 are not
reproduced to that standard and are labelled as guesses. Throwaway scenes (`ZZ
Bracket Probe`, `ZZ Leak Probe`, `ZZ Sigil Probe`) were deleted afterwards; the
book is back to 4 scenes and 1,428 words. I searched `docs/records/ux-review.md`
for* header, bracket, scene header, present and mentioned, dangling, location
type, Writer's Brief *before filing, and found nothing on this feature, which is
one commit old.*
