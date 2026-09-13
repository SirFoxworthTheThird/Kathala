export const chapterSynopses = [
  "Born in York and determined to go to sea, Crusoe rejects his father’s counsel, survives his first storm and the Yarmouth wreck, then chooses London over a humbled return home.",
  "Crusoe profits on the Guinea coast, is enslaved at Sallee, escapes in a provisioned longboat with Xury, and follows the African shore through hunger, fear, and dangerous wildlife.",
  "A Portuguese captain rescues Crusoe and Xury; Crusoe prospers as a Brazilian planter, joins a voyage intended to obtain enslaved labourers, and alone survives its wreck near an unknown island.",
  "Crusoe repeatedly salvages the wreck, builds a fortified habitation, divides his powder, marks a calendar, and begins shaping an ordered household from the remains of the ship.",
  "Crusoe opens his journal, improves his tools and furniture, discovers sprouting grain, and endures an earthquake and hurricane that expose the fragility of his refuge.",
  "Fever, a terrifying dream, tobacco, and scripture turn Crusoe from fear of death toward repentance and a changed understanding of his deliverance.",
  "An inland expedition reveals fertile country and inspires a second retreat; failed sowings and eventual harvests teach Crusoe the island’s unfamiliar seasons.",
  "Crusoe crosses the island, becomes lost on his return, reconsiders solitude, and learns to protect and harvest his small fields with improvised means.",
  "He masters pottery and bread-making, spends immense labour on a canoe he cannot launch, and adapts clothing and dwindling stores to a life that may never end.",
  "A perilous canoe voyage tests the island’s currents; the parrot’s voice startles Crusoe at his bower, while years of industry and a tame goat herd deepen his self-sufficiency.",
  "After surveying his island kingdom, Crusoe finds a human footprint; terror replaces confidence, and he conceals the castle behind a living screen of trees.",
  "Crusoe establishes a hidden pasture, discovers evidence of recurring cannibal landings, debates an ambush, rejects indiscriminate violence, and equips a secret cave for retreat.",
  "Another mainland landing renews Crusoe’s alarm; guns signal a ship in distress, and a solitary voyage to the Spanish wreck yields supplies but no surviving companions.",
  "A dream and prolonged vigilance prepare Crusoe to intervene at the shore, where he saves a fleeing captive, names him Friday, and brings him into the fortified household.",
  "Friday learns the household and Christian teaching while explaining his country, his captivity, and the European castaways across the sea; suspicion gives way to restored trust.",
  "Crusoe and Friday prepare a seaworthy canoe, confront another landing party, rescue a Spaniard and Friday’s father, and return with a larger island household.",
  "The rescued men recover, the islanders expand their provisions, and envoys depart to bring the Spaniard’s companions—just before an English ship appears offshore under mutinous control.",
  "Crusoe joins the marooned English captain, defeats successive landing parties through deception and force, recovers the ship, and leaves selected mutineers as the island’s new colonists.",
  "Crusoe leaves the island after twenty-eight years, learns that his Brazilian estate prospered, orders his fortune, and begins an overland return through the winter Pyrenees with Friday.",
  "Friday outwits a bear, the travellers survive a massed wolf attack, and Crusoe settles in England before revisiting the island and pointing toward the adventures of the second part.",
];

export const factionDefs = [
  ["island-household", "The Island Household", "The changing community built around Crusoe’s fortified settlement, from solitary labour to cooperation with Friday and the rescued castaways.", "#6e7047"],
  ["brazil-planters", "The Brazilian Planters", "Neighbouring sugar planters whose proposed Guinea venture sends Crusoe on the voyage that ends in shipwreck.", "#8b653f"],
  ["visiting-warriors", "The Visiting Warriors", "Mainland parties who periodically cross to the island with captives, making its western shore a place of fear and conflict.", "#8a473d"],
  ["english-loyalists", "The English Loyalists", "The captain, mate, passenger, and island allies who work together to recover the seized English ship.", "#456675"],
  ["english-mutineers", "The English Mutineers", "The divided sailors who depose their captain and are ultimately defeated by deception, negotiation, and force.", "#66546f"],
];

