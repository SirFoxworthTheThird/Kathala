import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const d = JSON.parse(readFileSync('f:/Projects/WorldBreaker/example/The Name of the Wind.pwk', 'utf8'));
const W = d.world.id;
const ts = 1713200000000;
const MAP_LAYER = 'yF9kfivU4hqYe27Nv3zMj';

const E = n => '70000000-0000-4000-a000-' + String(n).padStart(12, '0');

const LOC = {
  COMMONWEALTH: 'a0000000-0000-4000-a000-000000000007',
  ANILIN:       'a0000000-0000-4000-a000-000000000008',
  STONE_ROAD:   'a0000000-0000-4000-a000-000000000009',
  ELD:          'a0000000-0000-4000-a000-000000000010',
  UNIVERSITY:   'a0000000-0000-4000-a000-000000000011',
  IMRE:         'a0000000-0000-4000-a000-000000000012',
  TARBEAN:      'a0000000-0000-4000-a000-000000000013',
};

const C = {
  KVOTHE:  '30000000-0000-4000-a000-000000000001',
  BAST:    '30000000-0000-4000-a000-000000000002',
  CHRON:   '30000000-0000-4000-a000-000000000003',
  ARLIDEN: '30000000-0000-4000-a000-000000000004',
  LAURIAN: '30000000-0000-4000-a000-000000000005',
  ABENTHY: '30000000-0000-4000-a000-000000000006',
  DENNA:   '30000000-0000-4000-a000-000000000007',
  SIMMON:  '30000000-0000-4000-a000-000000000008',
  WILEM:   '30000000-0000-4000-a000-000000000009',
  AMBROSE: '30000000-0000-4000-a000-000000000010',
  CINDER:  '30000000-0000-4000-a000-000000000019',
  HALIAX:  '30000000-0000-4000-a000-000000000020',
  DEVI:    'b1e30133-29d0-4f94-8f70-e33df9d9f312',
  ELODIN:  'd3763704-c74f-431b-9045-8e415d8029d0',
  HEMME:   'de769a56-8aa4-4235-9a5c-fb52cf75bef7',
  KILVIN:  'ebcb2993-4269-4167-9fea-3bfc47935cba',
};

const ITEMS = {
  LUTE1:     '40000000-0000-4000-a000-000000000001',
  LUTE2:     '59ef6382-ce54-43d7-a8c1-e029c65df874',
  BLOODLESS: '81c2ef7b-9a7c-4e85-88bd-9d9b57437937',
  UKEY:      'dc4b0653-488a-4f7c-a171-1a43e6acbb05',
};

const RELS = {
  KVOTHE_BAST:    '50000000-0000-4000-a000-000000000001',
  KVOTHE_DENNA:   '50000000-0000-4000-a000-000000000002',
  KVOTHE_AMBROSE: '50000000-0000-4000-a000-000000000003',
  KVOTHE_SIMMON:  '50000000-0000-4000-a000-000000000004',
  KVOTHE_WILEM:   '50000000-0000-4000-a000-000000000005',
  KVOTHE_ELODIN:  '074ea5cb-85f8-4ffa-aaa9-602944fefcc5',
  KVOTHE_KILVIN:  '2701478e-099a-4d2b-aff3-3bd1424c0b35',
  KVOTHE_DEVI:    '73311964-968e-4cd7-9055-6e4c731fb67c',
  KVOTHE_HEMME:   'b62d2d0d-3cd0-474c-bb6b-cd3ae82132bb',
};

// ══════════════════════════════════════════════
// 1. CHARACTER DESCRIPTIONS
// ══════════════════════════════════════════════
const charDescriptions = {
  [C.KVOTHE]:  'The legendary arcanist, musician, and thief — known throughout the world by a dozen names. As a child he traveled with his father\'s Edema Ruh troupe before the Chandrian murdered his family. He spent three years as a street urchin in Tarbean before entering the University at an unheard-of young age, where he became both celebrated and notorious. In the present day he hides under the name Kote, running a quiet inn and pretending to be nobody.',
  [C.BAST]:    'Kvothe\'s student and companion at the Waystone Inn — seemingly human, but in truth a Fae noble of royal blood. Bast is quick-witted, charming, and occasionally ruthless when his master\'s welfare is at stake. He serves with absolute devotion, though he chafes at Kvothe\'s deliberate suppression of his own legend.',
  [C.CHRON]:   'Devan Lochees, called Chronicler — the most respected scribe in the known world. He travels to the Waystone Inn to record Kvothe\'s story firsthand, having tracked the legendary figure for years. Practical, skeptical, and precise, Chronicler is shaken when legend and reality collide.',
  [C.ARLIDEN]:  'Kvothe\'s father and leader of the Edema Ruh troupe — a celebrated performer and composer. Arliden was working on a song about the Chandrian at the time of his death, a project born of scholarly curiosity that ultimately drew the demons to his family. His talent, warmth, and love of craft shaped everything Kvothe became.',
  [C.LAURIAN]:  'Kvothe\'s mother, known as Laurian — born a woman of noble family who left that life to marry Arliden and travel with the Ruh. She was a rare talent: poet, performer, and fiercely intelligent. She died in the Chandrian massacre along with her husband.',
  [C.ABENTHY]:  'Called Ben by the troupe — a former University-trained arcanist who gave up academic life to wander. He joined Arliden\'s troupe for a time and became Kvothe\'s first real teacher, introducing him to sympathy, the Alar, and the fundamentals of naming. His departure left Kvothe without formal guidance at a crucial age.',
  [C.DENNA]:    'A beautiful, elusive young woman who keeps few fixed relationships and no fixed address. Denna\'s past is obscure and her present is full of contradictions — she has a secret patron known only as Master Ash who funds her studies, and her path seems to cross the Chandrian\'s as often as Kvothe\'s does. She and Kvothe are drawn to each other but always slightly out of step.',
  [C.SIMMON]:   'A cheerful, warm-hearted student at the University from a noble Aturan family. Simmon is a talented poet and one of Kvothe\'s most loyal friends. He is perceptive about people despite an often breezy manner, and his steady companionship helps Kvothe stay sane through the pressures of University life.',
  [C.WILEM]:    'A Cealdish student at the University, reserved and fiercely logical. Wilem comes from a modest background and has little patience for pretension. He is one of Kvothe\'s earliest and most dependable friends — honest to a fault, unimpressed by reputation, and quietly brave.',
  [C.AMBROSE]:  'Ambrose Jakis — arrogant, wealthy, and well-connected. The son of a powerful Aturan baron, Ambrose is used to getting what he wants, and he takes an immediate and lasting dislike to Kvothe. Their rivalry is one of the defining conflicts of Kvothe\'s time at the University, escalating from petty antagonism to genuine danger.',
  [C.CINDER]:   'One of the Chandrian — a creature of myth made terrifyingly real. He appears as a man with white hair and black eyes that shift like winter storms. It was Cinder who taunted young Kvothe at the massacre site. Kvothe burns with hatred and grief at the sound of his name.',
  [C.HALIAX]:   'The leader of the Chandrian, formerly known as Lanre — a once-legendary hero who was broken by grief and became something monstrous. Haliax commands the group and seems to be bound by ancient restraints that even his power cannot fully break. His true nature and motivations are wrapped in layer upon layer of distorted legend.',
  [C.DEVI]:     'A former student expelled from the University who now operates as a gaelet — a money-lender — in Imre. Devi is brilliant, dangerous, and meticulous. She charges reasonable interest on loans but takes blood as collateral, giving her a powerful hold over her debtors. She has a complicated, almost respectful relationship with Kvothe.',
  [C.ELODIN]:   'Master Namer and Re\'lar instructor at the University — and quite possibly the most powerful arcanist alive. Elodin is unpredictable, enigmatic, and seemingly unhinged, but every apparent eccentricity conceals a deeper method. He spent time in the Rookery (the University\'s asylum) and emerged unchanged — or perhaps more himself than before. He reluctantly takes Kvothe as a student.',
  [C.HEMME]:    'Master Hemme — a University instructor who teaches basic sympathy. He is petty, politically astute, and quick to punish students who embarrass him. His hostility toward Kvothe begins at their first meeting and never abates. He is the main force behind bringing Kvothe "On the Horns" before the masters.',
  [C.KILVIN]:   'Master Kilvin — a powerfully built Cealdish man who runs the Artificery (the Fishery). He speaks in vivid, occasionally mangled Aturan and has a genuine, generous respect for exceptional craftsmanship. He is one of the few masters who is straightforwardly kind to Kvothe, valuing skill over politics.',
};

