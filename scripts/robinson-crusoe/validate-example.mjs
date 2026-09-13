import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chronologicalEvents } from "./chronology.mjs";
import { sourceChapters } from "./source-text.mjs";

const examplePath = "example/Robinson Crusoe.pwk";
const libraryPath = "public/library/robinson-crusoe.pwk";
const d = JSON.parse(fs.readFileSync(examplePath, "utf8"));
assert.deepEqual(d, JSON.parse(fs.readFileSync(libraryPath, "utf8")), "example and library export differ");
assert.equal(d.world.readingMode, true);
assert.equal(d.timelines.length, 1);
assert.equal(d.chapters.length, 20);
assert.equal(d.events.length, 99);
assert.equal(d.sceneTexts.length, 99);
assert.equal(d.sceneTexts.reduce((n, scene) => n + scene.wordCount, 0), 120687);
assert.deepEqual(d.chapters.map((chapter) => chapter.title), sourceChapters.map((chapter) => chapter.title));
assert(d.chapters.every((chapter) => chapter.synopsis.length > 80));

const ids = (items) => new Set(items.map((item) => item.id));
const eventIds = ids(d.events), markerIds = ids(d.locationMarkers), characterIds = ids(d.characters);
const blobById = new Map(d.blobs.map((blob) => [blob.id, blob]));
const mapById = new Map(d.mapLayers.map((map) => [map.id, map]));
const markerById = new Map(d.locationMarkers.map((marker) => [marker.id, marker]));
const sceneByEvent = new Map(d.sceneTexts.map((scene) => [scene.eventId, scene]));

assert(d.events.every((event) => sceneByEvent.has(event.id)));
assert(d.events.every((event) => event.tension >= 1 && event.tension <= 5));
assert(d.events.every((event) => event.travelDays >= 0 && Number.isFinite(event.inWorldTime)));
for (let i = 1; i < d.events.length; i++) assert(d.events[i].inWorldTime >= d.events[i - 1].inWorldTime);
assert(d.events.every((event) => markerIds.has(event.locationMarkerId)));

for (const map of d.mapLayers) {
  const blob = blobById.get(map.imageId);
  assert(blob, `${map.name} has no image record`);
  assert(fs.existsSync(path.join("public", blob.url)), `${map.name} image is missing: ${blob.url}`);
}
for (const marker of d.locationMarkers) {
  const map = mapById.get(marker.mapLayerId);
  assert(map, `${marker.name} references a missing map`);
  assert(marker.x >= 0 && marker.x <= map.imageWidth && marker.y >= 0 && marker.y <= map.imageHeight, `${marker.name} is outside ${map.name}`);
  const blob = blobById.get(marker.imageId);
  assert(blob && fs.existsSync(path.join("public", blob.url)), `${marker.name} illustration is missing`);
  assert(blob.mimeType === "image/jpeg" && /\/location-[^/]+\.jpg$/.test(blob.url), `${marker.name} must use a generated location illustration`);
  if (marker.linkedMapLayerId) assert(mapById.has(marker.linkedMapLayerId));
}
for (const character of d.characters) {
  const blob = blobById.get(character.portraitImageId);
  assert(blob && fs.existsSync(path.join("public", blob.url)), `${character.name} portrait is missing`);
  assert(blob.mimeType === "image/jpeg" && /\/character-[^/]+\.jpg$/.test(blob.url), `${character.name} must use a generated character illustration`);
}
for (const item of d.items) {
  const blob = blobById.get(item.imageId);
  assert(blob && fs.existsSync(path.join("public", blob.url)), `${item.name} illustration is missing`);
}
const entityImageIds = [d.world.coverImageId, ...d.characters.map((x) => x.portraitImageId), ...d.items.map((x) => x.imageId), ...d.locationMarkers.map((x) => x.imageId)];
assert.equal(new Set(entityImageIds).size, entityImageIds.length, "entity artwork must not be reused");

const expectedSnapshots = new Set();
chronologicalEvents.forEach((scene, index) => scene.cast.forEach((slug) => expectedSnapshots.add(`${d.events[index].id}|robinson-crusoe-char-${slug}`)));
assert.equal(d.characterSnapshots.length, expectedSnapshots.size);
const actualSnapshots = new Set();
for (const snapshot of d.characterSnapshots) {
  assert(eventIds.has(snapshot.eventId) && characterIds.has(snapshot.characterId));
  assert(markerIds.has(snapshot.currentLocationMarkerId));
  assert(snapshot.statusNotes.length > 90);
  assert(!/finalized|ongoing context|not yet directly involved|state carried/i.test(snapshot.statusNotes));
  actualSnapshots.add(`${snapshot.eventId}|${snapshot.characterId}`);
}
assert.deepEqual(actualSnapshots, expectedSnapshots, "snapshots do not exactly match scene presence");
for (const event of d.events) {
  const statuses = d.characterSnapshots.filter((snapshot) => snapshot.eventId === event.id).map((snapshot) => snapshot.statusNotes);
  assert.equal(new Set(statuses).size, statuses.length, `${event.title} repeats one state across characters`);
}

assert(d.relationships.length >= 10 && d.relationships.every((relationship) => eventIds.has(relationship.startEventId)));
assert(d.factions.length >= 5 && d.factionMemberships.length >= 10);
assert(d.knowledgeFacts.length >= 5 && d.knowledgeReveals.length >= 5);
assert(d.characterGoals.length >= 5 && d.characterGoals.every((goal) => goal.text.trim()));
assert.deepEqual(
  d.events.filter((event) => event.structureBeat).map((event) => event.structureBeat),
  ["hook", "inciting-incident", "plot-point-1", "midpoint", "plot-point-2", "climax", "resolution"],
);
for (const [title, characterSlug] of [
  ["The Ship Breaks on the Sandbank", "ship-crew"],
  ["The Boatswain Surrenders", "boatswain"],
]) {
  const event = d.events.find((candidate) => candidate.title === title);
  const snapshot = d.characterSnapshots.find((candidate) => candidate.eventId === event?.id && candidate.characterId === `robinson-crusoe-char-${characterSlug}`);
  assert(snapshot && snapshot.isAlive === false, `${characterSlug} must be dead in ${title}`);
}
assert(d.itemPlacements.length > 0 && d.events.some((event) => event.involvedItemIds.length > 0));
for (const route of d.mapRoutes) {
  const map = mapById.get(route.mapLayerId);
  assert(map && Array.isArray(route.waypoints) && route.waypoints.length >= 2);
  assert(route.waypoints.every((waypoint) => markerById.get(waypoint)?.mapLayerId === map.id), `${route.name} crosses map layers`);
}
assert(d.lorePages.some((page) => /complete original prose/i.test(page.body)));
assert(d.lorePages.some((page) => /Walter Paget/i.test(page.body)));

const catalogue = JSON.parse(fs.readFileSync("public/library/index.json", "utf8"));
const entry = catalogue.entries.find((candidate) => candidate.id === "robinson-crusoe");
assert(entry, "catalogue entry missing");
assert.equal(entry.dataBytes, fs.statSync(libraryPath).size);
assert.equal(entry.counts.chapters, d.chapters.length);
assert.equal(entry.counts.events, d.events.length);
assert.equal(entry.counts.characters, d.characters.length);
assert.equal(entry.counts.locations, d.locationMarkers.length);
console.log("Robinson Crusoe example validation passed", { events: d.events.length, words: 120687, snapshots: d.characterSnapshots.length, images: d.blobs.length });
