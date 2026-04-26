# Feature: Onboarding & Progressive Disclosure

## Overview

PlotWeave is powerful but dense — a first-time user opening a new world sees 10 nav tabs, an empty dashboard, and no signal about where to start. This feature makes the app intuitive from the first click without removing any functionality. The strategy is **progressive disclosure**: show what matters now, reveal complexity when the user is ready for it.

The work breaks into four independent pillars that can ship in any order.

---

## Pillar 1 — Tiered Navigation

### Problem

The TopBar nav treats "Characters" and "Factions" as peers, "Timeline" and "Arc" as equals. New users are paralysed by choice; the important things don't feel more important than the optional ones.

### Solution

Split the 10 nav items into two visual tiers:

**Core** (always prominent, full-size icons):
- Dashboard · Timeline · Characters · Maps

**Extended** (smaller or grouped, always accessible but visually secondary):
- Items · Lore · Factions · Relations · Arc · Settings

Implementation options in increasing complexity:
1. **Visual separator** — a thin `|` or slight gap between the two groups, no behaviour change. Lowest effort.
2. **Muted styling** — extended items rendered at slightly lower opacity until hovered. Still no behaviour change.
3. **Collapsible "More" group** — extended items hidden behind a `···` button that expands inline. Reduces default nav width significantly.

Recommended: start with option 1 (separator), evaluate whether option 3 is needed based on user feedback.

### Files to touch
- [src/components/TopBar.tsx](../../src/components/TopBar.tsx) — add `tier` field to `navItems` array; apply `cn()` variant based on tier.

---

## Pillar 2 — Empty-World Onboarding Wizard

### Problem

A newly created world shows an empty Dashboard with no guidance. The user doesn't know the time-cursor/snapshot model, doesn't know what to create first, and there's no on-ramp.

### Solution

When a world has **zero events**, replace the Dashboard content with a focused "Start your story" flow. This is not a modal or tooltip tour — it *is* the page for that moment.

#### Steps

```
Step 1 — Start your timeline
         “Your story unfolds over time. Create a timeline and your first moment.”
         → Input: timeline name  →  creates Timeline + first Chapter + first Event

Step 2 — Add your first character
         “Stories change because people do. Add someone to track across your timeline.”
         → Input: character name, optional description  →  creates Character

Step 3 — Set their starting point
         “Pick where they are at this moment. You can change this later at any point in the story.”
         → Dropdown: pick from existing events  →  creates CharacterSnapshot

Step 4 — Your story is now trackable ✓
         “Your story is alive. As you add more moments to your timeline, move between them —
          everything you see updates: where your characters are, what they carry, what’s changed.
          That’s the time cursor. It’s the heart of how PlotWeave works.”
         → CTA: “Go to Timeline”  →  normal Dashboard
```

Each step is completable in under 30 seconds. The user can **skip** at any step and access the full interface immediately — no forced flow.

#### Trigger condition

Show the wizard when:
- `timelines.length === 0` OR (`events.length === 0`)

Once any event exists the wizard never reappears (standard dashboard shows instead).

#### Component structure

```
src/features/onboarding/
  OnboardingWizard.tsx      — step controller + step renderers
  steps/
    StepTimeline.tsx        — timeline + chapter + event creation
    StepCharacter.tsx       — character creation
    StepPlace.tsx           — character snapshot placement
    StepDone.tsx            — completion screen
```

#### Files to touch
- [src/features/worlds/WorldDashboard.tsx](../../src/features/worlds/WorldDashboard.tsx) — render `<OnboardingWizard>` when trigger condition is met, normal dashboard otherwise.
- New files under `src/features/onboarding/`.

---

## Pillar 3 — Smart Empty States (per-section)

### Problem

Every section, when it has no data, shows either a blank page or a generic "nothing here yet" message. New users don't know what a section is *for* or whether they need it.

### Solution

Each section's empty state answers three questions:
1. **What is this for?** — one sentence
2. **When would I need it?** — one sentence (optional, for advanced features)
3. **How do I start?** — one primary action button

#### Target copy per section

| Section | Title | Body | Action |
|---------|-------|------|--------|
| **Maps** | "No maps yet" | "Upload an image of your world and place locations on it." | Add Map |
| **Items** | "No items yet" | "Track objects that characters carry, use, or lose over time." | Add Item |
| **Relations** | "No relationships yet" | "Define how characters know and feel about each other." | Add Relationship |
| **Arc** | "Nothing to visualize" | "The Arc view shows character states across every chapter. Add characters and events first." | Go to Timeline |
| **Lore** | "No lore pages yet" | "Document your world's history, rules, and mythology — things that don't change with time." | Add Page |
| **Factions** | "No factions yet" | "Factions are organizations characters can belong to — kingdoms, guilds, cults. Optional, but powerful for political stories." | Add Faction |

