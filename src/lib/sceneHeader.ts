import { proseAliases } from './characterNames'
import { revealTargets } from './characterIdentity'
import type { Character } from '@/types'
import { ITEM_CONDITIONS, type ItemCondition } from './itemCondition'
import { LOCATION_STATUSES, type LocationStatus } from './locationStatus'

/**
 * The line at the top of a scene that says where it happens and who is there.
 *
 *     [#The Kitchen @@Wren Halloway @@Sal'ka]
 *
 * **Assertion-space, by position.** Every other way of recording this has had
 * to solve the same problem — prose narrates, it does not assert — by making
 * the keystroke carry the claim: one `@` means mentioned, two mean present.
 * That works, and it depends on the writer holding a convention in their head.
 * A bracketed line at the top of a scene solves it structurally: there,
 * writing *is* declaring, and nothing is inferred from a sentence.
 *
 * It also says the one thing no sigil could. A character can be **present and
 * never named in the text** — someone on the stairs, deliberately unmentioned
 * — and the only way to record that was to type `@@Name`, let the picker
 * insert it, and delete the fourteen characters it had just written. A writer
 * called that "a trick I discovered rather than something offered".
 *
 * ## The header is never stored
 *
 * It is **rendered from the scene's own records** every time the box is drawn,
 * and parsed back when the writer edits it. `sceneTexts.text` holds prose and
 * nothing else.
 *
 * That is not a detail. Storing the header in the prose would have meant two
 * editable copies of one fact — the header and the cast panel — and keeping
 * them in step is exactly the shape that silently destroyed a writer's cast
 * this morning, moved into the text where it is worse. Rendering means a
 * change made anywhere shows up here by construction, with no sync to drift.
 *
 * It also means the fourteen things that read scene prose — five exports, the
 * manuscript, search, find-and-replace, reading mode, the continuity checker,
 * the word count that feeds the pacing curve and the daily goal — need to know
 * nothing about it. A header cannot leak into a book it was never in.
 */

export interface SceneHeader {
  /** The place named after `#`, or null when the header names none. */
  place: string | null
  /** What `#The Chapel:ruined` says of the place: its status from this scene. */
  placeStatus?: LocationStatus
  /** Names given after `@@`, in the order written, trimmed and de-duplicated. */
  characters: string[]
  /** Of `characters`, those marked `:dead` — who die at this scene. */
  dead?: string[]
  /** Of `characters`, those marked `:alive` — who come back at this scene. */
  alive?: string[]
  /** Of `characters`, those marked `:called …` — what the book calls them from this scene. */
  called?: HeaderAs[]
  /** Of `characters`, those marked `:is …` — who they are revealed to be at this scene. */
  reveals?: HeaderAs[]
  /**
   * Items after `^`: in the scene, and — after `:@` or `:#` — with somebody
   * from this scene, or put down at a place here.
   */
  items?: HeaderItem[]
  /**
   * Facts after `?`: who learns them here (`:@Name`), the reader learning them
   * here (`:reader`), or — with nothing after — the fact becoming true here.
   */
  facts?: HeaderFact[]
  /** Relationships after `~`: `~Sabine Varro/Idris Quell:estranged`, or `:ended`. */
  relations?: HeaderRelation[]
}

/** A relationship on the Relationships line, and how it stands at this scene. */
export interface HeaderRelation { a: string; b: string; label: string; ended?: boolean }

/** A relationship token: two names, then what they are to each other — or that it has ended. */
function withPair(token: string): HeaderRelation | null {
  const m = /^([^/]*\S)\s*\/\s*([^:]*\S)\s*(?::\s*(.*))?$/.exec(token)
  if (!m) return null
  const label = (m[3] ?? '').trim()
  return /^ended$/i.test(label) ? { a: m[1].trim(), b: m[2].trim(), label: '', ended: true } : { a: m[1].trim(), b: m[2].trim(), label }
}

/** A fact on the Facts line: `?Dask is the Notary:@Sabine Varro`, `?…:reader`, or `?…` alone. */
export interface HeaderFact { title: string; learner?: string; reader?: boolean }

/** A fact token's title and who learns it: `Dask is the Notary:@Sabine Varro`. */
function withLearner(token: string): HeaderFact {
  const reader = /^(.*\S)\s*:\s*reader$/i.exec(token)
  if (reader) return { title: reader[1].trim(), reader: true }
  const who = /^(.*\S)\s*:\s*@@?\s*(\S.*)$/.exec(token)
  return who ? { title: who[1].trim(), learner: who[2].trim() } : { title: token }
}

/**
 * An item on the Items line: `^Ash Ledger`, `^Ash Ledger:@Sabine Varro`,
 * `^Warden's Pistol:#The Chapel`, `^Ash Ledger:damaged`, or a condition and a
 * target both — `^Ash Ledger:damaged:@Sabine Varro`.
 */
export interface HeaderItem { name: string; holder?: string; place?: string; condition?: ItemCondition }

/** `text` with a condition after its last colon, split: `Ash Ledger:damaged`. Only the conditions the app records count. */
function withCondition(text: string): { rest: string; condition: ItemCondition | null } {
  const m = /^(.*\S)\s*:\s*([a-z]+)$/i.exec(text)
  const word = m?.[2].toLowerCase()
  return m && (ITEM_CONDITIONS as readonly string[]).includes(word!) ? { rest: m[1].trim(), condition: word as ItemCondition } : { rest: text, condition: null }
}

/** A place token's name and the status after it, if it is one the app records: `The Drowned Chapel:ruined`. */
function withStatus(token: string): { rest: string; status: LocationStatus | null } {
  const m = /^(.*\S)\s*:\s*([a-z]+)$/i.exec(token)
  const word = m?.[2].toLowerCase()
  return m && (LOCATION_STATUSES as readonly string[]).includes(word!) ? { rest: m[1].trim(), status: word as LocationStatus } : { rest: token, status: null }
}

