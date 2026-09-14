import fs from "node:fs";
import { chapterLedger } from "./chapter-ledger.mjs";
import { eventLedger } from "./event-ledger.mjs";
import { sceneDrafts } from "./full-scene-drafts.mjs";
import { sourceEdition, sourceUrl } from "./source-text.mjs";

const W = process.env.PLOTWEAVE_WORLD_ID || "prisoner-of-zenda-world";
const now = Date.UTC(2026, 8, 14, 12);
const rec = (value) => ({ worldId: W, createdAt: now, updatedAt: now, ...value });
const id = (kind, key) => `prisoner-of-zenda-${kind}-${key}`;
const image = (key) => id("image", key);
const char = (key) => id("char", key);
const loc = (key) => id("loc", key);
const map = (key) => id("map", key);
const item = (key) => id("item", key);
const event = (n) => id("event", String(n).padStart(3, "0"));
const chapter = (n) => id("chapter", String(n).padStart(2, "0"));
const timelineId = id("timeline", "main");

export const characterDefs = [
  ["rudolf", "Rudolf Rassendyll", "An English gentleman whose Elphberg ancestry gives him the face needed to preserve Ruritania's throne."],
  ["king", "King Rudolf V", "The newly acceded King of Ruritania, impulsive and warm-hearted, whose captivity drives the rescue."],
  ["flavia", "Princess Flavia", "The King's cousin and expected bride, loved by the man who temporarily wears his crown."],
  ["sapt", "Colonel Sapt", "A blunt, fiercely loyal veteran whose audacity creates and sustains the royal impersonation."],
  ["fritz", "Fritz von Tarlenheim", "A young nobleman loyal to the King and the humane friend of Rudolf during the deception."],
  ["michael", "Duke Michael", "The King's half-brother, popular in Strelsau's old town and willing to imprison him to seize the throne."],
  ["rupert", "Rupert of Hentzau", "Michael's brilliant, amoral young follower, equally ready for murder, betrayal, or laughter."],
  ["antoinette", "Antoinette de Mauban", "A Frenchwoman drawn to Michael whose jealousy, courage, and peril make her an uncertain ally."],
  ["johann", "Johann Holf", "A castle servant coerced into carrying intelligence between the prison and Rudolf's party."],
  ["detchard", "Detchard", "An English member of Michael's Six and one of the three foreigners guarding the King."],
  ["de_gautet", "De Gautet", "A French member of Michael's Six stationed within the castle conspiracy."],
  ["bersonin", "Bersonin", "A Belgian member of Michael's Six and a close guard of the prison cell."],
  ["josef", "Josef", "The hunting-lodge servant whose loyalty makes him the first fatality of the plot."],
  ["marshal", "Marshal Strakencz", "The senior soldier charged with guarding Princess Flavia and the stability of the realm."],
  ["king_doctor", "The King's Doctor", "A physician forced to tend the captive King who sacrifices himself during the rescue."],
  ["rose", "Rose Rassendyll", "Rudolf's energetic sister-in-law, determined to direct his talents toward a respectable career."],
  ["robert", "Robert Rassendyll", "Rudolf's sober elder brother and head of the English branch of the family."],
  ["george", "George Featherly", "Rudolf's Paris friend, whose concern about his disappearance reaches the Strelsau police."],
];
const characters = characterDefs.map(([key, name, description], i) => rec({
  id: char(key), name, aliases: [], description,
  portraitImageId: image(`character-${key}`),
  color: ["#7a2f36", "#b68c4b", "#4e6682", "#53614c", "#867056", "#312f45"][i % 6],
  tags: [], isAlive: true, birthDate: null,
}));

