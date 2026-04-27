# UX Specification: Onboarding & Progressive Disclosure

**Input document:** `docs/features/onboarding-ux.md`  
**Persona:** UX/UI Expert  
**Date:** 2026-04-25

---

## 1. Scope

This document covers user flows, interaction states, visual hierarchy, microcopy, and accessibility requirements for all four pillars. It does not cover implementation or data architecture.

---

## 2. Pillar 1 — Tiered Navigation

### 2.1 User Flow

```
User opens a world
    ↓
TopBar renders with 10 nav items
    ↓
User perceives two visual groups (core / extended)
    ↓
User selects a core item → navigated immediately
    OR
User discovers extended items later → selects one → navigated immediately
    ↓
No items are ever hidden, gated, or require extra steps to reach
```

### 2.2 Friction Points

| Point | Risk | Mitigation |
|-------|------|------------|
| Extended items too muted | Users never discover Lore, Factions, etc. | Ensure hover state clearly signals interactivity; muted means *slightly* de-emphasised, not invisible |
| Separator too subtle | Tiers blend together; no perceived hierarchy | Separator must be visually distinct at a glance, not just at close inspection |
| Perceived as two-class nav | Power users feel extensions are "less real" | All items must have identical click affordance and response time |

### 2.3 Interaction States

| Element | State | Treatment |
|---------|-------|-----------|
| Core nav item | Default | Full opacity, full-size icon + label |
| Core nav item | Hover | Existing hover style (unchanged) |
| Core nav item | Active / current route | Existing active style (unchanged) |
| Core nav item | Focus (keyboard) | Visible focus ring, 2px minimum |
| Extended nav item | Default | Developer's choice: separator / muted opacity / collapsible — all options must still show label and icon |
| Extended nav item | Hover | Same hover style as core; opacity normalises if muted |
| Extended nav item | Active / current route | Same active style as core — being on an extended page should feel equally valid |
| Extended nav item | Focus (keyboard) | Visible focus ring, identical to core items |

### 2.4 Visual Hierarchy

- Core items come first in both visual and DOM order.
- Extended items follow, separated by the chosen visual treatment.
- No item is pushed off-screen or below a fold at standard viewport widths.

### 2.5 Accessibility

- **Tab order:** Core items first (left to right), then extended items — matches visual order.
- **No items removed from DOM:** Screen readers must be able to reach all 10 nav items.
- **ARIA current:** Active route item carries `aria-current="page"`.
- **Contrast:** Extended items in their muted default state must maintain a minimum 3:1 contrast ratio against the nav background (WCAG AA for UI components).
- **Separator (if used):** Must be `aria-hidden="true"` — it is decorative, not semantic.

### 2.6 Heuristic Critique

**Violation to avoid — Recognition over recall:** If extended items are collapsed behind a "···" button, the label must appear on hover/focus *immediately* (no delay). Users must not need to remember that the "···" button exists in order to navigate to a section they know they want.

---

## 3. Pillar 2 — Empty-World Onboarding Wizard

### 3.1 User Flow