let charsUpdated = 0;
d.characters.forEach(c => {
  if (charDescriptions[c.id] && c.description !== charDescriptions[c.id]) {
    c.description = charDescriptions[c.id];
    charsUpdated++;
  }
});
console.log('Characters described:', charsUpdated);

// ── Fill in relationship labels and types ──
const relUpdates = {
  [RELS.KVOTHE_BAST]:    { label: 'Master & Student', type: 'student-teacher' },
  [RELS.KVOTHE_DENNA]:   { label: 'Complicated Love', type: 'love-interest' },
  [RELS.KVOTHE_AMBROSE]: { label: 'Bitter Rivals', type: 'rivals' },
  [RELS.KVOTHE_SIMMON]:  { label: 'Close Friends', type: 'friendship' },
  [RELS.KVOTHE_WILEM]:   { label: 'Close Friends', type: 'friendship' },
  [RELS.KVOTHE_ELODIN]:  { label: 'Master & Student', type: 'student-teacher' },
  [RELS.KVOTHE_KILVIN]:  { label: 'Mentor & Apprentice', type: 'mentor' },
  [RELS.KVOTHE_DEVI]:    { label: 'Debtor & Lender', type: 'business' },
  [RELS.KVOTHE_HEMME]:   { label: 'Student & Antagonist', type: 'rivals' },
};
let relsUpdated = 0;
d.relationships.forEach(r => {
  if (relUpdates[r.id]) {
    Object.assign(r, relUpdates[r.id]);
    relsUpdated++;
  }
});
console.log('Relationships updated:', relsUpdated);

// ══════════════════════════════════════════════
// 2. NEW RELATIONSHIPS
// ══════════════════════════════════════════════
const existingRelPairs = new Set(d.relationships.map(r => r.characterAId + '|' + r.characterBId));
function addRel(id, aId, bId, label, type, strength, sentiment, startEventN) {
  const key = aId + '|' + bId;
  if (existingRelPairs.has(key)) return null;
  existingRelPairs.add(key);
  return { id, worldId: W, characterAId: aId, characterBId: bId,
    label, type, strength, sentiment,
    startEventId: E(startEventN), createdAt: ts, updatedAt: ts };
}

const newRels = [
  addRel(randomUUID(), C.KVOTHE, C.ARLIDEN, 'Father & Son', 'family', 'bond', 'positive', 7),
  addRel(randomUUID(), C.KVOTHE, C.LAURIAN, 'Mother & Son', 'family', 'bond', 'positive', 7),
  addRel(randomUUID(), C.KVOTHE, C.ABENTHY, 'First Teacher', 'mentor', 'strong', 'positive', 8),
  addRel(randomUUID(), C.KVOTHE, C.CHRON,   'Narrator & Subject', 'professional', 'moderate', 'complex', 5),
  addRel(randomUUID(), C.KVOTHE, C.CINDER,  'Hunter & Prey', 'nemesis', 'strong', 'negative', 16),
  addRel(randomUUID(), C.KVOTHE, C.HALIAX,  'Obsession / Terror', 'nemesis', 'strong', 'negative', 16),
  addRel(randomUUID(), C.SIMMON, C.WILEM,   'Best Friends', 'friendship', 'bond', 'positive', 31),
].filter(Boolean);

const REL_KVOTHE_ARLIDEN  = newRels[0]?.id;
const REL_KVOTHE_LAURIAN  = newRels[1]?.id;
const REL_KVOTHE_ABENTHY  = newRels[2]?.id;
const REL_KVOTHE_CHRON    = newRels[3]?.id;
const REL_KVOTHE_CINDER   = newRels[4]?.id;
const REL_KVOTHE_HALIAX   = newRels[5]?.id;
const REL_SIMMON_WILEM    = newRels[6]?.id;

d.relationships.push(...newRels);
console.log('New relationships added:', newRels.length);

// ══════════════════════════════════════════════
// 3. RELATIONSHIP SNAPSHOTS
// ══════════════════════════════════════════════
const existingRelSnaps = new Set(d.relationshipSnapshots.map(s => s.relationshipId + '|' + s.eventId));
function relSnap(relId, eventN, sentiment, strength, label, description) {
  if (!relId) return null;
  const eventId = E(eventN);
  const key = relId + '|' + eventId;
  if (existingRelSnaps.has(key)) return null;
  existingRelSnaps.add(key);
  return { id: randomUUID(), worldId: W, relationshipId: relId, eventId,
    isActive: true, sentiment, strength, label, description,
    sortKey: null, createdAt: ts, updatedAt: ts };
}

