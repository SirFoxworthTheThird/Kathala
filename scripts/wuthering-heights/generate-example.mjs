import fs from "node:fs";
import { chapterLedger } from "./chapter-ledger.mjs";
import { eventLedger } from "./event-ledger.mjs";
import { sourceChapters, sourceEdition, sourceUrl } from "./source-text.mjs";

const W = "wuthering-heights-world";
const now = 1789322400000;
const rec = (value) => ({
  worldId: W,
  createdAt: now,
  updatedAt: now,
  ...value,
});
const id = (kind, value) => `wuthering-heights-${kind}-${value}`;
const image = (name) => id("image", name);
const loc = (name) => id("loc", name);
const char = (name) => id("char", name);
const event = (number) => id("event", String(number).padStart(3, "0"));
const chapter = (number) => id("chapter", String(number).padStart(2, "0"));
const timelineId = id("timeline", "main");

const characterDefs = [
  [
    "lockwood",
    "Mr Lockwood",
    "The reserved tenant of Thrushcross Grange whose curiosity opens and closes the nested family history.",
  ],
  [
    "heathcliff",
    "Heathcliff",
    "The Liverpool foundling whose fierce attachment to Catherine and long revenge bind both houses.",
  ],
  [
    "nelly",
    "Ellen ‘Nelly’ Dean",
    "The practical housekeeper, participant, and principal narrator of the Earnshaw and Linton history.",
  ],
  [
    "catherine",
    "Catherine Earnshaw",
    "The wild, proud Earnshaw daughter whose bond with Heathcliff conflicts with her social ambition.",
  ],
  [
    "edgar",
    "Edgar Linton",
    "The courteous heir of Thrushcross Grange and Catherine’s husband.",
  ],
  [
    "isabella",
    "Isabella Linton",
    "Edgar’s sheltered sister, whose infatuation with Heathcliff becomes a disastrous marriage.",
  ],
  [
    "hindley",
    "Hindley Earnshaw",
    "Catherine’s brother, whose resentment of Heathcliff deepens after he inherits the Heights.",
  ],
  [
    "frances",
    "Frances Earnshaw",
    "Hindley’s delicate wife and Hareton’s mother.",
  ],
  [
    "hareton",
    "Hareton Earnshaw",
    "Hindley’s son, dispossessed and deliberately denied education but capable of loyalty and growth.",
  ],
  [
    "cathy",
    "Catherine ‘Cathy’ Linton",
    "The spirited daughter of Catherine and Edgar, raised in seclusion at the Grange.",
  ],
  [
    "linton",
    "Linton Heathcliff",
    "The frail son of Heathcliff and Isabella, used as an instrument in his father’s designs.",
  ],
  [
    "joseph",
    "Joseph",
    "The Heights’ elderly servant, severe in religion and fiercely attached to the old household.",
  ],
  [
    "zillah",
    "Zillah",
    "The later housekeeper at Wuthering Heights who shelters Lockwood and reports Cathy’s isolation.",
  ],
  [
    "earnshaw",
    "Mr Earnshaw",
    "The old master who brings Heathcliff from Liverpool into his family.",
  ],
  [
    "mrs-earnshaw",
    "Mrs Earnshaw",
    "The mistress of the Heights who distrusts the foundling brought into her home.",
  ],
  [
    "kenneth",
    "Doctor Kenneth",
    "The local doctor who attends illness and death across both households.",
  ],
];
const characters = characterDefs.map(([key, name, description], index) =>
  rec({
    id: char(key),
    name,
    aliases: [],
    description,
    portraitImageId: image(`character-${key}`),
    color: ["#64748b", "#3f3438", "#786759", "#8d5d63", "#748090", "#8a6b78"][
      index % 6
    ],
    tags: [],
    isAlive: true,
    birthDate: null,
  }),
);

const mapDefs = [
  [
    "moors",
    null,
    "The Yorkshire Moors",
    "A windswept overview of the country between the two houses and Gimmerton.",
    1536,
    1024,
  ],
  [
    "heights",
    "moors",
    "Wuthering Heights",
    "The exposed Earnshaw house, its yard, chambers, farm buildings, and garden.",
    1536,
    1024,
  ],
  [
    "grange",
    "moors",
    "Thrushcross Grange",
    "The sheltered Linton estate, including its park and principal rooms.",
    1536,
    1024,
  ],
  [
    "gimmerton",
    "moors",
    "Gimmerton",
    "The nearby village, church, churchyard, and road serving both estates.",
    1536,
    1024,
  ],
];
const mapLayers = mapDefs.map(
  ([key, parent, name, description, imageWidth, imageHeight]) =>
    rec({
      id: id("map", key),
      parentMapId: parent ? id("map", parent) : null,
      name,
      description,
      imageId: image(`map-${key}`),
      imageWidth,
      imageHeight,
      scalePixelsPerUnit: null,
      scaleUnit: null,
      levelGroupId: null,
      levelIndex: 0,
      levelLabel: "",
    }),
);