The "Optional, but powerful for…" language signals to the user that they don't *have* to use it.

#### Files to touch
- Each feature's roster/view component. Most already use `<EmptyState>` — just update the props.
- [src/features/maps/MapExplorerView.tsx](../../src/features/maps/MapExplorerView.tsx)
- [src/features/items/ItemRosterView.tsx](../../src/features/items/ItemRosterView.tsx)
- [src/features/relationships/RelationshipGraphView.tsx](../../src/features/relationships/RelationshipGraphView.tsx)
- [src/features/arc/CharacterArcView.tsx](../../src/features/arc/CharacterArcView.tsx)
- [src/features/lore/LoreView.tsx](../../src/features/lore/LoreView.tsx)
- [src/features/factions/FactionsView.tsx](../../src/features/factions/FactionsView.tsx)

---

## Pillar 4 — Dashboard as Living Guide

### Problem

The Dashboard shows static world metadata (creation date, world name). It adds no value beyond a loading screen.

### Solution

Make the Dashboard a **contextual suggestion engine** that adapts to the world's current state. As the user builds their world, the suggestions evolve and eventually disappear when everything is filled in.

#### Suggestion cards (show only when condition is true)

| Condition | Card title | Action |
|-----------|-----------|--------|
| No characters | "Add your first character" | → Characters |
| Characters exist but no events | "Add your first event" | → Timeline |
| Events exist but no character placed at any event | "Place a character on the timeline" | → Timeline |
| 2+ characters exist but no relationships | "Define how your characters relate" | → Relations |
| Events exist but no map | "Add a map to track where things happen" | → Maps |
| 5+ events exist but no lore | "Document your world's lore" (dismissible) | → Lore |
| 3+ characters exist but no factions (dismissible) | "Are there organizations in your world?" | → Factions |

Cards marked **dismissible** can be permanently hidden with an × button (stored in localStorage per world).

Below the suggestions: the existing summary stats (character count, event count, chapter count, etc.).

#### Component structure

```
src/features/worlds/WorldDashboard.tsx     — existing file, add suggestion section
src/features/worlds/DashboardSuggestion.tsx — reusable suggestion card component
```

#### Persistence

Dismissed card IDs stored in `localStorage` under key `plotweave-dismissed-suggestions-${worldId}` as a `string[]`.

---

## Pillar 5 — Tutorial Retirement

### Problem

A previous first-run feature (`TutorialWizard`) exists in the codebase. It guided the user through world creation, adding a character, and creating a timeline via a floating card overlay. Now that Pillar 2 delivers a more complete and narrative-toned first-run experience, the two systems overlap directly. Running both would result in a user being walked through setup twice, with conflicting copy, conflicting structure, and no coherent handoff between them.

The old tutorial also covered one concept the new wizard initially lacked — the **time cursor / chapter selector**. That gap is now closed by Pillar 2, Step 4 (see above).

### Solution

Retire `TutorialWizard` and `tutorialState.ts` entirely when Pillar 2 ships. World creation — the one step the old tutorial handled that Pillar 2 does not — is already handled by the existing `CreateWorldDialog`. No functionality is lost.

The old tutorial's localStorage key (`plotweave-tutorial`) is abandoned in place. No migration is required: users who completed the old tutorial have already set up their worlds, and the key is never read again.

---

## Implementation Order

1. **Pillar 3 — Smart empty states** — one component per section, no new architecture, highest ROI per hour of effort.
2. **Pillar 4 — Dashboard suggestions** — single file change + one new component, immediately makes the hub useful.
3. **Pillar 2 — Onboarding wizard** — biggest impact on first-run experience, moderate effort (~4 new components).
4. **Pillar 1 — Tiered navigation** — visual polish, tackle last once the flow is proven.

---

## Non-Goals

- No features are removed or hidden permanently.
- No route changes.
- No data model changes.
- No forced tutorial that blocks the user.
- The app remains fully functional with all ten nav sections accessible at all times.

---

## User Stories & Acceptance Criteria

---

### Pillar 1 — Tiered Navigation

**User Story**

As a new user opening WorldBreaker for the first time, I want the navigation bar to visually communicate which sections are essential and which are optional, so that I can confidently start without feeling paralysed by ten equally weighted choices.

**Acceptance Criteria**

*Given* I open any world in the app,  
*When* I look at the top navigation bar,  
*Then* I see a clear visual distinction between core items (Dashboard, Timeline, Characters, Maps) and extended items (Items, Lore, Factions, Relations, Arc, Settings) — expressed through a separator, muted opacity, or a collapsible group, at the developer's discretion.

