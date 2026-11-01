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
- **20:14.** C2 is finished: *Count It Back Down*, 101,948 words. Its `book.md` passes the format
  check: 21 chapters numbered 1–21, each with an italic era line, 78 scene breaks, and no other
  headings or markup. Its verse lines end in two spaces (40 lines), a Markdown line break that
  is invisible in the text a reader sees, so the normalisation leaves it alone.
- **A3 starts.**
- **About 20:15.** A3 stops on a usage limit (reset 23:40) minutes after starting. It has started
  its dev server and written nothing else: no notes, no profile, no chapters.
- **23:41.** The container restarts a third time; the sync and dev servers stop.
- **23:42.** The sync is restarted, and A3 is resumed in its own context.
- **2026-10-28, about 01:25.** A3 stops on the **weekly** usage limit (reset 2026-11-01 02:00),
  part-way through its book. Its last backup and the last sync, at 01:22, hold its work.
- **2026-11-01, 10:06.** The container restarts. This time the scratchpad, with A3's browser
  profile, survived the four-day wait; the sync and dev server did not.
- **2026-11-01, 10:08.** The sync is restarted, and A3 is resumed in its own context.
- **2026-11-01, 10:18.** A3 is finished: *What the Dark Is Owed*, 74,547 words. Its `book.md`
  passes the format check: 21 chapters numbered 1–21, each with an italic era line, 84 scene
  breaks, and no scene headers or other markup. It has 242 italics written `_x_`, which the
  normalisation covers. Its writer reports two app problems it worked around: Chromium crashing
  on the app's file downloads, and Find & replace turning line breaks into spaces.
- **C3 starts,** the last book.
- **2026-11-01, 11:25.** C3 is finished: *Surety*, 97,949 words. Its `book.md` passes the format
  check: 21 chapters numbered 1–21, each with an italic era line, 151 scene breaks, and no other
  headings, markup or export leftovers.
- **All six books are written.** The writing is over; evaluation begins.
- **2026-11-01, 11:26.** `prepare.py` makes the evaluators' copies and gives the six books the
  letters P–U at random. The mapping, with each book's normalisation counts, is sealed in
  `mapping.json`, whose SHA-256 is `108249cbb7c3710654d454e7d22864e023670196479c656f8a86743563a730e0`. The mapping itself is committed only after all
  judging is done. Until then it cannot be lost: each copy is the normalised text of exactly one
  committed book, so the letters can be recovered by comparing contents. That was checked as soon
  as the copies were made.
- **Evaluation order:** the 12 audits run three at a time, auditor 1 for P–U first, then auditor
  2. The 24 judgements follow, also three at a time.
- **Not blind:** I verify the auditors' claims without opening the mapping. But I know each
  book's length, and so could tell some letters apart. The run-10 verification had the same
  limit. The judges, who decide the main measure, are blind.
- **Correction to "Not blind", above.** It understates the limit. Each writer's final report gave
  me its book's premise and names, so I can identify every book from its contents, not only some
  of them from their lengths. My verification is therefore not blind at all. It is held instead to
  the pre-registered rules, applied the same way to every claim, and each verdict is recorded with
  its reason so it can be checked. The auditors and the judges see only letters.
- **2026-11-01, about 12:00.** Audits R-1, S-1 and T-1 stop on a usage limit (reset 15:00), part
  way through. P-1 and Q-1 had finished.
- **15:01.** The container restarts; the scratchpad survives, the evaluation sync does not.
- **15:02.** The sync is restarted, and the three audits are resumed in their own context.
- **2026-11-01, about 15:35.** Audits S-2, T-2 and U-2 stop on a usage limit (reset 20:00). The
  other nine audits are in, and books P, Q and R are verified.
- **20:01.** The container restarts; the scratchpad survives, the sync does not.
- **20:02.** The sync is restarted, and the three audits are resumed in their own context.
- **2026-11-01, 20:09.** All twelve audits are in, and all six books are verified
  (`evaluation/verified-P.md` to `verified-U.md`), before the judge prompts exist. The mapping
  is still unopened.