/** An item token's name, its condition, and where it goes: `Ash Ledger:damaged:@Sabine Varro`. */
function withTarget(token: string): HeaderItem {
  const m = /^(.*\S)\s*:\s*(@@|@|#)\s*(\S.*)$/.exec(token)
  // The condition is drawn before the target; written after it, it means the same.
  const target = m ? withCondition(m[3].trim()) : { rest: '', condition: null }
  const head = withCondition(m ? m[1].trim() : token)
  const condition = head.condition ?? target.condition
  const item: HeaderItem = { name: head.rest, ...(condition ? { condition } : {}) }
  if (!m) return item
  return m[2] === '#' ? { ...item, place: target.rest } : { ...item, holder: target.rest }
}

/** What `:dead` and `:alive` after a name say: a fate the scene records for them. */
export type Fate = 'dead' | 'alive'

/** A name, and another the token gives it: `Strider:called Aragorn`, `Edward Hyde:is Dr Henry Jekyll`. */
export interface HeaderAs { name: string; as: string }

/**
 * A character token's name and what it says of them here, if anything: a fate
 * (`Corwen Dask:dead`), the name the book calls them from here (`Strider:called
 * Aragorn`), or who they are revealed to be (`Edward Hyde:is Dr Henry Jekyll`).
 * Any other colon is part of the name.
 */
function withFate(token: string): { name: string; fate: Fate | null; called?: string; is?: string } {
  const m = /^(.*\S)\s*:\s*(dead|alive)$/i.exec(token)
  if (m) return { name: m[1].trim(), fate: m[2].toLowerCase() as Fate }
  const called = /^(.*?\S)\s*:\s*called\s+(\S.*)$/i.exec(token)
  if (called) return { name: called[1].trim(), fate: null, called: called[2].trim() }
  const is = /^(.*?\S)\s*:\s*is\s+(\S.*)$/i.exec(token)
  if (is) return { name: is[1].trim(), fate: null, is: is[2].trim() }
  return { name: token, fate: null }
}

/** The labels a block is drawn with. For the eye only: the sigil decides what a token means. */
export const HEADER_LABELS = { place: 'Place', characters: 'Characters', items: 'Items', facts: 'Facts', relations: 'Relationships' } as const

/**
 * Renders the header as a block, one labelled line for each kind of record the
 * scene has, and none for a kind it has not (docs/records/scene-header-block-plan.md).
 *
 *     [
 *       Place: #The Kitchen
 *       Characters: @@Wren Halloway @@Sal'ka
 *     ]
 *
 * Empty string when there is nothing to say.
 */
export function formatSceneHeader(header: SceneHeader): string {
  const lines: string[] = []
  if (header.place?.trim()) lines.push(`  ${HEADER_LABELS.place}: #${header.place.trim()}${header.placeStatus ? `:${header.placeStatus}` : ''}`)
  const cast = header.characters.map((n) => n.trim()).filter(Boolean)
  const fate = (n: string) => {
    if (header.dead?.includes(n)) return ':dead'
    if (header.alive?.includes(n)) return ':alive'
    const called = header.called?.find((c) => c.name === n)
    if (called) return `:called ${called.as}`
    const is = header.reveals?.find((r) => r.name === n)
    return is ? `:is ${is.as}` : ''
  }
  if (cast.length) lines.push(`  ${HEADER_LABELS.characters}: ${cast.map((n) => `@@${n}${fate(n)}`).join(' ')}`)
  const items = (header.items ?? []).filter((i) => i.name.trim())
  const target = (i: HeaderItem) => `${i.condition ? `:${i.condition}` : ''}${i.holder ? `:@${i.holder}` : i.place ? `:#${i.place}` : ''}`
  if (items.length) lines.push(`  ${HEADER_LABELS.items}: ${items.map((i) => `^${i.name.trim()}${target(i)}`).join(' ')}`)
  const facts = (header.facts ?? []).filter((f) => f.title.trim())
  const learner = (f: HeaderFact) => (f.learner ? `:@${f.learner}` : f.reader ? ':reader' : '')
  if (facts.length) lines.push(`  ${HEADER_LABELS.facts}: ${facts.map((f) => `?${f.title.trim()}${learner(f)}`).join(' ')}`)
  const relations = (header.relations ?? []).filter((r) => r.a.trim() && r.b.trim())
  const state = (r: HeaderRelation) => (r.ended ? ':ended' : r.label.trim() ? `:${r.label.trim()}` : '')
  if (relations.length) lines.push(`  ${HEADER_LABELS.relations}: ${relations.map((r) => `~${r.a.trim()}/${r.b.trim()}${state(r)}`).join(' ')}`)
  return lines.length ? `[\n${lines.join('\n')}\n]` : ''
}

/**
 * The header as one line, `[#The Kitchen @@Wren @@Sal'ka]`, for where it is
 * read rather than edited — Focus mode's slim bar has no room for a block.
 */
export function formatSceneHeaderLine(header: SceneHeader): string {
  const parts: string[] = []
  if (header.place?.trim()) parts.push(`#${header.place.trim()}`)
  for (const name of header.characters) if (name.trim()) parts.push(`@@${name.trim()}`)
  return parts.length ? `[${parts.join(' ')}]` : ''
}

/** At most this many lines between a block's brackets: a header is a few lines, and a bracket further down is prose. */
const BLOCK_LINES = 12

/**
 * Split a scene's displayed text into its header and its prose.
 *
 * Only what comes **first** can be a header, in one of two shapes:
 *
 * - **A line**, `[#Kitchen @@Wren]`: a complete `[…]` on the first line.
 * - **A block**: `[` alone on the first line, `]` closing it within a few
 *   lines, and every line between them a header's line — a label, tokens, or
 *   nothing (`headerLike`). That last rule is what keeps a bracket opened on
 *   the first line and closed further down the scene from swallowing the
 *   prose in between.
 *
 * Either way it must name at least one person or place. Anything else is prose
 * that happens to start with a bracket, which is a thing prose does — see
 * `namesAnything`.
 */
export function splitSceneHeader(text: string): { header: string | null; body: string } {
  const line = /^[ \t]*(\[[^\n\]]*\])[ \t]*(?:\r?\n)?/.exec(text)
  const block = line ? null : new RegExp(`^[ \\t]*(\\[[ \\t]*\\r?\\n(?:[^\\n\\]]*\\r?\\n){0,${BLOCK_LINES}}[^\\n\\]]*\\])[ \\t]*(?:\\r?\\n)?`).exec(text)
  const match = line ?? block
  if (!match) return { header: null, body: text }
  if (block && !innerLines(match[1]).every(headerLike)) return { header: null, body: text }
  if (!namesAnything(match[1])) return { header: null, body: text }
  return { header: match[1], body: text.slice(match[0].length).replace(/^\r?\n/, '') }
}

/** The lines between a header's brackets. */
function innerLines(header: string): string[] {
  return (/^\[([\s\S]*)\]$/.exec(header.trim())?.[1] ?? '').split(/\r?\n/)
}

