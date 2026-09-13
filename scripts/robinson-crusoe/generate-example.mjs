import assert from "node:assert/strict";
import fs from "node:fs";
import { chronologicalEvents } from "./chronology.mjs";
import { sourceChapters, sourceEdition, sourceUrl } from "./source-text.mjs";
import {
  characterDefs,
  itemDefs,
  locationDefs,
  motifDefs,
  relationshipDefs,
  threadDefs,
} from "./world-data.mjs";
import {
  chapterSynopses,
  characterIsAliveInScene,
  characterSceneState,
  factionDefs,
  factDefs,
  goalDefs,
  itemSceneUses,
  membershipDefs,
  revealDefs,
  routeDefs,
} from "./supporting-data.mjs";
import {
  assetNumber,
  characterImageFile,
  itemImageFile,
  locationImageFile,
  markerCoordinates,
  pagetFile,
} from "./asset-data.mjs";

const P = "robinson-crusoe",
  worldId = `${P}-world`,
  timelineId = `${P}-timeline-main`,
  now = 1799798400000;
const base = { worldId, createdAt: now, updatedAt: now };
const id = (kind, slug) => `${P}-${kind}-${slug}`;
const template = JSON.parse(
  fs.readFileSync("example/Treasure Island.pwk", "utf8"),
);
const d = { version: template.version, type: template.type, exportedAt: now };
for (const key of Object.keys(template))
  if (Array.isArray(template[key])) d[key] = [];
