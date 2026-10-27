# Part G: what happened while the books were written

Times are UTC, on 2026-10-27 unless a date is given. Each pause and resumption is listed here as
it happens, for the results.

- **08:47.** Wave 1 starts: A1, C1 and A2.
- **About 09:37.** All three writers stop on a usage limit (reset 13:40).
  - By then: A1 has drafted chapters 1–6, C1 chapters 1–13, A2 chapters 1–5.
  - Both app writers had exported a `backup.pwk`.
  - The last sync, at 09:47, holds all of it.
- **13:41.** The container restarts. The scratchpad, with the browser profiles, survives, but the
  sync loop and the writers' dev servers do not.
- **13:43.** The sync is restarted. Each writer is resumed in its own context, not replaced, and
  told only that a usage limit stopped it and, for A1 and A2, that its dev server must be started
  again. No resumption preface is used, since no writer was replaced.
- **Decided by the writer, before wave 2 starts:** wave 1 continues as it is, and wave 2 runs one
  book at a time instead of three together, alternating sides in the pre-registered order: C2,
  then A3, then C3. Each starts when the one before it has finished. Running one at a time uses no
  less of the usage limit in total. What it changes is that each book finishes sooner, so a run
  cut short ends with finished books rather than three half-written ones. Alternating sides keeps
  the interruptions from falling mostly on one side.
- **14:07.** C1 is finished: *The Merciful Increase*, 99,106 words (`wc -w`). Its `book.md` passes
  the format check: 21 chapters numbered 1–21, each with an italic era line, 110 scene breaks,
  and no other headings or markup. Nothing was removed.
- **About 14:45.** A1 and A2 stop on a usage limit (reset 18:40). By then both had chapter files
  up to 21 and a `backup.pwk` from 14:31–14:35. The last sync, at 14:42, holds them.
- **18:41.** The container restarts again; the scratchpad and profiles survive, the sync and the
  dev servers do not.
- **18:42.** The sync is restarted, and A1 and A2 are resumed in their own context, as before.
- **18:51.** A2 is finished: *The Long Round*, 97,538 words. Its `book.md` passes the format
  check: 21 chapters numbered 1–21, each with an italic era line, 68 scene breaks, and no scene
  headers, `##` titles or other markup. Two leftovers of the app's Markdown export remain in the
  prose: 597 italics written `_x_`, and 6 lines ending in a backslash line break.
- **Normalisation, set now and before any evaluation, for all six books alike:** the copies the
  auditors and judges read have `_x_` italics written `*x*`, and a backslash at the end of a
  line removed. Underscore italics would otherwise tell a judge which books came out of the app.
  Neither change touches a word of the prose. The committed `book.md` files are left as their
  writers made them, and the results list each book's counts.
- **18:57.** A1 is finished: *What the Needle Keeps*, 90,316 words. Its `book.md` passes the
  format check: 21 chapters numbered 1–21, each with an italic era line, 56 scene breaks, no
  other headings or markup, and no export leftovers. Its writer reports that its browser was
  sometimes killed from outside while it worked, and that it relaunched it each time; another
  writer's process clean-up is the likely cause, and nothing was lost.
- **Wave 1 is finished.** Wave 2 starts, one book at a time: C2 first.
