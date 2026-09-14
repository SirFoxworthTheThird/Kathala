import assert from "node:assert/strict";
import { eventDetails } from "./event-details.mjs";

const day = (year, month = 1, date = 1) =>
  Math.floor(
    (Date.UTC(year, month - 1, date) - Date.UTC(1632, 0, 1)) / 86_400_000,
  );
const chapterStarts = {
  1: day(1632),
  2: day(1651, 9, 20),
  3: day(1654, 9),
  4: day(1659, 9, 30),
  5: day(1659, 9, 30),
  6: day(1660, 5, 1),
  7: day(1660, 7, 15),
  8: day(1661, 9, 1),
  9: day(1662, 1, 1),
  10: day(1665, 11, 6),
  11: day(1674, 1, 1),
  12: day(1676, 1, 1),
  13: day(1682, 12, 1),
  14: day(1683, 3, 1),
  15: day(1684, 1, 1),
  16: day(1686, 1, 1),
  17: day(1686, 10, 1),
  18: day(1686, 12, 10),
  19: day(1686, 12, 19),
  20: day(1687, 12, 1),
};
const chapterSpans = {
  1: 7_190,
  2: 1_070,
  3: 1_855,
  4: 180,
  5: 214,
  6: 75,
  7: 410,
  8: 365,
  9: 1_400,
  10: 3_000,
  11: 730,
  12: 2_500,
  13: 455,
  14: 670,
  15: 730,
  16: 270,
  17: 70,
  18: 9,
  19: 347,
  20: 2_600,
};
const exactDays = {
  "A Restless Son in York": day(1632, 1, 1),
  "The Counsel of the Middle Station": day(1650, 9, 1),
  "Crusoe’s First Storm": day(1651, 9, 1),
  "The Wreck at Yarmouth Roads": day(1651, 9, 6),
  "Shame Bars the Road Home": day(1651, 9, 8),
  "The Ship Breaks on the Sandbank": day(1659, 9, 30),
  "The Wreck Lies Within Reach": day(1659, 10, 1),
  "Farewell to the Island": day(1686, 12, 19),
  "Home and Settlement": day(1687, 6, 11),
  "A Later Visit to the Island": day(1694, 1, 1),
};

let previous = 0;
export const chronologicalEvents = eventDetails.map((event) => {
  const siblings = eventDetails.filter(
    (candidate) => candidate.chapterNumber === event.chapterNumber,
  );
  const index = siblings.indexOf(event);
  const estimated = Math.round(
    chapterStarts[event.chapterNumber] +
      (chapterSpans[event.chapterNumber] * index) /
        Math.max(1, siblings.length - 1),
  );
  const at = exactDays[event.title] ?? estimated;
  const inWorldTime = Math.max(previous, at);
  const travelDays = Math.max(0, inWorldTime - previous);
  previous = inWorldTime;
  return { ...event, inWorldTime, travelDays };
});
assert(
  chronologicalEvents.every(
    (event, index) =>
      event.travelDays >= 0 &&
      (!index ||
        event.inWorldTime >= chronologicalEvents[index - 1].inWorldTime),
  ),
);
