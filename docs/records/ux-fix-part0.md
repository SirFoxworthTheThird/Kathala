# UX fixes, Part 0: the suspicions settled

Part 0 of `ux-expert-fixes-plan.md` answers the questions that change a fix, before any code. Each answer was
measured at `b7a8187`.

- **The marked file signs a change still waiting *(edit declined)* (UX-2-3).**
  - **The setup:** *Jekyll and Hyde*, exported for an editor, with three tracked changes made in that file.
    It was brought back in. *craggy* was accepted, the *lovable* deletion rejected, and *well-known → celebrated*
    left waiting (*Changes · 1*). Then it was exported for an editor again, marked.
  - **In `word/document.xml`:** the rejected change is `ins` *and yet somehow lovable* by *The author (edit
    declined)*, as it should be. The waiting one is `del` *celebrated* and `ins` *well-known*, also by *The author
    (edit declined)*.
  - **So the file tells the editor the writer declined an edit they have not decided on.** D-3 covers the file
    as well as the tally: a change still waiting is left out of what the file signs.
- **Two stacked dialogs closing on one Escape is not only Drafts (UX-2-6).**
  - Sixteen files render a `ConfirmDialog` and pass an inline `onOpenChange`. Among them: Drafts, Scene history,
    the world selector, a series card, Cloud sync, Custom fields, Lore, the map sidebar and the faction panel.
  - The cause is in `Dialog`: its layer is taken off and put back whenever the caller's handler changes identity.
    So the fix is there, once, and not in sixteen callers.
- **A reply typed under a note is lost on Resolve, but not on Edit (UX-2-7).** In `NotesPanel.tsx` the reply's
  form is apart from the editing form, and **Edit** leaves `replying` and the typed text as they were. Resolve
  loses it because the card that holds it is filtered away once the note is resolved. Only Resolve needs the fix.
- **The History tab's ✕ falls on touch too (UX-2-5, UX-1-2).** `HistoryTab.tsx:160` is `pw-tap absolute right-2
  top-2`, the same pairing as the dialog's ✕. The one fix to `.pw-tap` covers it.
- **The end-of-book `isAlive` fallback is only on the dashboard (UX-1-1, part 1's S-4).** Of the five places a
  missing state falls back to something:
  - `castAtCursor.ts:44` falls back to the record's flag. This is the fault.
  - `sequel.ts:184` falls back to the flag for the sequel's opening, where the end of the book is what is meant.
  - The map panel and the quick-state form fall back to `true`.
- **What Kathala's own Word export carries that a draft does not (D-2, UX-1-9).**
  - Every scene in a Kathala export is inside a bookmark named `KathalaScene_<n>`. Measured on
    `fixtures/docx/import/10-kathala-export.docx`: one per scene, beside Heading 1 for *Chapter N* and Heading 2
    for its title.
  - A draft written in Word has none of these, and uses Heading 2 for its scenes.
  - **So the "title under *Chapter One*" rule applies only to a file with `KathalaScene_` bookmarks.**