*Given* the navigation is tiered,  
*When* I click any extended nav item,  
*Then* I navigate to that section without any additional steps — all items remain directly accessible.

*Given* the navigation is tiered,  
*When* I am an experienced user who knows all sections,  
*Then* the tiering does not prevent me from reaching any section — no item is hidden behind a toggle I must deliberately enable.

**Out of Scope**

- User-configurable tier preferences.
- Permanently hiding or removing any nav item.
- Changing navigation routes or section names.

---

### Pillar 2 — Onboarding Wizard

**User Story**

As a writer opening a brand-new world for the first time, I want a short, narrative-toned guided experience that walks me through creating my first timeline moment, my first character, and placing them in the story, so that I understand how the time-cursor model works and feel like I've already begun writing — not just configuring software.

**Tone requirement:** The wizard copy must feel like an invitation into a story, not a setup checklist. It should speak the writer's language (moments, characters, stories) and carry a sense of gentle excitement about what they are about to create.

**Acceptance Criteria**

*Given* I open a world that has zero events,  
*When* I navigate to the Dashboard,  
*Then* I see the onboarding wizard in place of the standard Dashboard content.

*Given* the wizard is showing,  
*When* I look at Step 1,  
*Then* I see narrative-toned copy that frames my action as beginning a story (not "create a database record"), an input field for a timeline name, and a primary action button to create the timeline, first chapter, and first event in a single step.

*Given* I fill in the timeline name and confirm,  
*When* Step 1 completes successfully,  
*Then* a Timeline, a first Chapter, and a first Event are created, and I am automatically advanced to Step 2.

*Given* the wizard is on Step 2,  
*When* I look at the screen,  
*Then* I see narrative-toned copy inviting me to add a character whose journey I want to follow, a name input, an optional description field, and a primary action to create the character.

*Given* I fill in the character name and confirm,  
*When* Step 2 completes successfully,  
*Then* the Character is created and I am automatically advanced to Step 3.

*Given* the wizard is on Step 3,  
*When* I look at the screen,  
*Then* I see narrative-toned copy prompting me to place my character in the story's first moment, and a dropdown pre-populated with the events that already exist (including the one created in Step 1).

*Given* I select an event from the dropdown and confirm,  
*When* Step 3 completes successfully,  
*Then* a CharacterSnapshot is created linking the character to the selected event, and I am automatically advanced to Step 4.

*Given* the wizard is on Step 4,  
*When* I look at the screen,  
*Then* I see a narrative-toned completion message that explicitly names and explains the **time cursor** — the mechanic by which moving between moments in the timeline updates all character states, locations, and inventory — and a single call-to-action button that navigates me to the Timeline view.

*Given* Step 1 has been completed and at least one event exists,  
*When* I navigate to the Dashboard at any point in the future,  
*Then* the wizard never appears again — the standard Dashboard is shown instead.

*Given* I am on any wizard step,  
*When* I click "Skip" (available at every step),  
*Then* I am taken immediately to the standard Dashboard and the full interface is available — nothing is blocked or deferred.

**Out of Scope**

- Multi-character or multi-timeline setup in the wizard.
- Editing wizard-created records before leaving the wizard.
- A way to relaunch the wizard after it has been completed.

---

### Pillar 3 — Smart Empty States

**User Story**

As a user visiting a section that contains no data, I want to see a purposeful message that explains what the section is for, whether I need it, and how to take my first action, so that I can decide in seconds whether this section is relevant to my story and start using it immediately if it is.

**Acceptance Criteria**

*Given* I visit the Maps section and no map layers exist,  
*When* I look at the empty state,  
*Then* I see the title "No maps yet", the body "Upload an image of your world and place locations on it.", and a primary button labelled "Add Map".

*Given* I visit the Items section and no items exist,  
*When* I look at the empty state,  
*Then* I see the title "No items yet", the body "Track objects that characters carry, use, or lose over time.", and a primary button labelled "Add Item".

*Given* I visit the Relations section and no relationships exist,  
*When* I look at the empty state,  
*Then* I see the title "No relationships yet", the body "Define how characters know and feel about each other.", and a primary button labelled "Add Relationship".

*Given* I visit the Arc section and no characters or events exist,  
*When* I look at the empty state,  
*Then* I see the title "Nothing to visualize", the body "The Arc view shows character states across every chapter. Add characters and events first.", and a primary button labelled "Go to Timeline".

*Given* I visit the Lore section and no lore pages exist,  
*When* I look at the empty state,  
*Then* I see the title "No lore pages yet", the body "Document your world's history, rules, and mythology — things that don't change with time.", and a primary button labelled "Add Page".

*Given* I visit the Factions section and no factions exist,  
*When* I look at the empty state,  
*Then* I see the title "No factions yet", the body "Factions are organizations characters can belong to — kingdoms, guilds, cults. Optional, but powerful for political stories.", and a primary button labelled "Add Faction".

