import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const d = JSON.parse(readFileSync('f:/Projects/WorldBreaker/example/The Name of the Wind.pwk', 'utf8'));
const W = d.world.id;
const ts = 1713200000000;

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

const E = n => '70000000-0000-4000-a000-' + String(n).padStart(12, '0');

// ── STEP 1: Update event locationMarkerIds ──
const eventLocUpdates = {
  // Frame events → Waystone Inn (Commonwealth)
  0: LOC.COMMONWEALTH, 1: LOC.COMMONWEALTH, 2: LOC.COMMONWEALTH,
  3: LOC.COMMONWEALTH, 4: LOC.COMMONWEALTH, 5: LOC.COMMONWEALTH,
  6: LOC.COMMONWEALTH, 13: LOC.COMMONWEALTH, 17: LOC.COMMONWEALTH,
  45: LOC.COMMONWEALTH, 75: LOC.COMMONWEALTH, 85: LOC.COMMONWEALTH,
  88: LOC.COMMONWEALTH, 92: LOC.COMMONWEALTH, 93: LOC.COMMONWEALTH,
  // Troupe traveling → Commonwealth
  7: LOC.COMMONWEALTH, 8: LOC.COMMONWEALTH, 9: LOC.COMMONWEALTH,
  10: LOC.COMMONWEALTH, 11: LOC.COMMONWEALTH, 12: LOC.COMMONWEALTH,
  14: LOC.COMMONWEALTH, 15: LOC.COMMONWEALTH,
  // Massacre → The Eld
  16: LOC.ELD,
  // Wandering
  18: LOC.COMMONWEALTH, 19: LOC.COMMONWEALTH,
  // Tarbean
  20: LOC.TARBEAN, 21: LOC.TARBEAN, 22: LOC.TARBEAN,
  23: LOC.TARBEAN, 24: LOC.TARBEAN,
  25: LOC.COMMONWEALTH, // defending the Ruh — road outside Tarbean
  26: LOC.TARBEAN,
  27: LOC.TARBEAN,
  // Road to University
  28: LOC.ANILIN,
  29: LOC.STONE_ROAD,
  // Trebon arc
  53: LOC.COMMONWEALTH, 54: LOC.COMMONWEALTH, 55: LOC.COMMONWEALTH,
  56: LOC.COMMONWEALTH, 57: LOC.COMMONWEALTH, 58: LOC.COMMONWEALTH,
  59: LOC.COMMONWEALTH, 60: LOC.COMMONWEALTH, 61: LOC.COMMONWEALTH,
  62: LOC.COMMONWEALTH,
  // Master Ash mystery
  78: LOC.UNIVERSITY,
};

let eventsUpdated = 0;
d.events.forEach(ev => {
  const n = parseInt(ev.id.slice(-12));
  if (eventLocUpdates[n] && !ev.locationMarkerId) {
    ev.locationMarkerId = eventLocUpdates[n];
    eventsUpdated++;
  }
});
console.log('Events location markers updated:', eventsUpdated);

// ── STEP 2: Patch existing snapshots with locationIds ──
const existingLocMap = {
  [C.KVOTHE + '|' + E(21)]:  LOC.TARBEAN,
  [C.KVOTHE + '|' + E(31)]:  LOC.UNIVERSITY,
  [C.KVOTHE + '|' + E(28)]:  LOC.ANILIN,
  [C.DENNA  + '|' + E(28)]:  LOC.ANILIN,
  [C.KVOTHE + '|' + E(16)]:  LOC.ELD,
  [C.ARLIDEN + '|' + E(16)]: LOC.ELD,
  [C.LAURIAN + '|' + E(16)]: LOC.ELD,
  [C.SIMMON + '|' + E(31)]:  LOC.UNIVERSITY,
  [C.WILEM  + '|' + E(31)]:  LOC.UNIVERSITY,
  [C.KVOTHE + '|' + E(56)]:  LOC.COMMONWEALTH,
  [C.DENNA  + '|' + E(56)]:  LOC.COMMONWEALTH,
};

let snapshotsPatched = 0;
d.characterSnapshots.forEach(s => {
  const key = s.characterId + '|' + s.eventId;
  if (existingLocMap[key] && !s.currentLocationMarkerId) {
    s.currentLocationMarkerId = existingLocMap[key];
    snapshotsPatched++;
  }
});
console.log('Existing snapshots patched:', snapshotsPatched);

// ── STEP 3: Add new snapshots ──
const existing = new Set(d.characterSnapshots.map(s => s.characterId + '|' + s.eventId));

