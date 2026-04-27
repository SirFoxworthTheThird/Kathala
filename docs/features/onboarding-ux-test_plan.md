# Onboarding UX — Test Plan

**QA Engineer review of `src/features/onboarding/` and `src/features/worlds/`**

---

## Scope

Covers all four pillars from `docs/features/onboarding-ux.md`:

| Pillar | Feature |
|--------|---------|
| 1 | Tiered navigation (TopBar) |
| 2 | Onboarding wizard (OnboardingWizard + StepTimeline/Character/Place/Done) |
| 3 | Smart empty states (per-feature EmptyState updates) |
| 4 | Dashboard suggestions (DashboardSuggestion + SUGGESTION_RULES) |

---

## Testing strategy

`@testing-library/react` is **not installed**. The available stack is:

- `vitest` + `jsdom` + `fake-indexeddb` — DB-layer integration tests (same pattern as existing `src/db/hooks/__tests__/`)
- Suggestion rule logic extracted to `src/features/worlds/suggestionRules.ts` — pure function unit tests
- Wizard state machine is pure in-memory logic — testable via direct function calls without React
- Component rendering and accessibility require manual or E2E verification (Playwright)

---

## Pillar 2 — Onboarding Wizard

### AC Coverage Matrix

| Acceptance Criterion | Test ID | Method |
|---------------------|---------|--------|
| Empty world triggers wizard | WIZ-01 | DB integration |
| World with timeline does not trigger wizard | WIZ-02 | DB integration |
| World with events but no timeline… (N/A — impossible data model) | — | N/A |
| Whitespace-only timeline name rejected | WIZ-10 | DB integration (trim check) |
| Step 1 creates timeline + chapter + event | WIZ-03 | DB integration |
| `event.id` passed to step 3 | WIZ-04 | DB integration (wizard CRUD sequence) |
| Step 2 whitespace-only name rejected | WIZ-11 | DB integration |
| Step 2 creates character | WIZ-05 | DB integration |
| Step 2 skip → step 4 (step 3 bypassed) | WIZ-06 | Logic test (pure) |
| Step 3 creates snapshot linking character ↔ event | WIZ-07 | DB integration |
| Step 3 with null characterId falls through to skip | WIZ-08 | DB integration |
| Step 3 with no events shows "Continue" path | WIZ-09 | DB integration |
| Full wizard flow completes without DB errors | WIZ-12 | DB integration |
| Duplicate timeline name allowed (no unique constraint) | WIZ-13 | DB integration |

### Edge Cases and Vulnerabilities

1. **Whitespace-only names** — `"   "` must be rejected before DB write. `name.trim()` is called in both StepTimeline and StepCharacter, but the validation check uses `!name.trim()` (correct). Test both.
2. **Step 2 skip bypasses step 3** — `handleStep2Skip` sets step directly to 4, not calling `advance()`. If `advance()` ever changed to increment by more than 1, the skip would still be correct, but regression risk exists.
3. **Null characterId guard in StepPlace** — `if (!characterId || !selectedEventId) { onSkip(); return }`. This is the only defence against a null character reaching `upsertSnapshot`. Test it.
4. **`upsertSnapshot` idempotency** — calling it twice with the same `characterId + eventId` should update, not duplicate. Verify via snapshot count.
5. **Wizard latch** — once set, it stays mounted until `onExit()`. No regression path should clear it prematurely.
6. **`createdEventId` pre-selection** — step 3 pre-selects the event from step 1. If step 1 created event `A`, step 3 must present `A` as the default. Test that the event exists in DB.
7. **Step 1 color** — `createTimeline` receives `color: '#6366f1'`. `Timeline.color` is typed `string`, not `string | null`. Passing `null` would be a TypeScript error — confirmed fixed.

---

## Pillar 4 — Dashboard Suggestions

### AC Coverage Matrix

