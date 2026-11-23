# Spelling: the desktop app's corrections, and the world's own names: the plan (issue #705)

**Asked:**
- In the desktop app, a way to act on the spell checker's underline: suggestions, *Add to dictionary*, and Cut, Copy
  and Paste, with its languages chosen.
- The world's names known as words.
- A misspelt name caught: *Teodroa* for *Teodora*.
- The guide to say what is checked where.

## Measured

- **Where spell checking is on now.** It is on in the Page (`DraftBook.tsx`, `spellcheck: 'true'`), Focus mode
  (`FocusMode.tsx`, a `textarea` with `spellCheck`) and a scene's text box. It is off in the AI audit (`AuditPanel.tsx`)
  and in the chapter AI dialog (`ChapterAIDialog.tsx`).
- **The desktop app** (`electron/main.cjs`) leaves Electron's spell checker on by default. It has no `context-menu`
  handler, so no menu opens on a right click and the underline can't be acted on. It never sets the spell checker's
  languages.
- **Near misses on the Library.**
  - The probe is `scripts/spelling-probe.ts`, run over the 49 English books with prose: 4,669,685 words.
  - Each book is checked against the shipped word list rebuilt without that book (`toBaseline(without(all, book))`),
    so a book's own words are not already known to it, as they won't be for a writer's new book.
  - The names are each book's characters (with aliases and earlier names), places, items and factions.
  - Every flag on a published book was read and judged.
    - A **real near miss** spells the same person or place differently from its record. Examples: the book's own slip
      (*Nortier* for *Noirtier* in *Monte Cristo*, *Daisey* for *Daisy* in *Little Women*), an accent or a scansion
      mark (*Mozambíque*, *Port’ugal* in *Os Lusíadas*), or another language's form of the name (*Colosseo*).
    - Anything else is a **false alarm**: another word or another person (*Athens* against *Athena*, *Giotto* against
      *Grotto*).
  - Recall was measured by putting a typo into one use of each name in a scene, a letter swapped, dropped, added or
    changed after the first, and asking whether that scene's check finds it.

  | Rules | Flags | Real | False per 10,000 words | Typos found |
  | --- | ---: | ---: | ---: | ---: |
  | **Chosen (D-3)** | 117 | 70 (60%) | 0.101 | 1,201 of 1,341 (89.6%), the right name for 1,198 |
  | Shortest word 4 | 133 | 70 | 0.135 | 92.9% |
  | Shortest word 6 | 98 | 59 | 0.084 | 85.4% |
  | Any first letter | 140 | 70 | 0.150 | 89.6% |
  | Lower-case words too | 256 | 70 | 0.398 | 92.8% |
  | A word used twice is meant | 69 | 38 | 0.066 | 89.6% |
  | A word used 5 times is meant | 197 | 70 | 0.272 | 89.6% |

  - Before families and derived words were allowed for, 191 flags gave 0.409 false alarms in 10,000 words.
    - Families: *the Barrys*, *the Manettes*.
    - Derived words: *Alaskan*, *Napoleonic*.
  - A possessive in capitals (*MURRAY’S*) and a run-on *’d* (*Medlock’d*) were flagged by mistake until a word lost
    them before it was compared.
  - The issue's bar is one false alarm in 10,000 words. The chosen rules give a tenth of that.

## Decisions

- **D-1: in the desktop app, the world's names are added to this device's dictionary.**
  - The single words of every name of the open world are added to the spell checker's custom dictionary when the world
    opens, and again as names are added or changed. This covers characters, aliases, earlier names, places, items and
    factions.
  - Electron's dictionary is the device's, not the world's, so a name from another world stays known. Nothing is taken
    out of it: a word wrongly kept known costs an underline missed, and one wrongly removed would undo a writer's own
    *Add to dictionary*.
- **D-2: in a browser, Kathala marks near misses on the Page.**
  - A page cannot change a browser's dictionary, so a correct name keeps the browser's underline there, and the guide
    says so.
  - Kathala's own mark is a different one, for a word that looks like a misspelt name.
  - It is drawn on the Page. Focus mode and a scene's text box are plain text boxes, which take no marks, so they have
    the browser's own check, and the desktop app's dictionary.
- **D-3: a near miss** (`src/lib/nameSpelling.ts`) is a word that:
  - has a capital letter;
  - has at least 5 letters;
  - is not one of the world's name words, and not a word of the shipped baseline;
  - is used fewer than 3 times in the whole book, since a word used more often is one the writer means;
  - is one edit from a name word of at least 5 letters, or two edits for a word over 7 letters, where an edit is a
    letter added, dropped, changed, or two letters swapped;
  - has the name's first letter;
  - is not the name with a family or derived ending (*s*, *es*, *n*, *an*, *ian*, *ic*, *ish*, *ese*, *ite*).
- **D-4: what the mark offers.**
  - With the caret in a marked word, a tooltip asks *Did you mean Teodora?* and offers **Use Teodora** and **Not a
    typo**.
  - **Ctrl+.** (⌘. on a Mac) uses the name from the keyboard.
  - *Not a typo* is kept with the world (`World.spellingAccepted`), so it travels with the book, and the word is never
    marked again.
- **D-5: the desktop app's menu** (`electron/spellMenu.cjs`, a pure builder, unit-tested).
  - On a misspelt word: up to five of the spell checker's suggestions, then **Add to dictionary**.
  - Where text can be edited: **Cut**, **Copy**, **Paste** and **Select all**. Where it cannot, **Copy** for a
    selection.
  - No menu where there is nothing to offer.
- **D-6: the spelling languages are chosen on this device,** in World settings under *Spelling on this device*, shown
  only in the desktop app.
  - They are kept in the app's own data, `spelling.json`, and the default is the system's language.
  - On a Mac the system chooses the languages itself, and the section says so.
- **D-7: spell checking stays off in the AI dialogs.** A source test holds it there.

## Parts

1. **Logic** (`src/lib/nameSpelling.ts`):
   - the world's names and their words;
   - the edit distance;
   - near misses;
   - word use;
   - unit tests.

   The name list read from the store is `worldNameSource` in `src/db/hooks/useNameSpelling.ts`, with an integration
   test as names are added, renamed and deleted.
2. **The Page:**
   - near-miss marks (`nameMarks.ts`);
   - the tooltip, *Use*, *Not a typo* and Ctrl+.;
   - an e2e.
3. **The desktop app:**
   - the menu builder and its handler;
   - the names sent to the dictionary;
   - the languages, over IPC, with the settings section;
   - unit tests of the builder and the handler, with Electron's parts stood in.
4. **Checks:**
   - the source test for the AI dialogs;
   - mutants;
   - the GUIDE's *Spelling* part;
   - a record;
   - the full suites;
   - a PR.