function snap(charId, eventN, locId, isAlive, notes) {
  const eventId = E(eventN);
  const key = charId + '|' + eventId;
  if (existing.has(key)) return null;
  existing.add(key);
  return {
    id: randomUUID(),
    worldId: W,
    characterId: charId,
    eventId,
    isAlive,
    currentLocationMarkerId: locId,
    currentMapLayerId: null,
    inventoryItemIds: [],
    inventoryNotes: '',
    travelModeId: null,
    sortKey: null,
    statusNotes: notes,
    createdAt: ts,
    updatedAt: ts,
  };
}

const newSnaps = [];
const add = s => { if (s) newSnaps.push(s); };

// ── KVOTHE ──
add(snap(C.KVOTHE, 0,  LOC.COMMONWEALTH, true, 'Kvothe tends the Waystone Inn under the name Kote, keeping his past hidden.'));
add(snap(C.KVOTHE, 7,  LOC.COMMONWEALTH, true, 'Kvothe travels with his father Arliden\'s Edema Ruh troupe across the Commonwealth.'));
add(snap(C.KVOTHE, 9,  LOC.COMMONWEALTH, true, 'Kvothe studies sympathy under Ben as the troupe travels, showing exceptional aptitude.'));
add(snap(C.KVOTHE, 15, LOC.COMMONWEALTH, true, 'Ben has departed the troupe. Kvothe continues with his parents, without a teacher.'));
add(snap(C.KVOTHE, 18, LOC.COMMONWEALTH, true, 'Kvothe wanders the roads alone after the massacre, nearly catatonic with grief.'));
add(snap(C.KVOTHE, 20, LOC.TARBEAN,      true, 'Kvothe arrives in Tarbean, penniless and traumatized, beginning years on the streets.'));
add(snap(C.KVOTHE, 27, LOC.TARBEAN,      true, 'Kvothe prepares to leave Tarbean, resolved to seek the University.'));
add(snap(C.KVOTHE, 29, LOC.STONE_ROAD,   true, 'Kvothe travels the Great Stone Road toward the University after meeting Denna.'));
add(snap(C.KVOTHE, 30, LOC.UNIVERSITY,   true, 'Kvothe arrives at the University for the first time.'));
add(snap(C.KVOTHE, 41, LOC.IMRE,         true, 'Kvothe crosses to Imre and earns his talent pipes at the Eolian.'));
add(snap(C.KVOTHE, 43, LOC.UNIVERSITY,   true, 'Kvothe\'s lute is destroyed by Ambrose. He is devastated at the University.'));
add(snap(C.KVOTHE, 46, LOC.IMRE,         true, 'Kvothe secures a loan from Devi in Imre, pledging his blood as collateral.'));
add(snap(C.KVOTHE, 47, LOC.UNIVERSITY,   true, 'Kvothe builds the Alar schema and deepens his sympathy training.'));
add(snap(C.KVOTHE, 53, LOC.COMMONWEALTH, true, 'Kvothe and Simmon travel to Trebon following reports of Chandrian activity.'));
add(snap(C.KVOTHE, 54, LOC.COMMONWEALTH, true, 'Kvothe investigates a destroyed farm near Trebon, finding Chandrian signs.'));
add(snap(C.KVOTHE, 62, LOC.COMMONWEALTH, true, 'Kvothe recovers after defeating the draccus near Trebon. Denna has vanished again.'));
add(snap(C.KVOTHE, 63, LOC.IMRE,         true, 'Kvothe returns to Imre, exhausted and near-broke after the Trebon adventure.'));
add(snap(C.KVOTHE, 64, LOC.UNIVERSITY,   true, 'Kvothe faces financial ruin at the University and must find a way to pay tuition.'));
add(snap(C.KVOTHE, 66, LOC.UNIVERSITY,   true, 'Kvothe is injured in the Fishery fire but saves Fela from the blaze.'));
add(snap(C.KVOTHE, 68, LOC.UNIVERSITY,   true, 'Elodin agrees to take Kvothe as a student in Naming.'));
add(snap(C.KVOTHE, 69, LOC.IMRE,         true, 'Kvothe spends time with Denna in Imre; the relationship remains unresolved.'));
add(snap(C.KVOTHE, 70, LOC.UNIVERSITY,   true, 'Kvothe continues his sympathy studies and Fishery work.'));
add(snap(C.KVOTHE, 76, LOC.IMRE,         true, 'Kvothe deals with Devi again regarding his blood debt.'));
add(snap(C.KVOTHE, 77, LOC.UNIVERSITY,   true, 'Kvothe returns to the University, continuing studies and schemes.'));
add(snap(C.KVOTHE, 84, LOC.IMRE,         true, 'Kvothe encounters trouble in Imre, straining his relationships there.'));
add(snap(C.KVOTHE, 86, LOC.IMRE,         true, 'Kvothe names the wind on the road near Imre, demonstrating extraordinary Naming ability.'));
add(snap(C.KVOTHE, 87, LOC.UNIVERSITY,   true, 'Kvothe reflects on the experience of naming the wind, back at the University.'));
add(snap(C.KVOTHE, 92, LOC.COMMONWEALTH, true, 'Kvothe ends the first day of his story at the Waystone Inn.'));

