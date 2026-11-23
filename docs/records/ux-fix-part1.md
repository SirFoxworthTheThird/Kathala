# UX fixes, Part 1: the shared controls

Part 1 of `ux-expert-fixes-plan.md`: the faults that sit in one shared component and so show on every screen
that uses it. Each was re-measured at `b7a8187` before it was fixed, and each still reproduced.

| Finding | What it was | Now | Test |
|---|---|---|---|
| UX-2-1 (high) | No dropdown could be operated from the keyboard. | Fixed (D-4). | `sharedControls.spec.ts`, the first two tests |
| UX-1-2 / UX-2-5 (high) | On touch, every dialog's ✕ fell to the bottom-left. | Fixed. | the touch test |
| UX-2-16 / UX-3-15 | The ✕ showed no focus. | Fixed. | the touch test |
| UX-2-6 | One Escape closed a confirm and the dialog under it. | Fixed, for all sixteen such dialogs. | the Drafts test |
| UX-2-9 | A tap on a portrait opened its menu. | Fixed. | the portrait test |
| UX-2-15 | Find & replace and Scene history were unnamed, had fifteen identical *Replace* buttons, and a silent result. | Fixed. | the Find & replace test |
| UX-2-13, its width | A list was as narrow as its 70px trigger. | Fixed here: an unfiltered list is at least 224px. Its filter comes in Part 3. | none of its own; the floor is one number in `select.tsx` |

## Code

- **`src/components/ui/select.tsx`: the keyboard (D-4).**
  - **Opening.** On the trigger, Enter, Space or ↑/↓ opens the list on the option chosen, or the first. Focus
    goes into the list, and `aria-activedescendant` points at the option the keyboard is on, which is drawn
    with a ring.
  - **Moving and choosing.** ↑ ↓ Home End move. Typing jumps to an option starting with what was typed, and
    letters typed together within 0.7s make one word. Enter or Space chooses.
  - **Closing.** Escape and Tab close the list without choosing. Every way of closing gives focus back to the
    trigger.
  - **A filtered list** keeps focus in its box. The box is a `combobox` pointing at the active option, so ↑ ↓
    and Enter work while typing.
  - **Escape and Tab are caught on the window in the capture phase**, before the dialog's own Escape listener on
    `document` and its focus trap. That is what keeps the list in a dialog from closing the dialog.
  - **Kept as it was:**
    - the trigger's role, `button`, and its naming;
    - an option's role, and clicking one;
    - so the 92 places the specs find a list or an option still find them.
- **`src/index.css`: `.pw-tap` sets `position: relative` only on a button that is not already positioned.**
  Unlayered, the rule had beaten Tailwind's `absolute` on touch alone. It moved:
  - the shared dialog's ✕;
  - the full-size picture's ✕;
  - the History tab's delete.
- **`src/components/ui/dialog.tsx`:**
  - **The layer.** `useModalLayer` reads its close handler through a ref, so its layer depends on `open` alone.
    A caller's inline `onOpenChange` gives a new handler on every render, and each re-render had taken the
    layer off the stack and pushed it back on top. With a confirm open inside a dialog, the outer dialog
    became the innermost, and one Escape closed both.
  - **The ✕** gets a `focus-visible` ring.
- **`src/features/characters/CharacterDetailView.tsx`:** the portrait's ⋯ menu is `dense`, without the 44px
  overlay that covered the portrait's middle.
- **`FindReplaceDialog.tsx` and `SceneHistoryDialog.tsx`:**
  - both named by a `DialogTitle`;
  - each scene's button is *Replace in Ch. N · …*;
  - the result line is a `status`.

## Found on the way

- **The double Escape was one bug in sixteen places.** Part 0 counted the files that render a confirm inside a
  dialog with an inline handler. `dialogA11y.spec.ts`'s test of the same thing passed because its parent's
  handler was stable. The new test uses Drafts, which is one of the sixteen.
- **A test for the filter box** found it as a `textbox` (`pickerFilter.spec.ts`). It is a `combobox` now, on
  purpose, and the spec says so.
- **The spec's first run of the dropdown specs, on the dev server,** failed six tests with *The library could
  not be reached*. Those specs install Library books, which only the production build stages. They are run with
  the full suite, which builds.

## Tests

`e2e/sharedControls.spec.ts`, 6 tests:
- **a dropdown in the Export dialog,** by keyboard alone:
  - Enter opens it on the chosen option, with focus in the list;
  - ↓ and Enter choose, and focus goes back to the trigger;
  - ↓ on the trigger opens it;
  - Escape closes the list and not the dialog;
  - typing *f* finds *Final only*;
  - End and Home;
  - Tab leaves without choosing;
  - then Escape closes the dialog.
- **a filtered list** in *Move to chapter*: the box keeps focus, typing narrows it, Enter chooses, and Escape
  closes the list and not the dialog.
- **Drafts:** a confirm over it closes on one Escape, Drafts stays, and the next Escape closes Drafts.
- **Find & replace:**
  - the dialog is found by its name;
  - two *Replace in …* buttons with different names;
  - a status empty before Replace all and saying what it did after.
- **On an iPhone 13's screen with touch:**
  - **the ✕:** in the dialog's top-right corner, `absolute`, still with its 44px `::after`; no ring until the
    keyboard puts focus on it, and a ring then;
  - **a portrait:** its middle is the picture, and a tap there opens it full size with no menu; its corner still
    opens the menu.

## Mutants

In a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed. **17 against
`e2e/sharedControls.spec.ts`, 17 killed:**
- **The dropdown:**
  - ↓ does not move;
  - Escape not taken first;
  - Tab not taken first;
  - focus left on the trigger on opening;
  - focus not given back on closing;
  - no typeahead;
  - Enter does not choose;
  - ↓ on the trigger does not open;
  - Home goes to the wrong option;
  - the filter box points at no option.
- **`.pw-tap`** positions every button again.
- **The ✕** has no ring.
- **The dialog's layer** depends on its handler again.
- **The portrait** gets its menu's overlay back.
- **Find & replace:** its *Replace* buttons unnamed; its result not a status; the dialog unnamed.

## Checks at the commit shipped

- `npm run lint` and `tsc -b`: clean.
- `npx vitest run`: 4,175 tests in 367 files, all passing.
- `npm run test:e2e` on a production build: 1,122 tests, all passing.
