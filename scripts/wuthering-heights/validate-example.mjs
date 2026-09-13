import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { narrativeText, sourceChapters } from "./source-text.mjs";

const examplePath = "example/Wuthering Heights.pwk";
const libraryPath = "public/library/wuthering-heights.pwk";
const exampleBytes = fs.readFileSync(examplePath);
const libraryBytes = fs.readFileSync(libraryPath);
assert(exampleBytes.equals(libraryBytes), "Example and library copies differ");
const data = JSON.parse(exampleBytes);
const ids = (records) => new Set(records.map((record) => record.id));
const characterIds = ids(data.characters);
const eventIds = ids(data.events);
const locationIds = ids(data.locationMarkers);
const mapIds = ids(data.mapLayers);
const itemIds = ids(data.items);
const blobIds = ids(data.blobs);

assert.equal(data.chapters.length, 34);
assert.equal(data.events.length, data.sceneTexts.length);
assert.equal(
  data.sceneTexts.map((scene) => scene.text).join("\n\n"),
  narrativeText,
  "Manuscript is not the complete ordered narrative",
);
assert.deepEqual(
  data.sceneTexts.map((scene) => scene.wordCount),
  sourceChapters.map(
    (chapter) => (chapter.paragraphs.join(" ").match(/\S+/g) ?? []).length,
  ),
);

for (const event of data.events) {
  assert(
    locationIds.has(event.locationMarkerId),
    `Missing event location: ${event.id}`,
  );
  assert(
    event.involvedCharacterIds.every((id) => characterIds.has(id)),
    `Missing involved character: ${event.id}`,
  );
  assert(
    event.involvedItemIds.every((id) => itemIds.has(id)),
    `Missing involved item: ${event.id}`,
  );
  assert(
    event.tension >= 1 && event.tension <= 5,
    `Tension outside 1–5: ${event.id}`,
  );
  const snapshots = data.characterSnapshots.filter(
    (snapshot) => snapshot.eventId === event.id,
  );
  assert.equal(
    snapshots.length,
    event.involvedCharacterIds.length,
    `Snapshot count mismatch: ${event.id}`,
  );
  assert.deepEqual(
    new Set(snapshots.map((snapshot) => snapshot.characterId)),
    new Set(event.involvedCharacterIds),
    `Snapshot presence mismatch: ${event.id}`,
  );
  assert(
    snapshots.every((snapshot) => snapshot.statusNotes.length >= 35),
    `Thin character status: ${event.id}`,
  );
  assert.equal(
    new Set(snapshots.map((snapshot) => snapshot.statusNotes)).size,
    snapshots.length,
    `Repeated per-event statuses: ${event.id}`,
  );
}
for (const snapshot of data.characterSnapshots) {
  assert(characterIds.has(snapshot.characterId));
  assert(eventIds.has(snapshot.eventId));
  assert(locationIds.has(snapshot.currentLocationMarkerId));
  assert(mapIds.has(snapshot.currentMapLayerId));
  assert(
    !/ongoing context|not yet directly involved|state carried/i.test(
      snapshot.statusNotes,
    ),
  );
}
for (const character of data.characters) {
  const history = data.characterSnapshots.filter(
    (snapshot) => snapshot.characterId === character.id,
  );
  assert(
    history.every(
      (snapshot, index) =>
        index === 0 || snapshot.sortKey > history[index - 1].sortKey,
    ),
    `Character history is not chronological: ${character.name}`,
  );
}
for (const location of data.locationMarkers) {
  assert(mapIds.has(location.mapLayerId));
  assert(blobIds.has(location.imageId));
  assert(
    location.x >= 0 &&
      location.x <= 1536 &&
      location.y >= 0 &&
      location.y <= 1024,
  );
}
for (const map of data.mapLayers) {
  const gateways = data.locationMarkers.filter(
    (location) => location.linkedMapLayerId === map.id,
  );
  assert.equal(
    map.parentMapId ? gateways.length : 0,
    map.parentMapId ? 1 : 0,
    `Gateway invariant: ${map.name}`,
  );
  assert(blobIds.has(map.imageId));
}
for (const route of data.mapRoutes)
  assert(
    Array.isArray(route.waypoints),
    `Route waypoints missing: ${route.id}`,
  );
for (const relationship of data.relationships) {
  assert(characterIds.has(relationship.characterAId));
  assert(characterIds.has(relationship.characterBId));
  assert(eventIds.has(relationship.createdAtEventId));
}
for (const placement of data.itemPlacements) {
  assert(itemIds.has(placement.itemId));
  assert(eventIds.has(placement.eventId));
  assert(locationIds.has(placement.locationMarkerId));
}

const hashes = new Map();
for (const blob of data.blobs) {
  assert(
    !blob.url.startsWith("/"),
    `Asset URL must be library-relative: ${blob.url}`,
  );
  const assetPath = path.join("public", blob.url);
  assert(fs.existsSync(assetPath), `Missing asset: ${assetPath}`);
  const bytes = fs.readFileSync(assetPath);
  assert(bytes.length > 100_000, `Suspiciously small asset: ${assetPath}`);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  assert(
    !hashes.has(hash),
    `Duplicate asset bytes: ${assetPath} and ${hashes.get(hash)}`,
  );
  hashes.set(hash, assetPath);
}
const index = JSON.parse(fs.readFileSync("public/library/index.json"));
const entry = index.entries.find((item) => item.id === "wuthering-heights");
assert(entry, "Catalogue entry missing");
assert.equal(entry.dataBytes, libraryBytes.length);
assert.deepEqual(entry.counts, {
  characters: data.characters.length,
  chapters: data.chapters.length,
  events: data.events.length,
  locations: data.locationMarkers.length,
});
assert.equal(
  entry.cover,
  data.blobs.find((blob) => blob.id === data.world.coverImageId).url,
);

console.log({
  chapters: data.chapters.length,
  events: data.events.length,
  words: data.sceneTexts.reduce((sum, scene) => sum + scene.wordCount, 0),
  snapshots: data.characterSnapshots.length,
  assets: data.blobs.length,
  relationships: data.relationships.length,
  knowledge: data.knowledgeFacts.length,
  goals: data.characterGoals.length,
  lossless: true,
});
