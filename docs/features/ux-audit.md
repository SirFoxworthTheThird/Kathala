# UX Audit — PlotWeave (April 2026)

UX/UI Expert review. Covers navigation, every major view, shared components, and cross-cutting accessibility. Issues are grouped by severity: **Critical** (broken or inaccessible), **High** (significant friction), **Medium** (polish / consistency), **Low** (minor copy or visual).

---

## 1. Global / Cross-cutting

### CRITICAL — No focus trap in modal overlays
The Search Palette, Writer's Brief, and Continuity Checker open as full overlays or slide-in panels but do not trap keyboard focus. A keyboard user can Tab out of the palette into the document behind it. All modal surfaces must trap focus while open and restore it on close.

**Fix:** Wrap every overlay/sheet with a focus trap library or a manual `useFocusTrap` hook.

### CRITICAL — Search Palette missing ARIA roles
The palette is not announced to screen readers as a dialog. It needs `role="dialog"`, `aria-modal="true"`, and `aria-label="Search"`. The results list should use `role="listbox"` with each result as `role="option"` and `aria-selected` set by `activeIdx`. Without this, screen readers narrate it as a generic region.

### HIGH — Navigation icons have no visible labels and no keyboard-accessible tooltip
TopBar nav uses icon-only buttons. The `title` attribute provides a browser tooltip on hover but is:
- Not shown on keyboard focus
- Not reliably announced by all screen readers
- Not visible at all on touch devices

Every nav button, Writer's Brief button, Continuity button, and Help button falls into this category.