```
User opens a newly created world
    ↓
Dashboard renders → trigger condition true (no events)
    ↓
Wizard replaces Dashboard content
    ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 1 — "Your story begins with a moment"             │
│  User enters a timeline name                            │
│  → "Begin" → creates Timeline + Chapter + Event        │
│  → "Skip and explore on my own" → exit to Dashboard     │
└─────────────────────────────────────────────────────────┘
    ↓ (on complete)
┌─────────────────────────────────────────────────────────┐
│  STEP 2 — "Every story needs someone to follow"         │
│  User enters a character name (+ optional description)  │
│  → "Add them" → creates Character                       │
│  → "Skip for now" → jump to Step 4 (no one to place)   │
└─────────────────────────────────────────────────────────┘
    ↓ (on complete)
┌─────────────────────────────────────────────────────────┐
│  STEP 3 — "Where does their story begin?"               │
│  User picks an event from a pre-populated dropdown      │
│  → "Place them here" → creates CharacterSnapshot        │
│  → "Skip for now" → advance to Step 4                  │
└─────────────────────────────────────────────────────────┘
    ↓ (on complete or skip)
┌─────────────────────────────────────────────────────────┐
│  STEP 4 — "Your world is alive"                         │
│  Completion message + explanation of the time cursor    │
│  → "Go to my Timeline" → navigate to Timeline view     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Step-by-Step Friction Analysis

**Step 1**
- The concept of a "timeline" is unfamiliar to new users. The heading must abstract it: "moment" or "first scene" is more intuitive than "timeline."
- The input must be pre-focused on mount — the user should be able to start typing immediately.
- Empty submission must block with an inline error, not a toast or modal.

**Step 2**
- "Optional description" must be clearly secondary — a small "Add a description (optional)" expander below the name field, not a mandatory-looking second input.
- Skipping this step must also skip Step 3 silently — the user should not arrive at Step 3 with an empty character to place.

**Step 3**
- The event dropdown must pre-select the event created in Step 1. The user should not need to search or scroll.
- **Edge case:** If Step 1 was completed via another path (unlikely but possible) and the dropdown has multiple events, the Step 1 event should still be the default selection.
- **Edge case:** If Step 1 was skipped and no events exist, this step must not show an empty dropdown. Instead, show a soft message: "No moments yet — you can place your character later in the Timeline." CTA changes to "Continue" (not "Place them here").

**Step 4**
- This is a reward screen, not a form. No inputs, no validation.
- The explanation of the time cursor must be in narrative language, not technical: "Move through your timeline and the world updates around it."
- The CTA must navigate to Timeline view — it should not just close the wizard.

### 3.3 Interaction States

#### Step Indicator (progress dots)

| State | Treatment |
|-------|-----------|
| Inactive step | Small unfilled circle, muted colour |
| Active step | Filled circle, accent colour |
| Completed step | Filled circle with checkmark, success colour |

#### Input Fields (Steps 1 & 2)

| State | Treatment |
|-------|-----------|
| Default | Standard border, placeholder text |
| Focused | Accent-colour border ring, placeholder visible |
| Filled | Standard border, user text, clear button optional |
| Error | Red/destructive border, inline error message below field |
| Disabled | N/A — no disabled inputs in the wizard |

#### Primary CTA Button (per step)

| State | Treatment |
|-------|-----------|
| Default | Prominent filled button, full width or right-aligned |
| Hover | Slight darkening / elevation |
| Focus | Visible focus ring |
| Loading | Spinner replaces label; button disabled to prevent double-submit |
| Disabled | Greyed out when required field is empty |

#### Skip Link

| State | Treatment |
|-------|-----------|
| Default | Subtle — small text, muted colour, below primary CTA |
| Hover | Underline appears or colour intensifies |
| Focus | Visible focus ring |

### 3.4 Visual Hierarchy per Step

```
┌────────────────────────────────────────────────────────┐
│  ●  ○  ○  ○     ← step indicator, top of panel        │
│                                                        │
│  Narrative heading             ← H2, large, prominent  │
│  Subtext — what this step means for the story          │
│    ← smaller, muted                                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Input field (pre-focused)                        │  │
│  └──────────────────────────────────────────────────┘  │
│  ✕ Inline error message (hidden until triggered)       │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Secondary input (optional, collapsed by default) │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [       Primary CTA button — full width       ]       │
│                                                        │
│           Skip for now →         ← subtle link        │
└────────────────────────────────────────────────────────┘
```

Step 4 (completion):

```
┌────────────────────────────────────────────────────────┐
│  ●  ●  ●  ●     ← all dots filled / checked           │
│                                                        │
│  Narrative heading (celebratory)   ← H2, prominent    │
│  What the user can now do          ← subtext, muted   │
│                                                        │
│  [       Go to my Timeline — primary CTA       ]      │
└────────────────────────────────────────────────────────┘
```

### 3.5 Microcopy

| Location | Copy |
|----------|------|
| Step 1 heading | "Your story begins with a moment" |
| Step 1 subtext | "Give your timeline a name — it can be as grand as an age or as intimate as a single journey." |
| Step 1 input placeholder | "The Age of Embers, The Long Road, Act One…" |
| Step 1 CTA | "Begin" |
| Step 1 skip | "Skip and explore on my own →" |
| Step 1 empty error | "Give this moment a name before we begin." |
| Step 2 heading | "Every story needs someone to follow" |
| Step 2 subtext | "Who are we watching? Add the first character whose life will change." |
| Step 2 name placeholder | "Kira Ashvale, The Wanderer, Brother Cael…" |
| Step 2 description expander | "Add a description (optional)" |
| Step 2 CTA | "Add them to the story" |
| Step 2 skip | "Skip for now →" |
| Step 2 empty error | "Give your character a name." |
| Step 3 heading | "Where does their story begin?" |
| Step 3 subtext | "Pick the moment when we first meet them. You can change this any time." |
| Step 3 CTA | "Place them here" |
| Step 3 skip | "Skip for now →" |
| Step 3 no-events message | "No moments yet — you can place your character later in the Timeline." |
| Step 3 no-events CTA | "Continue" |
| Step 4 heading | "Your world is alive" |
| Step 4 subtext | "Move through your timeline and everything updates — where characters are, what they carry, what's changed. Your story is now trackable." |
| Step 4 CTA | "Go to my Timeline" |

### 3.6 Accessibility

**Focus management:**
- On wizard mount: focus moves to the Step 1 heading or the first input (developer's choice — first input is more efficient).
- On step advance: focus moves to the heading of the new step (not the input — give the user a moment to read the narrative context before typing).
- On wizard exit (skip): focus moves to the first interactive element of the standard Dashboard, or the main content region (`<main>`).
- On Step 4 CTA click: focus is irrelevant — navigating away.

**Step indicator ARIA:**
```html
<nav aria-label="Wizard progress">
  <ol>
    <li aria-current="step" aria-label="Step 1 of 4: Begin your story">●</li>
    <li aria-label="Step 2 of 4: Add a character">○</li>
    <li aria-label="Step 3 of 4: Place them in the story">○</li>
    <li aria-label="Step 4 of 4: Done">○</li>
  </ol>