export const membershipDefs = [
  ["island-household", "crusoe", "founder", "The Ship Breaks on the Sandbank"],
  ["island-household", "friday", "companion and fellow labourer", "The Rescue and Naming of Friday"],
  ["island-household", "spaniard", "rescued ally", "The Attack on the Cannibals"],
  ["island-household", "friday-father", "rescued elder", "Friday Finds His Father"],
  ["brazil-planters", "crusoe", "plantation owner", "A Plantation in Brazil"],
  ["brazil-planters", "wells", "neighbouring planter", "A Plantation in Brazil"],
  ["brazil-planters", "planters", "voyage partners", "The Slaving Voyage Proposed"],
  ["visiting-warriors", "carib-raiders", "landing parties", "Cannibals Return"],
  ["english-loyalists", "crusoe", "island commander", "The Marooned Captain"],
  ["english-loyalists", "friday", "scout and fighter", "The Marooned Captain"],
  ["english-loyalists", "english-captain", "lawful captain", "The Marooned Captain"],
  ["english-loyalists", "mate", "loyal officer", "The Marooned Captain"],
  ["english-loyalists", "passenger", "loyal passenger", "The Marooned Captain"],
  ["english-mutineers", "mutineers", "seized crew", "The Marooned Captain"],
  ["english-mutineers", "boatswain", "armed ringleader", "The Second Boat Comes Ashore"],
  ["english-mutineers", "will-atkins", "mutineer later spared", "The Second Boat Comes Ashore"],
];

export const factDefs = [
  ["island-uninhabited", "The island appears uninhabited", "Crusoe’s first surveys reveal no resident community, allowing him to mistake isolation for certainty.", "The Fertile Interior"],
  ["grain-grows", "The accidental grain can be cultivated", "Barley and rice from the ship’s stores germinate and can be multiplied through patient seasonal planting.", "Providential Grain"],
  ["other-visitors", "Other people visit the island", "A human footprint proves that Crusoe is not the only person to set foot on the island.", "The Footprint"],
  ["mainland-near", "The mainland lies within canoe range", "Friday identifies the distant coast and explains the crossings made by his people.", "Friday’s Country and Captivity"],
  ["spaniards-alive", "European castaways survive on the mainland", "Friday reports white bearded men living among the mainland people after a wreck.", "The Bearded Men Across the Sea"],
  ["ship-mutinied", "The English ship has been seized", "The marooned captain explains that his own crew mutinied and brought him ashore to die.", "The Marooned Captain"],
  ["plantation-prospered", "The Brazilian estate has prospered", "The Portuguese captain’s accounts show that Crusoe’s abandoned plantation has become a substantial fortune.", "The Brazilian Fortune Restored"],
];

export const revealDefs = [
  ["island-uninhabited", "crusoe", "The Fertile Interior", "His first inland survey finds abundant land but no inhabitants."],
  ["grain-grows", "crusoe", "Providential Grain", "He recognizes barley and rice growing from discarded husks."],
  ["other-visitors", "crusoe", "The Footprint", "The print overturns his long assumption of solitude."],
  ["mainland-near", "crusoe", "Friday’s Country and Captivity", "Friday supplies geographic knowledge Crusoe could not establish alone."],
  ["spaniards-alive", "crusoe", "The Bearded Men Across the Sea", "Friday’s memory gives Crusoe a possible community and route of escape."],
  ["ship-mutinied", "crusoe", "The Marooned Captain", "The captain explains the landing and asks for help."],
  ["ship-mutinied", "friday", "The Marooned Captain", "Friday learns why armed English sailors have come ashore."],
  ["plantation-prospered", "crusoe", "The Brazilian Fortune Restored", "Legal accounts establish the value accumulated during his absence."],
];

export const goalDefs = [
  ["crusoe", "A Restless Son in York", "The Ship Breaks on the Sandbank", "want", "Seek advancement and adventure beyond the secure life urged by his parents."],
  ["crusoe", "The Ship Breaks on the Sandbank", "The Great Canoe That Cannot Move", "need", "Turn the wreck’s finite stores and the island’s resources into a durable means of survival."],
  ["crusoe", "The Ship Breaks on the Sandbank", "The Captain Retakes His Ship", "want", "Find a seaworthy route back to human society without surrendering the security he has built."],
  ["crusoe", "Fever and a Terrible Dream", "Tobacco, Scripture, and Recovery", "need", "Interpret suffering through repentance, gratitude, and a renewed religious practice."],
  ["friday", "The Rescue and Naming of Friday", "Friday Finds His Father", "want", "Survive captivity, understand Crusoe’s household, and recover connection with his people."],
  ["spaniard", "The Attack on the Cannibals", "The Envoys Depart", "want", "Recover, return to his fellow castaways, and bring them under agreed terms to the island."],
  ["english-captain", "The Marooned Captain", "The Captain Retakes His Ship", "want", "Defeat the mutiny and regain lawful command of his ship."],
];

export const itemSceneUses = {
  "The Guinea Trade": ["guinea-gold"],
  "A Captive at Sallee": ["escape-longboat"],
  "Crusoe and Xury Escape": ["escape-longboat", "firearms"],
  "The First Raft": ["firearms", "gunpowder", "tools"],
  "Salvaging the Wreck": ["firearms", "gunpowder", "tools"],
  "The Calendar and the Balance Sheet": ["calendar-post"],
  "The Journal Begins": ["journal"],
  "Earthquake and Hurricane": ["gunpowder"],
  "Providential Grain": ["grain"],
  "Fever and a Terrible Dream": ["bible"],
  "Tobacco, Scripture, and Recovery": ["bible"],
  "Bread from First Principles": ["grain", "tools"],
  "Clothes, Ink, and Diminishing Stores": ["goatskins"],
  "The Great Canoe That Cannot Move": ["tools"],
  "A Tame Herd Replaces Powder": ["tools"],
  "A Boat for the Continent": ["seaworthy-canoe", "tools"],
  "Preparing to Rescue the Spaniards": ["seaworthy-canoe", "firearms"],
  "The Brazilian Fortune Restored": ["plantation-accounts"],
};

