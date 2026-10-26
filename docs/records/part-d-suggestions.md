# Part D: bookkeeping by confirmation

Two halves, both measured before anything was offered: D1, header lines suggested from a scene's prose; D2, what the app can infer and offer instead of the writer typing it.

## D1: header suggestions from the prose

`next-plan.md`, Part D1. The plan: a scene whose prose already says who is there, where it is, that an item changes hands or that somebody dies gets a suggested header line beneath it, and one key accepts it. It started with four kinds — people and places named, hand-off verbs with an item named, deaths stated outright — and said each would be tried on the Library's books, with its precision reported before it was shown to writers.

### How it is measured

`scripts/suggest-probe.ts` (`npm run probe:suggest`) reads every Library book through the app's own import and scores each rule against what the book's curators recorded at every scene with prose:

- **who is there:** the scene's cast (`involvedCharacterIds`);
- **where it is:** its place;
- **an item passing:** a custody statement at the scene that somebody holds it from there;
- **a death:** a person's record at the scene saying they are not alive, when the one before said they were.

Every rule is scored from scratch, as for a scene with no header yet. Precision is how much of what it suggested the curators had; recall, how much of what they had it suggested. A **line** score counts the whole suggestion, as one key accepts it, as right only if every name on it is the curators'.

- **Three sets of books.** The books alternate between a set the rules were tuned on (29 books, 2,157 scenes with prose) and a set held out from tuning (29 books, 3,106 scenes). The writer runs' own books (`docs/records/*.pwk`: 3 books, 36 scenes) are a third set, written by writers rather than curated.
- **The curated headers are not perfect.** The Library's cast is who is on stage. The curators sometimes leave out somebody who is there for a line, and the probe scores that as the rule being wrong.

### Results

Precision and recall, on the books held out from tuning:

| Rule | Precision | Recall |
|---|---|---|
| **Cast: speaks twice or more** (shipped) | **79%** | 12% |
| **Line: speaks twice or more** (shipped) | **74%** | 20% |
| Cast: speaks once or more | 73% | 23% |
| Line: speaks once or more | 62% | 32% |
| Cast: named three times or more | 65% | 28% |
| Place: the place named most | 12% | 4% |
| Hand-off: an item named after a giving verb | — (never fired) | 0% |
| Death: said outright, of somebody alive before | 21% | 3% |

On the tuned books the shipped line was right 80% of the time (27% recall). On the writer runs' books it was right 26 times in 27 (74% recall).

- **Who is there passed, read from speech.** Being named was not enough: in a novel people are talked about more often than they are present. The checker's rule for an unaccounted name, named three times or more, was right 65% of the time. Speech said of somebody by name, within a sentence (*said Bruno*, *Bruno replied*), was the signal that held up. Twice or more beat once by twelve points on whole lines, for half the recall. Starting a sentence with the name was tried as well, and was no better than being named.
- **Places did not pass.** The Library's places are named as the map labels them, such as *Harker's Room* or *The Count's Library*, and the prose rarely uses those names. When it did, the most-named place was usually somewhere talked about rather than the scene's own: 12% held out, 28% on the writers' books.
- **Hand-offs never fired.** In a sample of curated custody statements read with their prose (two dozen, from the tuned books), most recorded who holds an item from the scene where it first matters, not something handed over there. The items carry the curators' labels (*Martian Compass*, *Belt of Gold*), which the prose almost never uses. When something is handed over, the prose usually says *handed him the ledger*, with a pronoun for the person.
- **Deaths did not pass.** On the tuned books, 14 of the 29 deaths the rule first suggested were of somebody already dead, remembered later. Limiting it to people alive by the records before the scene removed those. In the samples read, what was left was mostly feigned deaths, threats and hypotheticals (*Valentine appears to die*). The rule found 5 of 198 held-out deaths, and was right on 5 of the 24 it suggested.

So the app offers who is there, read from speech, and nothing else. The probe keeps the other three rules, so the measurement can be run again on new books or new rules.

### In the app

The Page offers the suggestion beneath the header of the scene the caret is in, and only that scene: on a long book, an offer under every scene would read as clutter (`src/features/timeline/proseSuggestion.ts`).