/** A line's label — `Characters:` — taken off, with what follows it. */
function unlabelled(line: string): string {
  return line.replace(/^\s*[A-Za-z][A-Za-z ]{0,23}:\s*/, '')
}

/** Whether a line inside a block is a header's: nothing, or a label and tokens, or tokens. */
function headerLike(line: string): boolean {
  const rest = unlabelled(line).trim()
  return rest === '' || SIGIL_AT_START.test(rest)
}

/**
 * A sigil starts a token only at the start of a line or after a space. A name
 * may then have a sigil's character in it — *Room #4*, a fact asking *Who
 * killed Varro?* — without being cut in two there.
 *
 * `@@` before `@`, so two sigils are one token and not an empty name followed
 * by a real one. `^`, `?` and `~` are sigils already, so a token typed for a
 * later kind of record ends the name before it rather than joining it.
 */
const SIGIL = /(^|\s)(@@|@|#|\^|\?|~)/g
const SIGIL_AT_START = /^(@@|@|#|\^|\?|~)/

/** One line's tokens: each sigil and the name after it, up to the next token. Text before the first is not a token. */
function tokens(line: string): Array<{ sigil: string; name: string }> {
  const found = [...line.matchAll(SIGIL)].map((m) => ({ sigil: m[2], start: m.index! + m[1].length }))
  return found.map((t, i) => ({
    sigil: t.sigil,
    name: line.slice(t.start + t.sigil.length, found[i + 1]?.start ?? line.length).trim(),
  }))
}

/**
 * Whether a bracketed line asserts anything — one person, or one place.
 *
 * The shape of a header is not enough to be one. A writer scribbling
 * `[check: does the assize sit through low water?]` at the top of a draft has
 * written a margin note in the only punctuation margin notes use, and reading
 * it as a declaration answered it by emptying the scene: the note itself was
 * consumed as a header and never stored, the cast and the setting were cleared
 * because the note named nobody, and the real header — one line further down by
 * then — was saved as a paragraph of the book and exported as one.
 *
 * So a bracket that names nobody and nowhere is prose, which is what it was.
 * The test for it is the parse, not a second pattern, because anything the
 * parser cannot find a name in is a line the header has nothing to say about.
 */
function namesAnything(header: string): boolean {
  const { place, characters, items, facts, relations } = parseSceneHeader(header)
  return place !== null || characters.length > 0 || !!items?.length || !!facts?.length || !!relations?.length
}

/**
 * Read a header, a line or a block.
 *
 * A name runs until the next token or the end of its line, because names have
 * spaces in them — 68% of the names in the shipped library are not one word.
 * Returns nulls rather than throwing on a malformed header: half-typed is the
 * normal state of one somebody is typing.
 */
export function parseSceneHeader(header: string): SceneHeader {
  const place: string[] = []
  const characters: string[] = []
  const dead: string[] = []
  const alive: string[] = []
  const called: HeaderAs[] = []
  const reveals: HeaderAs[] = []
  const items: HeaderItem[] = []
  const facts: HeaderFact[] = []
  const relations: HeaderRelation[] = []
  const placeStatus: LocationStatus[] = []
  if (!/^\[[\s\S]*\]$/.test(header.trim())) return { place: null, characters }
  for (const line of innerLines(header)) {
    /*
      A single `@` names a character here, though the header is always
      *written* with two. Inside the brackets there is nothing else it could
      mean: a header asserts presence by being a header, so the second sigil
      carries no information there. It used to carry the whole line instead —
      `[#Court @Sella]` read Sella as part of the place name and then dropped
      her, which is a silent no-op on the one gesture the picker's own notice
      recommends.
    */
    for (const { sigil, name: token } of tokens(unlabelled(line))) {
      if (!token) continue
      if (sigil === '#') {
        const { rest, status } = withStatus(token)
        if (place.length === 0 && status) placeStatus.push(status)
        place.push(rest)
      }
      else if (sigil === '@@' || sigil === '@') {
        const { name, fate, called: as, is } = withFate(token)
        if (!name) continue
        if (!characters.includes(name)) characters.push(name)
        if (fate === 'dead' && !dead.includes(name)) dead.push(name)
        if (fate === 'alive' && !alive.includes(name)) alive.push(name)
        if (as && !called.some((c) => c.name === name)) called.push({ name, as })
        if (is && !reveals.some((r) => r.name === name)) reveals.push({ name, as: is })
      } else if (sigil === '^') {
        const item = withTarget(token)
        // One token per item: a second one for the same item is the writer mid-edit, and the first stands.
        if (item.name && !items.some((i) => i.name.toLowerCase() === item.name.toLowerCase())) items.push(item)
      } else if (sigil === '?') {
        const fact = withLearner(token)
        const key = (f: HeaderFact) => `${f.title.toLowerCase()}\u0000${f.learner?.toLowerCase() ?? ''}\u0000${f.reader ? 1 : 0}`
        // The same fact may be learned by several people at a scene: one token each, and a repeat of the same one counts once.
        if (fact.title && !facts.some((f) => key(f) === key(fact))) facts.push(fact)
      } else if (sigil === '~') {
        const rel = withPair(token)
        const pair = (r: HeaderRelation) => [r.a.toLowerCase(), r.b.toLowerCase()].sort().join('\u0000')
        // One token per pair: a second for the same two is the writer mid-edit, and the first stands.
        if (rel && !relations.some((r) => pair(r) === pair(rel))) relations.push(rel)
      }
    }
  }
  // Only when there are any, so a header with no fates reads exactly as one always did.
  return { place: place[0] ?? null, ...(placeStatus.length ? { placeStatus: placeStatus[0] } : {}), characters, ...(dead.length ? { dead } : {}), ...(alive.length ? { alive } : {}), ...(called.length ? { called } : {}), ...(reveals.length ? { reveals } : {}), ...(items.length ? { items } : {}), ...(facts.length ? { facts } : {}), ...(relations.length ? { relations } : {}) }
}

/**
 * Split what is *in the box* into header and prose, knowing the line that was
 * rendered into it.
 *
 * `splitSceneHeader` reads a string cold and can only look at the first line.
 * That is not enough on its own, because a writer who types a margin note above
 * the rendered line pushes it down to line two — and a header that is no longer
 * line one is, to a cold read, a paragraph of the book. It exported as one.
 *
 * The box is not a cold read: we know exactly what we put in it. So when the
 * first line is not a header, the rendered line is looked for and lifted back
 * out, whatever the writer typed above it. Their note stays, as the prose it
 * is; the line stays the line; and the two cannot be confused for each other,
 * because one of them is a string we wrote ourselves.
 *
 * Pass `''` for `rendered` when the records say nothing — then this is
 * `splitSceneHeader`, and a bracket in the box is prose.
 */
export function splitSceneDraft(
  text: string,
  rendered: string,
): { header: string | null; body: string } {
  const direct = splitSceneHeader(text)
  if (direct.header || !rendered) return direct
  const at = text.indexOf(rendered)
  if (at === -1) return direct
  const before = text.slice(0, at)
  // One newline, so lifting the line out does not leave the gap it sat in.
  const after = text.slice(at + rendered.length).replace(/^\n/, '')
  return { header: rendered, body: `${before}${after}`.replace(/^\n+/, '') }
}

/**
 * A character's state at this scene, as a fate in the header sets it: `:dead`
 * is not alive; `:alive` is alive and *revived*; taking either off sets back
 * what it had said.
 */
export interface FateChange { characterId: string; isAlive: boolean; revived: boolean }

/** An item handed to somebody at a scene, or put down at a place there. */
export interface ItemHandoff { itemId: string; characterId: string }
export interface ItemPut { itemId: string; placeId: string }
export interface ItemConditionAt { itemId: string; condition: ItemCondition }

/** What a scene's Items line draws (`sceneItems`), and what it is read against. */
export interface SceneItems { involved: string[]; handoffs: ItemHandoff[]; placements: ItemPut[]; conditions?: ItemConditionAt[] }

/**
 * The item records an Items line asks for. `involvedItemIds` is the scene's new
 * list of items, or null when it is unchanged; the rest are hand-offs and
 * placements to write at this scene, and ones taken off the line to take back.
 */
export interface ItemPlan {
  involvedItemIds: string[] | null
  give: ItemHandoff[]
  put: ItemPut[]
  takeBack: ItemHandoff[]
  unput: string[]
  /** Conditions to record at this scene, and items whose condition here is taken off the line. */
  condition: ItemConditionAt[]
  uncondition: string[]
}

/** A character learning a fact at a scene. */
export interface FactLearned { factId: string; characterId: string }

/** What a scene's Facts line draws (`sceneFacts`), and what it is read against. */
export interface SceneFacts { learned: FactLearned[]; reader: string[]; origin: string[] }

/** The knowledge records a Facts line asks for: reveals to make or take back, and facts the reader learns, or that become true, here. */
export interface FactPlan {
  learn: FactLearned[]
  unlearn: FactLearned[]
  readerHere: string[]
  readerOff: string[]
  originHere: string[]
  originOff: string[]
}

/**
 * A relationship the Relationships line draws at a scene: its state recorded
 * here, or — with none — the relationship itself, where it starts here.
 */
export interface DrawnRelation { relationshipId: string; label: string; ended: boolean; startsHere: boolean }

/**
 * The relationship records a Relationships line asks for: relationships to
 * make, starting here; a relationship that starts here, given a new label; a
 * state to record here; and a state here taken back.
 */
export interface RelationPlan {
  create: Array<{ characterAId: string; characterBId: string; label: string }>
  relabel: Array<{ relationshipId: string; label: string }>
  state: Array<{ relationshipId: string; label: string; isActive: boolean }>
  unstate: string[]
}

/** What a header line changes, and what in it the world could not answer. */
export interface HeaderPlan {
  /**
   * Names nothing answers, and a place nothing answers — said, and otherwise
   * left alone. `facts` are fact titles nothing answers: said, and offered to
   * be made, as a place is.
   */
  unknown: { names: string[]; place: string | null; facts?: string[]; refused?: string[] }
  /** The scene's new cast, mentions and setting, or null when the line changes nothing. */
  update: { involvedCharacterIds: string[]; mentionedCharacterIds: string[]; locationMarkerId: string | null } | null
  /** States to record at this scene for the fates the header gives or takes back. Empty when it changes none. */
  fates: FateChange[]
  /** Item records for the Items line. */
  items: ItemPlan
  /** Knowledge records for the Facts line. */
  facts: FactPlan
  /** Relationship records for the Relationships line. */
  relations: RelationPlan
  /** The place's status for the Place line. */
  placeStatus: PlaceStatusPlan
  /** Names and reveals for the Characters line. */
  identity: IdentityPlan
}

/**
 * The name the book calls somebody from this scene, and who somebody is
 * revealed to be here: to record, and — taken off the line — to take back.
 */
export interface IdentityPlan {
  rename: Array<{ characterId: string; name: string }>
  unrename: string[]
  reveal: Array<{ characterId: string; asId: string }>
  unreveal: string[]
}
const NO_IDENTITY: IdentityPlan = { rename: [], unrename: [], reveal: [], unreveal: [] }

/** What a scene's Characters line draws of names and reveals (`sceneNames`). */
export interface SceneNames { called: Array<{ characterId: string; name: string }>; revealed: Array<{ characterId: string; asId: string }> }

/** The Characters line's names and reveals, by name, for the people in `cast`: see `sceneNames`. */
export function headerNames(
  drawn: SceneNames,
  cast: readonly string[],
  nameOf: (id: string) => string | undefined,
): { called: HeaderAs[]; reveals: HeaderAs[] } {
  const by = (id: string, as: string | undefined) => {
    const name = cast.includes(id) ? nameOf(id) : undefined
    return name && as ? [{ name, as }] : []
  }
  return {
    called: drawn.called.flatMap((c) => by(c.characterId, c.name)),
    reveals: drawn.revealed.flatMap((r) => by(r.characterId, nameOf(r.asId))),
  }
}

/** The name changes and reveals recorded at scene `eventId`. */
export function sceneNames(
  eventId: string,
  characters: ReadonlyArray<Pick<Character, 'id' | 'nameChanges' | 'revealedAs'>>,
): SceneNames {
  const called: SceneNames['called'] = []
  const revealed: SceneNames['revealed'] = []
  for (const c of characters) {
    const change = c.nameChanges?.find((n) => n.eventId === eventId)
    if (change) called.push({ characterId: c.id, name: change.name })
    if (c.revealedAs?.eventId === eventId) revealed.push({ characterId: c.id, asId: c.revealedAs.characterId })
  }
  return { called, revealed }
}

/** A place's status to record at this scene, and a place whose status here is taken back. */
export interface PlaceStatusPlan { set: { placeId: string; status: LocationStatus } | null; unset: string | null }
const NO_PLACE_STATUS: PlaceStatusPlan = { set: null, unset: null }

const NO_ITEMS: ItemPlan = { involvedItemIds: null, give: [], put: [], takeBack: [], unput: [], condition: [], uncondition: [] }
const NO_FACTS: FactPlan = { learn: [], unlearn: [], readerHere: [], readerOff: [], originHere: [], originOff: [] }
const NO_RELATIONS: RelationPlan = { create: [], relabel: [], state: [], unstate: [] }

/**
 * Read a header line against the world and say what the scene becomes. The
 * rules of a scene card's draft and the Manuscript's Page, in one place.
 *
 * `involved` is the cast the line is read against: a card being edited passes
 * the cast it is editing, which is not always the stored one.
 *
 * No header is no change — deleting the line is how somebody clears their
 * screen, not how they empty their cast.
 */
export function planHeader(
  header: string | null,
  world: {
    characters: ReadonlyArray<{ id: string; name: string; aliases?: string[]; nameChanges?: Character['nameChanges']; revealedAs?: Character['revealedAs'] }>
    places: ReadonlyArray<{ id: string; name: string }>
    items?: ReadonlyArray<{ id: string; name: string }>
    facts?: ReadonlyArray<{ id: string; title: string }>
    relationships?: ReadonlyArray<{ id: string; characterAId: string; characterBId: string }>
  },
  /**
   * `dead` and `alive` are who the header *draws* with a fate at this scene
   * (`sceneFates`): what taking a fate off is measured against.
   */
  scene: { involved: string[]; mentioned: string[]; place: string | null; placeStatus?: LocationStatus | null; names?: SceneNames; dead?: string[]; alive?: string[]; items?: SceneItems; facts?: SceneFacts; relations?: DrawnRelation[] },
): HeaderPlan {
  if (!header) return { unknown: { names: [], place: null }, update: null, fates: [], items: NO_ITEMS, facts: NO_FACTS, relations: NO_RELATIONS, placeStatus: NO_PLACE_STATUS, identity: NO_IDENTITY }
  const parsed = parseSceneHeader(header)

  const matches = (name: string, against: string, aliases?: string[]) =>
    against.toLowerCase() === name.toLowerCase()
    || !!aliases?.some((a) => a.toLowerCase() === name.toLowerCase())

  // Every name the character goes by in the book, the ones they change to included.
  const found = parsed.characters.map((n) => ({
    name: n, record: world.characters.find((c) => matches(n, c.name, proseAliases({ ...c, aliases: c.aliases ?? [] }))),
  }))
  const place = parsed.place
    ? world.places.find((m) => matches(parsed.place!, m.name))
    : undefined
  const unmatched = found.filter((f) => !f.record).map((f) => f.name)
  const unknownPlace = parsed.place && !place ? parsed.place : null

  /*
    A place the header names but the world does not have keeps the setting
    it had: the writer meant to put the scene somewhere, and clearing it
    would answer a typo by throwing away the answer.

    That sentence is true of people word for word, and people were the case
    that dropped. `@@Juno Skeling` took Juno Skelling out of the scene, and
    so did the comma a writer puts between names by habit — one mistyped
    letter, and somebody was no longer in the room. So a header naming
    anybody this world cannot answer leaves the cast alone and says so; the
    names stay on the line, where the letter can be fixed in place.
  */
  const nextCast = unmatched.length > 0
    ? scene.involved
    : found.flatMap((f) => (f.record ? [f.record.id] : []))
  const nextPlace = parsed.place ? (place?.id ?? scene.place) : null
  const castUnchanged = nextCast.length === scene.involved.length
    && nextCast.every((id, i) => scene.involved[i] === id)
  const characterId = (n: string) => found.find((f) => f.name === n)?.record?.id
    ?? world.characters.find((c) => matches(n, c.name, proseAliases({ ...c, aliases: c.aliases ?? [] })))?.id
  const itemPlan = planItems(parsed.items ?? [], world, scene.items, characterId)
  const factPlan = planFacts(parsed.facts ?? [], world.facts ?? [], scene.facts, characterId)
  const relationPlan = planRelations(parsed.relations ?? [], world.relationships ?? [], scene.relations ?? [], characterId)
  const identityPlan = planIdentity(found, parsed, scene.names, world.characters, (n) =>
    world.characters.find((c) => matches(n, c.name, proseAliases({ ...c, aliases: c.aliases ?? [] }))))
  const unknown = {
    names: [...unmatched, ...itemPlan.unknown, ...factPlan.unknownNames, ...relationPlan.unknown, ...identityPlan.unknown],
    place: unknownPlace,
    ...(factPlan.unknownFacts.length ? { facts: factPlan.unknownFacts } : {}),
    ...(identityPlan.refused.length ? { refused: identityPlan.refused } : {}),
  }
  const identity = identityPlan.plan
  const fates = planFates(found, parsed, scene)
  const items = itemPlan.plan
  const facts = factPlan.plan
  const relations = relationPlan.plan
  const placeStatus = planPlaceStatus(parsed.place ? place?.id ?? null : null, parsed.placeStatus ?? null, !!unknownPlace, scene)
  if (castUnchanged && nextPlace === scene.place) return { unknown, update: null, fates, items, facts, relations, placeStatus, identity }
  return {
    unknown,
    identity,
    fates,
    items,
    facts,
    relations,
    placeStatus,
    update: {
      involvedCharacterIds: nextCast,
      /*
        Presence replaces a mention rather than sitting beside it, which is
        what `@@` in the prose does and what the guide promises of both. The
        header used to leave a character in the cast *and* in the mentioned
        list — two mutually exclusive claims, in one record, that nothing
        reported.
      */
      mentionedCharacterIds: scene.mentioned.filter((id) => !nextCast.includes(id)),
      locationMarkerId: nextPlace,
    },
  }
}

/**
 * What the Characters line says of names and reveals, against what it draws.
 * Only for the people on the line: somebody taken off it leaves the scene, and
 * what was recorded of their name is left as it was, as their fate is.
 *
 * A reveal the rules of `characterIdentity` forbid — of somebody as themself,
 * as somebody already revealed as another, or of somebody others are revealed
 * to be — is refused, and said, rather than written.
 */
function planIdentity(
  found: Array<{ name: string; record?: { id: string; name: string } }>,
  parsed: SceneHeader,
  drawn: SceneNames = { called: [], revealed: [] },
  characters: ReadonlyArray<{ id: string; name: string; revealedAs?: Character['revealedAs'] }>,
  byName: (name: string) => { id: string; name: string } | undefined,
): { plan: IdentityPlan; unknown: string[]; refused: string[] } {
  const plan: IdentityPlan = { rename: [], unrename: [], reveal: [], unreveal: [] }
  const unknown: string[] = []
  const refused: string[] = []
  for (const { name, record } of found) {
    if (!record) continue
    const id = record.id
    const called = parsed.called?.find((c) => c.name === name)
    const wasCalled = drawn.called.find((c) => c.characterId === id)
    if (called && wasCalled?.name !== called.as) plan.rename.push({ characterId: id, name: called.as })
    else if (!called && wasCalled) plan.unrename.push(id)

    const is = parsed.reveals?.find((r) => r.name === name)
    const wasRevealed = drawn.revealed.find((r) => r.characterId === id)
    if (!is) { if (wasRevealed) plan.unreveal.push(id); continue }
    const target = byName(is.as)
    if (!target) { unknown.push(is.as); continue }
    if (wasRevealed?.asId === target.id) continue
    if (!revealTargets(characters, id).some((c) => c.id === target.id)) {
      refused.push(target.id === id
        ? `${record.name} cannot be revealed to be themself.`
        : characters.some((c) => c.revealedAs?.characterId === id && c.id !== target.id)
          ? `${record.name} cannot be revealed to be anyone: others are revealed to be ${record.name}.`
          : `${record.name} cannot be revealed to be ${target.name}, who is revealed to be somebody else.`)
      continue
    }
    plan.reveal.push({ characterId: id, asId: target.id })
  }
  return { plan, unknown, refused }
}

/**
 * The place's state the Place line asks for: its status here, and the one the
 * line drew here taken back when the line no longer says it — the status taken
 * off, or the place itself changed or taken off, since the status was a claim
 * about the place the line named. A place nothing answers changes nothing.
 */
function planPlaceStatus(
  placeId: string | null,
  status: LocationStatus | null,
  unknownPlace: boolean,
  scene: { place: string | null; placeStatus?: LocationStatus | null },
): PlaceStatusPlan {
  if (unknownPlace) return NO_PLACE_STATUS
  const drawn = scene.placeStatus ?? null
  const same = placeId !== null && placeId === scene.place
  return {
    set: placeId && status && !(same && drawn === status) ? { placeId, status } : null,
    unset: scene.place && drawn && !(same && status) ? scene.place : null,
  }
}

/**
 * The status the Place line draws at scene `eventId` for its place: the place's
 * state here, where its status is not the one before it — or, with none
 * before, is one at all. A state that only carries the status on is not one.
 */
export function scenePlaceStatus(
  eventId: string,
  placeId: string | null,
  states: ReadonlyArray<{ locationMarkerId: string; eventId: string; status: string; sortKey?: number }>,
): LocationStatus | null {
  if (!placeId) return null
  const here = states.find((s) => s.locationMarkerId === placeId && s.eventId === eventId)
  if (!here || !(LOCATION_STATUSES as readonly string[]).includes(here.status)) return null
  const before = states
    .filter((s) => s.locationMarkerId === placeId && (s.sortKey ?? 0) < (here.sortKey ?? 0))
    .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]
  return before?.status === here.status ? null : here.status as LocationStatus
}

/**
 * The states the header's fates ask for. A fate given is written; a fate taken
 * off a name still on the header is set back. A name taken off the header
 * altogether leaves the scene, and its state is left as it was: leaving the
 * room is a change to the cast, not to whether somebody is alive.
 */
function planFates(
  found: Array<{ name: string; record?: { id: string } }>,
  parsed: SceneHeader,
  scene: { dead?: string[]; alive?: string[] },
): FateChange[] {
  const changes: FateChange[] = []
  for (const { name, record } of found) {
    if (!record) continue
    const id = record.id
    const dies = !!parsed.dead?.includes(name)
    const returns = !dies && !!parsed.alive?.includes(name)
    const wasDead = !!scene.dead?.includes(id)
    const wasAlive = !!scene.alive?.includes(id)
    if (dies && !wasDead) changes.push({ characterId: id, isAlive: false, revived: false })
    else if (returns && !wasAlive) changes.push({ characterId: id, isAlive: true, revived: true })
    else if (!dies && wasDead) changes.push({ characterId: id, isAlive: true, revived: false })
    else if (!returns && wasAlive) changes.push({ characterId: id, isAlive: false, revived: false })
  }
  return changes
}

/**
 * The item records the Items line asks for, against what the scene draws now.
 *
 * Every item named on the line is in the scene. One with a target is also
 * handed to that person, or put down at that place, here. A target taken off,
 * or changed, takes the old one back.
 *
 * A name nothing answers — an item, a holder, a place — is said and changes
 * nothing it could be the typo of: the scene's list of items stays as it was,
 * and nothing is taken back, since the token that seems to be missing may be
 * the one that was misspelt. What the line does name is still written.
 */
function planItems(
  tokens: HeaderItem[],
  world: { places: ReadonlyArray<{ id: string; name: string }>; items?: ReadonlyArray<{ id: string; name: string }> },
  drawn: SceneItems = { involved: [], handoffs: [], placements: [] },
  characterId: (name: string) => string | undefined,
): { plan: ItemPlan; unknown: string[] } {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const unknown: string[] = []
  const named: string[] = []
  const give: ItemHandoff[] = []
  const put: ItemPut[] = []
  const wantHandoffs: ItemHandoff[] = []
  const wantPuts: ItemPut[] = []
  const wantConditions: ItemConditionAt[] = []
  for (const token of tokens) {
    const item = world.items?.find((i) => same(i.name, token.name))
    if (!item) { unknown.push(token.name); continue }
    named.push(item.id)
    if (token.condition) wantConditions.push({ itemId: item.id, condition: token.condition })
    if (token.holder) {
      const who = characterId(token.holder)
      if (!who) { unknown.push(token.holder); continue }
      wantHandoffs.push({ itemId: item.id, characterId: who })
    } else if (token.place) {
      const where = world.places.find((p) => same(p.name, token.place!))
      if (!where) { unknown.push(token.place); continue }
      wantPuts.push({ itemId: item.id, placeId: where.id })
    }
  }
  for (const h of wantHandoffs) if (!drawn.handoffs.some((d) => d.itemId === h.itemId && d.characterId === h.characterId)) give.push(h)
  for (const p of wantPuts) if (!drawn.placements.some((d) => d.itemId === p.itemId && d.placeId === p.placeId)) put.push(p)
  const drawnConditions = drawn.conditions ?? []
  const condition = wantConditions.filter((c) => !drawnConditions.some((d) => d.itemId === c.itemId && d.condition === c.condition))
  const clean = unknown.length === 0
  const takeBack = clean ? drawn.handoffs.filter((d) => !wantHandoffs.some((h) => h.itemId === d.itemId && h.characterId === d.characterId)) : []
  // A placement replaced by another one here is overwritten, not taken back first.
  const unput = clean ? drawn.placements.filter((d) => !wantPuts.some((p) => p.itemId === d.itemId)).map((d) => d.itemId) : []
  // Likewise a condition replaced by another here.
  const uncondition = clean ? drawnConditions.filter((d) => !wantConditions.some((c) => c.itemId === d.itemId)).map((d) => d.itemId) : []
  const next = clean ? named : drawn.involved
  const unchanged = next.length === drawn.involved.length && next.every((id) => drawn.involved.includes(id))
  return { plan: { involvedItemIds: unchanged ? null : next, give, put, takeBack, unput, condition, uncondition }, unknown }
}

/**
 * What a scene's Items line draws: each item in the scene, and — where it
 * changes hands here — who it goes to or where it is put down. A hand-off is a
 * state here listing the item when the person's state before it did not; a
 * state that merely carries an item on is not one.
 *
 * And its condition, where that changes here: an item state at this scene
 * whose condition is not the one before it — or, with none before, is one at
 * all. A state that only carries the condition on, with new notes, is not one.
 */
export function sceneItems(
  eventId: string,
  involvedItemIds: readonly string[],
  snapshots: ReadonlyArray<{ characterId: string; eventId: string; inventoryItemIds: string[]; sortKey?: number }>,
  placements: ReadonlyArray<{ itemId: string; eventId: string; locationMarkerId: string }>,
  itemStates: ReadonlyArray<{ itemId: string; eventId: string; condition: string; sortKey?: number }> = [],
): SceneItems {
  const conditions: ItemConditionAt[] = []
  for (const here of itemStates) {
    if (here.eventId !== eventId || !(ITEM_CONDITIONS as readonly string[]).includes(here.condition)) continue
    const before = itemStates
      .filter((s) => s.itemId === here.itemId && (s.sortKey ?? 0) < (here.sortKey ?? 0))
      .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]
    if (before?.condition !== here.condition) conditions.push({ itemId: here.itemId, condition: here.condition as ItemCondition })
  }
  const handoffs: ItemHandoff[] = []
  for (const here of snapshots) {
    if (here.eventId !== eventId || here.inventoryItemIds.length === 0) continue
    const before = snapshots
      .filter((s) => s.characterId === here.characterId && (s.sortKey ?? 0) < (here.sortKey ?? 0))
      .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]
    for (const itemId of here.inventoryItemIds) {
      if (!before?.inventoryItemIds.includes(itemId)) handoffs.push({ itemId, characterId: here.characterId })
    }
  }
  const put = placements.filter((p) => p.eventId === eventId).map((p) => ({ itemId: p.itemId, placeId: p.locationMarkerId }))
  return { involved: [...involvedItemIds], handoffs, placements: put, ...(conditions.length ? { conditions } : {}) }
}