const locationDefs = [
  [
    "heights-gate",
    "moors",
    "Wuthering Heights",
    "The old Earnshaw farm stands high in the wind, built for harsh weather and guarded by a walled yard.",
    405,
    779,
    "heights",
  ],
  [
    "grange-gate",
    "moors",
    "Thrushcross Grange",
    "The Linton estate lies lower and more sheltered, surrounded by a cultivated park.",
    1050,
    334,
    "grange",
  ],
  [
    "gimmerton-gate",
    "moors",
    "Gimmerton",
    "A small moorland village connecting the isolated households with church, doctor, and ordinary society.",
    1230,
    699,
    "gimmerton",
  ],
  [
    "moor-road",
    "moors",
    "Moor Road",
    "The exposed track between the Heights and Grange becomes treacherous in snow and darkness.",
    735,
    554,
  ],
  [
    "penistone-crags",
    "moors",
    "Penistone Crags",
    "Rocky heights beyond the estates attract the younger generation’s forbidden excursions.",
    180,
    404,
  ],
  [
    "heights-yard",
    "heights",
    "Farmyard",
    "A stone court of gates, kennels, sheds, and working farm life immediately before the house.",
    280,
    374,
  ],
  [
    "house",
    "heights",
    "The House",
    "The broad kitchen-parlour is the Heights’ social centre, dominated by its hearth and heavy furnishings.",
    750,
    464,
  ],
  [
    "oak-chamber",
    "heights",
    "Oak-Panelled Chamber",
    "A seldom-used upstairs room preserves Catherine’s scratched names, old books, and enclosed bed.",
    1160,
    789,
  ],
  [
    "heights-garden",
    "heights",
    "Kitchen Garden",
    "A walled patch of currants, gooseberries, and rough paths beside the Heights.",
    1230,
    289,
  ],
  [
    "grange-park",
    "grange",
    "The Park",
    "Trees, lawns, and boundary walls separate the elegant Grange from the open moor.",
    300,
    504,
  ],
  [
    "grange-parlour",
    "grange",
    "Drawing Room",
    "A carpeted, lamplit room expressing the Lintons’ refinement and domestic order.",
    760,
    524,
  ],
  [
    "catherine-room",
    "grange",
    "Catherine’s Chamber",
    "The upstairs room where Catherine’s illness, delirium, reunion, and final hours unfold.",
    1160,
    789,
  ],
  [
    "gimmerton-church",
    "gimmerton",
    "Gimmerton Chapel",
    "The parish chapel attended by the neighbouring families when weather and inclination permit.",
    470,
    594,
  ],
  [
    "churchyard",
    "gimmerton",
    "Churchyard",
    "The sloping burial ground holds the graves that finally bring both generations together.",
    930,
    564,
  ],
  [
    "kenneth-house",
    "gimmerton",
    "Doctor Kenneth’s House",
    "The local doctor’s base in the village, within reach of both isolated estates.",
    1180,
    364,
  ],
];
const locationMarkers = locationDefs.map(
  ([key, map, name, description, x, y, linked]) =>
    rec({
      id: loc(key),
      mapLayerId: id("map", map),
      linkedMapLayerId: linked ? id("map", linked) : null,
      name,
      description,
      x,
      y,
      imageId: image(`location-${key}`),
      iconType: linked ? "building" : "place",
      tags: [],
      factionId: null,
    }),
);

