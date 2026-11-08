# R6: line-level checks on the prose

The sixth part of the editorial plan (`editorial-plan.md`).

## What was built

- **Five checks**, each pure, in `src/lib/proseChecks/`.
  - They read a scene's text as the page shows it: paragraphs, with the italics' underscores gone (`plainScene`). So a finding's offsets are the page's.
  - **Echoes** (`echoes`): a word said again too soon in the narration, or three words said again. How soon depends on how common the word is (`echoReach`):
    - within the span (20 words) for a word used 20–100 times in a million;
    - twice the span for one used 4–20 times;
    - three times the span for a rarer word;
    - never for a word used 100 times in a million or more.

    Not counted:
    - a repeat within one sentence;
    - anything in speech;
    - numbers;
    - a word the scene uses four or more times;
    - a word the book uses five times as often as books in general, which is its subject (`topicalWords`);
    - a phrase the book uses three times or more, which is its own, like a name (`stockPhrases`).

    A phrase needs two words of sense among its three, and a longer stretch said again is one finding.
  - **Pet words** (`petWords`): crutch words and pairs that editors name (`CRUTCHES`, `CRUTCH_PAIRS`).
    - A word or pair counts when the book uses it 3 times as often as books in general, and at least 20 times.
    - Only the book's worst 5 are listed.
    - Each scene gets one finding a word, with every use underlined.
  - **Sentence rhythm**:
    - six sentences of narration in a row within three words of each other in length (`rhythm`);
    - a scene of 20 sentences or more whose sentences are 1.8 times longer or shorter than the book's on average (`sceneRhythm`).

    Speech is left out. Whether a sentence is spoken is read from the quotation marks (`insideQuotes`): “ and ”, straight quotes by turns, and ‘ and ’, but not ’ between two letters, which is an apostrophe.
  - **Dialogue tags** (`tags`). A tag is a speech verb within three words of a quotation mark, before it or after it. Two things are flagged:
    - an adverb on a tag ("said softly", "said Mira gently");
    - where more than three quarters of a scene's tags are other than *said* and *asked*, each of those, if the scene has eight tags or more.
  - **Lengths** (`lengths`): a scene or chapter four times longer or shorter than the book's median. A book of fewer than five is not measured.
- **Every number is a setting** (`ProseCheckSettings`). Each has a default and can be changed for a book in World settings, under **Prose checks**. The settings and the writer's dismissals are kept on the world (`proseChecks`, `proseDismissed`), written by reading the world and writing it back in one transaction, so they travel in its `.pwk`.
- **The baseline** (`baseline.json`, 157 KB, 64 KB gzipped, loaded only when the checks run):
  - how often each word is used per million words, counted over the Library's 49 English books with prose, 4,669,682 words;
  - words used 4 times in a million or more (11,253 of them), since anything rarer counts as rare to every check;
  - the crutch pairs.

  `scripts/prose-baseline-probe.ts` counts it again.
- **The Prose pass on Read**, beside **Spoiler pass**:
  - findings underlined in the prose, a colour for each check;
  - the scene in view's findings listed beside the page, with the book's pet words above them;
  - each finding can be dismissed, or made into a note on its words, by the check (author `check`);
  - one pass at a time: turning one on turns the other off;
  - the checks run once the page has been drawn, with "Checking the prose…" shown until they finish.
- **The Continuity Checker** gets each chapter's findings, counted, as a note (`prose-craft`), never a warning, with the way to the chapter (`proseCraftIssues`).

## The noise bar

The plan asked that a check ship only if it finds few enough in published novels to be worth reading. The bar was set from that run.

`scripts/prose-probe.ts` runs every check over the Library. Each book is measured against a baseline of the others, so no book is its own "books in general". With the defaults, per 10,000 words:

| Check | Median book | Highest |
|---|---|---|
| Echoes | 4.2 | 14.7 |
| Pet words | 4.4 | 50.4 (*Alice in Wonderland*) |
| Sentence rhythm | 0.1 | 2.3 |
| Dialogue tags | 3.3 | 32.1 (*Peter Pan*) |
| Lengths | 0.6 | 4.0 |
| All five | 16.6 | 76.4 (*Alice in Wonderland*) |

So a 2,500-word scene of a published novel gets about four findings. The highest are honest:
- Carroll's *a little*, *quite* and *very*;
- Barrie's adverbs on tags.

The Library's two model-written books are found leaning where a writer would want to know. *The Cold Choir* (22.6 pet words in 10,000) has *looked at* ×70 at 6.4 times the usual rate, *her eyes* and *looked*; *The Undersong* has *turned*.

`proseChecksNoise.test.ts` holds the bar on a sample: about 10,000 words each of *Pride and Prejudice*, *Dracula*, *The Call of the Wild* and *Anne of Green Gables*, all out of copyright, in `fixtures/prose/sample.json`. With the shipped baseline, each check is held to its count on that sample when the defaults were set, plus a quarter:

| Check | Sample, per 10,000 words | Bar |
|---|---|---|
| Echoes | 10.1 | 13 |
| Pet words | 6.4 | 8 |
| Rhythm | 0.2 | 1 |
| Tags | 5.5 | 7 |
| Lengths | 0.2 | 1 |
| All | 22.5 | 28 |

The same test requires echoes, pet words and tags each to find something there, so turning a check off fails it too.

## How the defaults were reached

The first run, with thresholds guessed, found 163 echoes and 273 pet words per 10,000 words. Each change below is in the probe's history; reading its samples is what showed each:

- **Pet words were finding subjects, not habits.** As first built, any word the book used far more than books in general counted, and the run listed the whale in *Moby-Dick* (×869), the brig in *Kidnapped* and the locomotive in *Around the World*. A word used in nine books in ten does no better: the sea, the children, the floor. Only words editors name as crutches are pet words now. That is narrower than the plan's "words … the book uses far more often than books in general".
- **Echoes in the same sentence are how it is built**: "at peace with all … at peace with none", "now, on his knees; now, on his feet". Only echoes across sentences count.
- **Echoes in speech are talk**: "You refuse?" "I refuse." Only narration counts.
- **Numbers and a scene's subject were echoes**: "five years … five hundred eggs", "twenty times in a stage … twenty times in a day", the mushroom in the scene about the mushroom.
- **Phrase echoes were mostly epithets** ("the mender of roads", a man's name in *A Tale of Two Cities*) and grammar. A phrase now needs two words of sense, and not to be the book's own.
- **A long speech was a run of even narration.** Only a sentence starting with a quotation mark was counted as speech. Now the marks' state is followed through the paragraph, single quotation marks too, which British books use.
- **Tags were every *say* in speech**, and a share of 60% flagged nearly every 19th-century scene, which use *cried*, *replied* and *returned* as freely as *said*. *Say* and *ask* are not tags. The share is three quarters, over eight tags or more.
- **Ten pet words a scene was too many.** Only the book's worst five are listed, and the ratio is 3.

## Where it departs from the plan

- **Pet words are crutches only**, for the reason above.
- **The baseline ships with the app; it is not read from the books on the device.** Decision D-4 chose the Library's books as the baseline because they are "already on every device". They are not: they are downloaded when a reader asks for one. So the counts were made from them once, and ship as a table.
- **The prose pass is on Read only**, as the plan said; it is not on the Page.
- **A finding made a note is anchored on the page's text**, without the italics' underscores. A note finds its words in the prose closely enough either way (`placeNote`).
- **Speed.** The checks take 0.35 s for *Dracula* and 0.8 s for *The Count of Monte Cristo*, the Library's longest at 460,000 words, measured in Node. That is why they run after the page is drawn. Reading each scene's words and sentences once, rather than once a check, took *Monte Cristo* from 1.7 s.

## Checked

- `proseChecks.test.ts`, on prose made to show each check:
  - the page's text and its offsets;
  - sentence ends, titles and initials;
  - quotation marks, double and single, and apostrophes;
  - echoes: reach by commonness, and each thing not counted;
  - phrases, joined and stock;
  - topical words;
  - pet words: ratio, count, names, crutches only, pairs, the cap, and the uses in a scene;
  - rhythm, spoken and narrated, and a scene's average;
  - tags: near a quotation mark or not, adverbs, words in -ly that are not adverbs, the share;
  - lengths;
  - dismissal keys, the settings, and the baseline's counting.
- `proseChecksNoise.test.ts`: the bar, as above.
- `proseCraft.test.ts`: a chapter's findings counted in the book's order, dismissed ones left out, a chapter's length alone.
- `proseCheckSettings.test.ts`: two changes made together both land; the defaults back; a dismissal and its undoing; both in the backup.
- `e2e/prosePass.spec.ts`:
  - On Read, an echo and an adverb on a tag are underlined and listed.
  - The spoiler pass turns the prose pass off.
  - The tag is made a note by the check.
  - The echo is dismissed.
  - Tags are turned off in World settings and the dismissed echo brought back; on Read, the echo is back and the tag gone.
  - The checker counts chapter 1's echo.
- Mutants, each caught:
  - text: titles ending sentences; an apostrophe closing a quotation;
  - echoes: within a sentence; in speech; numbers; a book's or a scene's subject; the commonest words; a rarer word's reach; phrases of one word of sense; stock phrases; a stretch not joined;
  - pet words: any word; names; no cap; the uses after the first lost;
  - rhythm: speech counted; no spread; a short scene averaged;
  - tags: words in -ly that are not adverbs; a share over few tags; a verb far from the quotation;
  - lengths: a small book measured;
  - the book: dismissed findings kept; keys not numbered; subjects found too eagerly;
  - the checker: dismissed findings counted; a note made a warning;
  - storage: settings written over each other; every pair kept in the baseline; pairs across sentences;
  - on screen: no marks; dismiss doing nothing; a note by the writer, not the check; both passes on at once; a setting doing nothing; bringing back doing nothing; the checker without the prose; the settings ignored; dismissed findings listed.

  Eight mutants did not compile at first, and were redone until they did.