/**
 * The Items line a scene draws, by name: every item in the scene or changing
 * hands here, each once, with where it goes.
 */
export function headerItems(
  drawn: SceneItems,
  nameOf: { item: (id: string) => string | undefined; character: (id: string) => string | undefined; place: (id: string) => string | undefined },
): HeaderItem[] {
  const conditions = drawn.conditions ?? []
  const ids = [...new Set([...drawn.involved, ...drawn.handoffs.map((h) => h.itemId), ...drawn.placements.map((p) => p.itemId), ...conditions.map((c) => c.itemId)])]
  return ids.flatMap((id) => {
    const name = nameOf.item(id)
    if (!name) return []
    const to = drawn.handoffs.find((h) => h.itemId === id)
    const at = drawn.placements.find((p) => p.itemId === id)
    const holder = to ? nameOf.character(to.characterId) : undefined
    const place = !holder && at ? nameOf.place(at.placeId) : undefined
    const condition = conditions.find((c) => c.itemId === id)?.condition
    return [{ name, ...(condition ? { condition } : {}), ...(holder ? { holder } : {}), ...(place ? { place } : {}) }]
  })
}

/**
 * Who the header draws with a fate at scene `eventId`: `dead` for anyone in
 * `cast` whose state here says they are not alive when the state before it —
 * or none — said they were; `alive` for anyone whose state here says they came
 * back. Only a change is drawn, at the scene it happens: a corpse is not
 * `:dead` again in every scene after.
 */