const itemDefs = [
  [
    "catherine-diary",
    "Catherine’s Diary",
    "The marginal notes and scratched names through which Lockwood first encounters the earlier Catherine.",
  ],
  [
    "lockwood-lantern",
    "Lockwood’s Lantern",
    "The lantern Lockwood takes when attempting to leave the Heights in the snow.",
  ],
  [
    "heathcliff-money",
    "Heathcliff’s Money",
    "The unexplained fortune that lets Heathcliff return as a gentleman and acquire power over Hindley.",
  ],
  [
    "cathy-letters",
    "Cathy and Linton’s Letters",
    "The secret correspondence that sustains and compromises the younger cousins’ courtship.",
  ],
  [
    "linton-will",
    "Linton’s Will",
    "The document used to transfer the Grange and Cathy’s property into Heathcliff’s control.",
  ],
  [
    "hareton-books",
    "Hareton’s Books",
    "Books first associated with humiliation and later with Cathy’s effort to teach Hareton.",
  ],
];
const items = itemDefs.map(([key, name, description]) =>
  rec({
    id: id("item", key),
    name,
    description,
    iconType: "object",
    imageId: image(`item-${key}`),
    tags: [],
  }),
);

const casts = [
  ["lockwood", "heathcliff", "joseph"],
  ["lockwood", "heathcliff", "cathy", "hareton", "joseph", "zillah"],
  ["lockwood", "heathcliff", "cathy", "hareton", "joseph", "zillah"],
  [
    "lockwood",
    "nelly",
    "earnshaw",
    "mrs-earnshaw",
    "catherine",
    "hindley",
    "heathcliff",
  ],
  ["nelly", "earnshaw", "catherine", "hindley", "heathcliff", "joseph"],
  ["nelly", "hindley", "frances", "catherine", "heathcliff", "joseph"],
  [
    "nelly",
    "catherine",
    "heathcliff",
    "hindley",
    "frances",
    "edgar",
    "isabella",
  ],
  [
    "nelly",
    "hindley",
    "frances",
    "catherine",
    "heathcliff",
    "hareton",
    "kenneth",
  ],
  [
    "nelly",
    "catherine",
    "heathcliff",
    "hindley",
    "edgar",
    "isabella",
    "hareton",
    "joseph",
  ],
  ["nelly", "catherine", "heathcliff", "edgar", "isabella", "hindley"],
  ["nelly", "catherine", "heathcliff", "edgar", "isabella", "hindley"],
  ["nelly", "catherine", "edgar", "isabella", "heathcliff", "kenneth"],
  ["isabella", "heathcliff", "hindley", "hareton", "joseph"],
  ["nelly", "isabella", "heathcliff", "hindley", "hareton", "joseph"],
  ["nelly", "catherine", "heathcliff", "edgar"],
  ["nelly", "catherine", "heathcliff", "edgar", "kenneth"],
  ["nelly", "isabella", "heathcliff", "hindley", "hareton", "edgar", "kenneth"],
  ["nelly", "cathy", "edgar", "hareton", "heathcliff"],
  ["nelly", "cathy", "edgar", "linton"],
  ["nelly", "linton", "heathcliff", "cathy"],
  ["nelly", "cathy", "hareton", "linton", "heathcliff"],
  ["nelly", "cathy", "edgar", "heathcliff"],
  ["nelly", "cathy", "linton", "heathcliff", "hareton"],
  ["nelly", "cathy", "linton", "hareton", "heathcliff"],
  ["nelly", "cathy", "edgar"],
  ["nelly", "cathy", "linton", "heathcliff"],
  ["nelly", "cathy", "linton", "heathcliff", "hareton", "joseph"],
  ["nelly", "cathy", "edgar", "linton", "heathcliff"],
  ["nelly", "heathcliff"],
  ["nelly", "zillah", "cathy", "linton", "heathcliff", "hareton"],
  ["lockwood", "heathcliff", "cathy", "hareton"],
  ["lockwood", "nelly", "cathy", "hareton", "heathcliff", "joseph"],
  ["nelly", "cathy", "hareton", "heathcliff", "joseph"],
  ["lockwood", "nelly", "cathy", "hareton", "heathcliff", "joseph"],
];
const locations = [
  "heights-gate",
  "house",
  "oak-chamber",
  "grange-parlour",
  "house",
  "house",
  "house",
  "house",
  "house",
  "grange-parlour",
  "grange-parlour",
  "catherine-room",
  "house",
  "house",
  "catherine-room",
  "catherine-room",
  "house",
  "penistone-crags",
  "grange-parlour",
  "house",
  "moor-road",
  "moor-road",
  "house",
  "house",
  "grange-parlour",
  "moor-road",
  "house",
  "catherine-room",
  "churchyard",
  "house",
  "house",
  "house",
  "house",
  "churchyard",
];
const tensions = [
  2, 3, 5, 2, 4, 3, 4, 5, 5, 4, 5, 5, 4, 4, 5, 5, 5, 3, 3, 3, 4, 4, 3, 3, 3, 4,
  5, 5, 5, 4, 2, 2, 4, 2,
];
const years = [
  1801, 1801, 1801, 1771, 1777, 1777, 1777, 1778, 1780, 1783, 1783, 1783, 1783,
  1783, 1784, 1784, 1784, 1797, 1800, 1800, 1800, 1801, 1801, 1801, 1801, 1801,
  1801, 1801, 1801, 1801, 1801, 1802, 1802, 1802,
];
const day = (year, month = 1, date = 1) =>
  Math.floor(
    (Date.UTC(year, month - 1, date) - Date.UTC(1771, 0, 1)) / 86400000,
  );