export const routeDefs = [
  ["first-voyages", "First Voyages and Captivity", "world", "sea", ["york-home", "north-sea", "yarmouth-roads", "london", "guinea-coast", "sallee"]],
  ["escape-brazil", "Escape to Brazil", "world", "sea", ["sallee-harbor", "african-coast", "atlantic-passage", "brazil-plantation"]],
  ["wreck-voyage", "The Fatal Guinea Voyage", "world", "sea", ["brazil-plantation", "atlantic-passage", "island-gateway"]],
  ["island-circuit", "Crusoe’s Island Circuit", "island", "foot-and-canoe", ["wreck-site", "island-castle", "country-bower", "lookout-hill", "island-coast", "boat-harbor"]],
  ["return-europe", "Return and Overland Journey", "world", "ship-and-road", ["island-gateway", "english-ship", "england", "lisbon", "iberian-road", "pyrenees", "england"]],
];

export const characterSceneState = (slug, scene) => {
  const action = scene.description.replace(/[.]$/, "");
  const role = {
    crusoe: "Crusoe",
    father: "His father",
    mother: "His mother",
    friend: "The Hull friend",
    "guinea-captain": "The Guinea captain",
    "sallee-master": "The Sallee captain",
    xury: "Xury",
    moor: "Ismael",
    "portuguese-captain": "The Portuguese captain",
    wells: "Wells",
    planters: "The neighbouring planters",
    "ship-crew": "The ship’s company",
    "carib-raiders": "The visiting warriors",
    friday: "Friday",
    spaniard: "The Spaniard",
    "friday-father": "Friday’s father",
    "english-captain": "The English captain",
    mate: "The captain’s mate",
    passenger: "The loyal passenger",
    mutineers: "The mutineers",
    boatswain: "The boatswain",
    "will-atkins": "Will Atkins",
    guide: "The Pyrenean guide",
    widow: "The captain’s widow",
  }[slug];
  const focus = {
    crusoe: "He is the acting observer whose practical and moral position changes through the scene",
    father: "He is pressing the case for security, family duty, and the middle station",
    mother: "She is caught between affection for her son and loyalty to her husband’s judgment",
    friend: "He enables the voyage but judges its consequences from a more chastened position",
    "guinea-captain": "He is teaching, employing, or protecting the inexperienced merchant",
    "sallee-master": "He exercises the authority of Crusoe’s captor and owner",
    xury: "He shares immediate danger with Crusoe and must decide whether to trust him",
    moor: "He is the third man in the fishing boat and the immediate obstacle to escape",
    "portuguese-captain": "He acts with the generosity and commercial honesty that repeatedly aid Crusoe",
    wells: "He stands as Crusoe’s neighbouring benchmark in the Brazilian planting community",
    planters: "They pursue the labour and profit promised by the Guinea expedition",
    "ship-crew": "They struggle collectively with the vessel and worsening conditions at sea",
    "carib-raiders": "They arrive as an armed mainland party carrying out their own expedition",
    friday: "He acts from his own knowledge, loyalties, fear, courage, and growing partnership with Crusoe",
    spaniard: "He responds as a rescued castaway whose companions remain beyond the island",
    "friday-father": "He acts as an exhausted rescued elder and as Friday’s unexpectedly restored parent",
    "english-captain": "He seeks survival and the recovery of his lawful command",
    mate: "He supports his captain as a loyal officer in the counterattack",
    passenger: "He joins the loyal party as a civilian ally under immediate threat",
    mutineers: "They act as a divided group whose confidence erodes as control of the island slips away",
    boatswain: "He maintains violent resistance as one of the mutiny’s most dangerous leaders",
    "will-atkins": "He moves from active mutiny toward surrender and the prospect of being left ashore",
    guide: "He must keep the travellers together through snow, animals, and unfamiliar mountain ground",
    widow: "She safeguards Crusoe’s money and interests across the years of his disappearance",
  }[slug];
  return `${role}: ${action}. ${focus}.`;
};

export const characterIsAliveInScene = (slug, scene) => {
  if (slug === "ship-crew" && scene.title === "The Ship Breaks on the Sandbank") return false;
  if (slug === "boatswain" && scene.title === "The Boatswain Surrenders") return false;
  return true;
};