const newRelSnaps = [
  // Kvothe ↔ Arliden
  relSnap(REL_KVOTHE_ARLIDEN, 7,  'positive', 'bond',     'Father & Son',          'Kvothe idolises his father — a gifted musician and storyteller who shapes everything about how Kvothe sees the world.'),
  relSnap(REL_KVOTHE_ARLIDEN, 15, 'positive', 'bond',     'Father & Son',          'The troupe is close-knit. Kvothe and Arliden share musical evenings and long conversations on the road.'),
  relSnap(REL_KVOTHE_ARLIDEN, 16, 'positive', 'bond',     'Father & Son (Grief)',  'Arliden is dead. Kvothe is left with a hollow, shattering grief and a burning need to understand why.'),

  // Kvothe ↔ Laurian
  relSnap(REL_KVOTHE_LAURIAN, 7,  'positive', 'bond',     'Mother & Son',          'Laurian is warm, sharp-tongued, and deeply loving — she teaches Kvothe the value of words and memory.'),
  relSnap(REL_KVOTHE_LAURIAN, 16, 'positive', 'bond',     'Mother & Son (Grief)',  'Laurian is dead. Her loss is as devastating as Arliden\'s — the family that made Kvothe whole is gone.'),

  // Kvothe ↔ Abenthy
  relSnap(REL_KVOTHE_ABENTHY, 8,  'positive', 'moderate', 'Curious Student',       'Kvothe pesters Ben with questions about sympathy, astonishing him with how quickly he grasps the fundamentals.'),
  relSnap(REL_KVOTHE_ABENTHY, 9,  'positive', 'strong',   'Eager Apprentice',      'Ben formally teaches Kvothe sympathy, recognising his exceptional ability and taking genuine delight in it.'),
  relSnap(REL_KVOTHE_ABENTHY, 14, 'positive', 'strong',   'Teacher & Prodigy',     'Ben has pushed Kvothe further than any student he has known. Their bond has deepened into true friendship.'),
  relSnap(REL_KVOTHE_ABENTHY, 15, 'positive', 'strong',   'Parting Ways',          'Ben departs from the troupe. Kvothe is sad but grateful — the foundation Ben laid will shape everything that follows.'),

  // Kvothe ↔ Bast
  relSnap(RELS.KVOTHE_BAST, 0,  'complex', 'bond',     'Master & Student',        'Bast serves Kvothe at the Waystone Inn with complete loyalty, though he quietly grieves the diminished man his master has become.'),
  relSnap(RELS.KVOTHE_BAST, 6,  'complex', 'bond',     'Master & Student',        'As Kvothe begins his story, Bast is both audience and custodian — hoping the act of telling will somehow restore his master.'),
  relSnap(RELS.KVOTHE_BAST, 92, 'complex', 'bond',     'Keeper of the Legend',    'One day of the story told. Bast watches over Kvothe with fierce devotion, frustrated by his master\'s resignation.'),

  // Kvothe ↔ Chronicler
  relSnap(REL_KVOTHE_CHRON, 5,  'complex',  'weak',    'Wary Subject',            'Kvothe is reluctant; Chronicler has tracked him down and wants the truth. Kvothe agrees to talk, on his own terms.'),
  relSnap(REL_KVOTHE_CHRON, 6,  'complex',  'moderate','Narrator & Recorder',     'The agreement is struck: three days, three books, the unvarnished truth. Kvothe controls the story; Chronicler writes it.'),
  relSnap(REL_KVOTHE_CHRON, 92, 'positive', 'moderate','Growing Trust',           'The first day\'s account is complete. Chronicler is shaken by the distance between legend and man.'),

  // Kvothe ↔ Denna
  // (event 028 snapshot already exists — add to it)
  relSnap(RELS.KVOTHE_DENNA, 28, 'positive', 'weak',    'First Meeting',          'Kvothe meets Denna on the road and is immediately captivated. She is elusive, curious, and unlike anyone he has known.'),
  relSnap(RELS.KVOTHE_DENNA, 41, 'positive', 'moderate','Growing Infatuation',   'Kvothe sees Denna again at the Eolian in Imre. She cheers for him; the connection deepens, though it remains painfully unspoken.'),
  relSnap(RELS.KVOTHE_DENNA, 42, 'complex',  'moderate','Uncertain Feeling',     'They spend time together in Imre, talking and playing music, but Denna keeps her secrets and Kvothe keeps his pride.'),
  relSnap(RELS.KVOTHE_DENNA, 56, 'complex',  'strong',  'Crisis and Care',       'Kvothe finds Denna drugged near Trebon. His fear for her safety makes plain the depth of his feelings.'),
  relSnap(RELS.KVOTHE_DENNA, 62, 'complex',  'strong',  'Parting Again',         'They recover together but Denna leaves before anything can be resolved. She always slips away.'),
  relSnap(RELS.KVOTHE_DENNA, 69, 'complex',  'strong',  'Repeated Longing',      'Time in Imre with Denna is sweet but unsatisfying — the subject of her patron poisons their ease together.'),
  relSnap(RELS.KVOTHE_DENNA, 84, 'complex',  'strong',  'Growing Strain',        'Kvothe\'s suspicion about Master Ash creates friction. Their connection is as real as ever, and as frustrated.'),

  // Kvothe ↔ Simmon
  relSnap(RELS.KVOTHE_SIMMON, 31, 'positive', 'moderate','New Friend',           'Simmon is one of the first people to welcome Kvothe at the University with genuine warmth.'),
  relSnap(RELS.KVOTHE_SIMMON, 32, 'positive', 'strong',  'True Friendship',      'After initial awkwardness, Simmon and Kvothe fall into a comfortable and loyal friendship over shared meals and conversation.'),
  relSnap(RELS.KVOTHE_SIMMON, 43, 'positive', 'strong',  'Steady Support',       'When Ambrose destroys Kvothe\'s lute, Simmon is there — quietly offering comfort and solidarity.'),
  relSnap(RELS.KVOTHE_SIMMON, 53, 'positive', 'strong',  'Fellow Adventurer',    'Simmon travels to Trebon with Kvothe despite the risk. His loyalty is never in question.'),
  relSnap(RELS.KVOTHE_SIMMON, 64, 'positive', 'strong',  'Enduring Companion',   'Through financial ruin and University politics, Simmon remains Kvothe\'s most uncomplicated ally.'),

  // Kvothe ↔ Wilem
  relSnap(RELS.KVOTHE_WILEM, 31, 'positive', 'moderate','Cautious Respect',      'Wilem is guarded at first, but Kvothe\'s ability earns his genuine respect quickly.'),
  relSnap(RELS.KVOTHE_WILEM, 32, 'positive', 'strong',  'Real Friendship',       'Wilem and Kvothe settle into a friendship built on honesty and mutual regard, without pretense.'),
  relSnap(RELS.KVOTHE_WILEM, 41, 'positive', 'strong',  'Trusted Friend',        'Wilem is a steady presence at the Eolian. He does not flatter Kvothe, and that makes his praise mean more.'),

  // Simmon ↔ Wilem
  relSnap(REL_SIMMON_WILEM, 31, 'positive', 'bond',    'Best Friends',           'Simmon and Wilem have been close friends at the University long before Kvothe arrives.'),
  relSnap(REL_SIMMON_WILEM, 53, 'positive', 'bond',    'Inseparable',            'Where Simmon goes, Wilem tends to follow — and vice versa. Their friendship is one of the most solid things at the University.'),

  // Kvothe ↔ Ambrose
  relSnap(RELS.KVOTHE_AMBROSE, 35, 'negative', 'moderate', 'Instant Dislike',   'Kvothe humiliates Ambrose in front of others in the Archives. Ambrose\'s pride does not forgive insults.'),
  relSnap(RELS.KVOTHE_AMBROSE, 43, 'negative', 'strong',   'Open Hostility',    'Ambrose destroys Kvothe\'s lute — the most personal attack imaginable. The rivalry becomes genuine enmity.'),
  relSnap(RELS.KVOTHE_AMBROSE, 44, 'negative', 'strong',   'Retribution',       'Kvothe retaliates, making Ambrose appear foolish. Neither will back down.'),
  relSnap(RELS.KVOTHE_AMBROSE, 72, 'negative', 'bond',     'Dangerous Enemy',   'Ambrose\'s scheming is no longer just petty — he uses his family\'s influence to put Kvothe at real risk.'),

  // Kvothe ↔ Kilvin
  relSnap(RELS.KVOTHE_KILVIN, 31, 'positive', 'moderate', 'Promising Student',  'Kilvin notices Kvothe\'s potential at admissions. He offers a path in the Fishery almost immediately.'),
  relSnap(RELS.KVOTHE_KILVIN, 37, 'positive', 'strong',   'Respected Craftsman','Kilvin respects Kvothe\'s craftsmanship and ingenuity in the Fishery. The respect is mutual.'),
  relSnap(RELS.KVOTHE_KILVIN, 67, 'positive', 'strong',   'Genuine Esteem',     'Kvothe\'s bravery in the Fishery fire raises his standing with Kilvin enormously.'),

  // Kvothe ↔ Elodin
  relSnap(RELS.KVOTHE_ELODIN, 31, 'complex',  'weak',    'Inscrutable Master',  'Elodin\'s response to Kvothe at admissions is strange and unreadable — as if he\'s testing something else entirely.'),
  relSnap(RELS.KVOTHE_ELODIN, 68, 'positive', 'moderate','Reluctant Teacher',   'Elodin agrees to teach Kvothe Naming after being worn down. He is nothing like any other instructor Kvothe has had.'),
  relSnap(RELS.KVOTHE_ELODIN, 82, 'positive', 'moderate','Strange Progress',    'Elodin\'s teaching is maddening but Kvothe begins to suspect there is a method beneath the apparent chaos.'),

  // Kvothe ↔ Hemme
  relSnap(RELS.KVOTHE_HEMME, 34, 'negative', 'moderate', 'Mutual Contempt',    'Hemme singles Kvothe out in his first sympathy class and Kvothe refuses to be cowed — the hostility is immediate.'),
  relSnap(RELS.KVOTHE_HEMME, 39, 'negative', 'strong',   'Public Humiliation', 'Hemme tries to make an example of Kvothe; Kvothe turns it around on him. Hemme is livid.'),
  relSnap(RELS.KVOTHE_HEMME, 40, 'negative', 'strong',   'Formal Punishment',  'Hemme takes Kvothe before the masters. The proceedings ("On the Horns") nearly end Kvothe\'s University career.'),

  // Kvothe ↔ Devi
  relSnap(RELS.KVOTHE_DEVI, 46, 'complex',  'weak',     'Cautious Transaction','Devi lends Kvothe money with cold professionalism. She takes his blood and makes clear what it means.'),
  relSnap(RELS.KVOTHE_DEVI, 64, 'complex',  'moderate', 'Power Imbalance',     'Devi holds significant power over Kvothe via his blood. Their relationship is a careful dance of mutual wariness.'),
  relSnap(RELS.KVOTHE_DEVI, 76, 'complex',  'moderate', 'Grudging Respect',    'Despite the tension, there is a thread of genuine respect between them — two unusually capable people recognising each other.'),

  // Kvothe ↔ Cinder
  relSnap(REL_KVOTHE_CINDER, 16, 'negative', 'strong',  'The Killer',          'Cinder is the face of everything Kvothe has lost. He taunted the boy over the bodies of his family.'),

  // Kvothe ↔ Haliax
  relSnap(REL_KVOTHE_HALIAX, 16, 'negative', 'strong',  'Fear and Obsession',  'Haliax commanded Cinder to leave Kvothe alive. Whether mercy or cruelty, Kvothe cannot say. He will find the Chandrian.'),
].filter(Boolean);