export const mapDefs = [
  ["europe", null, "Europe", "Rudolf's route from England through Paris, Dresden, and the Alps to the imagined central-European kingdom of Ruritania."],
  ["ruritania", "europe", "Ruritania", "The kingdom contested between King Rudolf V and Duke Michael, from the western frontier to Strelsau and Zenda."],
  ["strelsau", "ruritania", "Strelsau", "The capital divided socially and politically between the King's new town and Michael's old town."],
  ["zenda", "ruritania", "Zenda District", "The wooded country around the hunting lodge, Tarlenheim's chateau, the town, and Michael's castle."],
  ["castle", "zenda", "Castle of Zenda", "The old keep, modern chateau, moat, and drawbridge where the King is secretly imprisoned."],
];
const mapLayers = mapDefs.map(([key, parent, name, description]) => rec({
  id: map(key), parentMapId: parent ? map(parent) : null, name, description,
  imageId: image(`map-${key}`), imageWidth: 1536, imageHeight: 1024,
  scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: "",
}));

export const locationDefs = [
  ["burlesdon-house", "europe", "The Rassendyll House", "The comfortable English family home where Rudolf's idle future and unusual ancestry are debated.", 210, 760],
  ["country-house", "europe", "Rudolf's Country House", "A quiet English retreat among woods and streams where Rudolf lives privately and keeps himself ready for whatever may follow Zenda.", 285, 700],
  ["paris", "europe", "Paris", "A cosmopolitan stop on Rudolf's eastward journey, alive with clubs, gossip, and continental connections.", 600, 520],
  ["dresden", "europe", "Dresden", "The Saxon city through which Rudolf travels and where later loyalty is renewed in private annual meetings.", 980, 665],
  ["tyrol", "europe", "The Tyrol", "An Alpine refuge where Rudolf recuperates before returning to ordinary English life.", 920, 340],
  ["ruritania-gateway", "europe", "Ruritania", "A small central-European kingdom reached east of Dresden and mapped in greater detail here.", 1240, 470, "ruritania"],
  ["border-station", "ruritania", "Ruritanian Frontier Station", "The customs stop where Rudolf's Elphberg face first causes official astonishment.", 185, 625],
  ["strelsau-gateway", "ruritania", "Strelsau", "The royal capital and coronation city, with the old town lying west of the palace quarter.", 1160, 745, "strelsau"],
  ["zenda-gateway", "ruritania", "Zenda District", "A wooded district fifty miles from the capital, dominated by Michael's castle and railway station.", 700, 500, "zenda"],
  ["strelsau-station", "strelsau", "Strelsau Station", "The ceremonial arrival point from which the coronation procession enters the capital.", 760, 155],
  ["old-town", "strelsau", "The Old Town", "Dense, poorer streets where Duke Michael is popular and Rudolf wins support by riding among the crowd.", 350, 665],
  ["cathedral", "strelsau", "Strelsau Cathedral", "The capital's ceremonial church where the apparent King is anointed and crowned.", 800, 535],
  ["royal-palace", "strelsau", "The Royal Palace", "The official residence where Rudolf learns kingship while guarding an identity that cannot withstand close scrutiny.", 1120, 825],
  ["flavia-residence", "strelsau", "Princess Flavia's Residence", "Flavia's guarded town house, the setting for courtship that is at once political performance and genuine love.", 1310, 520],
  ["summerhouse", "strelsau", "The Summerhouse", "A secluded garden pavilion chosen for a midnight ambush and transformed into a defensive trap.", 1120, 690],
  ["zenda-station", "zenda", "Zenda Station", "The quiet railway stop used by Rudolf before the coronation and by the conspirators travelling secretly.", 225, 180],
  ["zenda-town", "zenda", "Zenda", "The small town beneath the castle whose inn, roads, and inhabitants observe both royal hunting parties and secret manoeuvres.", 440, 600],
  ["hunting-lodge", "zenda", "The Hunting Lodge", "The forest lodge where the cousins meet, the King is drugged, and the impersonation is born.", 210, 825],
  ["lodge-cellar", "zenda", "The Lodge Cellar", "A concealed room used to hide the unconscious King, later found violated with Josef dead.", 230, 790],
  ["forest-road", "zenda", "Forest Road", "The screened road between station, lodge, town, and castle used for covert rides and pursuit.", 630, 520],
  ["tarlenheim-chateau", "zenda", "Tarlenheim Chateau", "Fritz's country house, converted into the loyal party's observation post and planning headquarters.", 1240, 155],
  ["forest-lodge", "zenda", "Forest Lodge", "A small refuge where the wounded Rudolf is hidden when Flavia comes seeking the King.", 1390, 555],
  ["zenda-forest", "zenda", "Zenda Forest", "The castle's broad hunting woods, concealing scouts, horses, pursuit, and Rudolf's final duel with Rupert.", 930, 690],
  ["castle-gateway", "zenda", "Castle of Zenda", "Michael's fortress combines a medieval keep with a newer chateau across a defended moat.", 1375, 870, "castle"],
  ["castle-moat", "castle", "The Moat", "Deep water encircling the old keep and separating it from the newer residential wing.", 760, 525],
  ["drawbridge", "castle", "The Drawbridge", "The narrow mechanical link between chateau and keep, decisive to both execution plan and rescue.", 760, 575],
  ["new-chateau", "castle", "The New Chateau", "Michael's occupied residence, whose rooms and entrance become the staging ground of betrayal.", 390, 665],
  ["antoinette-room", "castle", "Antoinette's Chamber", "The room where Michael's jealousy and Rupert's defiance erupt into fatal violence.", 330, 610],
  ["old-keep", "castle", "The Old Keep", "The defensible medieval tower holding the King's guarded cell above the moat.", 1120, 610],
  ["king-cell", "castle", "The King's Cell", "A locked chamber prepared so that the prisoner can be killed and his weighted body dropped into the moat.", 1220, 535],
  ["jacobs-ladder", "castle", "Jacob's Ladder", "The great drainage pipe beneath the King's window, used to hear the captive and dispose of evidence.", 1320, 620],
];
const locationMarkers = locationDefs.map(([key, mapKey, name, description, x, y, linked]) => rec({
  id: loc(key), mapLayerId: map(mapKey), linkedMapLayerId: linked ? map(linked) : null,
  name, description, x, y, imageId: image(`location-${key}`), iconType: linked ? "building" : "place", tags: [], factionId: null,
}));