**Fix:** Add `aria-label` to every icon button (most already have `title` — that isn't sufficient). For the nav items specifically, consider showing the label below the icon on hover/focus at minimum, or permanently showing text labels for core items.

### HIGH — `title` attribute used as the sole accessible name throughout
Over 20 interactive elements (nav buttons, action buttons, dismiss buttons) use `title=""` as their only accessible label. `title` is not reliably exposed by assistive technology and requires a pointer to appear. Replace all `title`-only buttons with `aria-label`.

### MEDIUM — Inconsistent empty state for "filtered to zero" vs "genuinely empty"
Most roster views (Characters, Lore, Items) correctly distinguish "no data yet" from "your search matched nothing." However the copy in Characters uses "Try a different search." while Items uses nothing. Audit all rosters for consistent filtered-empty copy.

### MEDIUM — No loading states for async operations
DB writes (creating characters, saving snapshots, importing) show a disabled button with text like "Adding…" but there are no loading indicators for initial data fetch. On first open, views silently render empty until `useLiveQuery` resolves. This is nearly instant locally but should still be handled gracefully with a skeleton or spinner.

### LOW — "..." vs "…" inconsistency in placeholder copy
Some inputs use `"Search characters..."` (three periods) and others use `"Choose a moment…"` (ellipsis character). Standardize to `…` everywhere.

---

## 2. TopBar

### HIGH — Writer's Brief and Continuity icons are not recognizable without context
`ScrollText` and `ShieldAlert` are domain-specific icons. A new user has no way to know what they do. They have `title` attributes (see global issue above) but no persistent labels.

**Fix:** These two were previously fixed with text labels per the UX roadmap, but the current code renders them as icon-only `h-8 w-8` buttons with no visible text. Either add a persistent label or show a tooltip on focus, not just hover.

### MEDIUM — World name truncated to `max-w-[120px]`
Long world names are silently truncated. There is no tooltip showing the full name. A user with a world named "The Chronicles of the Shattered Realms" sees "The Chronicles of…" with no way to read the full name in the header.

**Fix:** Add a `title` attribute (or proper tooltip) showing the full world name on hover/focus.

### MEDIUM — Brand button has no `aria-label`
The `<button onClick={() => navigate('/')}` containing the logo and "PlotWeave" text has no ARIA role label. Screen readers announce it as "PlotWeave" (from the text content) which is acceptable, but the `<img alt="PlotWeave">` inside is redundant — the `img` should be `alt=""` since the button text already conveys the label.

### LOW — Active nav item does not announce its state to screen readers
The active item gets visual styling (`bg-[hsl(var(--accent))]`) but there is no `aria-current="page"` on the active `NavLink`. React Router's `NavLink` supports this via its `aria-current` prop — it's not being set.

**Fix:** Add `aria-current={isActive ? 'page' : undefined}` inside the `className` function.

---

## 3. World Selector

### HIGH — Import hint shown at wrong time
When `importing === true && !importError`, the copy "Select a `.pwk` file to import" appears — but the file picker is already open or has already returned. The instruction appears *after* the user has already acted. On Electron, where the native dialog opens synchronously, the hint never even renders before the dialog closes.

**Fix:** Show the import format hint statically below the Import button, not conditionally during the loading state.

### MEDIUM — Import error has no icon and blends into the header
The error `<p className="mt-2 text-xs text-red-400">` is easy to miss — it's small, below the header row, and has no warning icon. 

**Fix:** Use the same `AlertCircle` + red background pattern used in ChapterAIDialog's error state.

### MEDIUM — "Generate from AI" label is opaque
A new user sees "Generate from AI" and doesn't know what it generates. It could mean "generate a new character", "generate text", or "generate a world." 

**Fix:** Rename to "Import from AI" or "Generate World from AI" — matching the dialog title inside.

### LOW — Hidden file input has no `aria-label`
`<input type="file" className="hidden">` has no accessible label. Although it's hidden and triggered programmatically, it should still have `aria-label="Import world file"` for screen reader hygiene.

---

## 4. World Dashboard

### MEDIUM — No visual separation between suggestions and stat tiles
The suggestion cards and the nav tiles grid sit one after the other with only `space-y-8` margin. When 3 suggestions are showing, the tiles below them are easy to scroll past without noticing they exist.

**Fix:** Add a section heading (e.g. "Your World") above the tiles grid, consistent with the "Recent Events" and "Timeline Links" headings already used lower on the page.

### MEDIUM — Dashboard returns `null` during loading
`if (!wizardReady) return null` renders a blank screen while IndexedDB resolves. This is typically < 100ms locally but creates a jarring flash for users with slow storage.

**Fix:** Render a lightweight skeleton (world name placeholder + grey tile placeholders) instead of `null`.

### LOW — Description "No description — click to add one" is not button-like
The italic placeholder text `"No description — click to add one."` is clickable (it activates the edit pencil button) only if the user clicks the pencil icon next to it — the text itself is not interactive. Yet it reads as an affordance. Either make the entire text row a click target that starts editing, or remove the "click to add" language.

---

## 5. Onboarding Wizard

### MEDIUM — Step indicator dots are not keyboard navigable (intentionally), but offer no skip-ahead affordance at all
The step dots are `<span>` elements — not interactive — which is correct (the spec says no skipping forward). However, a user who accidentally closes the browser mid-wizard and returns has no way to know they can't click dots. The dots look like tabs (common UX pattern = clickable). 

**Fix:** Use a visual style that reads as a progress indicator rather than tab controls — a stepped progress bar (line + filled/unfilled circles) rather than dots at the same visual weight as tab indicators.

### LOW — Skip link copy is inconsistent across steps
- Step 1: "Skip and explore on my own →"
- Steps 2–3: "Skip for now →"
- The arrow `→` is a decorative character with no `aria-hidden="true"`.

**Fix:** Standardize to "Skip for now" and add `aria-hidden="true"` to the arrow character, or remove it.

---

## 6. Timeline View

### HIGH — No visual indicator of which timeline is "active" when multiple timelines exist
When a world has multiple timelines, the timeline selector renders tab-like buttons, but the active timeline's color swatch is the only differentiator. The active button has no `aria-selected="true"`, no `role="tab"`, and no `aria-controls`. Screen readers cannot determine which timeline panel is shown.

**Fix:** Use a proper `role="tablist"` / `role="tab"` / `role="tabpanel"` pattern.

### MEDIUM — "Add Chapter" and "Generate with AI" buttons are peers without hierarchy
Both buttons have equal visual weight. "Add Chapter" is the primary manual action; "Generate with AI" is a power-user shortcut. They should have primary/secondary visual hierarchy.

### MEDIUM — Bulk action toolbar appears without announcement
When checkboxes are selected, the `BulkActionToolbar` appears at the top of the list. This state change has no `aria-live` announcement — a screen reader user selecting via keyboard will not know the toolbar appeared.

---

## 7. Character Roster

### MEDIUM — Dead characters not distinguished in the grid
`isAlive: false` characters show the same card layout as living ones. A writer tracking a large cast has no quick way to see which characters are dead without opening each card.

**Fix:** Add a subtle visual treatment to dead character cards (muted opacity, a Skull icon badge, or a strikethrough on the name). Reference: the Arc view already does this with heart/skull icons.

### MEDIUM — No character count shown when filtered
When the user searches and gets results, there's no "Showing 3 of 12 characters" indicator. After heavy filtering, the user doesn't know how many were excluded.

### LOW — Search input placeholder inconsistency
`"Search characters..."` — three periods instead of ellipsis character `…`.

---

## 8. Character Detail View

### HIGH — Back button uses `navigate(-1)` — breaks on direct URL entry
If a user opens a character URL directly (bookmark, share, or opening in a new tab), clicking Back navigates to the browser's previous page (or nowhere). A character in a known world always has a canonical parent URL.

**Fix:** Replace `navigate(-1)` with `navigate(\`/worlds/${worldId}/characters\`)`.

### HIGH — Portrait upload label missing accessible name
```tsx
<label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full ...">
  <Upload className="h-3 w-3 text-[hsl(var(--foreground))]" />
  <input type="file" accept="image/*" className="hidden" onChange={handlePortraitUpload} />
</label>
```
The `<label>` contains only an icon with no text and no `aria-label`. Screen readers announce this as an unlabelled file input.

**Fix:** Add `aria-label="Upload portrait image"` to the `<label>` element.

### MEDIUM — Delete character button is icon-only with no confirmation proximity
The `Trash2` button sits in the header with `ml-auto` — visually isolated but easy to hit accidentally. The `ConfirmDialog` provides a second chance, but the button itself has no `aria-label`.

**Fix:** Add `aria-label="Delete character"` to the delete button.

### MEDIUM — No visual feedback on portrait upload (success or failure)
After `handlePortraitUpload` completes, the image updates reactively — which is fine. But if the upload fails (e.g. file too large), there is no error message. The `try` block has no catch.

---

## 9. Search Palette

### HIGH — No result count per group, no cap per group
A world with 50 events matching "the" will show all 50 under "Events." The palette becomes a massive scrollable list with no way to scope results.

**Fix:** Cap each group at 5 results with a "Show all N →" affordance.

### MEDIUM — Location, route, and region results navigate to `/maps` without focusing the item
Selecting a location marker from search navigates to the Maps view. The store sets `setPendingFocusRouteId` / `setPendingFocusRegionId` for routes and regions, but location markers have no equivalent — the user lands on the map with no indication of which marker was the search result.

**Fix:** Implement `setPendingFocusMarkerId` analogous to the existing route/region focus pattern.

### MEDIUM — Clear query button has no `aria-label`
```tsx
<button onClick={() => setQuery('')} className="text-[hsl(var(--muted-foreground))] ...">
  <X className="h-3.5 w-3.5" />
</button>
```
No accessible name. Fix: `aria-label="Clear search"`.

### LOW — Relationship results sublabel is not useful
`sublabel: \`${r.sentiment} · ${r.strength}\`` doesn't tell the user who the relationship is between. "positive · strong" for a result labelled "mentor" gives no context.

**Fix:** Build the sublabel from character names: `"Kira → Brother Cael"`.

---

## 10. Writer's Brief Panel

### MEDIUM — No way to close with Escape key
The panel is closed only by clicking the `X` button. `Escape` should also close it — this is standard for slide-in panels and expected by keyboard users.

### MEDIUM — Panel has no `aria-label` or `role="complementary"` / `role="dialog"`
The slide-in panel is a visually distinct UI region but has no landmark role. Screen readers cannot navigate to or away from it as a named region.

### LOW — "No event selected" empty state is not actionable
When `!activeEventId`, the panel shows "Select an event from the timeline bar." This is correct copy, but there is no link or button to take the user to the timeline. A "Go to Timeline" nudge would reduce dead ends.

---

## 11. Continuity Checker

### MEDIUM — Issues with no "navigate to" link show `undefined` path
Any issue without a `navigatePath` renders no navigation button, but some issue cards show a `ChevronRight` affordance even when navigation is not available (conditional rendering inside the card based on `issue.navigatePath`). Verify all issue types produce a valid path or explicitly omit the affordance.

### MEDIUM — "Suppress" toggle has no visible label
The `EyeOff`/`Eye` icon button for suppressing an issue has `title="Suppress issue"` but no `aria-label`. It's also visually ambiguous — hide vs. dismiss vs. ignore are different actions to different users.

**Fix:** Add `aria-label="Suppress this issue"` and consider surfacing the word "Suppress" on hover.

### LOW — Category section headings are all-caps small text
Category labels like "CHARACTERS", "ITEMS" use `text-[10px] font-semibold uppercase tracking-wider`. At 10px this may fail WCAG AA contrast on some themes. Bump to `text-xs` (12px) minimum.

---

## 12. Arc View

### HIGH — No explanation of what an empty cell means
A cell with no snapshot at a given event column is visually blank (or shows a `—` dash). The user cannot distinguish between "this character has no snapshot here" (data gap) and "the character hasn't appeared yet" (not introduced) from the grid alone. These are different states that affect how a writer interprets the arc.

**Fix:** Add a legend below the table or a tooltip on empty cells explaining the distinction.

### MEDIUM — Horizontal scroll on a dense grid has no scroll affordance
When many characters and events fill the grid, the table overflows and scrolls horizontally. There is no scrollbar hint, fade indicator, or "→ scroll" affordance. Users on touch devices or those who haven't discovered horizontal scroll may miss content.

**Fix:** Add a right-edge fade gradient as a scroll hint, or pin the row header (character names) with `position: sticky`.

---

## 13. Lore View

### MEDIUM — Category color picker in `AddCategoryForm` has no accessible labels
The color swatches are `<button>` elements with `style={{ background: c }}` and no text or `aria-label`. Screen readers announce them all as unlabelled buttons.

**Fix:** Add `aria-label={\`Color: ${c}\`}` (or a human name if a color name map exists) and `aria-pressed={color === c}`.

### LOW — Inline category rename (`onBlur` save) can lose changes unexpectedly
`onBlur={() => handleSaveCategoryEdit(cat.id)}` saves on any focus loss — including when the user tabs to the "Add" button or clicks a color swatch. This is expected behavior for inline editing but the lack of a "discard" affordance means hitting Escape (which calls `setEditingCategoryId(null)`) is the only way to cancel, and only keyboard users know this.

---

## 14. Factions View

### LOW — Faction list and detail panel layout is not obvious from first open
On first opening Factions with data, the layout is two columns (list | detail), but the detail panel is blank until a faction is selected. No empty-state placeholder in the detail area explains this. A user might think the panel is broken.

**Fix:** Add a "Select a faction to view its details" placeholder in the right panel when nothing is selected.

---

## Summary by Priority

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | CRITICAL | Global | No focus trap in modal overlays |
| 2 | CRITICAL | Search | Missing ARIA dialog roles on palette |
| 3 | HIGH | Global | `title` used as sole accessible name on 20+ buttons |
| 4 | HIGH | Global | Icon-only nav with no keyboard-accessible labels |
| 5 | HIGH | Character Detail | Back button uses `navigate(-1)` — breaks on direct URL |
| 6 | HIGH | Character Detail | Portrait upload label has no accessible name |
| 7 | HIGH | Timeline | Multiple timelines: no `role="tab"` pattern |
| 8 | HIGH | Search | No result cap per group |
| 9 | HIGH | Search | Location markers not focused on navigation |
| 10 | MEDIUM | Dashboard | `null` render during load — should be skeleton |
| 11 | MEDIUM | TopBar | Writer's Brief / Continuity icons have no labels |
| 12 | MEDIUM | Roster | Dead characters not distinguished in grid |
| 13 | MEDIUM | Search | No `aria-label` on clear button |
| 14 | MEDIUM | Search | Relationship sublabel doesn't show character names |
| 15 | MEDIUM | Writer's Brief | Escape key doesn't close panel |
| 16 | MEDIUM | Arc View | Empty cell meaning is ambiguous |
| 17 | MEDIUM | Arc View | No sticky row header for horizontal scroll |
| 18 | MEDIUM | Lore | Color swatches have no accessible labels |
| 19 | MEDIUM | World Selector | Import hint shown at wrong time |
| 20 | MEDIUM | World Selector | Import error has no icon treatment |
| 21 | LOW | Global | "..." vs "…" inconsistency in placeholder copy |
| 22 | LOW | TopBar | `aria-current="page"` missing on active nav item |
| 23 | LOW | Onboarding | Step skip copy inconsistent across steps |
| 24 | LOW | Search | Relationship sublabel not useful |
| 25 | LOW | Factions | No placeholder in detail panel when nothing selected |
