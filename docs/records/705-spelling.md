# Spelling: the desktop app's corrections, and the world's own names (issue #705)

**Asked:** in the desktop app, a way to act on the spell checker's underline, with its languages chosen; the world's
names known as words; a misspelt name caught (*Teodroa* for *Teodora*); and the guide to say what is checked where.
The measurements and decisions are in `spelling-plan.md`, D-1 to D-7.

**Code:**
- `src/lib/nameSpelling.ts` (pure):
  - the world's names and their single words, possessives off;
  - the edit distance (letters added, dropped, changed, and two beside each other swapped), with a cutoff;
  - the near-miss rules (`NEAR_MISS_RULES`, `DERIVED`), a word's near miss, and every near miss in a text;
  - how often the book uses a word;
  - the name put in a word's place, in capitals where the word was.
- `src/db/hooks/useNameSpelling.ts`:
  - `worldNameSource`, the world's people, places, items and factions read from the store;
  - `setSpellingAccepted`, a word kept with the world (`World.spellingAccepted`) or taken back;
  - `useDictionaryNames`, which gives the desktop app's dictionary the open world's name words as they change.
- `src/features/timeline/nameMarks.ts`: the marks on the Page, drawn for the scenes in view; the offer with the caret in
  a mark (**Use Teodora**, **Not a typo**); and Ctrl+. (⌘. on a Mac). `DraftBook.tsx` gives it the names, the shipped
  word list, the kept words and the book's word counts, and redraws when any of them change.
- `electron/spellMenu.cjs`: the right-click menu built from Electron's own `context-menu` parameters; the languages,
  kept in the app's data folder as `spelling.json`; the IPC handlers. `main.cjs` attaches it and gives each window the
  menu, and `preload.cjs` exposes `electronAPI.spelling`.
- `src/lib/desktopSpelling.ts` and `src/features/worlds/SpellingLanguages.tsx`: *Spelling on this device* in World
  settings, shown only in the desktop app.
- `src/features/continuity/AuditPanel.tsx`: spell checking off in the audit's reply box (below).
- `scripts/spelling-probe.ts`: the measure on the Library, run with
  `npx vitest run --config vitest.probe.config.ts scripts/spelling-probe.ts`. It asserts the bar it was built to: under
  one false alarm in 10,000 words, and at least 85% of typos found.

## What it does

- **The Page** (D-2, D-3, D-4).
  - A word is marked when it has a capital, at least five letters, is not a name word or a word of the shipped list, is
    used fewer than three times in the book, has the name's first letter, is not the name with a family or derived
    ending, and is one edit from a name word (two for a word over seven letters).
  - It is marked as it is typed, and a name added while the Page is open is known at once.
  - With the caret in a mark, *Did you mean Teodora?* offers **Use Teodora** and **Not a typo**. Ctrl+. uses the name.
  - *Not a typo* is kept with the world, so it travels in a `.pwk`, and the word is not marked again.
  - Only scene prose is checked: not chapter or scene headings.
- **The desktop app** (D-1, D-5, D-6).
  - Right-click on a misspelt word: up to five suggestions, *No suggestions* when there are none, *Add to dictionary*,
    then Cut, Copy, Paste and Select all. Elsewhere in a field, the editing alone; outside one, Copy for a selection; no
    menu where there is nothing to offer.
  - The open world's name words go to the device's dictionary when the world opens and as names are added or changed.
    Nothing is taken out of it.
  - The languages are chosen in *Spelling on this device*. The default is the system's language, or its base language
    where the checker has only that (*fr-CA* gives *fr*). The last language cannot be taken away. On a Mac the system
    chooses, and the section says so.
- **The AI dialogs** (D-7): spell checking off in every text box of the audit and the chapter AI dialog.

## Found on the way

- **The audit's reply box had spell checking on.** The plan's measure said the AI audit was off, from the attribute on
  its prompt box. The source test reads every `textarea` and `input` in both dialogs, and the reply box had none. It is
  off now. The test was first written ending a tag at the `=>` of an `onChange` handler, so it read the attribute from
  the wrong place and failed on the fixed file; it now reads a tag to its own `/>`, and was seen to fail without the fix
  and pass with it.