export const itemDefs = [
  ["coronation-crown", "The Crown of Ruritania", "The state crown Rudolf accepts in another man's name, making a temporary deception a public reality."],
  ["drugged-wine", "The Drugged Wine", "A special bottle intended to keep the King from reaching his coronation."],
  ["royal-uniform", "The King's Uniform", "The Guard uniform and insignia that complete Rudolf's first transformation into his cousin."],
  ["revolver", "Rudolf's Revolver", "The concealed firearm carried through procession, ambush, and rescue preparations."],
  ["tea-table", "The Summerhouse Tea-table", "A small iron table overturned as Rudolf's barricade against three armed assassins."],
  ["rupert-dagger", "Rupert's Dagger", "The small blade Rupert throws after Rudolf refuses his first treacherous offer."],
  ["flavia-ring", "Flavia's Ring", "The pledge Flavia places on Rudolf before he leaves for the final assault."],
  ["jacobs-pipe", "The Drainpipe", "The pipe nicknamed Jacob's Ladder, joining the prison cell to the moat below."],
  ["silk-ladder", "The Rope Ladder", "Equipment prepared for the covert crossing and entry during the rescue."],
];
const items = itemDefs.map(([key, name, description]) => rec({ id: item(key), name, description, iconType: "object", imageId: image(`item-${key}`), tags: [] }));