d.relationshipSnapshots.push(...newRelSnaps);
console.log('Relationship snapshots added:', newRelSnaps.length);

// ══════════════════════════════════════════════
// 4. NEW ITEMS + ITEM DESCRIPTIONS
// ══════════════════════════════════════════════
// Enrich existing item descriptions
d.items.forEach(i => {
  if (i.id === ITEMS.LUTE1) {
    i.name = "Kvothe's Lute";
    i.description = "The lute Kvothe carries from his days with the Edema Ruh troupe. A fine instrument, carefully maintained through years of poverty and hardship. Destroyed by Ambrose Jakis.";
  }
  if (i.id === ITEMS.LUTE2) {
    i.description = "A superior lute Kvothe acquires after his first is destroyed by Ambrose — funded through a loan from Devi. It becomes his primary instrument for his remaining time at the University.";
  }
  if (i.id === ITEMS.BLOODLESS) {
    i.description = "Kvothe's Artificery masterwork — a sympathy lamp so perfectly constructed that it gives light without consuming its wick or fuel. Its creation earns him the title Re'lar and the respect of Master Kilvin.";
  }
  if (i.id === ITEMS.UKEY) {
    i.description = "A key that grants access to the Underthing — the maze of tunnels and forgotten passages beneath the University. Kvothe obtains it through his friendship with the peculiar Puppet.";
  }
});

// New items
const newItemIds = {
  GRAM:         randomUUID(),
  TALENT_PIPES: randomUUID(),
};

const newItems = [
  {
    id: newItemIds.GRAM,
    worldId: W,
    name: "The Gram",
    description: "A small iron disk inscribed with careful sympathy-bindings. Kvothe creates this gram to protect himself against the drain that comes from maintaining his Alar under attack — it acts as a buffer against sympathy used offensively against him.",
    imageId: null, tags: ['magical', 'crafted'], createdAt: ts, updatedAt: ts,
  },
  {
    id: newItemIds.TALENT_PIPES,
    worldId: W,
    name: "Talent Pipes",
    description: "The carved ivory pipes given to musicians who pass the Eolian's performance test — proof of genuine mastery. Kvothe earns his at the Eolian in Imre, playing despite a broken string, leaving the audience speechless.",
    imageId: null, tags: ['musical', 'prestige'], createdAt: ts, updatedAt: ts,
  },
];
d.items.push(...newItems);
console.log('New items added:', newItems.length);

// ══════════════════════════════════════════════
// 5. ITEM SNAPSHOTS (condition tracking)
// ══════════════════════════════════════════════
const existingItemSnaps = new Set(d.itemSnapshots.map(s => s.itemId + '|' + s.eventId));
function itemSnap(itemId, eventN, condition, notes) {
  const eventId = E(eventN);
  const key = itemId + '|' + eventId;
  if (existingItemSnaps.has(key)) return null;
  existingItemSnaps.add(key);
  return { id: randomUUID(), worldId: W, itemId, eventId, condition, notes, sortKey: null, createdAt: ts, updatedAt: ts };
}

const newItemSnaps = [
  itemSnap(ITEMS.LUTE1,     7,  'intact',    'Kvothe\'s lute travels everywhere with the troupe, carefully maintained.'),
  itemSnap(ITEMS.LUTE1,     21, 'worn',      'Survived three years in Tarbean — cracked, neglected, but not beyond repair.'),
  itemSnap(ITEMS.LUTE1,     30, 'intact',    'Restored and in good condition as Kvothe arrives at the University.'),
  itemSnap(ITEMS.LUTE1,     43, 'destroyed', 'Smashed by Ambrose Jakis. Beyond repair.'),
  itemSnap(ITEMS.LUTE2,     47, 'intact',    'Brand new — bought with Devi\'s loan money. Better than the original.'),
  itemSnap(ITEMS.LUTE2,     92, 'intact',    'Still in Kvothe\'s possession at the close of Day One.'),
  itemSnap(ITEMS.BLOODLESS, 47, 'intact',    'Newly completed masterwork. Kilvin praises it as the finest Re\'lar project in years.'),
  itemSnap(ITEMS.UKEY,      49, 'intact',    'Newly acquired — gives Kvothe access to the hidden underground passages of the University.'),
  itemSnap(newItemIds.GRAM, 71, 'intact',    'Freshly made. Kvothe tests it against sympathy attacks and it performs perfectly.'),
  itemSnap(newItemIds.TALENT_PIPES, 41, 'intact', 'Awarded at the Eolian after Kvothe\'s unforgettable performance.'),
].filter(Boolean);

d.itemSnapshots.push(...newItemSnaps);
console.log('Item snapshots added:', newItemSnaps.length);

// ══════════════════════════════════════════════
// 6. CHARACTER INVENTORY TRACKING (via snapshots)
// ══════════════════════════════════════════════
// Map eventN → characterId → items to ADD to inventoryItemIds
const inventoryAdditions = {
  7:  { [C.KVOTHE]: [ITEMS.LUTE1] },
  41: { [C.KVOTHE]: [newItemIds.TALENT_PIPES] },
  47: { [C.KVOTHE]: [ITEMS.LUTE2, ITEMS.BLOODLESS] },
  49: { [C.KVOTHE]: [ITEMS.UKEY] },
  71: { [C.KVOTHE]: [newItemIds.GRAM] },
};
// Event where lute1 is removed
const inventoryRemovals = {
  43: { [C.KVOTHE]: [ITEMS.LUTE1] },
};