export function sceneFates(
  eventId: string,
  cast: readonly string[],
  snapshots: ReadonlyArray<{ characterId: string; eventId: string; isAlive: boolean; revived?: boolean; sortKey?: number }>,
): { dead: string[]; alive: string[] } {
  const dead: string[] = []
  const alive: string[] = []
  for (const here of snapshots) {
    if (here.eventId !== eventId || !cast.includes(here.characterId)) continue
    if (here.isAlive) {
      if (here.revived) alive.push(here.characterId)
      continue
    }
    const before = snapshots
      .filter((s) => s.characterId === here.characterId && (s.sortKey ?? 0) < (here.sortKey ?? 0))
      .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]
    if (!before || before.isAlive) dead.push(here.characterId)
  }
  return { dead, alive }
}

/**
 * The knowledge records the Facts line asks for, against what the scene draws.
 *
 * Each token is one record: somebody learning the fact here, the reader
 * learning it here, or — alone — the fact becoming true here. One taken off
 * the line is taken back. A title nothing answers is offered to be made, and
 * a learner nothing answers is said; with either, nothing is taken back, for
 * the same reason as an item: the token that seems to be missing may be the
 * one that was misspelt.
 */
function planFacts(
  tokens: HeaderFact[],
  known: ReadonlyArray<{ id: string; title: string }>,
  drawn: SceneFacts = { learned: [], reader: [], origin: [] },
  characterId: (name: string) => string | undefined,
): { plan: FactPlan; unknownFacts: string[]; unknownNames: string[] } {
  const unknownFacts: string[] = []
  const unknownNames: string[] = []
  const learned: FactLearned[] = []
  const reader: string[] = []
  const origin: string[] = []
  for (const token of tokens) {
    const fact = known.find((f) => f.title.trim().toLowerCase() === token.title.toLowerCase())
    if (!fact) { if (!unknownFacts.includes(token.title)) unknownFacts.push(token.title); continue }
    if (token.learner) {
      const who = characterId(token.learner)
      if (!who) { unknownNames.push(token.learner); continue }
      learned.push({ factId: fact.id, characterId: who })
    } else if (token.reader) reader.push(fact.id)
    else origin.push(fact.id)
  }
  const clean = unknownFacts.length === 0 && unknownNames.length === 0
  const has = (list: FactLearned[], l: FactLearned) => list.some((x) => x.factId === l.factId && x.characterId === l.characterId)
  return {
    plan: {
      learn: learned.filter((l) => !has(drawn.learned, l)),
      unlearn: clean ? drawn.learned.filter((l) => !has(learned, l)) : [],
      readerHere: reader.filter((id) => !drawn.reader.includes(id)),
      readerOff: clean ? drawn.reader.filter((id) => !reader.includes(id)) : [],
      originHere: origin.filter((id) => !drawn.origin.includes(id)),
      originOff: clean ? drawn.origin.filter((id) => !origin.includes(id)) : [],
    },
    unknownFacts,
    unknownNames,
  }
}

