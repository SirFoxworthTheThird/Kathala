import assert from "node:assert/strict";
import { buildSceneDrafts } from "./full-scene-drafts.mjs";

export const sceneTitles = [
  [
    "A Restless Son in York",
    "The Counsel of the Middle Station",
    "Crusoe’s First Storm",
    "The Wreck at Yarmouth Roads",
    "Shame Bars the Road Home",
  ],
  [
    "The Guinea Trade",
    "A Captive at Sallee",
    "Crusoe and Xury Escape",
    "South Along the African Coast",
    "The Lion and the Longboat",
  ],
  [
    "Trade Along the African Shore",
    "Rescue by the Portuguese Captain",
    "A Plantation in Brazil",
    "The Slaving Voyage Proposed",
    "The Atlantic Storm",
    "The Ship Breaks on the Sandbank",
  ],
  [
    "The Wreck Lies Within Reach",
    "The First Raft",
    "Salvaging the Wreck",
    "The Fortified Habitation",
    "Powder, Hunting, and Despair",
    "The Calendar and the Balance Sheet",
    "A Solitary Household Takes Shape",
  ],
  [
    "The Journal Begins",
    "Tools, Furniture, and Fortification",
    "Providential Grain",
    "Earthquake and Hurricane",
  ],
  [
    "The Last Salvage and the Turtle",
    "Fever and a Terrible Dream",
    "Tobacco, Scripture, and Recovery",
    "A Changed Understanding of Deliverance",
  ],
  [
    "The Fertile Interior",
    "The Country Bower",
    "A Year on the Island",
    "Learning the Seasons and the Harvest",
  ],
  [
    "Across the Island",
    "Lost on the Return Journey",
    "Solitude Reconsidered",
    "Protecting and Harvesting the Corn",
  ],
  [
    "Fire-Hardened Pottery",
    "Bread from First Principles",
    "The Great Canoe That Cannot Move",
    "Four Years and a New Contentment",
    "Clothes, Ink, and Diminishing Stores",
  ],
  [
    "The Perilous Coastal Voyage",
    "The Voice at the Bower",
    "Years of Quiet Industry",
    "A Tame Herd Replaces Powder",
  ],
  [
    "Crusoe Circles His Island",
    "Crusoe’s Island Kingdom",
    "The Footprint",
    "Fear and Doubt",
    "The Castle Hidden in a Grove",
  ],
  [
    "A Secret Goat Pasture",
    "The Cannibal Shore",
    "An Ambush Imagined",
    "The Plan of Ambush Rejected",
    "The Cave Behind the Rock",
  ],
  ["Cannibals Return", "Guns from a Ship in Distress", "The Spanish Wreck"],
  [
    "Restlessness After the Spanish Wreck",
    "A Dream of Rescue",
    "A Plan and a Long Vigil",
    "Friday Runs for His Life",
    "The Rescue and Naming of Friday",
    "A Place for the New Companion",
  ],
  [
    "Friday Learns the Household",
    "Friday’s Country and Captivity",
    "Questions of Faith",
    "The Bearded Men Across the Sea",
    "Trust Restored",
  ],
  [
    "A Boat for the Continent",
    "Canoes on the Shore",
    "The Attack on the Cannibals",
    "Friday Finds His Father",
    "Four Subjects in the Island Kingdom",
  ],
  [
    "Preparing to Rescue the Spaniards",
    "The Envoys Depart",
    "An English Ship Appears",
    "The Marooned Captain",
    "The First Mutineers Defeated",
  ],
  [
    "The Second Boat Comes Ashore",
    "The Search Party Is Divided",
    "The Mutineers Drawn Apart",
    "The Boatswain Surrenders",
    "The Captain Retakes His Ship",
    "The Island’s New Colonists",
  ],
  [
    "Farewell to the Island",
    "The Brazilian Fortune Restored",
    "Crusoe Orders His Affairs",
    "The Overland Journey Begins",
    "Wolves in the Pyrenees",
    "Friday Faces a Bear",
  ],
  [
    "Friday’s Contest with the Bear",
    "The Wolf Pack",
    "Home and Settlement",
    "A Later Visit to the Island",
    "Toward the Second Part",
  ],
];

const drafts = buildSceneDrafts();
assert.equal(sceneTitles.length, 20);
for (const [chapterIndex, titles] of sceneTitles.entries()) {
  const count = drafts.filter(
    (draft) => draft.chapterNumber === chapterIndex + 1,
  ).length;
  assert.equal(
    titles.length,
    count,
    `Scene-title count differs in chapter ${chapterIndex + 1}`,
  );
}
export const manuscriptScenes = drafts.map((draft) => ({
  ...draft,
  title: sceneTitles[draft.chapterNumber - 1][draft.sceneIndex],
  wordCount: (draft.text.match(/\S+/g) ?? []).length,
}));
assert.equal(
  manuscriptScenes.reduce((total, scene) => total + scene.wordCount, 0),
  120_687,
);