</nav>
```

**Form inputs:**
- Every input must have a visible `<label>`, not just a placeholder. Placeholders disappear on focus and fail low-vision users.
- Error messages must be associated via `aria-describedby` on the input.

**Skip link:**
- Must be a `<button>` or `<a>` — not a `<span>` with an onClick handler.
- Must be reachable by Tab before the primary CTA (place it in DOM before CTA, style it below with CSS if needed) — or after CTA is acceptable; either order is fine as long as it's reachable.

**Loading state:**
- When primary CTA is in loading state, `aria-busy="true"` on the button; `aria-label` updates to "Creating… please wait".

**Keyboard shortcuts:**
- `Enter` submits the current step's form.
- `Escape` does nothing — do not treat it as skip. Users press Escape instinctively when trying to dismiss things; silently skipping them would be unexpected.

**Colour and tone:**
- The playful narrative tone must not rely solely on colour to convey meaning. Step completion (dot → checkmark) uses both colour *and* shape change.
- Error states use both a colour change (red border) and an icon + text message — never colour alone.

---

## 4. Pillar 3 — Smart Empty States

### 4.1 User Flow

```
User navigates to a section (Maps / Items / Relations / Arc / Lore / Factions)
    ↓
Section has no data
    ↓
Empty state component renders in place of the data view
    ↓
User reads: what is this for? + optional: when would I need it?
    ↓
User clicks action button
    → Section-specific creation flow begins (inline or panel)
    OR
    → Navigates to another section (Arc: "Go to Timeline")
    ↓
User creates first record
    ↓
Empty state is replaced by the normal data view
```

### 4.2 Friction Points

| Point | Risk | Mitigation |
|-------|------|------------|
| Arc empty state CTA navigates away | User loses context — was in Arc, now in Timeline | The button copy "Go to Timeline" sets expectation; Arc has nothing to show until data exists, so leaving is correct |
| Factions body copy says "Optional" | Could read as a warning or dismissal | Tone must be inviting, not apologetic: "Optional, but powerful" is correct — keep it |
| Action button triggers navigation vs inline creation | Inconsistent affordance across sections | Accept the inconsistency; each section's creation flow is different. Prioritise the most direct path per section |

### 4.3 Interaction States

| Element | State | Treatment |
|---------|-------|-----------|
| Empty state container | Default | Centred, ample vertical whitespace, no border needed |
| Illustrative icon (if used) | Default | Decorative, `aria-hidden="true"`, muted colour |
| Title text | Default | Medium weight, body-size or slightly larger |
| Body text | Default | Regular weight, muted colour, max ~60 chars wide for readability |
| Action button | Default | Primary filled style |
| Action button | Hover | Slight darkening |
| Action button | Focus | Visible focus ring |
| Action button | Loading | Spinner, disabled to prevent double-fire |

### 4.4 Visual Hierarchy

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│              [Illustrative icon — optional]            │
│                                                        │
│                  Title (medium weight)                 │
│          Body text (muted, max ~60 chars wide)         │
│                                                        │
│              [     Action button     ]                 │
│                                                        │
└────────────────────────────────────────────────────────┘
```