/** What a scene's Facts line draws: who learns what here, what the reader learns here, and what becomes true here. */
export function sceneFacts(
  eventId: string,
  reveals: ReadonlyArray<{ factId: string; characterId: string; eventId: string }>,
  facts: ReadonlyArray<{ id: string; readerLearnsAtEventId: string | null; originEventId: string | null }>,
): SceneFacts {
  return {
    learned: reveals.filter((r) => r.eventId === eventId).map((r) => ({ factId: r.factId, characterId: r.characterId })),
    reader: facts.filter((f) => f.readerLearnsAtEventId === eventId).map((f) => f.id),
    origin: facts.filter((f) => f.originEventId === eventId).map((f) => f.id),
  }
}

/** The Facts line a scene draws, by name: what becomes true here, then who learns what, then what the reader learns. */
export function headerFacts(
  drawn: SceneFacts,
  nameOf: { fact: (id: string) => string | undefined; character: (id: string) => string | undefined },
): HeaderFact[] {
  const out: HeaderFact[] = []
  for (const id of drawn.origin) { const title = nameOf.fact(id); if (title) out.push({ title }) }
  for (const l of drawn.learned) {
    const title = nameOf.fact(l.factId)
    const learner = nameOf.character(l.characterId)
    if (title && learner) out.push({ title, learner })
  }
  for (const id of drawn.reader) { const title = nameOf.fact(id); if (title) out.push({ title, reader: true }) }
  return out
}