*Given* I click the primary action button in any empty state,  
*When* the action resolves,  
*Then* I land in the correct creation flow for that section — no secondary navigation required.

**Out of Scope**

- Empty state variations based on partial data (e.g., "you have characters but no relationships").
- Animated or interactive empty state illustrations.
- Dismissible empty states.

---

### Pillar 4 — Dashboard as Living Guide

**User Story**

As a user actively building my world, I want the Dashboard to surface contextual suggestions based on what I have and have not yet created, so that I always have a clear next step without having to manually inspect every section to figure out what is missing.

**Acceptance Criteria**

*Given* I open the Dashboard,  
*When* one or more suggestion conditions are true,  
*Then* I see at most 3 suggestion cards displayed — the most relevant ones based on the priority order defined in the feature spec.

*Given* the condition "no characters exist" is true,  
*When* I see the Dashboard,  
*Then* a suggestion card with the title "Add your first character" is shown, and clicking it navigates me to the Characters section.

*Given* characters exist but no events exist,  
*When* I see the Dashboard,  
*Then* a suggestion card with the title "Add your first event" is shown, and clicking it navigates me to the Timeline section.

*Given* events exist but no character has been placed at any event,  
*When* I see the Dashboard,  
*Then* a suggestion card with the title "Place a character on the timeline" is shown, and clicking it navigates me to the Timeline section.

*Given* 2 or more characters exist but no relationships exist,  
*When* I see the Dashboard,  
*Then* a suggestion card with the title "Define how your characters relate" is shown, and clicking it navigates me to the Relations section.

*Given* events exist but no map layer exists,  
*When* I see the Dashboard,  
*Then* a suggestion card with the title "Add a map to track where things happen" is shown, and clicking it navigates me to the Maps section.

*Given* 5 or more events exist but no lore pages exist,  
*When* I see the Dashboard,  
*Then* a dismissible suggestion card with the title "Document your world's lore" is shown, and clicking it navigates me to the Lore section.

*Given* 3 or more characters exist but no factions exist,  
*When* I see the Dashboard,  
*Then* a dismissible suggestion card with the title "Are there organizations in your world?" is shown, and clicking it navigates me to the Factions section.

*Given* a dismissible suggestion card is visible,  
*When* I click its dismiss (×) button,  
*Then* the card is permanently removed from the Dashboard for this world and never reappears — even after refreshing or reopening the app.

*Given* I have dismissed one or more cards,  
*When* I open a different world,  
*Then* the dismissed state of the previous world does not affect the suggestions shown for the new world — dismissals are scoped per world.

*Given* a suggestion condition is no longer true (e.g., I added a character after seeing the "Add your first character" card),  
*When* I return to the Dashboard,  
*Then* that suggestion card is no longer shown — it disappears automatically.

*Given* I am on the Dashboard with or without active suggestions,  
*When* I scroll down,  
*Then* the existing world summary statistics (character count, event count, chapter count, etc.) are still visible below the suggestion cards.

**Out of Scope**

- Suggestions that require cross-world data.
- User-defined custom suggestions.
- A way to un-dismiss a dismissed card from within the app.
- Suggestion cards for sections that do not yet exist in the app.

---

### Pillar 5 — Tutorial Retirement

**User Story**

As a new user opening WorldBreaker for the first time, I want a single, coherent first-run experience that sets up my world and teaches me the app's core concept, so that I am not walked through overlapping or conflicting setup flows.

**Acceptance Criteria**

*Given* Pillar 2 has shipped,  
*When* I create a new world and navigate to its Dashboard,  
*Then* I see the Pillar 2 onboarding wizard — not the old `TutorialWizard` overlay.

*Given* the old `TutorialWizard` is removed,  
*When* I navigate to any section of the app,  
*Then* no floating tutorial card appears at any step — the old tutorial is completely gone.

*Given* a user previously completed the old tutorial and has data in their world,  
*When* they open the app after the old tutorial is removed,  
*Then* all world data they created (characters, timelines, chapters) is intact — no content is lost as a result of retiring the feature.

*Given* world creation was previously a step in the old tutorial,  
*When* the old tutorial is removed,  
*Then* world creation still works via the existing Create World dialog — no regression in that flow.

*Given* the old tutorial stored its state under the localStorage key `plotweave-tutorial`,  
*When* the tutorial is retired,  
*Then* that key is abandoned in place and never read — no migration or cleanup is required of users.

**Out of Scope**

- Providing a way to replay or opt back in to the old tutorial.
- Migrating or deleting the `plotweave-tutorial` localStorage key from existing users' browsers.
- Any UI affordance referencing the retired tutorial.
