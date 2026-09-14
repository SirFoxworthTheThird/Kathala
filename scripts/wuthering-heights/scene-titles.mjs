import assert from "node:assert/strict";
import { chapterDrafts } from "./full-scene-drafts.mjs";

export const sceneTitles = new Map([
  [
    1,
    [
      "Lockwood Calls on His Landlord",
      "The Weathered House on the Heights",
      "Inside the House",
      "A Fellow Misanthropist",
      "The Dogs Attack",
      "A Second Visit Promised",
    ],
  ],
  [
    2,
    [
      "A Snowbound Return",
      "The Silent Young Mistress",
      "Heathcliff Comes In",
      "Mistaken Kinships",
      "The Household Named",
      "No Guide Through the Snow",
      "The Stolen Lantern",
      "Dogs at the Doorstone",
    ],
  ],
  [
    3,
    [
      "Zillah's Forbidden Chamber",
      "Catherine's Names and Diary",
      "The Chapel Nightmare",
      "A Child at the Window",
      "Heathcliff Answers the Cry",
      "Catherine's Name Spoken",
      "A Plea to the Ghost",
      "Morning at the Hearth",
      "Across the Buried Moor",
      "Lockwood Returns Ill",
    ],
  ],
  [
    4,
    [
      "Lockwood Asks for the Family History",
      "The Tangled Houses Explained",
      "Nelly Begins Her Account",
      "Mr Earnshaw Brings Home a Foundling",
      "Heathcliff Takes His Place",
      "The Boys' Enmity Hardens",
    ],
  ],
  [
    5,
    [
      "Mr Earnshaw Declines",
      "Hindley Is Sent Away",
      "Catherine and Heathcliff Under Joseph",
      "Death by the Hearth",
    ],
  ],
]);

for (const [chapterNumber, titles] of sceneTitles) {
  assert.equal(
    titles.length,
    chapterDrafts.filter((draft) => draft.chapterNumber === chapterNumber)
      .length,
    `Title count does not match chapter ${chapterNumber} drafts`,
  );
}

export const titledDrafts = chapterDrafts.map((draft) => ({
  ...draft,
  title:
    sceneTitles.get(draft.chapterNumber)?.[draft.sceneIndex] ??
    `Chapter ${draft.chapterNumber}, provisional scene`,
}));