const chapters = chapterLedger.map(({ number, title, synopsis }) => rec({
  id: chapter(number), timelineId, number, title, synopsis, notes: "Source chapter title retained from Anthony Hope's text.", wordGoal: null,
}));
// PlotWeave stores calendar positions as whole in-world days. sortOrder keeps
// the ledger's clock-time sequence for scenes that occur on the same day.
const date = (day) => day;
const events = eventLedger.map((entry, index) => {
  const draft = sceneDrafts[index];
  const previous = eventLedger[index - 1];
  return rec({
    id: event(index + 1), chapterId: chapter(draft.chapterNumber), timelineId,
    title: entry.title, description: entry.description, locationMarkerId: loc(entry.location),
    involvedCharacterIds: Object.keys(entry.states).map(char), mentionedCharacterIds: ({19:["antoinette"],22:["george"],32:["johann"],55:["flavia","sapt","king","rupert"]}[index + 1] ?? []).map(char),
    involvedItemIds: [], tags: [`chapter-${draft.chapterNumber}`],
    threadIds: [id("thread", index < 14 ? "impersonation" : index < 40 ? "rescue" : "assault")],
    motifIds: [id("motif", index % 3 === 0 ? "doubling" : "honour")],
    sortOrder: index, travelDays: previous ? Math.max(0, entry.day - previous.day) : 0,
    inWorldTime: date(entry.day), tension: entry.tension, structureBeat: null,
    status: "final", povCharacterId: char("rudolf"), isFlashback: false,
  });
});
const itemEvents = new Map([
  [6, ["drugged-wine"]], [9, ["royal-uniform", "revolver"]], [11, ["coronation-crown"]],
  [21, ["tea-table", "revolver"]], [29, ["rupert-dagger"]], [37, ["silk-ladder"]], [38, ["flavia-ring"]],
  [33, ["jacobs-pipe"]], [43, ["revolver", "silk-ladder"]], [50, ["flavia-ring"]],
]);
for (const [eventNumber, keys] of itemEvents) events[eventNumber - 1].involvedItemIds = keys.map(item);
const sceneTexts = sceneDrafts.map((draft, i) => ({
  id: id("scene", String(i + 1).padStart(3, "0")), worldId: W, eventId: event(i + 1),
  text: draft.text, wordCount: (draft.text.match(/\S+/g) ?? []).length, createdAt: now, updatedAt: now,
}));
const deathEvent = { josef: 14, michael: 41, de_gautet: 42, bersonin: 43, detchard: 43, king_doctor: 43 };
const characterSnapshots = events.flatMap((ev, i) => Object.entries(eventLedger[i].states).map(([key, statusNotes], j) => rec({
  id: `${ev.id}-snapshot-${j + 1}`, characterId: char(key), eventId: ev.id,
  isAlive: !(deathEvent[key] && i + 1 >= deathEvent[key]), currentLocationMarkerId: ev.locationMarkerId,
  currentMapLayerId: locationMarkers.find((x) => x.id === ev.locationMarkerId)?.mapLayerId,
  inventoryItemIds: [], inventoryNotes: "", travelModeId: null, sortKey: i, statusNotes,
})));