- **A name in the shipped word list is not checked.** The list is built from the Library's books, so it holds their
  names: *utterson*, *harker*, *lucy*. A word of the list is an ordinary word to the check, so *Uttreson* is not marked
  in *Jekyll and Hyde*, and the guide's first screenshot showed nothing. A writer's name is checked unless it is also
  one of the list's words, which a name shared with a Library book (*Lucy*) will be. The screenshot uses *Newcomen*,
  which is not in the list, and the guide says that a name the Library's books use, such as *Lucy* or *Harker*, is not
  checked.
- **The probe's false alarms were mostly families and possessives.** *The Barrys*, *Alaskan*, *MURRAY’S* in capitals
  and *Medlock’d* were flagged until a word lost its possessive or run-on ending before it was compared and the derived
  endings were allowed. That took the false alarms from 0.409 to 0.101 in 10,000 words with no loss of recall.
- **A four-letter near miss.** *Vasss* for *Vasse* survived the first mutant run: nothing tested a short name. A test
  now holds that a name word under five letters is not checked (*Vass*) and one of five is (*Vasse*).
- **A unit test's typo was two edits away.** *Teodro* is two from *Teodora*; the test uses *Teodra*.

## Tests

- `src/lib/__tests__/nameSpelling.test.ts`, 16:
  - **names:** people with aliases and earlier names, places, items and factions, each once; their words, possessives
    off; the check made of the long words that are not ordinary;
  - **distance:** added, dropped, changed and swapped letters; the cutoff;
  - **near misses:** one letter wrong, with the name and where; two edits for a long name; the names themselves and
    their possessives left; ordinary, short and lower-case words left; a word used three times left; the first letter
    needed; families and derived words left; the nearer of two names, where it is not the first; capitals kept in the
    correction; possessives and run-on endings; the book's word counts.
- `src/db/hooks/__tests__/nameSpelling.test.ts`, 2: the name list as people, places, items and factions are added,
  renamed and deleted; a word kept with the world once, and taken back.
- `src/lib/__tests__/electronSpelling.test.ts`, 8, with Electron's parts stood in:
  - **the menu:** five suggestions and their order, *No suggestions*, the editing roles and their flags, Copy for a
    selection, nothing outside a field;
  - **the set-up:** the system's language, a base language, a saved choice, a broken file, a language the device
    lacks; the dictionary given each word once and nothing that is not a word; the languages answered and kept; the
    Mac; a window's menu acting on its own page.
- `src/lib/__tests__/spellcheckPlaces.test.ts`, 2: on in the Page and Focus mode; off in every box of the AI dialogs.
- `e2e/nameSpelling.spec.ts`, 3:
  - **the Page:** marks with their names, the names unmarked; no offer until the caret is in one; Use; Ctrl+.; the prose
    saved; Not a typo kept with the world past a reload; a word marked as it is typed; a place added and known at once;
  - **the desktop app**, its bridge stood in: the world's name words sent, and a faction's as it is added; the
    languages shown and chosen, and the last one kept;
  - **the Mac** message, and no section in a browser.

## Mutants

In a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed. Ten mutants failed the gate on the first
pass by leaving a binding unused; each was rewritten to keep it referenced and run again.

- **25 against the unit tests:** 25 killed.
  - The distance at two edits, or one, for every word; any word length, and any name word length.
  - Ordinary words marked, and ordinary name words checked; the names themselves marked.
  - A word used often never meant; lower case marked; any first letter; derived words marked; no swap.
  - The first name rather than the nearest; a possessive in capitals kept; the correction out of capitals.
  - No aliases, no earlier names.
  - Six suggestions; Add to dictionary replacing the word; a menu for a misspelling outside a field.
  - Any string to the dictionary, and words given again; the Mac not known; the languages not kept; no base language.
  - One survived the first pass, *any word length*: the four-letter test above killed it.
- **10 against `e2e/nameSpelling.spec.ts`:** 10 killed.
  - No marks, no offer, no key, the word not replaced.
  - Not a typo not kept, kept words marked, names not redrawn.
  - No names sent, the last language taken, the Mac not said.