d.world = {
  id: worldId,
  name: "The Life and Adventures of Robinson Crusoe",
  description:
    "A restless English voyager survives shipwreck and remakes daily life on an isolated Atlantic island, where labour, fear, faith, encounter, and the hope of return transform nearly three decades of solitude.",
  coverImageId: id("image", "world"),
  theme: "theme-adventure",
  readingMode: true,
  createdAt: now,
  updatedAt: now,
  continuityStaleThreshold: 5,
  wordTarget: null,
  calendar: {
    startYear: 1632,
    yearSuffix: " (source dates and documented editorial chronology)",
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
};
d.timelines = [
  {
    id: timelineId,
    worldId,
    name: "Crusoe’s Life and Voyages",
    description:
      "One chronology follows Crusoe’s retrospective account from York through the island years and return.",
    color: "#8a6b3f",
    dayOffset: 0,
    createdAt: now,
  },
];
d.mapLayers = [
  {
    ...base,
    id: id("map", "world"),
    parentMapId: null,
    name: "Crusoe’s Atlantic World",
    description:
      "The ports, coasts, plantations, and overland routes joined by Crusoe’s voyages.",
    imageId: id("image", "map-world"),
    imageWidth: 1536,
    imageHeight: 1024,
    scalePixelsPerUnit: null,
    scaleUnit: null,
    levelGroupId: null,
    levelIndex: 0,
    levelLabel: "",
  },
  {
    ...base,
    id: id("map", "island"),
    parentMapId: id("map", "world"),
    name: "Crusoe’s Island",
    description:
      "The unnamed island’s shores, hills, dwellings, fields, anchorages, and concealed refuges.",
    imageId: id("image", "map-island"),
    imageWidth: 1024,
    imageHeight: 1536,
    scalePixelsPerUnit: null,
    scaleUnit: null,
    levelGroupId: null,
    levelIndex: 0,
    levelLabel: "",
  },
];
d.locationMarkers = locationDefs.map(
  ([slug, map, name, description]) => {
    const sourceMap = d.mapLayers.find((layer) => layer.id === id("map", map));
    assert(sourceMap, `Missing map: ${map}`);
    return ({
    ...base,
    id: id("loc", slug),
    mapLayerId: id("map", map),
    linkedMapLayerId: slug === "island-gateway" ? id("map", "island") : null,
    name,
    description,
    x: markerCoordinates[map][slug][0],
    // Leaflet's Simple CRS stores Y from the lower edge, while the reviewed
    // artwork coordinates are conventional image pixels measured from the top.
    y: sourceMap.imageHeight - markerCoordinates[map][slug][1],
    iconType: "landmark",
    tags: [],
    factionId: null,
    imageId: id("image", `location-${slug}`),
  }); },
);
d.characters = characterDefs.map(([slug, name, description], index) => ({
  ...base,
  id: id("char", slug),
  name,
  aliases: [],
  description,
  portraitImageId: id("image", `character-${slug}`),
  color: ["#8a6b3f", "#47717a", "#7d5144", "#64724a"][index % 4],
  tags: [],
  isAlive: true,
  birthDate: null,
}));
d.items = itemDefs.map(([slug, name, description, iconType]) => ({
  ...base,
  id: id("item", slug),
  name,
  description,
  iconType,
  imageId: id("image", `item-${slug}`),
  tags: [],
}));
d.plotThreads = threadDefs.map(([slug, name, description], index) => ({
  ...base,
  id: id("thread", slug),
  name,
  color: ["#855b35", "#4c6b55", "#6e5a78", "#3f7180"][index % 4],
  description,
}));
d.motifs = motifDefs.map(([slug, name, description], index) => ({
  ...base,
  id: id("motif", slug),
  name,
  color: ["#476a78", "#8a6b3f", "#68734b", "#72514a"][index % 4],
  description,
}));
d.chapters = sourceChapters.map((chapter) => ({
  ...base,
  id: id("chapter", String(chapter.number).padStart(2, "0")),
  timelineId,
  number: chapter.number,
  title: chapter.title,
  synopsis: chapterSynopses[chapter.number - 1],
  notes: "",
  wordGoal: null,
}));
const chapterEventCounts = new Map();
const structureBeatByTitle = {
  "A Restless Son in York": "hook",
  "Crusoe’s First Storm": "inciting-incident",
  "The Ship Breaks on the Sandbank": "plot-point-1",
  "The Footprint": "midpoint",
  "An English Ship Appears": "plot-point-2",
  "The Captain Retakes His Ship": "climax",
  "Home and Settlement": "resolution",
};
d.events = chronologicalEvents.map((scene, index) => {
  const sortOrder = chapterEventCounts.get(scene.chapterNumber) ?? 0;
  chapterEventCounts.set(scene.chapterNumber, sortOrder + 1);
  const location = d.locationMarkers.find(
    (marker) => marker.id === id("loc", scene.location),
  );
  assert(location, scene.location);
  const searchable = `${scene.title} ${scene.description}`;
  const threadSlugs = [
    scene.chapterNumber <= 3
      ? "wandering"
      : scene.chapterNumber <= 10
        ? "survival"
        : scene.chapterNumber <= 16
          ? "encounter"
          : scene.chapterNumber <= 18
            ? "colony"
            : "plantation",
  ];
  if (/faith|prayer|scripture|bible|providence|repent|conscience|gratitude|deliverance/i.test(searchable)) threadSlugs.push("providence");
  if (/escape|return|boat|canoe|ship|current|mainland|voyage|deliverance/i.test(searchable)) threadSlugs.push("escape");
  const motifSlugs = [
    /storm|wreck|current|coast|sea/i.test(scene.title)
      ? "storms"
      : /journal|calendar|fortune|affairs|year/i.test(scene.title)
        ? "accounts"
        : /castle|cave|pasture|field|house/i.test(scene.title)
          ? "enclosures"
          : /footprint|voice|guns|ship appears/i.test(scene.title)
            ? "signs"
            : "labour",
  ];
  if (/gun|powder|firearm|weapon|shoot|attack|mutineer|cannibal/i.test(searchable)) motifSlugs.push("weapons");
  if (/master|slave|captive|service|Friday|kingdom|subject|colony|captain|command/i.test(searchable)) motifSlugs.push("mastery");
  return {
    ...base,
    id: id("event", String(index + 1).padStart(3, "0")),
    chapterId: d.chapters[scene.chapterNumber - 1].id,
    timelineId,
    title: scene.title,
    description: scene.description,
    locationMarkerId: location.id,
    involvedCharacterIds: scene.cast.map((slug) => id("char", slug)),
    mentionedCharacterIds: [],
    involvedItemIds: (itemSceneUses[scene.title] ?? []).map((slug) => id("item", slug)),
    tags: [`chapter-${scene.chapterNumber}`],
    threadIds: [...new Set(threadSlugs)].map((slug) => id("thread", slug)),
    motifIds: [...new Set(motifSlugs)].map((slug) => id("motif", slug)),
    sortOrder,
    travelDays: scene.travelDays,
    inWorldTime: scene.inWorldTime,
    tension: scene.tension,
    structureBeat: structureBeatByTitle[scene.title] ?? null,
    status: "final",
    povCharacterId: id("char", "crusoe"),
    isFlashback: false,
  };
});
const relationshipStarts = {
  "crusoe-father": "A Restless Son in York",
  "crusoe-mother": "A Restless Son in York",
  "crusoe-xury": "A Captive at Sallee",
  "crusoe-portuguese-captain": "Rescue by the Portuguese Captain",
  "crusoe-friday": "The Rescue and Naming of Friday",
  "friday-friday-father": "Friday Finds His Father",
  "crusoe-spaniard": "The Attack on the Cannibals",
  "crusoe-english-captain": "The Marooned Captain",
  "english-captain-mate": "The Marooned Captain",
  "crusoe-widow": "The Guinea Trade",
};
d.relationships = relationshipDefs.map(
  ([a, b, label, strength, sentiment, description]) => ({
    ...base,
    id: id("relationship", `${a}-${b}`),
    characterAId: id("char", a),
    characterBId: id("char", b),
    label,
    strength,
    sentiment,
    description,
    isBidirectional: true,
    startEventId: d.events.find(
      (event) => event.title === relationshipStarts[`${a}-${b}`],
    ).id,
  }),
);
d.sceneTexts = chronologicalEvents.map((scene, index) => ({
  id: id("scene", String(index + 1).padStart(3, "0")),
  worldId,
  eventId: d.events[index].id,
  text: scene.text,
  wordCount: scene.wordCount,
  createdAt: now,
  updatedAt: now,
}));
d.characterSnapshots = chronologicalEvents.flatMap((scene, index) =>
  scene.cast.map((slug, characterOrder) => {
    const event = d.events[index],
      character = d.characters.find(
        (candidate) => candidate.id === id("char", slug),
      ),
      marker = d.locationMarkers.find(
        (candidate) => candidate.id === event.locationMarkerId,
      );
    assert(character && marker);
    return {
      ...base,
      id: id("snapshot", `${String(index + 1).padStart(3, "0")}-${slug}`),
      characterId: character.id,
      eventId: event.id,
      isAlive: characterIsAliveInScene(slug, scene),
      currentLocationMarkerId: marker.id,
      currentMapLayerId: marker.mapLayerId,
      inventoryItemIds: [],
      inventoryNotes: "",
      travelModeId: null,
      sortKey: index * 10000 + characterOrder,
      statusNotes: characterSceneState(slug, scene),
    };
  }),
);
d.factions = factionDefs.map(([slug, name, description, color]) => ({
  ...base,
  id: id("faction", slug),
  name,
  description,
  color,
  coverImageId: null,
  tags: [],
}));
d.blobs = [
  { ...base, id: id("image", "world"), mimeType: "image/jpeg", url: `library/robinson-crusoe/art/${pagetFile(assetNumber.world)}` },
  { ...base, id: id("image", "map-world"), mimeType: "image/png", url: "library/robinson-crusoe/maps/atlantic-world.png" },
  { ...base, id: id("image", "map-island"), mimeType: "image/png", url: "library/robinson-crusoe/maps/crusoes-island.png" },
  ...Object.entries(characterImageFile).map(([slug, filename]) => ({ ...base, id: id("image", `character-${slug}`), mimeType: "image/jpeg", url: `library/robinson-crusoe/art/${filename}` })),
  ...Object.entries(itemImageFile).map(([slug, filename]) => ({ ...base, id: id("image", `item-${slug}`), mimeType: "image/png", url: `library/robinson-crusoe/art/${filename}` })),
  ...Object.entries(locationImageFile).map(([slug, filename]) => ({ ...base, id: id("image", `location-${slug}`), mimeType: "image/jpeg", url: `library/robinson-crusoe/art/${filename}` })),
];
const eventByTitle = (title) => {
  const event = d.events.find((candidate) => candidate.title === title);
  assert(event, `Missing event: ${title}`);
  return event;
};
d.factionMemberships = membershipDefs.map(([faction, character, role, start], index) => ({
  ...base,
  id: id("membership", String(index + 1).padStart(2, "0")),
  factionId: id("faction", faction),
  characterId: id("char", character),
  role,
  startEventId: eventByTitle(start).id,
  endEventId: null,
  notes: "",
}));
d.factionRelationships = [
  { ...base, id: id("faction-relationship", "household-warriors"), factionAId: id("faction", "island-household"), factionBId: id("faction", "visiting-warriors"), label: "defensive enemies", sentiment: "negative", strength: 5, description: "Fear becomes direct conflict when Crusoe and Friday intervene to rescue captives.", isBidirectional: true, startEventId: eventByTitle("The Attack on the Cannibals").id },
  { ...base, id: id("faction-relationship", "loyalists-mutineers"), factionAId: id("faction", "english-loyalists"), factionBId: id("faction", "english-mutineers"), label: "opposing ship parties", sentiment: "negative", strength: 5, description: "The loyal officers and island allies fight to reverse the seizure of the English ship.", isBidirectional: true, startEventId: eventByTitle("The Marooned Captain").id },
];
d.knowledgeFacts = factDefs.map(([slug, title, description, reveal]) => ({
  ...base,
  id: id("fact", slug),
  title,
  description,
  tags: [],
  visibleFromEventId: eventByTitle(reveal).id,
  sourceEventId: eventByTitle(reveal).id,
  knowledgeType: "discovery",
}));
d.knowledgeReveals = revealDefs.map(([fact, character, event, notes], index) => ({
  ...base,
  id: id("reveal", String(index + 1).padStart(2, "0")),
  factId: id("fact", fact),
  characterId: id("char", character),
  eventId: eventByTitle(event).id,
  notes,
}));
d.characterGoals = goalDefs.map(([character, start, end, type, description], index) => ({
  ...base,
  id: id("goal", String(index + 1).padStart(2, "0")),
  characterId: id("char", character),
  startEventId: eventByTitle(start).id,
  endEventId: eventByTitle(end).id,
  type,
  text: description,
  status: "resolved",
}));
d.itemPlacements = d.events.flatMap((event, eventIndex) =>
  event.involvedItemIds.map((itemId, itemIndex) => ({
    ...base,
    id: id("placement", `${String(eventIndex + 1).padStart(3, "0")}-${String(itemIndex + 1).padStart(2, "0")}`),
    itemId,
    eventId: event.id,
    locationMarkerId: event.locationMarkerId,
    notes: `Used or materially present during ${event.title}.`,
    sortKey: eventIndex * 100 + itemIndex,
  })),
);
d.mapRoutes = routeDefs.map(([slug, name, map, travelMode, locations]) => ({
  ...base,
  id: id("route", slug),
  mapLayerId: id("map", map),
  name,
  description: `A ${travelMode} route traced through the locations recorded in Crusoe’s account.`,
  color: "#765a38",
  waypoints: locations.map((location) => id("loc", location)),
  travelMode,
  visibleFromEventId: d.events[0].id,
}));
d.loreCategories = [
  {
    id: id("lore-category", "sources"),
    worldId,
    name: "Sources and Editorial Method",
    color: "#756454",
    sortOrder: 0,
  },
  {
    id: id("lore-category", "world"),
    worldId,
    name: "World and Context",
    color: "#657052",
    sortOrder: 1,
  },
];
d.lorePages = [
  {
    ...base,
    id: id("lore-page", "source"),
    categoryId: d.loreCategories[0].id,
    title: "Complete Manuscript Source",
    body: `The reading manuscript reproduces the complete original prose of ${sourceEdition}, ${sourceUrl}. Project Gutenberg marks the edition public domain in the USA. Its licence wrapper, title page, and contents are excluded. The twenty authored chapter headings are retained as chapter metadata, and every narrative paragraph appears exactly once in ordered scene drafts. Calendar dates explicitly stated by Defoe are preserved; dates between those anchors are editorial estimates used to display the long chronology and are not claims about an exact historical day.`,
    tags: [],
    coverImageId: null,
    linkedEntityIds: [worldId],
    visibleFromEventId: d.events[0].id,
  },
  {
    ...base,
    id: id("lore-page", "calendar"), categoryId: id("lore-category", "sources"),
    title: "Calendar and Dating", body: "Crusoe supplies exact dates for his birth, departures, wreck, anniversaries, and return, but not for every narrated transition. The calendar preserves explicit dates and uses transparent editorial interpolation between anchors so that elapsed time never runs backward. Those estimates organize playback; they do not replace the novel’s own wording.",
    tags: ["calendar", "editorial"], coverImageId: null, linkedEntityIds: [worldId], visibleFromEventId: d.events[0].id,
  },
  {
    ...base,
    id: id("lore-page", "island"), categoryId: id("lore-category", "world"),
    title: "The Unnamed Island", body: "The island is a fictionalized geography near the mouth of the Orinoco, described through Crusoe’s movement rather than a surveyed plan. Its eastern wreck shore, fortified dwelling, fertile interior, western lookout, recurring south-west landings, currents, caves, fields, and goat enclosures form the practical world of the long castaway narrative.",
    tags: ["geography"], coverImageId: id("image", "map-island"), linkedEntityIds: [id("map", "island")], visibleFromEventId: eventByTitle("The Ship Breaks on the Sandbank").id,
  },
  {
    ...base,
    id: id("lore-page", "colonial-context"), categoryId: id("lore-category", "world"),
    title: "Colonial Trade, Slavery, and the Narrative", body: "The novel’s commercial world is inseparable from European colonial expansion and racial slavery. Crusoe is enslaved at Sallee, later sells Xury into conditional service, becomes a Brazilian plantation owner, and is wrecked while attempting a voyage intended to obtain enslaved Africans. These elements are retained and named rather than softened; the example presents the book’s historical language and unequal relationships without endorsing them.",
    tags: ["historical-context", "slavery", "colonialism"], coverImageId: id("image", "location-brazil-plantation"), linkedEntityIds: [worldId, id("thread", "plantation")], visibleFromEventId: eventByTitle("A Captive at Sallee").id,
  },
  {
    ...base,
    id: id("lore-page", "illustrations"), categoryId: id("lore-category", "sources"),
    title: "Illustration Provenance", body: "The cover artwork comes from Walter Paget’s illustrations for the 1891 Cassell fine-art edition of Robinson Crusoe, digitized by the British Library and made available through Wikimedia Commons. All character, location, and item illustrations and both navigational maps are newly generated, mature period-style artwork based on the people, objects, and places described in Defoe’s narrative; the maps are interpretive rather than historical surveys.",
    tags: ["images", "provenance"], coverImageId: id("image", "world"), linkedEntityIds: [worldId], visibleFromEventId: d.events[0].id,
  },
];
const json = `${JSON.stringify(d, null, 2)}\n`;
fs.writeFileSync("example/Robinson Crusoe.pwk", json);
fs.writeFileSync("public/library/robinson-crusoe.pwk", json);
const cataloguePath = "public/library/index.json";
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
const catalogueEntry = catalogue.entries.find((entry) => entry.id === P);
assert(catalogueEntry, "Robinson Crusoe catalogue entry is missing");
catalogueEntry.dataBytes = Buffer.byteLength(json);
fs.writeFileSync(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`);
assert.equal(d.sceneTexts.length, 99);
assert.equal(
  d.sceneTexts.reduce((sum, scene) => sum + scene.wordCount, 0),
  120687,
);
console.log({
  chapters: d.chapters.length,
  events: d.events.length,
  scenes: d.sceneTexts.length,
  words: d.sceneTexts.reduce((n, s) => n + s.wordCount, 0),
  bytes: Buffer.byteLength(json),
});