Centre-aligned. No secondary actions. No links to documentation. One clear next step.

### 4.5 Accessibility

- **Title:** Rendered as an `<h2>` (or the appropriate heading level for the page's heading hierarchy — not a `<p>` styled to look like a heading).
- **Action button:** Label is descriptive enough to be understood without the visual context. "Add Map" is acceptable; "Click here" is not.
- **Icon (if used):** `aria-hidden="true"` — purely decorative.
- **Empty state container:** No `role="alert"` — this is not an error condition. It is the default state of an empty section.

### 4.6 Heuristic Critique

**Violation to avoid — Consistency:** All six empty states must use the same visual template (icon + title + body + button). If Maps gets an illustration and Items gets plain text, users lose trust in the consistency of the application.

---

## 5. Pillar 4 — Dashboard as Living Guide

### 5.1 User Flow

```
User opens Dashboard
    ↓
Suggestion section renders above the world stats
    ↓
At most 3 suggestion cards are shown (priority-ordered)
    ↓
┌──────────────────────────────────────────────────────┐
│  User clicks a card's navigate action                │
│      → navigates to the relevant section             │
└──────────────────────────────────────────────────────┘
    OR
┌──────────────────────────────────────────────────────┐
│  User clicks × on a dismissible card                 │
│      → card disappears with a smooth transition      │
│      → remaining cards stay in place (no reflow)     │
│      → dismissal persisted to localStorage           │
└──────────────────────────────────────────────────────┘
    OR
┌──────────────────────────────────────────────────────┐
│  User satisfies a suggestion's condition              │
│  (e.g. creates a character)                          │
│      → on next Dashboard visit, card is gone         │
│      → next priority card takes its slot (up to 3)  │
└──────────────────────────────────────────────────────┘
    ↓
User scrolls below suggestions
    ↓
World stats (character count, event count, etc.) are visible
```

### 5.2 Friction Points

| Point | Risk | Mitigation |
|-------|------|------------|
| Accidental dismiss | User loses a suggestion they wanted | Per AC, dismissal is permanent. Accept this. Dismiss button requires deliberate targeting (small, requires intentional click) |
| Cards reflow after dismiss | Jarring layout jump | Animate card exit (fade + collapse height) before removing from DOM |
| "No suggestions" state | Empty section feels like a bug | When all conditions are met, remove the suggestion section entirely; stats rise naturally. No "all done!" message needed — absence is the reward |
| Non-dismissible cards feel nagging | User can't make them go away except by acting | These only show for genuinely blocking gaps (no characters, no events). They are not nagging — they are navigation shortcuts. Once the user acts, they vanish |

### 5.3 Interaction States

#### Suggestion Card

| Element | State | Treatment |
|---------|-------|-----------|
| Card container | Default | Subtle background (slightly elevated from page), rounded corners, no harsh border |
| Card container | Hover | Very slight shadow increase — signals interactivity of the whole card or just the button |
| Navigate CTA | Default | Text link or ghost button style — less prominent than a primary button |
| Navigate CTA | Hover | Colour shift, underline or arrow animation |
| Navigate CTA | Focus | Visible focus ring |
| Dismiss button (×) | Default | Small, muted — deliberately not the visual focus |
| Dismiss button (×) | Hover | Colour intensifies (e.g. muted → text-colour) |
| Dismiss button (×) | Focus | Visible focus ring |
| Card | Exiting (after dismiss) | Fade opacity to 0 + collapse height — duration ~200ms |

### 5.4 Visual Hierarchy

```
┌─────────────────────────────────────────────────────┐
│  [Section heading: "Next steps" or no heading]      │
│                                                     │
│  ┌────────────────────────────────────────────┐ [×]│  ← × only if dismissible
│  │  Card title (medium weight)                │    │
│  │  [Navigate →]   ← subtle CTA              │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  ┌────────────────────────────────────────────┐ [×]│
│  │  ...                                       │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  ┌────────────────────────────────────────────┐    │  ← no × (non-dismissible)
│  │  ...                                       │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  ─────────────────── divider ───────────────────── │
│                                                     │
│  World stats (existing)                             │
└─────────────────────────────────────────────────────┘
```

### 5.5 Microcopy

| Suggestion ID | Card title | Navigate CTA copy |
|---------------|------------|-------------------|
| `add-character` | "Add your first character" | "Go to Characters →" |
| `add-first-event` | "Add your first event" | "Go to Timeline →" |
| `place-character` | "Place a character on the timeline" | "Go to Timeline →" |
| `add-relationships` | "Define how your characters relate" | "Go to Relations →" |
| `add-map` | "Add a map to track where things happen" | "Go to Maps →" |
| `document-lore` | "Document your world's lore" | "Go to Lore →" |
| `add-factions` | "Are there organizations in your world?" | "Go to Factions →" |

Dismiss button `aria-label` pattern (see §5.6):

```
aria-label="Dismiss: Document your world's lore"
```

### 5.6 Accessibility

**Live region — card removal:**
```html
<section aria-live="polite" aria-label="Suggested next steps">
  <!-- suggestion cards render here -->
</section>
```
When a card is removed, the screen reader announces the change without interrupting the user mid-sentence (`polite`, not `assertive`).

**Dismiss button:**
```html
<button aria-label="Dismiss: Document your world's lore">×</button>
```
The visible label is "×" (decorative). The accessible name must include the title of the card being dismissed so a screen reader user knows what they are dismissing.

**Navigate CTA:**
- Must be a `<button>` (triggers navigation via router) or `<a>` (href to route).
- Label must be meaningful in isolation: "Go to Lore →" is acceptable; "Learn more" is not.

**Keyboard interaction:**
- Tab navigates between cards and within each card (navigate CTA → dismiss button).
- After dismissing a card with Enter/Space: focus moves to the next card's navigate CTA. If no cards remain, focus moves to the world stats section heading.
- Cards must not auto-dismiss without user interaction.

**Touch target:**
- Dismiss button (×): minimum 44×44px clickable/tappable area, even if the visible icon is smaller (use padding).

**Colour contrast:**
- Card title and CTA must meet WCAG AA (4.5:1 for normal text).
- Dismiss button (×) in its default muted state must still meet 3:1 (UI component threshold).

---

## 6. Cross-Pillar Accessibility Requirements

| Requirement | Applies to | Standard |
|-------------|-----------|---------|
| All interactive elements reachable by Tab | All pillars | WCAG 2.1 AA — 2.1.1 |
| Visible focus indicator, ≥ 2px ring | All pillars | WCAG 2.1 AA — 2.4.7 |
| No information conveyed by colour alone | Wizard step dots, error states, faction swatches | WCAG 2.1 AA — 1.4.1 |
| Text contrast ≥ 4.5:1 (normal text) | All pillars | WCAG 2.1 AA — 1.4.3 |
| UI component contrast ≥ 3:1 | Muted nav items, dismiss button, input borders | WCAG 2.1 AA — 1.4.11 |
| Form inputs have visible labels (not placeholder-only) | Wizard steps 1 & 2 | WCAG 2.1 AA — 1.3.1, 3.3.2 |
| Error messages associated with inputs via aria-describedby | Wizard steps 1 & 2 | WCAG 2.1 AA — 3.3.1 |
| Focus managed on dynamic content changes | Wizard step advance, card dismiss | WCAG 2.1 AA — 2.4.3 |
| Screen reader notified of dynamic section changes | Suggestion card removal | WCAG 2.1 AA — 4.1.3 |

---

## 7. Heuristic Review — Cross-Pillar

| Heuristic (Nielsen) | Violation risk | Recommendation |
|---------------------|---------------|----------------|
| **Visibility of system status** | Wizard loading state is invisible if no spinner shown | Always show a loading state on primary CTA while DB writes complete |
| **User control and freedom** | Dismissed suggestions cannot be un-dismissed | Acceptable per product decision. Mitigate by making dismiss button hard to activate accidentally (small, requires deliberate click) |
| **Consistency and standards** | Empty states across 6 sections must look identical | Enforce a single `<EmptyState>` component — no one-off implementations |
| **Error prevention** | Double-submit on wizard CTA | Disable button and show spinner immediately on click |
| **Recognition over recall** | Extended nav items behind "···" | If collapsible nav is chosen, tooltip or label must appear on hover without a click |
| **Aesthetic and minimalist design** | Suggestion section adds 3 new visual elements to Dashboard | Cap at 3 cards strictly; if 0 conditions are met, remove the section entirely — no "You're all caught up!" empty state message |