let inventoryUpdates = 0;
d.characterSnapshots.forEach(s => {
  const n = parseInt(s.eventId.slice(-12));
  const adds = inventoryAdditions[n]?.[s.characterId];
  const removals = inventoryRemovals[n]?.[s.characterId];
  if (adds) {
    s.inventoryItemIds = [...new Set([...s.inventoryItemIds, ...adds])];
    inventoryUpdates++;
  }
  if (removals) {
    s.inventoryItemIds = s.inventoryItemIds.filter(id => !removals.includes(id));
    inventoryUpdates++;
  }
});
console.log('Inventory updates applied:', inventoryUpdates);

// ══════════════════════════════════════════════
// 7. ENRICH EVENT DESCRIPTIONS
// ══════════════════════════════════════════════
const eventDescriptions = {
  0:  'The Waystone Inn breathes with a deep, patient silence — the kind that fills a place when its owner has stopped fighting it. Kote polishes the bar and waits.',
  1:  'A scrael — one of the black, crab-like creatures spreading fear across the countryside — is found near the inn. Kote and Bast deal with it quickly, efficiently, and without the flair of a legend.',
  2:  'An ordinary day at the Waystone. Kote serves cider, listens to the locals worry about the roads, and pretends he has nothing more pressing on his mind.',
  3:  'Jake Carter, the smith\'s prentice, arrives injured after a scrael attack. The gathering of frightened locals marks the creeping wrongness of the world outside the inn.',
  4:  'Chronicler — the famous scribe Devan Lochees — arrives half-dead on the road. Kote brings him in, and Bast\'s eyes sharpen with calculation.',
  5:  'Chronicler makes his pitch: he wants to record the true story of Kvothe\'s life. Kvothe deflects, deflects, and then — unexpectedly — agrees.',
  6:  'Terms are struck. Three days. Three books. The truth. Kvothe pours two drinks and begins: "I was a happy child."',
  7:  'Kvothe describes his early life with the Edema Ruh — the fire and the road, music and stories, the shape of a childhood spent entirely in motion.',
  8:  'Abenthy joins the troupe — a barrel-chested, oddly cheerful ex-arcanist. Young Kvothe is fascinated by the sympathy demonstration Ben gives, and pesters him mercilessly until Ben agrees to teach him.',
  9:  'Ben begins teaching Kvothe sympathy in earnest. The Alar — the mental split needed for binding — comes to Kvothe with startling ease. Ben is quietly alarmed by how fast his student learns.',
  10: 'Kvothe masters the Alar: the ability to hold two opposing thoughts simultaneously without either weakening. Ben sets him harder and harder drills, and Kvothe clears them all.',
  11: 'Kvothe binds iron — his first real sympathy working. The heat flows from one piece of metal to another and he feels the sting of it in his own skin. He grins through the pain.',
  12: 'Kvothe digs through Ben\'s books, hungry for any scrap of information about the Chandrian. Ben answers his questions carefully, unwilling to encourage the obsession.',
  13: 'At the inn, Bast sets down his notes and stretches. Kvothe pauses his telling, refills the drinks, and both men rest in the quiet.',
  14: 'Ben teaches Kvothe to call the wind by name — just for a moment, just a breath. It is the first time Kvothe touches something older and stranger than sympathy. Ben is shaken afterward.',
  15: 'Ben decides to leave — he has found a woman and a town to settle in. The farewell is warm and sad. He tells Kvothe: go to the University, study hard, and stay away from the Chandrian.',
  16: 'Kvothe returns from gathering wood to find his entire troupe slaughtered. His parents lie among the dead. The fire still burns. He catches a glimpse of pale-haired Cinder before darkness takes him.',
  17: 'Back in the inn. Kvothe\'s voice is flat as he describes what he saw. The fire. The bodies. The silence that came after. Chronicler writes without comment.',
  18: 'Kvothe wanders the roads for weeks, barely eating, barely thinking. The troupe\'s routes mean nothing to him now. He moves because stopping feels like dying.',
  19: 'Playing his lute by a roadside, Kvothe\'s fingers bleed from hours of playing. The music is the only thing that still makes sense. A merchant offers him a ride to Tarbean.',
  20: 'The city swallows Kvothe whole. He is twelve, alone, and has nothing. Tarbean is massive, indifferent, and dangerous. He finds a ruin to sleep in and begins the long work of surviving.',
  21: 'Three years pass. Kvothe lives in the Tarbean slums — Waterside and the Dockside warren. He begs, steals, and slowly hollows out. He calls himself Kote and forgets, most days, who he used to be.',
  22: 'Midwinter in Tarbean. Kvothe is arrested during a festival and thrown into a holding pen. The cold and the hunger are familiar; the humiliation is worse.',
  23: 'Kvothe hears the storyteller Skarpi hold a crowd at a tavern — not with tricks, but with a history of Lanre that makes the old stories feel like lies. Kvothe listens until dawn.',
  24: 'Something shifts. Kvothe starts remembering who he is. He retrieves his lute from where he hid it, mends it badly, and begins practising again. The city is no longer a trap — it is a place he is leaving.',
  25: 'On the road out of Tarbean, Kvothe defends a small Edema Ruh family from a group of soldiers who have no right to harass them. The old reflexes are back.',
  26: 'Skarpi is arrested by a church official for what he told the crowd about Lanre. The official — calm, pitiless — seems to know exactly what Skarpi was doing and why it is forbidden.',
  27: 'Kvothe prepares himself — mentally, practically. He rehearses what he knows of sympathy. He works out what he will need to say to impress the masters. He plans.',
  28: 'On the road near Anilin, Kvothe meets a young woman travelling alone — Denna. They share a fire and conversation and she is unlike anyone he has met. She leaves before morning.',
  29: 'Kvothe continues along the Great Stone Road toward the University, unable to stop thinking about the girl on the road. He is equal parts excited and terrified about what lies ahead.',
  30: 'Kvothe arrives at the University and immediately feels underprepared and underdressed. The campus is larger than he imagined. Everything is more complicated. He tries not to show it.',
  31: 'The masters assess Kvothe in admissions — Elodin\'s questions are bewildering, Hemme\'s are hostile, Kilvin\'s are delighted. They set his tuition at three talents. He barely has that.',
  32: 'Kvothe adjusts to University life — the schedule, the titles, the strange social rules. Simmon and Wilem become his first real friends.',
  33: 'Kvothe visits the Archives for the first time and is dazzled. So much knowledge. He immediately begins looking for anything about the Chandrian.',
  34: 'Kvothe attends Hemme\'s sympathy class and manages — just barely — not to get himself expelled in the first session.',
  35: 'Kvothe encounters Ambrose Jakis in the Archives and the dislike is mutual, instant, and complete. Ambrose is used to winning these encounters. Kvothe is not interested in losing.',
  36: 'Kvothe\'s bluntness and curiosity earn him a ban from the Archives. The loss is devastating — it was the one place he felt at home at the University.',
  37: 'Kvothe begins working in the Fishery under Kilvin, crafting sympathy devices. He is good at it immediately. The money helps. Kilvin\'s approval means more than he expected.',
  38: 'Kvothe advances rapidly in his sympathy studies — his knowledge and his Alar are both far ahead of his year. He is simultaneously admired and resented.',
  39: 'Hemme attempts to make an example of Kvothe in class by demonstrating how sympathy can cause pain. Kvothe redirects it back onto Hemme, in front of the entire group.',
  40: 'Kvothe is brought before the masters — "On the Horns" — on Hemme\'s complaint. Master Lorren and Master Kilvin speak in his favour. He is suspended for one term instead of expelled.',
  41: 'Kvothe plays at the Eolian and earns his talent pipes despite a string breaking mid-performance. It is one of the finest things he has ever done.',
  42: 'Kvothe and Denna spend time in Imre — talking, playing, circling around what neither of them will say. She mentions her patron but says nothing useful about him.',
  43: 'Ambrose has Kvothe\'s lute destroyed — smashed beyond repair. It was his father\'s. It survived Tarbean. The loss tears something open in Kvothe that he had mostly managed to keep closed.',
  44: 'Kvothe engineers a careful, legally deniable revenge on Ambrose involving a bone-tar fire and considerable embarrassment. It is not enough. It never will be.',
  45: 'An interlude. Bast pours more drinks. Kvothe stretches his hand — the one that shakes sometimes — and does not mention it.',
  46: 'Kvothe goes to Devi in Imre and secures a loan at reasonable interest. The collateral is a phial of his blood. Both of them know what that means.',
  47: 'Kvothe creates the Bloodless — his Fishery masterwork — and earns the rank of Re\'lar. He also uses some of the loan money to buy a new, finer lute.',
  48: 'A term of ordinary University life: classes, sympathy practice, work in the Fishery, evenings at Anker\'s with Sim and Wil.',
  49: 'Kvothe discovers the Underthing — a labyrinth of tunnels and forgotten passages beneath the University. He obtains a key from Puppet.',
  50: 'Kvothe follows the Underthing deeper and meets Puppet — an odd, otherworldly figure who tends a room full of Aturan artifacts and speaks in riddles. Elodin\'s name comes up.',
  51: 'Kvothe rides past the part of Tarbean he once knew. He watches it from a distance and does not stop.',
  52: 'A letter brings news: strange, violent deaths near Trebon, with signs of the Chandrian. Kvothe cannot sit still.',
  53: 'Kvothe and Simmon make the journey to Trebon — fast travel and nervous energy. Kvothe is thinking about Cinder. He doesn\'t say so.',
  54: 'A farmstead near Trebon has been destroyed — the family killed, the signs unmistakable. Kvothe finds painted figures and a name scratched into the wood. His hands are steady. His stomach is not.',
  55: 'In the wreckage of a travelling troupe, Kvothe finds Denna — alive, barely, in the ruins. She has been drugged with Denner resin.',
  56: 'Kvothe pieces together what happened: a draccus has been drawn to the area and is eating Denner resin from the hidden drug operation. The Chandrian were here first. Now there is a very large, very drugged lizard to deal with.',
  57: 'Kvothe tracks the draccus toward Trebon — a creature the size of a barn, moving with the terrifying certainty of something that has never had a predator.',
  58: 'Denna regains consciousness. She has been drugged for days. She does not remember much. She is furious about it, and frightened.',
  59: 'Kvothe leads the draccus away from Trebon using fire and sympathy — a desperate improvisation that burns through his body heat and leaves him shaking.',
  60: 'The draccus attacks the village anyway. Kvothe has to get ahead of it, stay ahead of it, and keep improvising.',
  61: 'Kvothe kills the draccus by using sympathy to detonate a bell tower onto its head. The explosion leaves him half-dead on the ground. He considers this a victory.',
  62: 'Kvothe recovers — slowly. Denna has vanished again by the time he can walk. He is given forty talents by the grateful mayor and feels hollow anyway.',
  63: 'Kvothe returns to Imre, exhausted and filthy and richer than he has ever been. None of it feels like enough.',
  64: 'The forty talents do not last. Tuition, Devi\'s interest, new strings, food. University life has a way of consuming money absolutely.',
  65: 'A new term. Kvothe studies, works, schemes for coin, and tries to get back into the Archives via any legal means available.',
  66: 'A fire breaks out in the Fishery. Kvothe pulls Fela out of the burning room before she dies. He is badly burned. Kilvin\'s praise afterward embarrasses him.',
  67: 'Fela thanks Kvothe. The University community notices. Ambrose is irritated. Kvothe is just glad his hands still work.',
  68: 'Kvothe corners Elodin — again — and this time Elodin actually agrees to teach him. He sets Kvothe an assignment that makes no obvious sense.',
  69: 'Kvothe and Denna spend a long afternoon in Imre — music and talk and the frustrating closeness that never quite becomes anything else.',
  70: 'Kvothe works on his sympathy. His Alar is now strong enough that maintaining multiple simultaneous bindings barely costs him effort.',
  71: 'Kvothe creates the gram — a small iron disk inscribed with protective sympathy bindings — in the Fishery. Kilvin watches with interest. It works.',
  72: 'Ambrose is plotting something more serious than embarrassment. He uses his family\'s connections. Kvothe starts watching his back.',
  73: 'Tuition time again. Kvothe scrapes together the money through a combination of Fishery work, busking, and careful pride-management.',
  74: 'Rumours spread around the University about Kvothe\'s various exploits. Some are accurate. Most are not. All of them are more flattering than he deserves.',
  75: 'Another pause at the inn. Bast refills the fire. Kvothe\'s hands wrap around his cup like they are holding something in.',
  76: 'Back to Devi\'s. More negotiations. Kvothe has never been entirely comfortable here — she is too sharp, and he knows she knows it.',
  77: 'Kvothe pulls off something clever against one of Ambrose\'s schemes. He is pleased with himself for exactly as long as it takes Ambrose to think of the next move.',
  78: 'Denna is being taught by a patron called Master Ash who, Kvothe increasingly suspects, is not just eccentric but dangerous. He cannot prove it. She does not want his suspicions.',
  79: 'Kvothe searches the Archives — legally this time, with grudging permission — for anything about the Amyr, the Chandrian, or the ancient wars. He finds fragments. Only fragments.',
  80: 'An ordinary day. Lectures, Fishery work, an evening with Sim and Wil. Kvothe almost forgets, for a few hours, that he is supposed to be looking for something.',
  81: 'Kvothe is reprimanded for arrogance during a practical session. He deserved it. He argues back anyway.',
  82: 'Elodin\'s Naming lessons continue. Today he tells Kvothe to go listen to the wind for three hours. Kvothe does it. Something at the edge of his mind shifts.',
  83: 'Kvothe considers the future: the University, the Chandrian, Denna, the name of the wind. They circle each other in his mind without resolving.',
  84: 'An argument in Imre with Denna about Master Ash becomes something uglier than either of them wanted. She leaves. He stays. Neither of them said the right thing.',
  85: 'Chronicler puts down his stylus. Kvothe is quiet for a moment — longer than usual. Bast does not look at either of them.',
  86: 'Riding back to the University in a thunderstorm, something opens in Kvothe. He calls the name of the wind — properly, completely — and the storm responds. He does not fully understand what he has done. He knows it was real.',
  87: 'Back at the University, Kvothe sits with it. To know the name of a thing is to see it differently forever. He is still working out what that means.',
  88: 'Evening at the inn. Kvothe asks Chronicler if he is still writing. Chronicler looks at his hands. Yes. Still writing.',
  89: 'Back in the story, near its end for the day. Kvothe ties up the last threads of this particular telling and looks out the window.',
  90: 'The candles are burning low. Kvothe wraps the last parts of the day\'s account with the care of a man who has been doing this all his life.',
  91: 'The first day of telling ends. Three books worth of story. Three days total. Kvothe goes quiet and pours one last drink.',
  92: 'A silence of three parts fills the inn again. Kvothe sets down his cup. Outside, the road is empty. Tomorrow there will be more.',
  93: 'The same silence as the prologue — but different. Heavier. Something has shifted in the inn, in Kvothe, perhaps in the world.',
};