// ── BAST ──
add(snap(C.BAST, 0,  LOC.COMMONWEALTH, true, 'Bast serves Kvothe at the Waystone Inn, watching over his master with fierce devotion.'));
add(snap(C.BAST, 1,  LOC.COMMONWEALTH, true, 'Bast accompanies Kvothe to deal with the scrael found outside the inn.'));
add(snap(C.BAST, 92, LOC.COMMONWEALTH, true, 'Bast remains at the Waystone Inn as Kvothe concludes the first day of his tale.'));

// ── CHRONICLER ──
add(snap(C.CHRON, 4,  LOC.COMMONWEALTH, true, 'Chronicler is found injured on the road; brought to the Waystone Inn by Kvothe and Bast.'));
add(snap(C.CHRON, 5,  LOC.COMMONWEALTH, true, 'Chronicler negotiates with Kvothe to record his full story over three days.'));
add(snap(C.CHRON, 92, LOC.COMMONWEALTH, true, 'Chronicler finishes transcribing the first day of Kvothe\'s tale.'));

// ── ARLIDEN ──
add(snap(C.ARLIDEN, 7, LOC.COMMONWEALTH, true, 'Arliden leads his Edema Ruh troupe, composing a dangerous song about the Chandrian.'));
add(snap(C.ARLIDEN, 8, LOC.COMMONWEALTH, true, 'Arliden welcomes Abenthy (Ben) to travel with the troupe.'));
// event 16 already has a snapshot

// ── LAURIAN ──
add(snap(C.LAURIAN, 7, LOC.COMMONWEALTH, true, 'Laurian travels with Arliden\'s troupe, performing and caring for young Kvothe.'));
add(snap(C.LAURIAN, 8, LOC.COMMONWEALTH, true, 'Laurian is present when Abenthy joins the troupe.'));
// event 16 already has a snapshot

// ── ABENTHY (BEN) ──
add(snap(C.ABENTHY, 8,  LOC.COMMONWEALTH, true, 'Ben joins the Edema Ruh troupe, quickly becoming a mentor and friend to young Kvothe.'));
add(snap(C.ABENTHY, 9,  LOC.COMMONWEALTH, true, 'Ben teaches Kvothe the foundations of sympathy as the troupe travels.'));
add(snap(C.ABENTHY, 14, LOC.COMMONWEALTH, true, 'Ben continues teaching Kvothe advanced sympathy techniques and alar.'));
add(snap(C.ABENTHY, 15, LOC.COMMONWEALTH, true, 'Ben departs the Edema Ruh troupe to settle in a town and open an apothecary shop.'));

// ── DENNA ──
// event 028 already has a snapshot
add(snap(C.DENNA, 29, LOC.STONE_ROAD,   true, 'Denna travels the Great Stone Road separately, heading her own elusive way.'));
add(snap(C.DENNA, 41, LOC.IMRE,         true, 'Denna is at the Eolian in Imre when Kvothe earns his talent pipes.'));
add(snap(C.DENNA, 42, LOC.IMRE,         true, 'Denna and Kvothe spend time together in Imre; she remains elusive about her patron.'));
add(snap(C.DENNA, 53, LOC.COMMONWEALTH, true, 'Denna travels independently near Trebon, drawn toward the same Chandrian activity.'));
// events 055, 056, 058 already have snapshots
add(snap(C.DENNA, 62, LOC.COMMONWEALTH, true, 'Denna recovers near Trebon after being drugged with Denner resin; she and Kvothe part again.'));
add(snap(C.DENNA, 69, LOC.IMRE,         true, 'Denna meets Kvothe in Imre; the meeting is bittersweet and leaves much unresolved.'));
add(snap(C.DENNA, 84, LOC.IMRE,         true, 'Denna is in Imre; her relationship with her patron Master Ash strains her connection with Kvothe.'));