const itemsByChapter = new Map([
  [2, ["lockwood-lantern"]],
  [3, ["catherine-diary"]],
  [10, ["heathcliff-money"]],
  [17, ["heathcliff-money"]],
  [21, ["cathy-letters"]],
  [24, ["cathy-letters", "hareton-books"]],
  [25, ["cathy-letters"]],
  [28, ["linton-will"]],
  [30, ["linton-will"]],
  [31, ["hareton-books"]],
  [32, ["hareton-books"]],
  [33, ["hareton-books"]],
]);
const timelines = [
  {
    id: timelineId,
    worldId: W,
    name: "The Earnshaw and Linton History, 1771–1802",
    description:
      "One editorial chronology unites Lockwood’s present with the earlier events narrated by Nelly. Dates without explicit textual support are approximate and preserve the novel’s sequence.",
    color: "#65545f",
    dayOffset: 0,
    createdAt: now,
  },
];
const chapters = chapterLedger.map(({ number, title, synopsis }) =>
  rec({
    id: chapter(number),
    timelineId,
    number,
    title,
    synopsis,
    notes:
      "Editorial title; Emily Brontë’s source chapter is numbered but untitled.",
    wordGoal: null,
  }),
);
const events = chapterLedger.map(({ number, title, synopsis }, index) => {
  const metadata = eventLedger[index];
  return rec({
    id: event(number),
    chapterId: chapter(number),
    timelineId,
    title,
    description: synopsis,
    locationMarkerId: loc(metadata.location),
    involvedCharacterIds: Object.keys(metadata.states).map(char),
    mentionedCharacterIds: [],
    involvedItemIds: (itemsByChapter.get(number) ?? []).map((key) =>
      id("item", key),
    ),
    tags: [`chapter-${number}`],
    threadIds: [id("thread", number < 18 ? "first-generation" : "inheritance")],
    motifIds: [
      id(
        "motif",
        [2, 3, 12, 15, 16, 29, 34].includes(number) ? "windows" : "weather",
      ),
    ],
    sortOrder: index,
    travelDays: index
      ? Math.max(0, day(metadata.year) - day(eventLedger[index - 1].year))
      : 0,
    inWorldTime: day(
      metadata.year,
      Math.min(12, (index % 12) + 1),
      Math.min(28, index + 1),
    ),
    tension: metadata.tension,
    structureBeat: null,
    status: "final",
    povCharacterId:
      number <= 3 || number === 31 || number === 34
        ? char("lockwood")
        : char("nelly"),
    isFlashback: number >= 4 && number <= 30,
  });
});
const sceneTexts = sourceChapters.map((source, index) => ({
  id: id("scene", String(index + 1).padStart(3, "0")),
  worldId: W,
  eventId: event(index + 1),
  text: source.paragraphs.join("\n\n"),
  wordCount: (source.paragraphs.join(" ").match(/\S+/g) ?? []).length,
  createdAt: now,
  updatedAt: now,
}));
const deathChapter = {
  earnshaw: 5,
  frances: 8,
  catherine: 16,
  hindley: 17,
  edgar: 28,
  linton: 30,
  heathcliff: 34,
};
const characterSnapshots = events.flatMap((ev, eventIndex) =>
  Object.entries(eventLedger[eventIndex].states).map(
    ([characterKey, statusNotes], castIndex) =>
      rec({
        id: `${ev.id}-snapshot-${castIndex + 1}`,
        characterId: char(characterKey),
        eventId: ev.id,
        isAlive: !(
          deathChapter[characterKey] &&
          eventIndex + 1 >= deathChapter[characterKey]
        ),
        currentLocationMarkerId: ev.locationMarkerId,
        currentMapLayerId:
          locationMarkers.find((x) => x.id === ev.locationMarkerId)
            ?.mapLayerId ?? id("map", "moors"),
        inventoryItemIds: [],
        inventoryNotes: "",
        travelModeId: null,
        // HistoryTab orders a character's records by this value. It must track
        // story chronology, not the character's position within an event cast.
        sortKey: eventIndex,
        statusNotes,
      }),
  ),
);