let eventsEnriched = 0;
d.events.forEach(ev => {
  const n = parseInt(ev.id.slice(-12));
  if (eventDescriptions[n]) {
    ev.description = eventDescriptions[n];
    eventsEnriched++;
  }
});
console.log('Events enriched:', eventsEnriched);

// ══════════════════════════════════════════════
// 8. ENRICH CHAPTER SYNOPSES
// ══════════════════════════════════════════════
const chapterSynopses = {
  '60000000-0000-4000-a000-000000000000': 'A detailed, layered description of the three silences that fill the Waystone Inn — the silence of a man who has given up, set against the ordinary sounds of an inn at rest.',
  '60000000-0000-4000-a000-000000000001': 'Scraels are found near Newarre. Old Cob\'s stories run to demons; Kote and Bast deal with the creature practically. The locals are frightened of the spreading darkness on the roads.',
  '60000000-0000-4000-a000-000000000002': 'A quiet day at the inn. Kote is performing the role of innkeeper with the exhausting thoroughness of someone who has rehearsed it until the performance becomes indistinguishable from the person.',
  '60000000-0000-4000-a000-000000000003': 'Jake Carter is found injured by a scrael. The locals gather; the talk is of safety, the roads, and the strangeness creeping into familiar things.',
  '60000000-0000-4000-a000-000000000004': 'Chronicler arrives and is saved from a scrael attack. Kote tends his wounds. Bast recognises who Chronicler is before Kote does, and something shifts in the inn\'s equilibrium.',
  '60000000-0000-4000-a000-000000000005': 'Chronicler reveals his purpose: he wants to record Kvothe\'s life in full. Kvothe deflects, offers the comfortable legend, and is finally worn down into agreeing to the truth.',
  '60000000-0000-4000-a000-000000000006': 'Kvothe sets his terms and begins. The first words of the real story.',
  '60000000-0000-4000-a000-000000000007': 'The life of the Edema Ruh: roads and fire, music and story, the close world of the troupe. Kvothe at seven, ten, twelve — happy and ignorant and full of questions.',
  '60000000-0000-4000-a000-000000000008': 'Ben joins the troupe and Kvothe immediately begins to study him. The first sympathy demonstration. The beginning of a real education.',
  '60000000-0000-4000-a000-000000000009': 'Ben teaches Kvothe formally. The Alar. The disciplines. The costs. Kvothe\'s aptitude is extraordinary and Ben is not sure whether to be proud or worried.',
  '60000000-0000-4000-a000-000000000010': 'Kvothe works on the split-mind technique until it becomes effortless — or near enough. Ben tests him with coins and candles and progressively stranger tasks.',
  '60000000-0000-4000-a000-000000000011': 'The first real binding — heat drawn from one thing and sent to another. Kvothe feels the sympathist\'s price: what you take has to come from somewhere. He grins.',
  '60000000-0000-4000-a000-000000000012': 'Kvothe\'s research into the Chandrian from Ben\'s books. Ben is careful about what he confirms and what he leaves unsaid.',
  '60000000-0000-4000-a000-000000000013': 'The first frame narrative pause. Kvothe and Chronicler and Bast rest in the inn. The story breathes.',
  '60000000-0000-4000-a000-000000000014': 'Ben teaches Kvothe to call the wind by name — not sympathy, something older. The lesson frightens Ben more than it frightens his student.',
  '60000000-0000-4000-a000-000000000015': 'Ben leaves the troupe. Fond farewells, practical advice, a shadow of foreboding. He urges Kvothe toward the University and away from the Chandrian.',
  '60000000-0000-4000-a000-000000000016': 'Kvothe returns to the camp to find everyone dead. The fire, the bodies, the terrible stillness. His parents are among them. He catches one glimpse of Cinder before shock takes him.',
  '60000000-0000-4000-a000-000000000017': 'Frame pause. Kvothe\'s voice is flat. He is not performing grief; he is simply reporting what was there.',
  '60000000-0000-4000-a000-000000000018': 'Kvothe wanders, lost in shock. Weeks of empty roads and no purpose. The lute is somewhere in his arms but he barely plays.',
  '60000000-0000-4000-a000-000000000019': 'Music finds him again — or he finds it. Playing for hours until his fingers bleed, then more. A stranger offers him a ride to Tarbean.',
  '60000000-0000-4000-a000-000000000020': 'Tarbean: vast, indifferent, brutal. Kvothe arrives a child and immediately understands that this city will not make any accommodation for him.',
  '60000000-0000-4000-a000-000000000021': 'Three years condensed: Kvothe\'s life as a street urchin. Begging, thieving, surviving. Calling himself Kote. The person he used to be feels like a story about someone else.',
  '60000000-0000-4000-a000-000000000022': 'The Midwinter celebration. Cold, crowded, Kvothe in a holding pen. Religion and ceremony glimpsed from the outside.',
  '60000000-0000-4000-a000-000000000023': 'Skarpi the storyteller tells the real history of Lanre in a Tarbean tavern — a history the church does not want told. Kvothe listens all night.',
  '60000000-0000-4000-a000-000000000024': 'Something wakes in Kvothe. He retrieves his lute, patches it badly, and starts playing again. He is going to leave.',
  '60000000-0000-4000-a000-000000000025': 'On the road, Kvothe intervenes when soldiers harass a Ruh family. The old instincts — and the old anger — are intact.',
  '60000000-0000-4000-a000-000000000026': 'Skarpi is arrested by a church inquisitor. Kvothe watches. The inquisitor is terrifyingly calm.',
  '60000000-0000-4000-a000-000000000027': 'Kvothe prepares himself for the University. He reviews what Ben taught him. He plans.',
  '60000000-0000-4000-a000-000000000028': 'The road to the University and a brief, unforgettable encounter with a girl named Denna.',
  '60000000-0000-4000-a000-000000000029': 'Traveling with Denna for a short stretch. Then the paths diverge. Kvothe continues alone toward the University with Denna still turning over in his thoughts.',
  '60000000-0000-4000-a000-000000000030': 'Arrival at the University. The size of it. The rules. The fact that Kvothe has to pass admissions before any of it matters.',
  '60000000-0000-4000-a000-000000000031': 'Admissions. Kvothe performs beyond expectation — answering questions in three languages, demonstrating sympathy, impressing nearly everyone. His tuition is set at three talents.',
  '60000000-0000-4000-a000-000000000032': 'The first term begins. Kvothe meets Simmon and Wilem and begins learning the rhythms of the University.',
  '60000000-0000-4000-a000-000000000033': 'The Archives. Kvothe falls in love with the idea of a building full of every book ever written and begins looking for information on the Chandrian immediately.',
  '60000000-0000-4000-a000-000000000034': 'Hemme\'s class. Kvothe navigates the hostile instructor while trying not to do anything that would see him expelled in his first term.',
  '60000000-0000-4000-a000-000000000035': 'Ambrose. One conversation and the shape of the rivalry is clear.',
  '60000000-0000-4000-a000-000000000036': 'Kvothe\'s bluntness earns him a ban from the Archives. He is devastated.',
  '60000000-0000-4000-a000-000000000037': 'Work in the Fishery begins. Kilvin is a revelation — a master who values skill over politics.',
  '60000000-0000-4000-a000-000000000038': 'Kvothe advances through his sympathy studies with embarrassing speed.',
  '60000000-0000-4000-a000-000000000039': 'The incident in Hemme\'s class: sympathy as a weapon, turned around.',
  '60000000-0000-4000-a000-000000000040': 'On the Horns before the masters. Kvothe defends himself and receives a suspended sentence.',
  '60000000-0000-4000-a000-000000000041': 'The Eolian. Talent pipes earned.',
  '60000000-0000-4000-a000-000000000042': 'An afternoon in Imre with Denna. Always almost, never quite.',
  '60000000-0000-4000-a000-000000000043': 'Ambrose destroys Kvothe\'s lute. The thing Kvothe carried from the Ruh, through Tarbean, all the way here.',
  '60000000-0000-4000-a000-000000000044': 'Revenge. Careful, plausible-deniable, satisfying, and not enough.',
  '60000000-0000-4000-a000-000000000045': 'Third frame pause. The night is further along. The fire needs feeding.',
  '60000000-0000-4000-a000-000000000046': 'Devi\'s loan. Blood as collateral. Both parties clear-eyed about what this means.',
  '60000000-0000-4000-a000-000000000047': 'The Bloodless completed. Re\'lar title earned. New lute acquired.',
  '60000000-0000-4000-a000-000000000048': 'A term of steady University life — study, work, friendship. The surface of things.',
  '60000000-0000-4000-a000-000000000049': 'The Underthing: hidden passages beneath the University, older than anyone alive remembers.',
  '60000000-0000-4000-a000-000000000050': 'Puppet: strange, unsettling, possibly not entirely human. He guards something and seems to know things he shouldn\'t.',
  '60000000-0000-4000-a000-000000000051': 'A brief return to Tarbean in memory and geography. Kvothe does not stop.',
  '60000000-0000-4000-a000-000000000052': 'Word from Trebon: something terrible happened. Signs of the Chandrian.',
  '60000000-0000-4000-a000-000000000053': 'The road to Trebon with Simmon.',
  '60000000-0000-4000-a000-000000000054': 'Investigation at the destroyed farmstead. Chandrian signs in the wreckage.',
  '60000000-0000-4000-a000-000000000055': 'Denna found in the ruins — alive, but drugged with Denner resin.',
  '60000000-0000-4000-a000-000000000056': 'The draccus: a creature the size of a barn, maddened by Denner resin, heading for Trebon.',
  '60000000-0000-4000-a000-000000000057': 'Tracking the draccus toward the village. The difficulty of stopping something with no natural predators.',
  '60000000-0000-4000-a000-000000000058': 'Denna comes back to herself. The conversation is difficult.',
  '60000000-0000-4000-a000-000000000059': 'Kvothe uses sympathy and fire to lead the draccus away from Trebon. The effort costs him nearly everything he has.',
  '60000000-0000-4000-a000-000000000060': 'The draccus attacks anyway. Kvothe gets ahead of it. Barely.',
  '60000000-0000-4000-a000-000000000061': 'Kvothe destroys the draccus by collapsing the bell tower onto its head. Then lies in the rubble wondering if he is still alive.',
  '60000000-0000-4000-a000-000000000062': 'Recovery. Forty talents from the grateful mayor. Denna already gone.',
  '60000000-0000-4000-a000-000000000063': 'Return to Imre, exhausted.',
  '60000000-0000-4000-a000-000000000064': 'The forty talents vanish into tuition, debt, and living.',
  '60000000-0000-4000-a000-000000000065': 'Second term, continued. Sympathy practice and Archives politics.',
  '60000000-0000-4000-a000-000000000066': 'The Fishery fire. Fela saved.',
  '60000000-0000-4000-a000-000000000067': 'Aftermath of the fire. The University notices Kvothe in a new way.',
  '60000000-0000-4000-a000-000000000068': 'Elodin agrees to teach Naming. On his own terms, in his own way.',
  '60000000-0000-4000-a000-000000000069': 'Denna in Imre. Beautiful and frustrating and gone.',
  '60000000-0000-4000-a000-000000000070': 'Advanced sympathy. Multiple simultaneous bindings holding steady.',
  '60000000-0000-4000-a000-000000000071': 'The gram constructed. A small circle of iron with a big purpose.',
  '60000000-0000-4000-a000-000000000072': 'Ambrose escalates. Family connections deployed.',
  '60000000-0000-4000-a000-000000000073': 'Tuition paid, somehow, again.',
  '60000000-0000-4000-a000-000000000074': 'Kvothe\'s reputation at the University is growing faster than his actual accomplishments.',
  '60000000-0000-4000-a000-000000000075': 'Fourth frame pause. Kvothe pours more drinks.',
  '60000000-0000-4000-a000-000000000076': 'Back to Devi. More blood-debt negotiations.',
  '60000000-0000-4000-a000-000000000077': 'Kvothe outmanoeuvres one of Ambrose\'s schemes — and waits for the next.',
  '60000000-0000-4000-a000-000000000078': 'Master Ash is Denna\'s patron and Kvothe\'s growing suspicion. She will not hear it.',
  '60000000-0000-4000-a000-000000000079': 'Archives research: Amyr, Chandrian, ancient wars. Fragments and silences where knowledge should be.',
  '60000000-0000-4000-a000-000000000080': 'An ordinary day. Good ones are worth mentioning.',
  '60000000-0000-4000-a000-000000000081': 'Kvothe\'s arrogance surfaces in a lesson and he is called on it.',
  '60000000-0000-4000-a000-000000000082': 'Elodin: go listen to the wind. Kvothe does. Something at the edge of his mind stirs.',
  '60000000-0000-4000-a000-000000000083': 'Taking stock. The Chandrian are no closer. Denna is no closer. The University continues.',
  '60000000-0000-4000-a000-000000000084': 'The argument in Imre about Master Ash. Things said that cannot be unsaid.',
  '60000000-0000-4000-a000-000000000085': 'Fifth frame pause. The night has grown very quiet.',
  '60000000-0000-4000-a000-000000000086': 'On the road back in a storm, Kvothe names the wind. He knows the name completely and it answers him.',
  '60000000-0000-4000-a000-000000000087': 'Back at the University. Sitting with what happened on the road. The world feels different.',
  '60000000-0000-4000-a000-000000000088': 'Sixth frame pause. The story is nearing the end of Day One.',
  '60000000-0000-4000-a000-000000000089': 'The final stretch of the first day\'s account.',
  '60000000-0000-4000-a000-000000000090': 'Kvothe gathers the threads together.',
  '60000000-0000-4000-a000-000000000091': 'The last events of the first day told.',
  '60000000-0000-4000-a000-000000000092': 'Day One ends. Three silences settle back over the Waystone Inn.',
  '60000000-0000-4000-a000-000000000093': 'The epilogue silence — same inn, same man, same waiting. But the story has been started, and started things cannot be entirely unstarted.',
};

let chaptersEnriched = 0;
d.chapters.forEach(ch => {
  if (chapterSynopses[ch.id]) {
    ch.synopsis = chapterSynopses[ch.id];
    chaptersEnriched++;
  }
});
console.log('Chapters enriched:', chaptersEnriched);

// ══════════════════════════════════════════════
// WRITE
// ══════════════════════════════════════════════
writeFileSync('f:/Projects/WorldBreaker/example/The Name of the Wind.pwk', JSON.stringify(d, null, 2));
console.log('\nDone.');
console.log('Total relationship snapshots:', d.relationshipSnapshots.length);
console.log('Total item snapshots:', d.itemSnapshots.length);
console.log('Total items:', d.items.length);
console.log('Total relationships:', d.relationships.length);
