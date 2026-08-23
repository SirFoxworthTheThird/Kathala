# Writer run — 23 Aug 2026, at `f3c9cb0`

Fourth writer's-eye session. Everything below happened in the production build
(`vite build` + `vite preview` at `localhost:4173`) driven with Playwright
against a persistent profile.

The brief was pointed: **34 commits landed since the last run at `6e2ac29`**, so
the question was what that work broke, half-finished or made worse — a
regression weighted above a new low-severity finding. Five-plus library books
were also added by another contributor in that window and had never been
reviewed.

Built **The Salt Marches** from nothing — 3 chapters, 6 scenes, 5 characters
(one of them created by accident, W23-4), an uploaded map, 3 locations, prose in
2 scenes, POV on 5 of 6, and positions that change between two scenes. Then
downloaded **Neuromancer**, **Alice's Adventures in Wonderland**, **The
Invisible Man** and **The Secret Garden** and drove each one's dashboard, map
and continuity checker.

**One self-correction recorded up front, because it changes W23-1.** The first
explanation offered for the 32 Neuromancer warnings was that the delta model was
carrying stale locations forward and the check was reading a carry-forward as an
assertion. Measured, that was **false**: all 118 (character × scene) pairs carry
their own snapshot with an explicit location. The finding is stronger than the
guess, and points the other way.

---

## Ranked, by what it costs a writer

1. **W23-1** — the new *In the scene, recorded somewhere else* check fires **32 times** on the shipped Neuromancer, and its one-click batch rewrites 32 authored snapshots. Reversing it costs 32 undos.
2. **W23-2** — a chapter's title cannot be changed anywhere in the app, and three places say it can.
3. **W23-3** — a character pin covers the location marker it stands on; at two characters the place name vanishes from the map entirely.
4. **W23-4** — pressing Enter for a paragraph break can create a character record, silently.
5. **W23-5** — Add Scene does not offer the Setting field that three new features depend on, and it has three different names on three screens.
6. **W23-6** — every "add another one" select keeps the last name you picked as its label, so it reads as a duplicate.
7. **W23-7** — 150 MB of the library's own art ships in `dist/`, is served by the app, and is then fetched from a GitHub branch instead.
8. **W23-8** — a single Enter is not a paragraph break, and nothing says so.
9. **W23-9** — `pov-consecutive` fires on every single-POV book, which is most novels.
10. **W23-10** — the guide's *Place them in the story* leaves the character out of the scene's cast; the dashboard then says they never appear.
11. **W23-11** — VOCAB-1 unfinished: 17 user-visible "event" strings survive, one on every dashboard (*"1 events"*).
12. **W23-12** — the knowledge-anachronism warning lowercases the writer's character names.

## Verified independently

These figures were re-derived from the shipped data rather than taken on trust:

| claim | measured |
|---|---|
| Neuromancer scenes / with a Setting | 29 / 29 |
| (character × scene) cast pairs | 118 |
| snapshots / with an explicit location / pairs having their own | 118 / 118 / 118 |
| `scene-cast-elsewhere` firings | **32** |
| `updateChapter` call sites outside tests | **2** — `{ notes }` and `{ wordGoal }`; never `title` |
| library art on disk (Neuromancer / Alice / Invisible Man) | 101M / 28M / 17M |
| `raw.githubusercontent.com` references in those three `.pwk` | **204** |
| `pov-consecutive` threshold | hard `runLen >= 3` |
| add-selects with `onValueChange` and no `value` | 9, against 1 already fixed |

The full session report — mechanisms, file and line references, the evidence for
each finding, six open suspicions and a long *What worked* section — is the
agent's own text, reproduced below.
