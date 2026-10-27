# Part G: the Part 6 rerun, as run

`next-plan.md`, Part G. Written 2026-10-27, before any of the six books exists. It runs Part 6
again under its pre-registration (`run-10-part-6-preregistration.md`, 9a65f19): the same brief,
the same measures and the same decision rule. This file lists only what differs from that
pre-registration, and why. Results go in a separate file.

## What is reused, word for word

The first attempt's materials were lost with its container (`run-10-part-6-attempt-1.md`), but
each was printed or sent in this session, and is recovered from its transcript:

- **The six writer prompts:** the ones sent on 2026-10-19. They are in `part-g/prompts/`, with the
  changes listed below.
- **The run-10 audit prompt:** the one given to each auditor in run 10. It is in
  `part-g/audit-prompt.md`; `{BOOK}` and `{OUT}` stand for the paths.
- **The run-10 judge prompt:** in `part-g/judge-prompt.md`, with `{FIRST}`, `{SECOND}` and `{OUT}`
  for the paths. As in run 10, each judge's copy also has the words FIRST and SECOND replaced by
  that pair's letters.
- **`quotes.py`:** run 10's, unchanged, in `part-g/quotes.py`.

## What differs, and why

- **The app.** The app writers use Kathala as it is after Parts A–F: `development` at d27e98c
  (#638), not 4194f86. That is the point of the rerun (`next-plan.md`: "after A, B and D at
  least"). The fix for the first attempt's paste bug (337c9a4) is in it.
- **The folders** are `scratchpad/partg/<book>/`, not `part6/`.
- **The browser.** The Chromium in this container is a newer build at a new path. Only the path
  in the app prompt changes.
- **Keeping the work.** The first attempt lost every book when the container was reclaimed during
  a usage-limit wait. So:
  - `part-g/sync.sh` copies each writer's folder into `part-g/books/<book>/` every ten minutes,
    and commits and pushes it. It copies text and `.pwk` files only, never a browser profile or a
    screenshot.
  - Both prompts tell the writer that the folder is copied regularly. The control prompt asks the
    writer to keep the book in the folder chapter by chapter.
  - The app prompt asks the writer to keep the browser profile in `profile/`, and to export a
    world backup to `backup.pwk` at the end of each chapter. The book lives in the browser's
    IndexedDB, which the sync cannot read. This is one small duty the control writers do not
    have; it is the app's own export, which the prompt already asked for once at the end.
- **A writer that stops.** If a writer stops before its book is finished, a new writer of the
  same kind continues from the folder as committed. It gets the same prompt, prefaced with
  `part-g/prompts/resume-preface.md`. An app writer whose profile is lost first restores its
  world from `backup.pwk` through the app's own import; `{RESTORE}` then says so in one sentence,
  and is otherwise empty. Every resumption is listed in the results,
  with the chapter it resumed at. The pre-registration did not foresee this. The rule is set now,
  before any writer starts, so that it cannot be chosen to suit a result.

## Order

As pre-registered: two waves of three, A1, C1 and A2, then C2, A3 and C3. Wave 2 starts when
wave 1 has finished. Then come the format check, the shuffle and the sealed mapping, the audits
and their verification, and the 24 judgements.
