# UX fixes, Part 2: overlays that hold the keyboard, menus, and Escape

Part 2 of `ux-expert-fixes-plan.md`: the hand-made overlays that lacked what the shared `Dialog` gives, the two
menus that were menus only to a mouse, and the panels Escape did not close. Each was re-measured at `ed5c931`
before it was fixed, and each still reproduced.

| Finding | What it was | Now | Test |
|---|---|---|---|
| UX-1-5 | The Library had no role, no name and no focus trap. Focus stayed on *Library* behind it, and closing dropped focus on `<body>`. | Fixed. | the Library test |
| UX-2-12 | Focus mode was not a modal: Tab walked into the app under it. | Fixed. | the Focus mode test |
| UX-3-14 | Help did not take focus, and was not a dialog. | Fixed (a dialog, as the Brief is). | the Help test |
| UX-1-11 | The narrow navigation drawer said `aria-modal` but left focus outside it. | Fixed. | the drawer test |
| UX-1-10 | The world card's ▾ menu ignored Escape and the arrows, and did not say it was open. | Fixed. | the world card test |
| UX-3-5, the menu half | Map tools ignored Escape and did not take focus. The scale's ✕ is Part 4's. | Fixed. | the Map tools test |
| UX-3-7 | Escape did not close the map's panels, the faction panel, the item's edit, or the search palette once focus left its box. | Fixed. | the last four tests |

## Code

- **`src/lib/useOverlayFocus.ts`:** what `Dialog` gives, for an overlay drawn by hand.
  - **Opening** moves focus in, to a given element or the first control, unless something inside already has it.
  - **While open,** Tab stays inside.
  - **Closing** gives focus back to what had it, unless focus has already gone somewhere real.
  - **The opener** is taken in a layout effect. Where a field inside has already taken focus by then, or focus is
    on `<body>`, the element focused before it is taken, which a document-wide `focusin` record keeps.
- **`src/lib/useFocusTrap.ts`:** counts only what Tab can land on.
  - The trap wraps when focus is on the last control it counts. A hidden file input, a button in a folded section,
    `tabindex="-1"` or anything under `inert` was a "last" that focus never sat on, so Tab walked out past it.
  - Found by this part's first run: forward Tab left the Library, Help and Focus mode, while Shift+Tab stayed in.
    Every shared `Dialog` uses the same trap.
- **The four overlays:**
  - **the Library:** `role="dialog"`, named by its heading. Its confirm is an `alertdialog`, and the catalogue is
    `inert` while the confirm is up.
  - **Focus mode:** a modal named *Focus mode*. Closing leaves focus where the Page puts it, in the prose where the
    writing stopped. That is somewhere real, so the hook leaves it there.
  - **Help:** a dialog named by its heading.
  - **the drawer:** the hook only, since it already had the role.
- **`src/components/ui/useMenuKeyboard.ts`:** `Menu`'s keyboard, as a hook `Menu` now uses. The world card's split
  button and the map's Map tools use it too, since neither can be `Menu`: one has items with a second line, the
  other has items grouped under headings.
  - ↓ or ↑ on the trigger opens the menu on its first item.
  - ↓ ↑ Home End move.
  - Escape closes the menu and gives focus back. It is taken on the window in the capture phase, so a menu inside a
    dialog closes alone.
  - Tab closes the menu.
  - A press outside closes it.
  - **Its own module, not `menu.tsx`:** `readingGateGuards.test.ts` holds a file that imports from `ui/menu` to
    consulting the reading gate, because those files draw row and card menus. Neither file using the hook does.
- **`src/lib/escapeCloses.ts`:** whether an Escape closes the panel it was pressed in.
  - Not from a text field: a panel's fields save on blur, and closing would unmount the field without one.
  - Not when a list or menu took the key first.
- **Escape on panels:**
  - the map's location, route, region and character panels, except while a canvas mode runs or under a modal;
  - the faction panel;
  - the search palette, from anywhere in it;
  - the item page's edit, which Escape cancels, as its Cancel button does.

## Tests

- `src/lib/__tests__/escapeCloses.test.ts`, 3:
  - closes from a button, a checkbox, or the panel itself;
  - never from a text box, a textarea, editable text or a select;
  - only on Escape, and not on one a list or menu already took.
- `e2e/overlaysAndEscape.spec.ts`, 9:
  - **the Library:** focus goes in on Enter; four Shift+Tabs and six Tabs stay in; Escape gives focus back to
    *Library*.
  - **Focus mode:** the caret is in its box; eight Tabs stay in; Escape returns to the Page with the caret in the
    prose.
  - **Help:** focus goes in; six Tabs stay in; Escape gives focus back to *Help*.
  - **the drawer at 390px:** focus goes in; four Shift+Tabs stay in; Escape gives focus back to ☰.
  - **a world card's ▾:** `aria-expanded`; ↓ opens on the first item; ↓ and End move; Escape closes and gives focus
    back.
  - **Map tools:** ↓ opens it on its first item; Escape closes and gives focus back. Then a location's panel, opened
    from the sidebar, closes on Escape.
  - **the faction panel:** Escape in its tag box leaves it open; Escape from its close button closes it.
  - **the search palette:** closes on Escape with focus on *Whole words*.
  - **an item's edit:** Escape cancels it, and the name typed is not saved.

## Mutants

In a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed.
- **19 against the new spec and the unit test, 19 killed:**
  - the trap counts what Tab cannot reach;
  - the hook moves no focus in, or gives none back;
  - each overlay without the hook, and the Library and Focus mode without their role;
  - the menu's Escape not taken, and its ↓ not opening it;
  - the world card's popup not a menu;
  - Map tools' trigger keys not wired;
  - each panel's Escape off;
  - `escapeCloses` closing from a field, killed both by the faction test and by the unit test.
- **First pass:**
  - Three mutants failed the gate on the first pass. `false && open` is a constant expression to ESLint, so they
    were rewritten as `open && !open` and killed.
  - The two menu mutants first ran on the hook in `menu.tsx`. They were run again on it in `useMenuKeyboard.ts`
    after it moved, and both were killed again.

## Checks at the commit shipped

- `npm run lint` and `tsc -b`: clean.
- `npx vitest run`: 4,178 tests in 368 files, all passing.
- E2E_PENDING
