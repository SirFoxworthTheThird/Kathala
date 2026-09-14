import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSceneDrafts, sourceChapters } from "./full-scene-drafts.mjs";
const ep = "example/The Lost World.pwk",
  lp = "public/library/the-lost-world.pwk",
  d = JSON.parse(fs.readFileSync(ep, "utf8"));
assert.equal(d.chapters.length, 16);
assert.equal(d.events.length, 32);
const C = {
  malone: "lost-world-character-malone",
  challenger: "lost-world-character-challenger",
  summerlee: "lost-world-character-summerlee",
  roxton: "lost-world-character-roxton",
  zambo: "lost-world-character-zambo",
};
const all = [C.malone, C.challenger, C.summerlee, C.roxton];
const revisions = {
  "lost-world-event-stegosaurs": [
    "The Iguanodon Glade",
    "The explorers follow enormous tracks into a glade and become the first modern witnesses of living iguanodons.",
    all,
  ],
  "lost-world-event-first-survey": [
    "The Pterodactyl Rookery",
    "The explorers enter a volcanic pit crowded with pterodactyls and barely escape the enraged colony.",
    all,
  ],
  "lost-world-event-camp-attack": [
    "The Camp in Peril",
    "A great carnivorous dinosaur attacks Fort Challenger at night until Roxton drives it away with a burning branch.",
    all,
  ],
  "lost-world-event-night-march": [
    "Malone Surveys the Plateau",
    "Malone climbs the great gingko, encounters an ape-man, and maps the plateau from above.",
    [C.malone],
  ],
  "lost-world-event-pterodactyl-rookery": [
    "Malone’s Night Journey",
    "Malone secretly crosses the forest to Lake Gladys, observes its nocturnal life, and survives pursuit by a great predator.",
    [C.malone],
  ],
  "lost-world-event-ape-capture": [
    "Malone Returns to an Empty Camp",
    "Malone returns at dawn to find Fort Challenger wrecked and his companions missing, then arranges with Zambo to send his account home.",
    [C.malone, C.zambo],
  ],
  "lost-world-event-rescue": [
    "Malone and Roxton Strike Back",
    "Malone finds Roxton and together they rescue Challenger, Summerlee, and four plateau people from the ape-men.",
    all,
  ],
  "lost-world-event-ape-war": [
    "Refuge with the Plateau People",
    "The rescued party reaches the plateau people's caves and agrees to help them resist the ape-men.",
    all,
  ],
  "lost-world-event-lake-expedition": [
    "The Alliance Advances",
    "The explorers and their plateau allies march from the caves toward the ape-men's territory.",
    all,
  ],
  "lost-world-event-diamond-clay": [
    "The Battle for the Plateau",
    "Rifles and native spears break the ape-men's attack and end their domination of Maple White Land.",
    all,
  ],
  "lost-world-event-escape-route": [
    "Those Were the Real Conquests",
    "With the plateau people as guides, the expedition studies the land, its inhabitants, and its surviving prehistoric life.",
    all,
  ],
  "lost-world-event-zambo-reunion": [
    "The Hidden Tunnel",
    "A native diagram leads the explorers through a concealed tunnel and down to their faithful campkeeper Zambo.",
    [...all, C.zambo],
  ],
};
for (const [id, [title, description, involvedCharacterIds]] of Object.entries(
  revisions,
)) {
  const event = d.events.find((candidate) => candidate.id === id);
  assert(event, id);
  Object.assign(event, { title, description, involvedCharacterIds });
}
// Chapter XI opens with the attack on the camp and only then turns to the
// daytime survey and Malone's climb of the gingko.
d.events.find(
  (event) => event.id === "lost-world-event-camp-attack",
).sortOrder = 0;
d.events.find(
  (event) => event.id === "lost-world-event-night-march",
).sortOrder = 1;
for (const chapter of d.chapters) {
  const chapterEvents = d.events.filter(
    (event) => event.chapterId === chapter.id,
  );
  chapterEvents.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  chapterEvents.forEach((event, index) => {
    event.sortOrder = index;
  });
}
const groups = d.chapters.map((c) =>
  d.events
    .filter((e) => e.chapterId === c.id)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
);
const places = {
  "lost-world-event-stegosaurs": "lost-world-location-stegosaurus-pool",
  "lost-world-event-first-survey": "lost-world-location-pterodactyl-swamp",
  "lost-world-event-camp-attack": "lost-world-location-summit-camp",
  "lost-world-event-night-march": "lost-world-location-forest-lookout",
  "lost-world-event-pterodactyl-rookery": "lost-world-location-central-lake",
  "lost-world-event-ape-capture": "lost-world-location-summit-camp",
  "lost-world-event-rescue": "lost-world-location-ape-town",
  "lost-world-event-ape-war": "lost-world-location-indian-caves",
  "lost-world-event-lake-expedition": "lost-world-location-indian-caves",
  "lost-world-event-diamond-clay": "lost-world-location-ape-town",
  "lost-world-event-escape-route": "lost-world-location-central-lake",
  "lost-world-event-zambo-reunion": "lost-world-location-escape-tunnel",
};
const state = {
  "lost-world-event-stegosaurs": {
    malone: "records the living iguanodons in astonishment",
    challenger: "sees his disputed claims vindicated",
    summerlee: "accepts the evidence before him",
    roxton: "restrains his hunter's instinct to preserve secrecy",
  },
  "lost-world-event-first-survey": {
    malone: "escapes the rookery bruised and shaken",
    challenger: "provokes the colony while pursuing evidence",
    summerlee: "observes the pterodactyls at dangerously close range",
    roxton: "covers the party's retreat from the pit",
  },
  "lost-world-event-camp-attack": {
    malone: "holds position inside the threatened camp",
    challenger: "faces the predator behind the thorn barrier",
    summerlee: "survives the nocturnal assault",
    roxton: "drives the predator away with fire",
  },
  "lost-world-event-night-march": {
    malone: "maps the plateau from the gingko after meeting an ape-man",
  },
  "lost-world-event-pterodactyl-rookery": {
    malone: "returns from Lake Gladys exhausted after escaping a predator",
  },
  "lost-world-event-ape-capture": {
    malone: "finds the camp wrecked and sends his record for help",
    zambo: "remains below the cliffs and undertakes to dispatch the manuscript",
  },
  "lost-world-event-rescue": {
    malone: "fires from concealment to save the prisoners",
    roxton: "leads the armed rescue",
    challenger: "escapes execution and reaches his rescuers",
    summerlee: "is pulled away moments before execution",
  },
  "lost-world-event-ape-war": {
    malone: "reaches refuge among the plateau people",
    challenger: "agrees to aid their resistance",
    summerlee: "reluctantly accepts the alliance",
    roxton: "commits himself to defeating the ape-men",
  },
  "lost-world-event-lake-expedition": {
    malone: "marches with the allied force",
    challenger: "advances confidently beside the plateau people",
    summerlee: "joins the expedition despite his misgivings",
    roxton: "helps direct the allied advance",
  },
  "lost-world-event-diamond-clay": {
    malone: "supports the rifle line during the decisive battle",
    challenger: "fires on the attacking ape-men",
    summerlee: "takes part in the defense",
    roxton: "directs the gunfire that breaks the attack",
  },
  "lost-world-event-escape-route": {
    malone: "documents the expedition's peaceful survey",
    challenger: "collects specimens across the plateau",
    summerlee: "conducts sustained scientific fieldwork",
    roxton: "ranges independently and guards a private discovery",
  },
  "lost-world-event-zambo-reunion": {
    malone: "finds the moonlit exit and descends",
    challenger: "brings his specimens through the tunnel",
    summerlee: "emerges convinced that escape is possible",
    roxton: "guides the retreat through the caves",
    zambo: "welcomes the expedition back below the cliffs",
  },
};
const revisedIds = new Set(Object.keys(revisions));
d.characterSnapshots = (d.characterSnapshots ?? []).filter(
  (snapshot) => !revisedIds.has(snapshot.eventId),
);
let globalOrder = 0;
for (const event of groups.flat()) {
  if (!revisedIds.has(event.id)) {
    globalOrder++;
    continue;
  }
  event.involvedCharacterIds.forEach((characterId, characterOrder) => {
    const key = Object.entries(C).find(([, id]) => id === characterId)?.[0];
    const locationId =
      event.id === "lost-world-event-ape-capture" && characterId === C.zambo
        ? "lost-world-location-base-camp"
        : places[event.id];
    const marker = d.locationMarkers.find(
      (candidate) => candidate.id === locationId,
    );
    assert(marker && state[event.id]?.[key]);
    d.characterSnapshots.push({
      worldId: d.world.id,
      createdAt: d.world.updatedAt,
      updatedAt: d.world.updatedAt,
      id: `${event.id}-snapshot-${key}`,
      characterId,
      eventId: event.id,
      sortKey: globalOrder * 10000 + characterOrder,
      isAlive: true,
      currentLocationMarkerId: marker.id,
      currentMapLayerId: marker.mapLayerId,
      inventoryItemIds: [],
      inventoryNotes: "",
      statusNotes: state[event.id][key],
      travelModeId: null,
    });
  });
  globalOrder++;
}
const { sceneDrafts, anchors } = buildSceneDrafts(groups),
  events = groups.flat();