// ── SIMMON ──
// event 031 already has a snapshot
add(snap(C.SIMMON, 32, LOC.UNIVERSITY,   true, 'Simmon helps Kvothe settle in at the University; one of the first genuine friends Kvothe makes.'));
add(snap(C.SIMMON, 41, LOC.IMRE,         true, 'Simmon accompanies Kvothe to the Eolian in Imre for the talent pipes audition.'));
add(snap(C.SIMMON, 43, LOC.UNIVERSITY,   true, 'Simmon is at the University when Ambrose destroys Kvothe\'s lute.'));
add(snap(C.SIMMON, 53, LOC.COMMONWEALTH, true, 'Simmon travels with Kvothe to Trebon to investigate the Chandrian reports.'));
add(snap(C.SIMMON, 62, LOC.COMMONWEALTH, true, 'Simmon recovers alongside Kvothe after the Trebon draccus incident.'));
add(snap(C.SIMMON, 63, LOC.IMRE,         true, 'Simmon returns to Imre with Kvothe after the Trebon adventure.'));
add(snap(C.SIMMON, 64, LOC.UNIVERSITY,   true, 'Simmon is back at the University, supportive of Kvothe through his financial troubles.'));

// ── WILEM ──
// event 031 already has a snapshot
add(snap(C.WILEM, 32, LOC.UNIVERSITY, true, 'Wilem is a steady presence; one of Kvothe\'s first genuine friends at the University.'));
add(snap(C.WILEM, 41, LOC.IMRE,       true, 'Wilem is at the Eolian in Imre when Kvothe earns his talent pipes.'));
add(snap(C.WILEM, 64, LOC.UNIVERSITY, true, 'Wilem remains at the University, continuing his Cealdish studies.'));

// ── AMBROSE JAKIS ──
add(snap(C.AMBROSE, 35, LOC.UNIVERSITY, true, 'Ambrose meets Kvothe in the Archives; the two take an immediate dislike to each other.'));
add(snap(C.AMBROSE, 43, LOC.UNIVERSITY, true, 'Ambrose is responsible for destroying Kvothe\'s lute, escalating their rivalry.'));
add(snap(C.AMBROSE, 44, LOC.UNIVERSITY, true, 'Kvothe retaliates against Ambrose; their enmity deepens into open hostility.'));
add(snap(C.AMBROSE, 72, LOC.UNIVERSITY, true, 'Ambrose continues scheming against Kvothe within the University.'));

// ── CINDER ──
add(snap(C.CINDER, 16, LOC.ELD, true, 'Cinder is one of the Chandrian responsible for massacring Kvothe\'s troupe. His white hair and black eyes mark him.'));

// ── HALIAX ──
add(snap(C.HALIAX, 16, LOC.ELD, true, 'Haliax, the fallen king who leads the Chandrian, is present at the massacre. He commands Cinder to stop tormenting Kvothe.'));

// ── KILVIN ──
add(snap(C.KILVIN, 31, LOC.UNIVERSITY, true, 'Master Kilvin oversees the Fishery at the University and notes Kvothe\'s potential.'));
add(snap(C.KILVIN, 37, LOC.UNIVERSITY, true, 'Kilvin works alongside Kvothe in the Fishery, teaching him crafting.'));
add(snap(C.KILVIN, 67, LOC.UNIVERSITY, true, 'Kilvin is present when Kvothe saves Fela from the Fishery fire, raising Kvothe\'s standing.'));

// ── HEMME ──
add(snap(C.HEMME, 34, LOC.UNIVERSITY, true, 'Master Hemme teaches sympathy at the University and immediately dislikes Kvothe\'s arrogance.'));
add(snap(C.HEMME, 39, LOC.UNIVERSITY, true, 'Hemme humiliates Kvothe in his sympathy class, but Kvothe turns the tables publicly.'));
add(snap(C.HEMME, 40, LOC.UNIVERSITY, true, 'Hemme presses charges against Kvothe before the masters.'));

// ── ELODIN ──
add(snap(C.ELODIN, 31, LOC.UNIVERSITY, true, 'Master Elodin is on the admissions panel and gives Kvothe his first taste of Naming.'));
add(snap(C.ELODIN, 68, LOC.UNIVERSITY, true, 'Elodin agrees to teach Kvothe Naming after much persistence from Kvothe.'));
add(snap(C.ELODIN, 82, LOC.UNIVERSITY, true, 'Elodin continues his unorthodox Naming instruction, pushing Kvothe toward understanding.'));

// ── DEVI ──
add(snap(C.DEVI, 46, LOC.IMRE, true, 'Devi lends Kvothe money in exchange for a blood sample — powerful magical collateral.'));
add(snap(C.DEVI, 64, LOC.IMRE, true, 'Devi holds Kvothe\'s blood debt, giving her significant leverage over him.'));
add(snap(C.DEVI, 76, LOC.IMRE, true, 'Kvothe deals with Devi again, navigating the complicated terms of his blood debt.'));

console.log('New snapshots to add:', newSnaps.length);
d.characterSnapshots.push(...newSnaps);
writeFileSync('f:/Projects/WorldBreaker/example/The Name of the Wind.pwk', JSON.stringify(d, null, 2));
console.log('Done. Total snapshots:', d.characterSnapshots.length);
