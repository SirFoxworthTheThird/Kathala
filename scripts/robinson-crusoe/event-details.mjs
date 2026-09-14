import assert from "node:assert/strict";
import { sceneMetadata } from "./scene-metadata.mjs";

// Original structural summaries. The public-domain prose remains exclusively in
// scene drafts; these descriptions explain the modeled beat in fresh language.
const D = {
  "A Restless Son in York":
    "Crusoe recalls his family, education, and the wandering ambition that makes an ordinary settled life intolerable to him.",
  "The Counsel of the Middle Station":
    "His father argues that security and contentment lie between poverty and greatness, but Crusoe cannot surrender his desire for the sea.",
  "Crusoe’s First Storm":
    "Crusoe secretly sails from Hull, panics in rough weather, vows to return home, and abandons that promise as soon as the sea grows calm.",
  "The Wreck at Yarmouth Roads":
    "A violent gale dismasts and floods the ship; its company escapes by boat moments before the vessel founders.",
  "Shame Bars the Road Home":
    "Although the disaster confirms his father's warning, Crusoe travels to London because he is too ashamed to return to York.",
  "The Guinea Trade":
    "An honest captain teaches Crusoe navigation and commerce on a profitable voyage to the Guinea coast.",
  "A Captive at Sallee":
    "On a second voyage Crusoe is captured by a Sallee rover and spends two years serving its captain while watching for escape.",
  "Crusoe and Xury Escape":
    "When entrusted with a fishing boat, Crusoe throws the Moor overboard and flees south with Xury and concealed provisions.",
  "South Along the African Coast":
    "Crusoe and Xury avoid the shore by night, seek water by day, and pass a coast alive with unfamiliar animals and people.",
  "The Lion and the Longboat":
    "The fugitives shoot a lion near their anchorage and preserve its hide while continuing south.",
  "Trade Along the African Shore":
    "Friendly coastal inhabitants exchange food and water with the boat after Crusoe kills a threatening beast for them.",
  "Rescue by the Portuguese Captain":
    "A Portuguese ship takes Crusoe and Xury aboard; its generous captain buys the boat and agrees to free Xury after faithful service.",
  "A Plantation in Brazil":
    "Crusoe establishes a Brazilian sugar plantation and slowly prospers with help from the Portuguese captain and his neighbour Wells.",
  "The Slaving Voyage Proposed":
    "Neighbouring planters ask Crusoe to obtain enslaved labourers in Guinea, offering him an equal share of the expedition without capital.",
  "The Atlantic Storm":
    "The expedition is driven north and west by successive storms, losing men as it searches for a route toward English settlements.",
  "The Ship Breaks on the Sandbank":
    "The vessel strikes offshore shoals; the escape boat overturns in the surf and Crusoe alone reaches land alive.",
  "The Wreck Lies Within Reach":
    "At daylight Crusoe discovers the grounded ship has moved close enough to reach at low tide.",
  "The First Raft":
    "He constructs a raft from spars, loads arms, food, tools, and clothing, and fights the tide to land the cargo safely.",
  "Salvaging the Wreck":
    "Repeated raft journeys strip the stranded ship of everything that might sustain a solitary life before it breaks apart.",
  "The Fortified Habitation":
    "Crusoe chooses a dry site beneath a rock, raises a concealed palisade, and carries his stores into the new fortress.",
  "Powder, Hunting, and Despair":
    "Fear of lightning makes him disperse the gunpowder while hunting and sober reflection expose both the danger and advantages of his position.",
  "The Calendar and the Balance Sheet":
    "Crusoe marks time on a post and writes a paired account of every misery and corresponding mercy in his condition.",
  "A Solitary Household Takes Shape":
    "He arranges his cave, makes crude furniture, and begins the journal that records his labour and changing mind.",
  "The Journal Begins":
    "The journal revisits the landing, salvage voyages, choice of shelter, and early construction in dated entries.",
  "Tools, Furniture, and Fortification":
    "Crusoe improvises tools, enlarges the cave, orders his stores, and completes the defensive wall around his home.",
  "Providential Grain":
    "Discarded seed unexpectedly sprouts into barley and rice, giving Crusoe the foundation of future harvests.",
  "Earthquake and Hurricane":
    "An earthquake threatens to bury the habitation, followed by a hurricane that forces Crusoe to reconsider where he lives.",
  "The Last Salvage and the Turtle":
    "Crusoe recovers timber and iron from the wreck until the sea destroys it, then adds turtle meat and eggs to his provisions.",
  "Fever and a Terrible Dream":
    "A severe ague leaves Crusoe helpless and delirious, confronting him with death and the moral course of his past life.",
  "Tobacco, Scripture, and Recovery":
    "He combines tobacco remedies with his first earnest prayer and Bible reading, and the fever finally breaks.",
  "A Changed Understanding of Deliverance":
    "Recovery leads Crusoe to seek freedom from guilt rather than merely escape from the island.",
  "The Fertile Interior":
    "Exploring inland, Crusoe discovers a lush valley of grapes, melons, cocoa, and citrus far richer than the coast.",
  "The Country Bower":
    "He builds a second sheltered dwelling in the fruitful interior while deciding not to abandon the safer coastal castle.",
  "A Year on the Island":
    "On the first anniversary of the wreck, Crusoe fasts, reflects, and accepts the island's repeating wet and dry seasons.",
  "Learning the Seasons and the Harvest":
    "Failed sowings teach him the local calendar; successful barley and rice create the practical problem of processing grain.",
  "Across the Island":
    "A longer survey reaches the opposite shore, where distant mainland hills and abundant turtles revive thoughts of escape.",
  "Lost on the Return Journey":
    "Crusoe loses his bearings in the island's wooded interior before finding the familiar bower and castle again.",
  "Solitude Reconsidered":
    "Scripture and the order of his household lead Crusoe to compare present peace with the restless life he pursued before the wreck.",
  "Protecting and Harvesting the Corn":
    "He fences the crop against goats and frightens birds away, then harvests every ear with improvised tools.",
  "Fire-Hardened Pottery":
    "After repeated failures, Crusoe discovers how to fire clay vessels strongly enough to hold liquids and withstand cooking heat.",
  "Bread from First Principles":
    "He invents a mortar, sieve, and oven so that his carefully grown grain can finally become bread.",
  "The Great Canoe That Cannot Move":
    "Crusoe spends months hollowing an enormous cedar only to discover that he cannot transport it to the water.",
  "Four Years and a New Contentment":
    "The useless canoe teaches him to count means before beginning; reflection makes his limited island wealth feel sufficient.",
  "Clothes, Ink, and Diminishing Stores":
    "As shipboard supplies decay, Crusoe stretches his ink, sews goatskin clothing, and constructs an umbrella.",
  "The Perilous Coastal Voyage":
    "A smaller canoe carries Crusoe around the island until an offshore current sweeps him toward open sea and nearly prevents his return.",
  "The Voice at the Bower":
    "Exhausted after regaining land, Crusoe wakes to a voice calling his name and discovers that Poll has learned his familiar phrases.",
  "Years of Quiet Industry":
    "Crusoe settles into years of worship, husbandry, basketry, pottery, and maintenance without a new external crisis.",
  "A Tame Herd Replaces Powder":
    "With ammunition dwindling, he traps and domesticates goats until meat and milk no longer depend on the gun.",
  "Crusoe Circles His Island":
    "Dressed in goatskins, Crusoe uses his knowledge of the tides to bring the canoe safely around the island.",
  "Crusoe’s Island Kingdom":
    "He surveys the castle, fields, bower, herds, and stores that now form a self-sufficient domain.",
  "The Footprint":
    "A single naked footprint on an empty beach destroys Crusoe's certainty that the island belongs to him alone.",
  "Fear and Doubt":
    "Crusoe retreats to the castle, debates every possible origin of the print, and lets fear overwhelm his confidence.",
  "The Castle Hidden in a Grove":
    "He strengthens the entrance and plants dense living defences until the habitation disappears behind trees.",
  "A Secret Goat Pasture":
    "To protect his food supply from discovery, Crusoe divides the herd and establishes a concealed enclosure.",
  "The Cannibal Shore":
    "At the south-west point he finds human bones and fire remains, confirming that visiting parties kill captives there.",
  "An Ambush Imagined":
    "Horror hardens into elaborate plans to destroy the next landing party from a concealed lookout.",
  "The Plan of Ambush Rejected":
    "Crusoe concludes that he has no authority to execute strangers for customs committed outside his society.",
  "The Cave Behind the Rock":
    "While seeking a safer retreat, he discovers and equips a deep hidden cave for himself and vital stores.",
  "Cannibals Return":
    "A new landing revives Crusoe's rage and vigilance, but the visitors depart before he acts.",
  "Guns from a Ship in Distress":
    "Distant cannon signal a vessel in danger, and Crusoe lights a beacon that cannot prevent its wreck.",
  "The Spanish Wreck":
    "He reaches the stranded Spanish ship, finds its crew dead, and recovers cargo while mourning lost companionship.",
  "Restlessness After the Spanish Wreck":
    "Recovered stores improve Crusoe's circumstances but renew his dangerous longing for the mainland.",
  "A Dream of Rescue":
    "A vivid dream in which a prisoner runs to his protection suggests a possible companion and route of escape.",
  "A Plan and a Long Vigil":
    "Crusoe resolves to rescue a captive from a future landing and watches the coast for more than a year.",
  "Friday Runs for His Life":
    "One of two prisoners breaks free, crosses the creek, and runs toward Crusoe's concealment.",
  "The Rescue and Naming of Friday":
    "Crusoe and the fugitive defeat his pursuers; the rescued man pledges loyalty and receives the name Friday.",
  "A Place for the New Companion":
    "Crusoe feeds and clothes Friday, clears the shore, and gives him quarters near the castle.",
  "Friday Learns the Household":
    "Friday adopts cooked food, agricultural work, and the routines required to sustain two people.",
  "Friday’s Country and Captivity":
    "Growing fluency lets Friday explain his people, his capture, and the canoes used across the channel.",
  "Questions of Faith":
    "Crusoe teaches his religion while Friday's direct questions expose limits in his teacher's understanding.",
  "The Bearded Men Across the Sea":
    "Friday reveals that shipwrecked Europeans live among his people, reviving hope of collective escape.",
  "Trust Restored":
    "Crusoe mistakes Friday's joy at seeing the mainland for disloyalty, then recognizes his steadfast attachment.",
  "A Boat for the Continent":
    "Together they fell, shape, launch, mast, and provision a seaworthy canoe for the crossing.",
  "Canoes on the Shore":
    "Before departure, another landing brings prisoners—including a European and Friday's father—to the execution place.",
  "The Attack on the Cannibals":
    "Crusoe and Friday open fire, free the European captive, and scatter the surviving attackers.",
  "Friday Finds His Father":
    "The second bound prisoner proves to be Friday's father, and Friday tends him with open joy.",
  "Four Subjects in the Island Kingdom":
    "The Spaniard and Friday's father recover at the fortified home, expanding the isolated household.",
  "Preparing to Rescue the Spaniards":
    "The group increases crops and stores so newcomers will not exhaust the island's food.",
  "The Envoys Depart":
    "The Spaniard and Friday's father cross to the mainland with terms and provisions for the castaways.",
  "An English Ship Appears":
    "Before they return, an English vessel anchors offshore and sends a boat carrying three bound prisoners.",
  "The Marooned Captain":
    "Crusoe learns of the mutiny and offers to restore the ship in exchange for passage to England.",
  "The First Mutineers Defeated":
    "The freed captain's party surprises the scattered boat crew and compels the survivors to surrender.",
  "The Second Boat Comes Ashore":
    "A larger armed party lands from the ship to find the first boat disabled and its crew missing.",
  "The Search Party Is Divided":
    "False calls draw the searchers inland while their boat is secured and their cohesion fails.",
  "The Mutineers Drawn Apart":
    "Darkness, exhaustion, and unseen voices separate the mutineers until the loyal party surrounds them.",
  "The Boatswain Surrenders":
    "After the boatswain is killed, Will Atkins and the remaining men accept quarter.",
  "The Captain Retakes His Ship":
    "A selected party boards at night, defeats the mutineer watch, and signals success with seven guns.",
  "The Island’s New Colonists":
    "Several mutineers are spared and left the island's shelters, weapons, crops, and survival instructions.",
  "Farewell to the Island":
    "After twenty-eight years, Crusoe boards the recovered ship with Friday and relics of his solitary life.",
  "The Brazilian Fortune Restored":
    "In Lisbon the Portuguese captain proves the plantation survived and restores decades of income.",
  "Crusoe Orders His Affairs":
    "Newly wealthy, Crusoe rewards old friends, provides for family, and arranges the plantation from afar.",
  "The Overland Journey Begins":
    "Uneasy about another sea voyage, Crusoe leads Friday and fellow travellers toward France by land.",
  "Wolves in the Pyrenees":
    "Winter closes the mountain route as wolves descend around the armed company.",
  "Friday Faces a Bear":
    "Friday saves the wounded guide, then deliberately draws a pursuing bear away from the road.",
  "Friday’s Contest with the Bear":
    "Friday outmanoeuvres the bear on a branch and kills it after a display of nerve.",
  "The Wolf Pack":
    "A massed wolf attack surrounds the travellers until disciplined volleys and a powder blast clear the road.",
  "Home and Settlement":
    "Back in England, Crusoe converts his fortune into a settled household, marriage, and children.",
  "A Later Visit to the Island":
    "Crusoe revisits the colony, hears how its divided settlers survived, and supplies it for permanence.",
  "Toward the Second Part":
    "He closes the first history by pointing toward later conflicts and journeys reserved for the continuation.",
};