d.sceneTexts = events.map((e, i) => ({
  id: `lost-world-scene-${String(i + 1).padStart(3, "0")}`,
  worldId: d.world.id,
  eventId: e.id,
  text: sceneDrafts[i],
  wordCount: (sceneDrafts[i].match(/\S+/g) ?? []).length,
  createdAt: d.world.updatedAt,
  updatedAt: d.world.updatedAt,
}));
const lore = d.lorePages?.find((p) =>
  /source|artwork|edition/i.test(`${p.title} ${p.body}`),
);
if (lore)
  lore.body =
    "The manuscript contains the complete narrative text of Project Gutenberg eBook #139 across all 16 chapters. Gutenberg packaging, contents, foreword, and front matter are excluded. Maps and illustrations are documented separately in this page.";
const text = `${JSON.stringify(d, null, 2)}\n`;
fs.writeFileSync(ep, text);
fs.writeFileSync(lp, text);
const idx = JSON.parse(fs.readFileSync("public/library/index.json", "utf8")),
  entry = idx.entries.find((x) => x.id === "the-lost-world");
assert(entry);
entry.dataBytes = Buffer.byteLength(text);
entry.notice =
  "Unofficial reading-mode reference for a public-domain novel. The manuscript contains the complete narrative text of Project Gutenberg eBook #139 across all 16 chapters; Gutenberg packaging and front matter are excluded. Linked maps and public-domain illustrations are recorded in Lore.";
fs.writeFileSync(
  "public/library/index.json",
  `${JSON.stringify(idx, null, 2)}\n`,
);
console.log({
  chapters: sourceChapters.length,
  events: d.events.length,
  scenes: d.sceneTexts.length,
  words: d.sceneTexts.reduce((n, x) => n + x.wordCount, 0),
});
for (const a of anchors)
  console.log(`${a.chapter}: ${a.event} <- ${a.paragraph}: ${a.excerpt}`);
