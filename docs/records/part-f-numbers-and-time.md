# Part F: numbers and time, as you write

`next-plan.md`, Part F. The run-10 comparison found that numbers and time made up most of the verified errors in all three books: ages, elapsed time, counts and distances. The plan named three answers. Two of them (F1, F2) are mechanical checks gated on measurement, as Part 4's were. The third (F3) is the AI audit, chapter by chapter, as the book is written.

**What the measure could use.** The plan's test set is run 10's verified error lists, in the experiment's `results.md`. That file is not in this repository or on this machine. What is here:

- **The examples `run-10-plan.md` quotes:**
  - Hal is 22 at a Bicentennial a century earlier, yet 64 now.
  - "Three weeks since the forty-sixth" is six weeks.
  - "Twelve hours after" is 22 days.
  - "Eleven taken" against "you took three".
  - A bell rung 27 times, then 9,206.
- ***The Cold Choir*'s prose** (`e2e/fixtures/cold-choir.pwk`).
- **The Library's books,** for false alarms.

## F3: the AI audit, a chapter at a time, while writing — shipped

The audit from the run-10 plan's Part 5 read the whole book from a pasted prompt. Now:

- **Offered at a chapter.** **Audit this chapter with AI**, at the foot of a chapter's panel, opens the checker on that chapter's audit.
- **Against the book so far.** The prompt holds every chapter up to the one being audited, in reading order, and asks only for contradictions that chapter takes part in, with at least one quote from it (`auditPrompt(book, focus)`).
  - A finding none of whose quotes is from the chapter is dropped when the reply is checked, with that reason (`checkAudit(…, focus)`).
  - Kept, a chapter's findings replace only what an earlier audit found in that chapter; findings about the rest of the book stand (`keepAuditFindings(…, chapter)`).
- **One click, with the writer's own key** (decision D-2). **Run the audit** sends the prompt from the browser to Anthropic's Messages API, and nowhere else (`src/lib/auditWithKey.ts`).
  - It uses `@anthropic-ai/sdk`, streamed, on `claude-opus-5-5` with adaptive thinking at high effort.
  - Server-side fallbacks (`fallbacks: "default"`) answer a request the model declines, rather than leaving it empty.
  - The reply goes through the same quote check as a pasted one.
  - The key is remembered in this browser only when the writer ticks the box.
  - A refused key, a declined request, a reply cut off, a rate limit or no connection is each said in a sentence, and the prompt stays there to copy.
- **Paste-only stays.**

**Not measured:** how many of run 10's errors the audit finds. That needs the error lists, and an API key and its cost, which this session had neither of. The run-10 experiment's own auditors, given the whole book, are what found those errors in the first place. The audit prompt asks for those kinds of contradiction, with the experiment's rules for what counts.

### Protecting the key

Asked what kept the key safe, the first version's answer was not enough: a
remembered key sat in `localStorage` in plain text, and nothing stopped a
script the app did not ship from running beside it. It is now held as safely
as a page with no server can hold it:

- **Held only while the audit is open,** unless the writer asks to keep it.
- **The desktop app keeps it encrypted by the system keychain** (`electron/secrets.cjs`, Electron's `safeStorage`), in the main process, behind a bridge that knows this one secret. The page never stores it.
  - Where the system has no real encryption (Linux with no secret service, where `safeStorage` falls back to a fixed key, `basic_text`), it keeps nothing and says so.
- **A browser keeps it until the tab is closed** (`sessionStorage`) and no longer, never in `localStorage`. Nothing a page can encrypt with is out of reach of the same page, so the honest protection in a browser is not to outlive the tab.
- **Forget the key** clears it wherever it was kept.
- **It goes to one address.** `baseURL` is pinned to `https://api.anthropic.com`, so no environment setting can point it elsewhere. Retries follow the SDK's rules, and a refused key is never retried.
- **The built app runs only its own scripts** (`src/lib/contentSecurityPolicy.ts`, injected into the production `index.html`): none inline, none from `eval`, none from another site. Also no plugins, no form posts, and no rebasing of relative URLs.
  - Connections stay open to `https:`, because saving a linked picture, the Library and the export's cover fetch from other sites. The script rule is what keeps a stranger's script from being there to use them.
- **The field** is a password field, with autocomplete and spellcheck off.
- **The panel advises a dedicated key** with a spend limit, which caps the cost of a leak and can be revoked alone.

What remains, and cannot be removed without a server: the key is in the request
headers the browser sends, visible in that browser's developer tools.

**Checked.**

- **Unit tests:**
  - the keychain module with a fake keychain (encrypted on disk, nothing kept without real encryption, forgotten);
  - the page's store (the tab only, never `localStorage`; the keychain in the desktop app, with nothing in the page);
  - the policy's directives;
  - a source rule that one module alone touches the key's storage, and never `localStorage`.
- **e2e:**
  - kept for a reload, not in a new tab, never in `localStorage`, and forgotten;
  - a script injected inline, and one from another site, both refused, while the app's own run.
  - The full suite runs against the production build, under the policy.
- **The desktop app**, built and launched under a virtual display: it loads from `file://` with the policy and no violations, and on this container (no keyring) the bridge keeps nothing and the page holds nothing.
- **Mutants, each turning its test red:**
  - `localStorage` in place of the tab;
  - the `basic_text` refusal removed;
  - `'unsafe-inline'` in `script-src`;
  - the policy left out of the build.

## F1: stated ages — measured, not shipped

`scripts/ages-probe.ts` (`npm run probe:ages`) reads every Library book and the books kept here (63). It extracts ages stated in the prose in four shapes, each kept apart:

| Shape | Example | Found |
|---|---|---|
| Appositive | *Hal Oduya, sixty-four,* | 5 |
| Predicate | *Justine was twelve years of age* | 3 |
| Said | *"I'm thirteen years old," remarked Anne* | 6 |
| Sentence | an age phrase (*years old*, *aged*, *a man of*) in a sentence naming one person | 39 |

Approximations (*nearly*, *about*, *or so*) are not counted, and flashbacks are skipped. Two statements about one person contradict when their ages differ from the time between their scenes by more than a year and a half.

- **The three strict shapes found 14 statements in 63 books,** about 11 people. The five read in the samples are each the named person's age (*"I am ten," answered Mary*), one of them at a past event (*when Justine was twelve years of age*). But only two people had two statements, and nothing contradicted. A check built on them would almost never speak.
- **The sentence shape found 39 more, and five contradictions.** Read by hand, **none of the five is real**:
  - *Dantès 25, then 10*: the 25 is another man; the 10 is the Count's boyhood.
  - *Franz 40, then 2*: the 40 is a stranger; the 2 is his age when his father died.
  - *Vampa 6, then 19*: both are Teresa's.
  - *Haydée 5, then 3*: two past events, both rightly told.
  - *Athos 30, then 25*: the 25 is a story about "one of my friends".
- **The sampled statements show why.** In a sentence naming one person, the age is often someone else's: *two girls of six and eight* beside Jane Bennet, *a five-year-old bull* beside Agamemnon. Or it is an age at a past event (*when I was a little girl, only six*). Hal's error has that same shape: *I was twenty-two … It was the Bicentennial*. Comparing it needs the Bicentennial's date, which nothing records.

0 of 5 against a gate of 9 in 10: it does not ship. The probe stays, so a better rule can be measured the same way.

## F2: counts and durations — not shipped

Each of run 10's examples needs to know which quantity or which event a number is about:

- "eleven taken" and "you took three" are the same taking;
- "twenty-seven times" and "9,206" are the same bell;
- "three weeks since the forty-sixth" counts from the forty-sixth.

String rules cannot tell which numbers belong together. In a novel, counts change and durations run from many starting points, so a rule pairing numbers without knowing that would mostly report numbers that were never meant to agree, as F1's sentence shape did with ages. Part 4 already covers the narrow case it can see: a gap stated at a scene's opening between dated scenes (`statedGaps.ts`). Beyond that, these errors are what the AI audit asks for and checks the quotes of (F3).

## Tests

- **Unit:**
  - `auditPrompt.test.ts`: the book so far, and the chapter asked about.
  - `auditReply.test.ts`: a finding not about the chapter is dropped, with its reason.
  - `auditFindings.test.ts`: a chapter's audit replaces only that chapter's findings.
  - `auditWithKey.test.ts`: against a fetch answering as the streamed Messages API does. It checks the request (endpoint, the browser header, the key, the fallback beta, model, prompt) and the reply, and that a refusal or a refused key is said in words, with a 401 not retried.
- **`e2e/chapterAudit.spec.ts`,** with the API answered by `page.route` and never reached:
  - the offer;
  - the prompt holding chapters 1–2 and not 3;
  - a run with a key, whose request carries the key and the chapter's prompt;
  - a finding about chapters 1 and 3 dropped from chapter 2's audit;
  - chapter 3's earlier finding still there after chapter 2's is kept;
  - the key remembered only when asked, across a reload.
  - `auditAI.spec.ts` passes unchanged.
- **Mutants, each turning its test red:**
  - the check's chapter scope removed;
  - keeping without the chapter scope;
  - the key always remembered;
  - the prompt ignoring the focus.