/**
 * The relationship records the Relationships line asks for, against what the
 * scene draws.
 *
 * Two people with no relationship get one, starting here. One that starts here
 * takes the label as its own. Any other records its state here: the label, or
 * `:ended`. A state here taken off the line is taken back. A relationship that
 * starts here is left when its token is taken off — ending or removing one is
 * a decision about the relationship, made on its own page or with Undo, not by
 * clearing a line. A name nothing answers is said, and nothing is taken back
 * meanwhile.
 */
function planRelations(
  tokens: HeaderRelation[],
  known: ReadonlyArray<{ id: string; characterAId: string; characterBId: string }>,
  drawn: DrawnRelation[],
  characterId: (name: string) => string | undefined,
): { plan: RelationPlan; unknown: string[] } {
  const unknown: string[] = []
  const plan: RelationPlan = { create: [], relabel: [], state: [], unstate: [] }
  const named = new Set<string>()
  for (const token of tokens) {
    const a = characterId(token.a)
    const b = characterId(token.b)
    if (!a) unknown.push(token.a)
    if (!b) unknown.push(token.b)
    if (!a || !b || a === b) continue
    const rel = known.find((r) => (r.characterAId === a && r.characterBId === b) || (r.characterAId === b && r.characterBId === a))
    if (!rel) {
      // Nothing to end: a relationship that never began has no state to take.
      if (!token.ended) plan.create.push({ characterAId: a, characterBId: b, label: token.label })
      continue
    }
    named.add(rel.id)
    const here = drawn.find((d) => d.relationshipId === rel.id)
    if (here && here.label === token.label && here.ended === !!token.ended) continue
    if (here?.startsHere && !token.ended) plan.relabel.push({ relationshipId: rel.id, label: token.label })
    else plan.state.push({ relationshipId: rel.id, label: token.label, isActive: !token.ended })
  }
  if (unknown.length === 0) {
    for (const d of drawn) if (!d.startsHere && !named.has(d.relationshipId)) plan.unstate.push(d.relationshipId)
  }
  return { plan, unknown }
}