const relationDefs = [
  ["rudolf", "king", "distant cousins and physical doubles", 5, "positive", 5],
  ["rudolf", "flavia", "forbidden lovers separated by public duty", 5, "positive", 11],
  ["rudolf", "sapt", "co-conspirators bound by loyalty to the King", 5, "positive", 7],
  ["rudolf", "fritz", "trusted allies and friends", 5, "positive", 5],
  ["king", "michael", "half-brothers and rivals for the throne", 5, "negative", 7],
  ["michael", "antoinette", "jealous lovers divided by ambition", 4, "mixed", 3],
  ["michael", "rupert", "master and dangerously faithless lieutenant", 5, "negative", 18],
  ["rupert", "antoinette", "predatory suitor and resisting target", 5, "negative", 27],
  ["rudolf", "rupert", "admiring mortal enemies", 5, "negative", 18],
  ["sapt", "fritz", "senior and junior officers of the loyal party", 4, "positive", 5],
];
const relationships = relationDefs.map(([a,b,label,strength,sentiment,start],i) => rec({
  id:id("relationship",i+1), characterAId:char(a), characterBId:char(b), label,strength,sentiment,
  notes:"This bond changes under the pressure of captivity, impersonation, and rescue.", isMutual:true, createdAtEventId:event(start),
}));
const relationshipSnapshots = [
  [2, 24, "publicly promised as King and princess", 5, "positive", "The political courtship becomes a sincere engagement under a false identity."],
  [7, 41, "betrayed and killed", 5, "negative", "Rupert turns the castle's divided loyalties into Michael's death."],
  [2, 51, "lovers parted by duty", 5, "mixed", "They refuse escape so that Ruritania and the restored King can endure."],
].map(([rel,n,label,strength,sentiment,notes],i)=>rec({id:id("relationship-snapshot",i+1),relationshipId:id("relationship",rel),eventId:event(n),label,strength,sentiment,notes}));
const plotThreads = [
  rec({id:id("thread","impersonation"),name:"The Royal Impersonation",description:"A one-day substitution becomes the shield protecting an abducted King.",color:"#b18a4f",status:"resolved",tags:[]}),
  rec({id:id("thread","rescue"),name:"Finding the Prisoner",description:"Rudolf's circle identifies the prison, its guards, and the mechanism designed to kill the King.",color:"#4b6278",status:"resolved",tags:[]}),
  rec({id:id("thread","assault"),name:"The Castle Assault",description:"Competing rescue, betrayal, jealousy, and murder plots converge at the Castle of Zenda.",color:"#873b3e",status:"resolved",tags:[]}),
];
const motifs = [
  rec({id:id("motif","doubling"),name:"Doubling and Identity",description:"Two faces make kingship both a public performance and a private moral test.",color:"#ba9152",tags:[]}),
  rec({id:id("motif","honour"),name:"Honour and Renunciation",description:"The adventure repeatedly asks what must be surrendered when desire conflicts with an oath.",color:"#536781",tags:[]}),
];
const factions = [
  rec({id:id("faction","loyalists"),name:"The King's Loyalists",description:"The small circle working to preserve the crowned King and rescue his person.",color:"#b08a4e",coverImageId:image("location-royal-palace"),tags:[]}),
  rec({id:id("faction","michael"),name:"Duke Michael's Six",description:"Michael and the six chosen men trusted with the King's captivity and Rudolf's destruction.",color:"#71343d",coverImageId:image("location-new-chateau"),tags:[]}),
];
const memberDefs = [["loyalists","rudolf","royal double",7,null],["loyalists","sapt","strategist",5,null],["loyalists","fritz","officer",5,null],["loyalists","king","sovereign",5,null],["michael","michael","leader",7,42],["michael","rupert","lieutenant",18,42],["michael","detchard","foreign guard",18,44],["michael","de_gautet","foreign guard",18,43],["michael","bersonin","foreign guard",18,44]];
const factionMemberships = memberDefs.map(([f,c,role,start,end],i)=>rec({id:id("membership",i+1),factionId:id("faction",f),characterId:char(c),role,startEventId:event(start),endEventId:end?event(end):null,notes:""}));
const loreCategories = [{id:id("lore-category","source"),worldId:W,name:"Source and Editorial Method",color:"#8b744e",sortOrder:0},{id:id("lore-category","realm"),worldId:W,name:"The Ruritanian Realm",color:"#596a78",sortOrder:1}];
const lorePages = [
  rec({id:id("lore","source"),categoryId:loreCategories[0].id,title:"Complete Public-Domain Text",body:`The manuscript reproduces all 22 chapters of ${sourceEdition} from ${sourceUrl}. Scene boundaries are editorial but lossless; summaries and the reconstructed 1890 calendar are editorial. Ruritania is fictional, so map geography expresses relationships described in the novel rather than claiming real coordinates.`,tags:["source","public-domain","editorial-method"],coverImageId:image("world-cover"),linkedEntityIds:[],visibleFromEventId:null}),
  rec({id:id("lore","succession"),categoryId:loreCategories[1].id,title:"The Elphberg Succession",body:"The red-haired Elphberg line rules Ruritania. The King's lawful coronation, prospective marriage to Flavia, and physical survival are separate but interconnected foundations of political legitimacy.",tags:["royalty","succession"],coverImageId:image("item-coronation-crown"),linkedEntityIds:[char("king"),char("rudolf"),char("flavia")],visibleFromEventId:event(1)}),
  rec({id:id("lore","capital"),categoryId:loreCategories[1].id,title:"A Divided Capital",body:"Strelsau's newer quarters favour the King, while the crowded old town favours Duke Michael. Rudolf's choice of coronation route turns geography into an immediate test of popular rule.",tags:["strelsau","politics"],coverImageId:image("location-old-town"),linkedEntityIds:[loc("old-town"),char("michael")],visibleFromEventId:event(4)}),
];
const factDefs = [
  ["double","Rudolf can pass for the King","Their resemblance is exact enough once beard and clothing are matched.",5],
  ["captivity","Michael holds the King at Zenda","The abducted King is kept alive in the old castle as leverage.",16],
  ["kill-mechanism","The prison is prepared for instant murder","Guards can kill the King and send his weighted body down the pipe if rescue begins.",37],
  ["antoinette-warning","Antoinette is secretly resisting Michael","Her warnings serve Rudolf while pursuing her own safety and attachment.",20],
];
const knowledgeFacts = factDefs.map(([key,title,description,n])=>rec({id:id("fact",key),title,description,tags:[],readerLearnsAtEventId:event(n),originEventId:event(n)}));
const revealDefs = [["double","rudolf",5],["captivity","rudolf",16],["captivity","sapt",16],["kill-mechanism","rudolf",37],["kill-mechanism","sapt",37],["antoinette-warning","rudolf",20]];
const knowledgeReveals = revealDefs.map(([fact,c,n],i)=>rec({id:id("reveal",i+1),factId:id("fact",fact),characterId:char(c),eventId:event(n),note:"This information materially changes the character's next decision."}));
const goalDefs = [["rudolf",7,51,"need","Restore the true King without sacrificing Ruritania to Michael.","resolved"],["rudolf",18,51,"want","Find an honourable future with Flavia despite the borrowed identity.","abandoned"],["sapt",7,47,"want","Keep a visible King on the throne until Rudolf V can be rescued.","resolved"],["michael",7,41,"want","Convert the King's captivity into crown and marriage.","failed"],["flavia",18,51,"need","Reconcile her love for Rudolf with duty to the kingdom.","resolved"],["rupert",29,46,"want","Exploit every faction for danger, profit, and personal freedom.","active"]];
const characterGoals = goalDefs.map(([c,start,end,type,text,status],i)=>rec({id:id("goal",i+1),characterId:char(c),startEventId:event(start),endEventId:event(end),type,text,status}));
const itemPlacements = events.flatMap((ev,i)=>ev.involvedItemIds.map((itemId,j)=>rec({id:id("placement",`${i+1}-${j+1}`),itemId,eventId:ev.id,locationMarkerId:ev.locationMarkerId,notes:`Materially present during ${ev.title}.`,sortKey:i*100+j})));
const blobs = [
  ...mapDefs.map(([key])=>({id:image(`map-${key}`),worldId:W,mimeType:"image/jpeg",url:`library/prisoner-of-zenda/maps/${key}.jpg`,createdAt:now})),
  ...characterDefs.map(([key])=>({id:image(`character-${key}`),worldId:W,mimeType:"image/jpeg",url:`library/prisoner-of-zenda/art/character-${key}.jpg`,createdAt:now})),
  ...locationDefs.map(([key])=>({id:image(`location-${key}`),worldId:W,mimeType:"image/jpeg",url:`library/prisoner-of-zenda/art/location-${key}.jpg`,createdAt:now})),
  ...itemDefs.map(([key])=>({id:image(`item-${key}`),worldId:W,mimeType:"image/jpeg",url:`library/prisoner-of-zenda/art/item-${key}.jpg`,createdAt:now})),
  {id:image("world-cover"),worldId:W,mimeType:"image/jpeg",url:"library/prisoner-of-zenda/art/world-cover.jpg",createdAt:now},
];
const world = {
  version:11,type:"plotweave-world",exportedAt:now,
  world:{id:W,name:"The Prisoner of Zenda",description:"An English traveller discovers that his face is identical to a threatened king's and agrees to wear the crown long enough to defeat a coup. The masquerade becomes a trial of courage, loyalty, and renunciation when the true King is abducted and Rudolf falls in love with the princess promised to his double.",coverImageId:image("world-cover"),theme:"theme-adventure",readingMode:true,createdAt:now,updatedAt:now,continuityStaleThreshold:5,calendar:{startYear:1890,yearSuffix:"",months:[["January",31],["February",28],["March",31],["April",30],["May",31],["June",30],["July",31],["August",31],["September",30],["October",31],["November",30],["December",31]].map(([name,days])=>({name,days}))},wordTarget:null},
  mapLayers,locationMarkers,characters,items,characterSnapshots,characterMovements:[],itemPlacements,locationSnapshots:[],itemSnapshots:[],relationships,relationshipSnapshots,
  timelines:[{id:timelineId,worldId:W,name:"The Zenda Affair",description:"A single editorial chronology follows Rudolf from England through the coronation, captivity, rescue, and aftermath.",color:"#8b3540",dayOffset:0,createdAt:now}],
  chapters,events,blobs,travelModes:[],timelineRelationships:[],crossTimelineArtifacts:[],
  mapRoutes:[rec({id:id("route","royal-rail"),mapLayerId:map("ruritania"),name:"Zenda–Strelsau Railway",routeType:"rail",waypoints:[loc("border-station"),loc("zenda-gateway"),loc("strelsau-gateway")],color:"#6d563e",notes:"The railway used for the coronation journey and covert returns."}),rec({id:id("route","castle-road"),mapLayerId:map("zenda"),name:"Road to the Castle",routeType:"road",waypoints:[loc("zenda-station"),loc("zenda-town"),loc("forest-road"),loc("castle-gateway")],color:"#6d563e",notes:"The principal route through the Zenda district."})],
  mapRegions:[],mapRegionSnapshots:[],mapAnnotations:[],loreCategories,lorePages,factions,factionMemberships,factionRelationships:[],knowledgeFacts,knowledgeReveals,characterGoals,sceneTexts,plotThreads,motifs,continuitySuppressions:[],writingLogs:[],sceneRevisions:[],
};
const json=`${JSON.stringify(world,null,2)}\n`;
fs.mkdirSync("example",{recursive:true}); fs.mkdirSync("public/library",{recursive:true});
fs.writeFileSync("example/The Prisoner of Zenda.pwk",json); fs.writeFileSync("public/library/the-prisoner-of-zenda.pwk",json);
const indexPath="public/library/index.json"; const index=JSON.parse(fs.readFileSync(indexPath,"utf8"));
const catalogueEntry={id:"the-prisoner-of-zenda",title:"The Prisoner of Zenda",author:"Anthony Hope",blurb:"An English traveller with a king's face must wear the crown, rescue his captive double, and surrender the princess he loves.",data:"the-prisoner-of-zenda.pwk",dataBytes:Buffer.byteLength(json),counts:{characters:characters.length,chapters:chapters.length,events:events.length,locations:locationMarkers.length},notice:`Unofficial reference for a public-domain novel. Manuscript scenes reproduce the complete original prose of all 22 chapters from ${sourceEdition}; Gutenberg front and end matter are excluded. Scene divisions, summaries, calendar dates, fictional map geography, and all original generated illustrations are editorial.`,worldId:W,cover:"library/prisoner-of-zenda/art/world-cover.jpg"};
const existing=index.entries.findIndex((x)=>x.id===catalogueEntry.id); if(existing>=0) index.entries[existing]=catalogueEntry; else index.entries.push(catalogueEntry);
fs.writeFileSync(indexPath,`${JSON.stringify(index,null,2)}\n`);
console.log({chapters:chapters.length,events:events.length,scenes:sceneTexts.length,words:sceneTexts.reduce((n,s)=>n+s.wordCount,0),characters:characters.length,locations:locationMarkers.length,assets:blobs.length,bytes:Buffer.byteLength(json)});