const relationshipPairs = [
  [
    "heathcliff",
    "catherine",
    "inseparable companions and tragic lovers",
    5,
    "mixed",
  ],
  [
    "catherine",
    "edgar",
    "wife and husband divided by incompatible needs",
    4,
    "mixed",
  ],
  [
    "heathcliff",
    "isabella",
    "abusive husband and estranged wife",
    5,
    "negative",
  ],
  [
    "hindley",
    "heathcliff",
    "foster brothers and bitter enemies",
    5,
    "negative",
  ],
  ["edgar", "isabella", "protective brother and sister", 4, "positive"],
  ["edgar", "cathy", "devoted father and daughter", 5, "positive"],
  ["heathcliff", "linton", "coercive father and son", 5, "negative"],
  ["cathy", "linton", "cousins forced into marriage", 4, "mixed"],
  [
    "cathy",
    "hareton",
    "hostile cousins who grow into loving equals",
    5,
    "positive",
  ],
  ["heathcliff", "hareton", "dispossessor and dependent ward", 4, "negative"],
  ["nelly", "catherine", "nurse, confidante, and moral adversary", 4, "mixed"],
  ["nelly", "cathy", "protective nurse and foster mother", 5, "positive"],
];
const relationshipStart = [4, 8, 10, 4, 6, 16, 20, 21, 18, 17, 4, 16];
const relationships = relationshipPairs.map(
  ([a, b, label, strength, sentiment], index) =>
    rec({
      id: id("relationship", index + 1),
      characterAId: char(a),
      characterBId: char(b),
      label,
      strength,
      sentiment,
      notes: "The relationship changes materially across the narrated history.",
      isMutual: true,
      createdAtEventId: event(relationshipStart[index]),
    }),
);
const relationshipSnapshots = [
  rec({
    id: id("relationship-snapshot", 1),
    relationshipId: id("relationship", 1),
    eventId: event(9),
    label: "separated after an overheard rejection",
    strength: 5,
    sentiment: "mixed",
    notes:
      "Heathcliff leaves before hearing Catherine say that he is more herself than she is.",
  }),
  rec({
    id: id("relationship-snapshot", 2),
    relationshipId: id("relationship", 1),
    eventId: event(15),
    label: "reunited at Catherine's deathbed",
    strength: 5,
    sentiment: "mixed",
    notes:
      "Their last conscious meeting joins love, blame, and terror of separation.",
  }),
  rec({
    id: id("relationship-snapshot", 3),
    relationshipId: id("relationship", 8),
    eventId: event(27),
    label: "coerced husband and wife",
    strength: 1,
    sentiment: "negative",
    notes: "Cathy is imprisoned until she marries Linton.",
  }),
  rec({
    id: id("relationship-snapshot", 4),
    relationshipId: id("relationship", 9),
    eventId: event(32),
    label: "teacher and willing pupil",
    strength: 4,
    sentiment: "positive",
    notes: "Cathy apologises and begins teaching Hareton to read.",
  }),
  rec({
    id: id("relationship-snapshot", 5),
    relationshipId: id("relationship", 9),
    eventId: event(33),
    label: "acknowledged lovers",
    strength: 5,
    sentiment: "positive",
    notes: "Their mutual affection displaces the inherited quarrel.",
  }),
];
const plotThreads = [
  rec({
    id: id("thread", "first-generation"),
    name: "Catherine and Heathcliff",
    description:
      "A childhood bond collides with class, marriage, bereavement, and Heathcliff’s demand that death not divide them.",
    color: "#6b4652",
    status: "active",
    tags: [],
  }),
  rec({
    id: id("thread", "inheritance"),
    name: "Inheritance and the Second Generation",
    description:
      "Heathcliff’s revenge captures both estates until Cathy and Hareton create a different future.",
    color: "#6a6652",
    status: "active",
    tags: [],
  }),
];
const motifs = [
  rec({
    id: id("motif", "weather"),
    name: "Wind, Snow, and Storm",
    description:
      "Weather makes emotion physical and repeatedly controls access between houses.",
    color: "#71808a",
    tags: [],
  }),
  rec({
    id: id("motif", "windows"),
    name: "Windows and Thresholds",
    description:
      "Windows and doors divide shelter from exclusion, living from dead, and watcher from participant.",
    color: "#7c6571",
    tags: [],
  }),
];
const loreCategories = [
  {
    id: id("lore-category", "source"),
    worldId: W,
    name: "Source and Editorial Method",
    color: "#756a62",
    sortOrder: 0,
  },
  {
    id: id("lore-category", "world"),
    worldId: W,
    name: "Moorland Life",
    color: "#66705c",
    sortOrder: 1,
  },
];
const lorePages = [
  rec({
    id: id("lore", "source"),
    categoryId: loreCategories[0].id,
    title: "Text, Chapter Titles, and Dates",
    body: `The complete public-domain prose comes from ${sourceEdition}, ${sourceUrl}. Emily Brontë’s chapters are numbered but untitled; all descriptive chapter and event titles are editorial. The calendar is an editorial reconstruction because the novel supplies intervals more often than exact dates. One timeline contains both Lockwood’s present and Nelly’s retrospective account.`,
    tags: ["source", "editorial-method", "chronology"],
    coverImageId: image("world-cover"),
    linkedEntityIds: [],
    visibleFromEventId: null,
  }),
  rec({
    id: id("lore", "estates"),
    categoryId: loreCategories[1].id,
    title: "The Two Houses",
    body: "Wuthering Heights is exposed, old, and bound to working land; Thrushcross Grange is sheltered, cultivated, and associated with gentility. The novel repeatedly tests the human meanings attached to that contrast.",
    tags: ["estates", "moorland", "social-order"],
    coverImageId: image("location-heights-gate"),
    linkedEntityIds: [id("location", "heights"), id("location", "grange")],
    visibleFromEventId: null,
  }),
];
const factions = [
  rec({
    id: id("faction", "earnshaw"),
    name: "The Earnshaw Household",
    description: "The family and dependants rooted at Wuthering Heights.",
    color: "#66574d",
    coverImageId: image("location-heights-gate"),
    tags: [],
  }),
  rec({
    id: id("faction", "linton"),
    name: "The Linton Household",
    description: "The family and servants of Thrushcross Grange.",
    color: "#77736a",
    coverImageId: image("location-grange-gate"),
    tags: [],
  }),
];
const factionMemberships = [
  ["earnshaw", "earnshaw", "master", 4, 5],
  ["earnshaw", "mrs-earnshaw", "mistress", 4, 5],
  ["earnshaw", "catherine", "daughter", 4, 16],
  ["earnshaw", "hindley", "heir and master", 4, 17],
  ["earnshaw", "heathcliff", "foster child, then owner", 4, null],
  ["earnshaw", "hareton", "dispossessed heir", 8, null],
  ["earnshaw", "joseph", "servant", 4, null],
  ["earnshaw", "zillah", "housekeeper", 2, null],
  ["linton", "edgar", "heir and master", 6, 28],
  ["linton", "isabella", "daughter", 6, 12],
  ["linton", "catherine", "mistress", 10, 16],
  ["linton", "cathy", "daughter and heir", 16, 28],
  ["linton", "nelly", "housekeeper", 10, 32],
  ["linton", "linton", "legal heir", 27, 30],
].map(([faction, character, role, start, end], index) =>
  rec({
    id: id("membership", index + 1),
    factionId: id("faction", faction),
    characterId: char(character),
    role,
    startEventId: event(start),
    endEventId: end ? event(end) : null,
    notes: "",
  }),
);
const characterGoals = [
  [
    "catherine",
    4,
    9,
    "want",
    "Preserve her identity with Heathcliff while gaining the social life offered by Edgar.",
    "abandoned",
  ],
  [
    "heathcliff",
    7,
    17,
    "want",
    "Return humiliation and dispossession upon Hindley and the Linton family.",
    "active",
  ],
  [
    "heathcliff",
    17,
    30,
    "want",
    "Gain legal control of both Wuthering Heights and Thrushcross Grange through debt and inheritance.",
    "resolved",
  ],
  [
    "isabella",
    10,
    17,
    "need",
    "Escape the marriage whose imagined romance has become captivity.",
    "resolved",
  ],
  [
    "edgar",
    16,
    28,
    "want",
    "Protect and educate Cathy within the shelter of the Grange.",
    "resolved",
  ],
  [
    "cathy",
    21,
    28,
    "want",
    "Reach and comfort Linton without abandoning her dying father.",
    "failed",
  ],
  [
    "hareton",
    24,
    33,
    "need",
    "Overcome the ignorance imposed on him and meet Cathy as an equal.",
    "resolved",
  ],
  [
    "cathy",
    31,
    33,
    "need",
    "Reject inherited contempt and recognise Hareton's dignity.",
    "resolved",
  ],
].map(([character, start, end, type, text, status], index) =>
  rec({
    id: id("goal", index + 1),
    characterId: char(character),
    startEventId: event(start),
    endEventId: event(end),
    type,
    text,
    status,
  }),
);
const knowledgeFacts = [
  [
    "heathcliff-plan",
    "Heathcliff intends to acquire both estates",
    "Debt, marriage, and inheritance form one deliberate design.",
    10,
    10,
  ],
  [
    "catherine-love",
    "Catherine identifies herself with Heathcliff",
    "Her decision to marry Edgar does not diminish the bond she describes to Nelly.",
    9,
    9,
  ],
  [
    "linton-coercion",
    "Linton acts under Heathcliff's threats",
    "The younger Linton's pleading and treachery are shaped by fear of his father.",
    23,
    23,
  ],
  [
    "cathy-hareton-kin",
    "Hareton is Cathy's cousin and the rightful Earnshaw heir",
    "Cathy initially mistakes him for a servant because Heathcliff has denied his station and education.",
    18,
    18,
  ],
  [
    "grave-plan",
    "Heathcliff has arranged burial beside Catherine",
    "He has opened Catherine's coffin and removed the adjoining coffin side so their remains can mingle.",
    29,
    29,
  ],
].map(([key, title, description, reader, origin]) =>
  rec({
    id: id("fact", key),
    title,
    description,
    tags: [],
    readerLearnsAtEventId: event(reader),
    originEventId: event(origin),
  }),
);
const knowledgeReveals = [
  [
    "catherine-love",
    "nelly",
    9,
    "Catherine explains why her attachment to Heathcliff is inseparable from her identity.",
  ],
  [
    "heathcliff-plan",
    "nelly",
    14,
    "Heathcliff admits that Isabella and Hindley's ruin serve his retaliation.",
  ],
  [
    "linton-coercion",
    "nelly",
    23,
    "Linton reveals his terror while begging Cathy to continue visiting.",
  ],
  [
    "linton-coercion",
    "cathy",
    26,
    "Cathy understands that Linton's appeals are enforced by Heathcliff.",
  ],
  [
    "cathy-hareton-kin",
    "cathy",
    18,
    "Nelly identifies Hareton after Cathy treats him as a servant.",
  ],
  [
    "grave-plan",
    "nelly",
    29,
    "Heathcliff personally recounts the opening of Catherine's grave.",
  ],
].map(([fact, character, eventNumber, note], index) =>
  rec({
    id: id("reveal", index + 1),
    factId: id("fact", fact),
    characterId: char(character),
    eventId: event(eventNumber),
    note,
  }),
);
const itemPlacements = events.flatMap((ev, eventIndex) =>
  ev.involvedItemIds.map((itemId, itemIndex) =>
    rec({
      id: id("placement", `${eventIndex + 1}-${itemIndex + 1}`),
      itemId,
      eventId: ev.id,
      locationMarkerId: ev.locationMarkerId,
      notes: `Materially present during ${ev.title}.`,
      sortKey: eventIndex * 100 + itemIndex,
    }),
  ),
);
const blobs = [
  ...mapDefs.map(([key]) => ({
    id: image(`map-${key}`),
    worldId: W,
    mimeType: "image/jpeg",
    url: `library/wuthering-heights/maps/${key}.jpg`,
    createdAt: now,
  })),
  ...characterDefs.map(([key]) => ({
    id: image(`character-${key}`),
    worldId: W,
    mimeType: "image/jpeg",
    url: `library/wuthering-heights/art/character-${key}.jpg`,
    createdAt: now,
  })),
  ...locationDefs.map(([key]) => ({
    id: image(`location-${key}`),
    worldId: W,
    mimeType: "image/jpeg",
    url: `library/wuthering-heights/art/location-${key}.jpg`,
    createdAt: now,
  })),
  ...itemDefs.map(([key]) => ({
    id: image(`item-${key}`),
    worldId: W,
    mimeType: "image/jpeg",
    url: `library/wuthering-heights/art/item-${key}.jpg`,
    createdAt: now,
  })),
  {
    id: image("cover"),
    worldId: W,
    mimeType: "image/jpeg",
    url: "library/wuthering-heights/art/world-cover.jpg",
    createdAt: now,
  },
];
const world = {
  version: 11,
  type: "plotweave-world",
  exportedAt: now,
  world: {
    id: W,
    name: "Wuthering Heights",
    description:
      "Across the isolated Yorkshire moors, the Earnshaw and Linton households become entangled through a foundling’s arrival, an attachment that defies social order, and a revenge inherited by their children. Emily Brontë’s Gothic novel sets cultivated rooms against elemental weather while asking whether love, possession, and memory can survive the violence done in their names.",
    coverImageId: image("cover"),
    theme: "theme-gothic",
    readingMode: true,
    createdAt: now,
    updatedAt: now,
    continuityStaleThreshold: 5,
    calendar: {
      startYear: 1771,
      yearSuffix: "",
      months: [
        ["January", 31],
        ["February", 28],
        ["March", 31],
        ["April", 30],
        ["May", 31],
        ["June", 30],
        ["July", 31],
        ["August", 31],
        ["September", 30],
        ["October", 31],
        ["November", 30],
        ["December", 31],
      ].map(([name, days]) => ({ name, days })),
    },
    wordTarget: null,
  },
  mapLayers,
  locationMarkers,
  characters,
  items,
  characterSnapshots,
  characterMovements: [],
  itemPlacements,
  locationSnapshots: [],
  itemSnapshots: [],
  relationships,
  relationshipSnapshots,
  timelines,
  chapters,
  events,
  blobs,
  travelModes: [],
  timelineRelationships: [],
  crossTimelineArtifacts: [],
  mapRoutes: [
    rec({
      id: id("route", "houses"),
      mapLayerId: id("map", "moors"),
      name: "Road Between the Houses",
      routeType: "moor-road",
      waypoints: [loc("heights-gate"), loc("moor-road"), loc("grange-gate")],
      color: "#695f62",
      notes:
        "The repeatedly travelled road between Wuthering Heights and Thrushcross Grange.",
    }),
  ],
  mapRegions: [],
  mapRegionSnapshots: [],
  mapAnnotations: [],
  loreCategories,
  lorePages,
  factions,
  factionMemberships,
  factionRelationships: [],
  knowledgeFacts,
  knowledgeReveals,
  characterGoals,
  sceneTexts,
  plotThreads,
  motifs,
  continuitySuppressions: [],
  writingLogs: [],
  sceneRevisions: [],
};
const json = `${JSON.stringify(world, null, 2)}\n`;
fs.mkdirSync("example", { recursive: true });
fs.mkdirSync("public/library", { recursive: true });
fs.writeFileSync("example/Wuthering Heights.pwk", json);
fs.writeFileSync("public/library/wuthering-heights.pwk", json);
const indexPath = "public/library/index.json";
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const catalogueEntry = {
  id: "wuthering-heights",
  title: "Wuthering Heights",
  author: "Emily Brontë",
  blurb:
    "On the Yorkshire moors, the histories of the Earnshaw and Linton households are consumed by Heathcliff’s bond with Catherine and the revenge he carries into their children’s lives.",
  data: "wuthering-heights.pwk",
  dataBytes: Buffer.byteLength(json),
  counts: {
    characters: characters.length,
    chapters: chapters.length,
    events: events.length,
    locations: locationMarkers.length,
  },
  notice: `Unofficial reference for a public-domain novel. The original prose is public domain; manuscript scenes reproduce the complete narrative of all 34 chapters from ${sourceEdition}. Gutenberg front and end matter are excluded. Chapter titles, event descriptions, and the reconstructed calendar are editorial. All maps and entity artwork are original generated illustrations documented in Lore.`,
  worldId: W,
  cover: "library/wuthering-heights/art/world-cover.jpg",
};
const existing = index.entries.findIndex(
  (entry) => entry.id === catalogueEntry.id,
);
if (existing >= 0) index.entries[existing] = catalogueEntry;
else index.entries.push(catalogueEntry);
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log({
  chapters: chapters.length,
  events: events.length,
  scenes: sceneTexts.length,
  words: sceneTexts.reduce((n, s) => n + s.wordCount, 0),
  snapshots: characterSnapshots.length,
  bytes: Buffer.byteLength(json),
});