| Acceptance Criterion | Test ID | Method |
|---------------------|---------|--------|
| `add-character` fires when characterCount === 0 | SUGG-01 | Unit |
| `add-character` does NOT fire when characterCount > 0 | SUGG-02 | Unit |
| `add-first-event` fires only when chars > 0 AND events === 0 | SUGG-03 | Unit |
| `place-character` fires when events > 0 AND no snapshots | SUGG-04 | Unit |
| `add-relationships` fires when chars ≥ 2 AND rels === 0 | SUGG-05 | Unit |
| `add-map` fires when events > 0 AND maps === 0 | SUGG-06 | Unit |
| `document-lore` fires when events ≥ 5 AND lore === 0 | SUGG-07 | Unit |
| `add-factions` fires when chars ≥ 3 AND factions === 0 | SUGG-08 | Unit |
| Cap at MAX_SUGGESTIONS (3) | SUGG-09 | Unit |
| Dismissed rule excluded | SUGG-10 | Unit |
| Multiple dismissed rules excluded | SUGG-11 | Unit |
| Priority order preserved (array order = display order) | SUGG-12 | Unit |
| Non-dismissible rule cannot be dismissed | SUGG-13 | Unit (contract check) |
| Empty world shows only `add-character` (not conflicting rules) | SUGG-14 | Unit |
| Fully built world shows 0 suggestions | SUGG-15 | Unit |

### Edge Cases and Vulnerabilities

1. **Mutually exclusive rules not enforced** — `add-character` (chars=0) and `add-first-event` (chars>0) cannot both fire at once by definition. But `add-first-event` and `place-character` CAN co-fire (chars>0, events=0 → place-character condition is `events>0`, so they can't). Verify.
2. **`document-lore` boundary** — fires at `events >= 5`, not `> 4`. Test exactly 4 (false) and 5 (true).
3. **`add-factions` boundary** — fires at `chars >= 3`. Test 2 (false) and 3 (true).
4. **Dismissal scoped per world** — key `plotweave-dismissed-suggestions-${worldId}` must differ across worlds. Verified at the key construction level; dismissal from world A must not affect world B.
5. **Corrupted localStorage** — if `localStorage.getItem(dismissedKey)` returns non-JSON, the `try/catch` in `useState` initializer falls back to `[]`. Verified in implementation.
6. **`dismissedIds` XSS surface** — suggestion IDs are static constants (`SuggestionRule.id`), not user-controlled, so no injection risk.
7. **Cap is AFTER dismiss filter** — 3 dismissible rules dismissed → remaining undismissed rules fill up to 3. Test: dismiss 2 of top 3, verify 3rd is still shown.

---

## Pillar 1 — Tiered Navigation

### AC Coverage Matrix

| Acceptance Criterion | Test ID | Method |
|---------------------|---------|--------|
| Core nav items visible at full opacity | NAV-01 | Manual / E2E |
| Extended nav items at reduced opacity | NAV-02 | Manual / E2E |
| Visual separator between tiers | NAV-03 | Manual / E2E |

*No logic to unit-test in TopBar — it is a pure rendering concern.*

---

## Pillar 3 — Smart Empty States

### AC Coverage Matrix

| Feature | Updated? | Test ID | Method |
|---------|----------|---------|--------|
| Maps empty state | Yes | ES-01 | Manual |
| Items empty state | Yes | ES-02 | Manual |
| Relationships empty state | Yes | ES-03 | Manual |
| Arc empty state | Yes | ES-04 | Manual |
| Lore empty state | Yes | ES-05 | Manual |
| Factions empty state | Yes | ES-06 | Manual |

*Empty state copy is static strings — visual/manual verification only.*

---

## Security & Robustness Notes

1. **localStorage is synchronous and blocking** — the `try/catch` in the `useState` initializer protects against `JSON.parse` errors. The `dismissSuggestion` function writes synchronously; no async race possible.
2. **No user-controlled data flows into suggestion rule evaluation** — `WorldSummaryData` fields are counts from DB queries. No injection surface.
3. **`upsertSnapshot` race** — two rapid submits of StepPlace could call `upsertSnapshot` concurrently. The dedup check inside `upsertSnapshot` handles the "same characterId+eventId" case by updating in-place, so the result is still a single record. Not a vulnerability, but worth knowing.
4. **Step indicator is read-only** — step dots are `<span>` elements, not interactive. Users cannot skip forward by clicking. ✓

---

## Automated Test Files

| File | What it tests |
|------|---------------|
| `src/features/onboarding/__tests__/wizardCrud.test.ts` | DB integration: full wizard CRUD sequence, edge cases |
| `src/features/worlds/__tests__/suggestionRules.test.ts` | Pure unit: all 7 rules, cap, dismissal, boundary values |