- **Who is offered.** Whoever speaks twice or more in the prose and is not already accounted for: not in the cast, mentioned, there from elsewhere, the point of view, set aside before, or named on the line, applied or not (`suggestCast`, `accountedFor`).
- **Alt+Enter, or Add to header.** The names go on the line as the writer would type them (`withCast`): at the end of a one-line header, on a block's Characters line, or as a new line. The line is then applied the way a line the writer has left is (`applyHeader`), so the cast is recorded by the same path as typing. The edit bypasses the Page's rules for the writer's own edits, as its catching up with the records does, because those rules refuse a line put above the prose.
- **Alt+Shift+Enter, or Not here.** The people offered are set aside for that scene, on this device (localStorage). It is the writer's answer to an offer, not something the book says.
- **Nothing is written until it is taken.**

### Tests

- **`headerSuggest.test.ts`:** speech counted only when said of somebody by name; the threshold; whom the header accounts for, including a name typed on the line and not yet applied; and the header with names added, in each of its three forms, read back by the header's own parser.
  - A mutant offering whoever speaks once turns it red.
  - So does one counting every name as speech.
- **`e2e/headerSuggest.spec.ts`:**
  - Offered for somebody who speaks, not for somebody only named, and not for somebody who speaks once.
  - The key writes the cast and the line, and the offer goes. The button does the same.
  - Set aside, the offer stays gone after a reload, while another scene's is still offered.
  - Two mutants turn it red:
    - Without bypassing the Page's edit rules, nothing is written.
    - With the setting-aside not saved, the offer comes back after a reload.
  - The reload half first passed that second mutant: it went to the same address, which is not a reload. It now reloads the page.
- The Page and header specs (119) pass with it.

## D2: nothing to type that the app can infer

The plan named two inferences, each to be offered as a suggestion and never written silently:

- **A scene's date** from a phrase like *two days later*.
- **A new scene taking its place and cast from the one before** when its first paragraph does not move anyone.

Neither passed, and neither is offered. The probe measures both, and keeps their rules.

### How it is measured

- **The date.** The opening paragraph is searched for phrases a `When:` line can hold: *N days later*, *a week later*, *a fortnight later*, *the next morning* (+1), *that same evening* (0). The days found are scored against the days from the scene before on the same timeline, by the book's own clock (`computeInWorldDays`). Almost every Library scene is pinned to a day, so a scene's curated "days since the scene before" field is mostly empty, and the clock is the only place the curated answer is held.
- **Place and cast.** The previous scene's place and cast in the chapter are scored against the scene's own. The rule offers them only where the opening paragraph has nobody going anywhere (`still`: no *went*, *came*, *arrived*, *rode*, *returned* and the like). The same scoring over every scene (`any`) shows what the condition adds.

### Results

Precision, held out (tuned in brackets):

| Rule | Precision | Recall |
|---|---|---|
| Date from the opening | 36% (36%) | 2% |
| Same place, opening still | 59% (51%) | 60% |
| Same place, any opening | 55% (47%) | 55% |
| Same whole cast, opening still | 56% (54%) | 92% |
| Same whole cast, any opening | 54% (52%) | 93% |

On the writer runs' books, the date phrase never fired. The same place was right in 4 of 9 still scenes, and the same cast in 4 of 11.

- **The date.** In the samples read, the phrases were read as written, but the curated clock disagrees with them about two times in three. In *Anne of Green Gables*, *the next morning* is curated as 0 days at one scene, and as 19 at another, where the scene before in the book's order is not the day before in the story. Some of that is the curated chronology's coarseness, and some is the phrase being about something other than the scene's start. Either way, a writer accepting it would be told something the book's own clock contradicts as often as not, and it fires in 2% of scenes.
- **Place and cast.** A scene shares the place of the one before about half the time in the Library. An opening with nobody moving raises that by four points. An offer right one time in two is a question, not bookkeeping saved, so it is not offered.

## What is left

- **Measured in the next writer run:** actions spent on the app rather than the book, against run 10's 302 (the plan's second measure).
- **D2 is not offered.** If a writer's own books, rather than the Library's, ever show the date phrase or the place carried forward being right, the probe will show it: their books are its third set.
