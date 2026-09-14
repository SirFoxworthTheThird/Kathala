import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { narrativeText } from "./source-text.mjs";

const examplePath = "example/The Prisoner of Zenda.pwk";
const libraryPath = "public/library/the-prisoner-of-zenda.pwk";
const exampleBytes = fs.readFileSync(examplePath);
const libraryBytes = fs.readFileSync(libraryPath);
assert(exampleBytes.equals(libraryBytes), "Example and library copies differ");
const data = JSON.parse(exampleBytes);
const ids = (records) => new Set(records.map(({ id }) => id));
const characterIds = ids(data.characters);
const eventIds = ids(data.events);
const locationIds = ids(data.locationMarkers);
const mapIds = ids(data.mapLayers);
const itemIds = ids(data.items);
const blobIds = ids(data.blobs);

assert.equal(data.chapters.length, 22);
assert.equal(data.events.length, 55);
assert.equal(data.events.length, data.sceneTexts.length);
assert.equal(data.sceneTexts.map(({ text }) => text).join("\n\n"), narrativeText, "Manuscript is not lossless");
assert.equal(data.sceneTexts.reduce((n, scene) => n + scene.wordCount, 0), 53408);
assert.equal(data.timelines.length, 1);
assert.equal(data.world.readingMode, true);
assert.equal(data.world.theme, "theme-adventure");

for (const event of data.events) {
  assert(locationIds.has(event.locationMarkerId), `Missing event location: ${event.id}`);
  assert(event.tension >= 1 && event.tension <= 5, `Tension outside 1–5: ${event.id}`);
  assert(Number.isInteger(event.inWorldTime), `Calendar day is not whole: ${event.id}`);
  assert(event.travelDays >= 0, `Negative elapsed time: ${event.id}`);
  assert(event.involvedCharacterIds.every((id) => characterIds.has(id)));
  assert(event.involvedItemIds.every((id) => itemIds.has(id)));
  const snapshots = data.characterSnapshots.filter((snapshot) => snapshot.eventId === event.id);
  assert.equal(snapshots.length, event.involvedCharacterIds.length, `Snapshot count mismatch: ${event.id}`);
  assert.deepEqual(new Set(snapshots.map(({ characterId }) => characterId)), new Set(event.involvedCharacterIds), `Snapshot presence mismatch: ${event.id}`);
  assert.equal(new Set(snapshots.map(({ statusNotes }) => statusNotes)).size, snapshots.length, `Repeated statuses inside ${event.id}`);
  assert(snapshots.every(({ statusNotes }) => statusNotes.length >= 40), `Thin state in ${event.id}`);
}
for (const snapshot of data.characterSnapshots) {
  assert(characterIds.has(snapshot.characterId));
  assert(eventIds.has(snapshot.eventId));
  assert(locationIds.has(snapshot.currentLocationMarkerId));
  assert(mapIds.has(snapshot.currentMapLayerId));
  assert(!/ongoing context|state carried|not yet directly involved/i.test(snapshot.statusNotes));
}
for (const character of data.characters) {
  const history = data.characterSnapshots.filter(({ characterId }) => characterId === character.id);
  assert(history.length, `Character never present: ${character.name}`);
  assert(history.every((snapshot, i) => i === 0 || snapshot.sortKey > history[i - 1].sortKey), `History order: ${character.name}`);
  assert(blobIds.has(character.portraitImageId));
}
for (const location of data.locationMarkers) {
  assert(mapIds.has(location.mapLayerId));
  assert(blobIds.has(location.imageId));
  assert(location.x >= 0 && location.x <= 1536 && location.y >= 0 && location.y <= 1024, `Marker out of bounds: ${location.name}`);
  assert(location.description.length >= 70, `Thin location description: ${location.name}`);
}
for (const layer of data.mapLayers) {
  assert(blobIds.has(layer.imageId));
  const gateways = data.locationMarkers.filter(({ linkedMapLayerId }) => linkedMapLayerId === layer.id);
  assert.equal(gateways.length, layer.parentMapId ? 1 : 0, `Gateway invariant: ${layer.name}`);
}
for (const route of data.mapRoutes) {
  assert(Array.isArray(route.waypoints), `Route waypoints missing: ${route.id}`);
  assert(route.waypoints.every((id) => locationIds.has(id)));
}
for (const relationship of data.relationships) {
  assert(characterIds.has(relationship.characterAId));
  assert(characterIds.has(relationship.characterBId));
  assert(eventIds.has(relationship.createdAtEventId));
}

const missingAssets = [];
const hashes = new Map();
for (const blob of data.blobs) {
  assert(!blob.url.startsWith("/"), `Asset URL must be library-relative: ${blob.url}`);
  const assetPath = path.join("public", blob.url);
  if (!fs.existsSync(assetPath)) {
    missingAssets.push(assetPath);
    continue;
  }
  const bytes = fs.readFileSync(assetPath);
  assert(bytes.length > 100_000, `Suspiciously small asset: ${assetPath}`);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  assert(!hashes.has(hash), `Duplicate asset bytes: ${assetPath} and ${hashes.get(hash)}`);
  hashes.set(hash, assetPath);
}
if (missingAssets.length && !process.argv.includes("--structure-only")) {
  throw new Error(`Missing ${missingAssets.length} required assets:\n${missingAssets.join("\n")}`);
}

const index = JSON.parse(fs.readFileSync("public/library/index.json"));
const entry = index.entries.find(({ id }) => id === "the-prisoner-of-zenda");
assert(entry, "Catalogue entry missing");
assert.equal(entry.dataBytes, libraryBytes.length);
assert.deepEqual(entry.counts, { characters: data.characters.length, chapters: data.chapters.length, events: data.events.length, locations: data.locationMarkers.length });
assert.equal(entry.cover, data.blobs.find(({ id }) => id === data.world.coverImageId).url);

console.log({ chapters: 22, events: 55, words: 53408, snapshots: data.characterSnapshots.length, maps: data.mapLayers.length, locations: data.locationMarkers.length, assets: data.blobs.length, missingAssets: missingAssets.length, lossless: true });