const high = new Set([
  "The Wreck at Yarmouth Roads",
  "The Ship Breaks on the Sandbank",
  "Earthquake and Hurricane",
  "The Perilous Coastal Voyage",
  "The Footprint",
  "The Attack on the Cannibals",
  "The First Mutineers Defeated",
  "The Captain Retakes His Ship",
  "The Wolf Pack",
]);
const severe = new Set([
  "Crusoe’s First Storm",
  "Crusoe and Xury Escape",
  "The Atlantic Storm",
  "Fever and a Terrible Dream",
  "Cannibals Return",
  "Friday Runs for His Life",
  "Canoes on the Shore",
  "The Second Boat Comes Ashore",
  "The Boatswain Surrenders",
  "Wolves in the Pyrenees",
  "Friday Faces a Bear",
  "Friday’s Contest with the Bear",
]);
const quiet = new Set([
  "A Restless Son in York",
  "A Plantation in Brazil",
  "The Calendar and the Balance Sheet",
  "A Solitary Household Takes Shape",
  "The Journal Begins",
  "A Changed Understanding of Deliverance",
  "A Year on the Island",
  "Solitude Reconsidered",
  "Four Years and a New Contentment",
  "Years of Quiet Industry",
  "Crusoe’s Island Kingdom",
  "Questions of Faith",
  "Home and Settlement",
  "Toward the Second Part",
]);

export const eventDetails = sceneMetadata.map((scene) => ({
  ...scene,
  description: D[scene.title] ?? null,
  tension: high.has(scene.title)
    ? 5
    : severe.has(scene.title)
      ? 4
      : quiet.has(scene.title)
        ? 1
        : 3,
}));
assert.equal(Object.keys(D).length, 99);
assert.equal(
  eventDetails.filter((event) => event.description).length,
  99,
  "Every manuscript scene must have a curated description",
);
assert(eventDetails.every((event) => event.tension >= 1 && event.tension <= 5));