/**
 * What a scene's Relationships line draws: each relationship whose state is
 * recorded here, and each that starts here with no state of its own here.
 */
export function sceneRelations(
  eventId: string,
  relationships: ReadonlyArray<{ id: string; label: string; startEventId: string | null }>,
  snapshots: ReadonlyArray<{ relationshipId: string; eventId: string; label: string; isActive: boolean }>,
): DrawnRelation[] {
  const states = snapshots.filter((s) => s.eventId === eventId)
  return [
    ...relationships
      .filter((r) => r.startEventId === eventId && !states.some((s) => s.relationshipId === r.id))
      .map((r) => ({ relationshipId: r.id, label: r.label, ended: false, startsHere: true })),
    ...states.map((s) => ({ relationshipId: s.relationshipId, label: s.label, ended: !s.isActive, startsHere: false })),
  ]
}

/** The Relationships line a scene draws, by name. */
export function headerRelations(
  drawn: DrawnRelation[],
  relationships: ReadonlyArray<{ id: string; characterAId: string; characterBId: string }>,
  nameOf: (id: string) => string | undefined,
): HeaderRelation[] {
  return drawn.flatMap((d) => {
    const rel = relationships.find((r) => r.id === d.relationshipId)
    const a = rel && nameOf(rel.characterAId)
    const b = rel && nameOf(rel.characterBId)
    return a && b ? [{ a, b, label: d.label, ...(d.ended ? { ended: true } : {}) }] : []
  })
}

/** Whether a plan left everything on the line answered. */
export const planIsClean = (plan: HeaderPlan) => plan.unknown.names.length === 0 && plan.unknown.place === null && !plan.unknown.facts?.length && !plan.unknown.refused?.length

/** The prose alone — what is stored, counted, compiled and exported. */
export function sceneBody(text: string): string {
  return splitSceneHeader(text).body
}
