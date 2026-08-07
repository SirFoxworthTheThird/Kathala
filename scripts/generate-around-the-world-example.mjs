import fs from 'node:fs'

const P = 'around-the-world-in-eighty-days'
const worldId = `${P}-world`
const timelineId = `${P}-timeline-main`
const now = 1786060800000
const base = { worldId, createdAt: now, updatedAt: now }
const id = (kind, slug) => `${P}-${kind}-${slug}`
const chId = n => id('chapter', String(n).padStart(2, '0'))
const charId = slug => id('char', slug)
const itemId = slug => id('item', slug)
const locId = slug => id('loc', slug)
const mapId = slug => id('map', slug)
const imageId = slug => id('image', slug)
const threadId = slug => id('thread', slug)
const motifId = slug => id('motif', slug)
const commons = (file, width = 960) => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=${width}`

const directImages = {
  cover: commons('Around the World in Eighty Days - book cover (139390140).jpg', 960),
  'map-world': commons('Around the World in Eighty Days map.png', 1356),
  'map-london': commons("1890 Bacon Traveler's Pocket Map of London, England - Geographicus - London-bacon-1890.jpg", 1280),
  'map-india': commons('Railway map of India 1870.jpg', 1300),
  'map-yokohama': commons('1870 map of Yokohama.jpg', 1280),
  'map-america': commons('Haasis & Lubrecht American Union Railroad Map 1871 UTA.jpg', 1280),
}
for (let n = 1; n <= 55; n += 1) directImages[`plate-${n}`] = commons(`Around the World in Eighty Days (1873) ${n}.png`, 960)
const blob = (slug, mimeType = 'image/jpeg') => ({ id: imageId(slug), worldId, mimeType, url: directImages[slug], createdAt: now })
const blobs = [
  blob('cover'), blob('map-world', 'image/png'), blob('map-london'), blob('map-india'), blob('map-yokohama'), blob('map-america'),
  ...Array.from({ length: 55 }, (_, index) => blob(`plate-${index + 1}`, 'image/png')),
]

const mapLayers = [
  { ...base, id: mapId('world'), parentMapId: null, name: 'Fogg’s Route Around the World', description: 'The eastward circuit from London through the Mediterranean, India, East Asia, the Pacific, North America, and the Atlantic.', imageId: imageId('map-world'), imageWidth: 1356, imageHeight: 627, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
  { ...base, id: mapId('london'), parentMapId: mapId('world'), name: 'London', description: 'The city of Fogg’s ordered domestic life, the Reform Club wager, and the final dash against the clock.', imageId: imageId('map-london'), imageWidth: 1280, imageHeight: 981, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
  { ...base, id: mapId('india'), parentMapId: mapId('world'), name: 'India and Its Railways, 1870', description: 'The railway and overland passage from Bombay to Calcutta, interrupted by an unfinished line and the rescue of Aouda.', imageId: imageId('map-india'), imageWidth: 1300, imageHeight: 1636, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
  { ...base, id: mapId('yokohama'), parentMapId: mapId('world'), name: 'Yokohama, 1870', description: 'The treaty port where Passepartout survives alone before rejoining Fogg and Aouda aboard the Pacific steamer.', imageId: imageId('map-yokohama'), imageWidth: 1280, imageHeight: 704, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
  { ...base, id: mapId('america'), parentMapId: mapId('world'), name: 'American Railways, 1871', description: 'The transcontinental route from San Francisco toward New York, crossing the plains, the Rocky Mountains, and the Missouri.', imageId: imageId('map-america'), imageWidth: 1280, imageHeight: 924, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
]

const locationMarkers = []
const mapHeightBySlug = { world: 627, london: 981, india: 1636, yokohama: 704, america: 924 }
function location(slug, map, name, description, x, y, iconType = 'landmark', linked = null, artwork = 'plate-1') {
  locationMarkers.push({ ...base, id: locId(slug), mapLayerId: mapId(map), linkedMapLayerId: linked ? mapId(linked) : null, name, description, x, y: mapHeightBySlug[map] - y, iconType, tags: [], factionId: null, imageId: imageId(artwork) })
}

// Source coordinates below are measured from each image's top edge; Leaflet's
// simple CRS stores y from the bottom edge, so location() performs the inversion.
location('london-entrance', 'world', 'London', 'Fogg’s home city and the fixed point against which the eighty-day wager is measured.', 642, 155, 'city', 'london', 'plate-1')
location('paris', 'world', 'Paris', 'The first continental capital on the express route southeast from London.', 665, 174, 'city', null, 'plate-5')
location('turin', 'world', 'Turin', 'The Alpine railway junction crossed during the rapid passage toward Brindisi.', 685, 190, 'city', null, 'plate-5')
location('brindisi', 'world', 'Brindisi', 'The Adriatic port where the travellers board the Mongolia for Suez and Bombay.', 716, 207, 'harbor', null, 'plate-6')
location('suez', 'world', 'Suez', 'The canal port where Fix first examines Fogg and begins to follow him as a suspected bank robber.', 770, 246, 'harbor', null, 'plate-7')
location('aden', 'world', 'Aden', 'A coaling station at the entrance to the Red Sea, reached with the Mongolia ahead of schedule.', 817, 286, 'harbor', null, 'plate-8')
location('bombay-entrance', 'world', 'Bombay', 'The western Indian port where the sea voyage ends and the rail journey across the subcontinent begins.', 874, 280, 'city', 'india', 'plate-10')
location('calcutta-world', 'world', 'Calcutta', 'The eastern Indian port where a courtroom delay is followed by departure aboard the Rangoon.', 934, 271, 'city', null, 'plate-23')
location('singapore', 'world', 'Singapore', 'The tropical port and coaling stop reached during the storm-delayed voyage toward Hong Kong.', 1021, 341, 'harbor', null, 'plate-25')
location('hong-kong', 'world', 'Hong Kong', 'The British port where steamer schedules, an opium den, and Fix’s interference divide the travelling party.', 1041, 260, 'harbor', null, 'plate-27')
location('tankadere-sea', 'world', 'South China Sea aboard the Tankadere', 'The exposed passage made in a small pilot boat from Hong Kong toward Shanghai.', 1074, 242, 'ship', null, 'plate-30')
location('yokohama-entrance', 'world', 'Yokohama', 'The Japanese treaty port where the separated travellers find one another before crossing the Pacific.', 1130, 205, 'city', 'yokohama', 'plate-32')
location('general-grant', 'world', 'Pacific aboard the General Grant', 'The long eastward steamship crossing from Yokohama to San Francisco.', 1230, 245, 'ship', null, 'plate-35')
location('san-francisco-entrance', 'world', 'San Francisco', 'The American Pacific port where the party transfers from ocean steamer to transcontinental railroad.', 165, 229, 'city', 'america', 'plate-36')
location('new-york-world', 'world', 'New York', 'The Atlantic port reached moments too late for the scheduled steamer to Liverpool.', 478, 205, 'city', null, 'plate-48')
location('henrietta', 'world', 'Atlantic aboard the Henrietta', 'A trading steamer diverted toward Europe after Fogg purchases control from its unwilling captain.', 535, 175, 'ship', null, 'plate-50')
location('queenstown', 'world', 'Queenstown', 'The Irish port where Fogg leaves the Henrietta and takes rail and packet connections toward Liverpool.', 608, 161, 'harbor', null, 'plate-51')
location('liverpool', 'world', 'Liverpool', 'The English port where Fix finally arrests Fogg before the mistake is corrected.', 625, 157, 'city', null, 'plate-52')

location('savile-row', 'london', 'No. 7 Savile Row', 'Fogg’s precisely ordered townhouse, maintained according to a strict daily timetable.', 575, 585, 'building', null, 'plate-1')
location('reform-club', 'london', 'The Reform Club', 'Fogg’s Pall Mall club, where cards, newspapers, and a disputed travel calculation produce the wager.', 555, 625, 'building', null, 'plate-3')
location('charing-cross', 'london', 'Charing Cross Station', 'The central terminus from which Fogg and Passepartout leave London for Dover.', 600, 650, 'station', null, 'plate-4')
location('london-terminus', 'london', 'London Terminus', 'The station reached after the final rail journey from Liverpool, leaving only a carriage race to Pall Mall.', 545, 545, 'station', null, 'plate-53')
location('wilson-house', 'london', 'Reverend Samuel Wilson’s House', 'The clergyman’s residence where Passepartout learns that the travellers have gained a calendar day.', 615, 575, 'building', null, 'plate-54')

location('bombay', 'india', 'Bombay', 'A crowded western port of railways, markets, and temples where Passepartout’s curiosity causes legal trouble.', 330, 1140, 'city', null, 'plate-10')
location('malabar-hill', 'india', 'Malabar Hill Temple', 'A hilltop sacred precinct entered by Passepartout without understanding its restrictions.', 290, 1165, 'temple', null, 'plate-11')
location('kholby', 'india', 'Kholby', 'The temporary end of the railway, where passengers discover that the line to Allahabad is unfinished.', 655, 955, 'station', null, 'plate-14')
location('jungle-camp', 'india', 'Bundelkhand Forest', 'A wooded overland route crossed by elephant after the broken railway connection.', 700, 875, 'forest', null, 'plate-15')
location('pillaji-temple', 'india', 'Pillaji Temple', 'A remote shrine where Aouda is held during the night before the procession.', 735, 820, 'temple', null, 'plate-18')
location('suttee-clearing', 'india', 'Funeral Clearing', 'The ceremonial ground where the rescue turns a fatal procession into an escape.', 760, 800, 'landmark', null, 'plate-21')
location('allahabad', 'india', 'Allahabad', 'The railhead regained after the elephant journey, where Aouda receives European clothing and joins the eastbound train.', 760, 720, 'city', null, 'plate-22')
location('benares', 'india', 'Benares', 'The ancient Ganges city passed during the uninterrupted railway journey toward Calcutta.', 845, 690, 'city', null, 'plate-22')
location('calcutta', 'india', 'Calcutta', 'The eastern metropolis where Passepartout’s temple offence is tried before the party reaches the Rangoon.', 1045, 785, 'city', null, 'plate-23')

location('yokohama-harbor', 'yokohama', 'Yokohama Harbour', 'The treaty port’s busy waterfront, receiving the Carnatic and the General Grant.', 690, 425, 'harbor', null, 'plate-31')
location('yokohama-streets', 'yokohama', 'Native Quarter', 'The streets where Passepartout wanders hungry, penniless, and unable to speak Japanese.', 570, 350, 'district', null, 'plate-31')
location('long-noses', 'yokohama', 'Honourable William Batulcar’s Circus', 'A travelling acrobatic show whose human pyramid briefly employs Passepartout.', 620, 315, 'theatre', null, 'plate-33')
location('general-grant-berth', 'yokohama', 'General Grant’s Berth', 'The Pacific Mail steamer’s departure point and the scene of the party’s reunion.', 760, 440, 'ship', null, 'plate-34')

location('san-francisco', 'america', 'San Francisco', 'A rapidly growing Pacific city where an election meeting becomes a street fight.', 145, 600, 'city', null, 'plate-36')
location('oakland', 'america', 'Oakland Station', 'The eastern-bay departure point for the Pacific Railroad journey.', 170, 585, 'station', null, 'plate-37')
location('medicine-bow', 'america', 'Medicine Bow', 'A Wyoming stop where a suspension bridge and a duel threaten the journey.', 530, 480, 'station', null, 'plate-40')
location('fort-kearny', 'america', 'Fort Kearny', 'The Nebraska military post from which soldiers and volunteers set out to recover the kidnapped passengers.', 690, 500, 'fort', null, 'plate-45')
location('omaha', 'america', 'Omaha', 'The Missouri River railway junction reached by wind sledge after the rescue.', 750, 480, 'city', null, 'plate-47')
location('chicago', 'america', 'Chicago', 'The major eastern railway junction crossed in the urgent run toward New York.', 900, 420, 'city', null, 'plate-48')
location('new-york', 'america', 'New York', 'The Atlantic terminus where the China has sailed forty-five minutes before Fogg arrives.', 1160, 440, 'city', null, 'plate-48')

const characterDefs = [
  ['fogg', 'Phileas Fogg', ['Mr Fogg'], 'An exact, reserved London gentleman who stakes his fortune on completing the new global itinerary in eighty days.', 'plate-1', '#4f6f78', true],
  ['passepartout', 'Jean Passepartout', [], 'Fogg’s resourceful French valet, newly committed to a quiet life and repeatedly drawn into the journey’s most physical dangers.', 'plate-2', '#b06f3c', true],
  ['aouda', 'Aouda', ['Mrs Aouda'], 'A Parsi woman rescued in India who becomes an active, perceptive companion during the eastward journey.', 'plate-21', '#8d5c68', true],
  ['fix', 'Detective Fix', ['Mr Fix'], 'A British detective who mistakes Fogg for the Bank of England robber and follows him while awaiting legal authority.', 'plate-7', '#6a6260', true],
  ['cromarty', 'Sir Francis Cromarty', [], 'A British brigadier-general who travels across India and helps Fogg rescue Aouda.', 'plate-14', '#66734e', true],
  ['guide', 'The Parsee Guide', [], 'A skilled young guide who supplies local knowledge and leads the elephant party through the forest.', 'plate-15', '#8a7348', true],
  ['kiouni', 'Kiouni', [], 'The elephant purchased by Fogg when the railway unexpectedly ends at Kholby.', 'plate-15', '#77705e', true],
  ['priest', 'The Chief Priest', [], 'The leader of the procession holding Aouda at the Pillaji temple.', 'plate-18', '#7e5344', true],
  ['obadiah', 'Judge Obadiah', [], 'The Calcutta magistrate who hears the temple case and sets a costly bail.', 'plate-23', '#6b5a48', true],
  ['oysterpuff', 'Oysterpuff', [], 'The court clerk who produces Passepartout’s abandoned shoes as evidence.', 'plate-23', '#756654', true],
  ['consul', 'The Suez Consul', [], 'The British official who validates Fogg’s passport despite Fix’s attempt to delay him.', 'plate-7', '#4c7080', true],
  ['bunsby', 'John Bunsby', [], 'The decisive pilot and master of the Tankadere, hired to force a passage toward Shanghai.', 'plate-30', '#496c75', true],
  ['batulcar', 'Honourable William Batulcar', [], 'An American circus proprietor whose troupe gives Passepartout work and an unexpected reunion.', 'plate-33', '#93643f', true],
  ['mandiboy', 'Captain of the General Grant', [], 'The Pacific Mail captain responsible for the long Yokohama–San Francisco crossing.', 'plate-35', '#486878', true],
  ['proctor', 'Colonel Stamp Proctor', [], 'A belligerent American encountered first at an election rally and later aboard the transcontinental train.', 'plate-36', '#814a3e', true],
  ['conductor', 'The Pacific Railroad Conductor', [], 'The railway official who manages bridge hazards, track obstructions, and the attack on the train.', 'plate-40', '#5d6a70', true],
  ['mudge', 'Mudge', [], 'An American who carries the party from Fort Kearny to Omaha in a sail-powered sledge.', 'plate-47', '#6f7456', true],
  ['speedy', 'Captain Andrew Speedy', [], 'The stubborn master of the Henrietta, whose ship and command Fogg progressively buys.', 'plate-50', '#704f43', true],
  ['wilson', 'Reverend Samuel Wilson', [], 'The London clergyman whose availability reveals the calendar error to Passepartout.', 'plate-54', '#706955', true],
  ['stuart', 'Andrew Stuart', [], 'A Reform Club whist player who challenges the feasibility of the eighty-day circuit.', 'plate-3', '#675a4d', true],
  ['sullivan', 'John Sullivan', [], 'A Reform Club member who joins the twenty-thousand-pound wager.', 'plate-3', '#5b6670', true],
  ['fallentin', 'Samuel Fallentin', [], 'One of Fogg’s fellow whist players and backers of the wager.', 'plate-3', '#6a6355', true],
  ['flanagan', 'Thomas Flanagan', [], 'A brewer and Reform Club member who stakes money against Fogg’s timetable.', 'plate-3', '#76604f', true],
  ['ralph', 'Gauthier Ralph', [], 'A Bank of England governor who discusses the robbery before joining the wager.', 'plate-3', '#4f6474', true],
]
const characters = characterDefs.map(([slug, name, aliases, description, portrait, color, isAlive]) => ({ ...base, id: charId(slug), name, aliases, description, portraitImageId: imageId(portrait), color, tags: [], isAlive, birthDate: null }))

const itemDefs = [
  ['carpet-bag', 'Fogg’s Carpet-bag', 'A compact travelling bag holding shirts, footwear, and a large reserve of Bank of England notes.', 'bag', 'plate-4'],
  ['bradshaw', 'Bradshaw’s Continental Railway Guide', 'The railway and steamship timetable used to convert the proposed circuit into a sequence of connections.', 'book', 'plate-3'],
  ['passport', 'Fogg’s Passport', 'A document stamped at the principal stops, intended as proof of the route rather than a legal necessity.', 'document', 'plate-7'],
  ['warrant', 'Fix’s Arrest Warrant', 'The delayed authority Fix needs before he can detain Fogg in British territory.', 'document', 'plate-7'],
  ['watch', 'Passepartout’s Watch', 'A cherished watch kept on London time, eventually exposing the westward movement of the apparent day.', 'watch', 'plate-8'],
  ['shoes', 'Passepartout’s Temple Shoes', 'The footwear left behind in Bombay and later produced as evidence in Calcutta.', 'clothing', 'plate-11'],
  ['banknotes', 'Fogg’s Banknotes', 'The portable fortune from which Fogg calmly pays fares, bail, rewards, animals, vessels, and fuel.', 'money', 'plate-4'],
  ['revolver', 'Fogg’s Revolver', 'A travelling weapon carried through the dangerous railway crossing and used during the rescue.', 'weapon', 'plate-44'],
  ['elephant', 'Kiouni’s Tack', 'The saddle and equipment used to carry the party across the unfinished Indian railway gap.', 'equipment', 'plate-15'],
  ['palanquin', 'Aouda’s Palanquin', 'The covered litter used in the procession from the temple before the rescue.', 'vehicle', 'plate-18'],
  ['opium-pipe', 'Opium Pipe', 'The pipe forced on Passepartout after Fix prevents him from warning Fogg about the Carnatic.', 'object', 'plate-28'],
  ['circus-costume', 'Long Nose Costume', 'The elaborate acrobat’s disguise Passepartout wears in Batulcar’s human pyramid.', 'clothing', 'plate-33'],
  ['railway-tickets', 'Round-the-world Tickets', 'The sequence of rail and steamship passages purchased as the journey advances.', 'document', 'plate-4'],
  ['sledge-sail', 'Mudge’s Sledge Sail', 'A broad sail that turns prairie wind into speed across the frozen plains.', 'equipment', 'plate-47'],
  ['henrietta', 'The Henrietta', 'A screw steamer bought piece by piece when coal runs short on the Atlantic.', 'ship', 'plate-50'],
]
const items = itemDefs.map(([slug, name, description, iconType, artwork]) => ({ ...base, id: itemId(slug), name, description, iconType, imageId: imageId(artwork), tags: [] }))

const chapterDefs = [
  ['In Which Phileas Fogg and Passepartout Accept Each Other, One as Master, the Other as Man', 'Passepartout enters the service of the exact and enigmatic Phileas Fogg.'],
  ['In Which Passepartout Is Convinced That He Has at Last Found His Ideal', 'Passepartout inspects his new home and celebrates the prospect of a regulated life.'],
  ['In Which a Conversation Takes Place Which Seems Likely to Cost Phileas Fogg Dear', 'A discussion of the bank robbery and a new global timetable becomes a twenty-thousand-pound wager.'],
  ['In Which Phileas Fogg Astounds Passepartout, His Servant', 'Fogg returns home, orders immediate packing, and leaves London that evening.'],
  ['In Which a New Species of Funds, Unknown to the Moneyed Men, Appears on ’Change', 'Public opinion and betting markets turn Fogg’s journey into a national speculation.'],
  ['In Which Fix, the Detective, Betrays a Very Natural Impatience', 'At Suez, Fix studies arriving passengers and becomes convinced that Fogg is the bank robber.'],
  ['Which Once More Demonstrates the Uselessness of Passports as Aids to Detectives', 'Fogg obtains the Suez visa while Fix fails to detain him without a warrant.'],
  ['In Which Passepartout Talks Rather More, Perhaps, Than Is Prudent', 'Fix questions Passepartout and learns the circumstances and urgency of Fogg’s departure.'],
  ['In Which the Red Sea and the Indian Ocean Prove Propitious to the Designs of Phileas Fogg', 'The Mongolia crosses to Bombay ahead of schedule while Fix continues the pursuit.'],
  ['In Which Passepartout Is Only Too Glad to Get Off with the Loss of His Shoes', 'Passepartout enters a Bombay temple and escapes the priests at the cost of his shoes.'],
  ['In Which Phileas Fogg Secures a Curious Means of Conveyance at a Fabulous Price', 'The Indian railway ends unexpectedly, and Fogg buys an elephant for the overland gap.'],
  ['In Which Phileas Fogg and His Companions Venture Across the Indian Forests, and What Ensued', 'The elephant party crosses the forest and discovers the procession carrying Aouda.'],
  ['In Which Passepartout Receives a New Proof That Fortune Favors the Brave', 'Passepartout enters the funeral pyre disguised as the dead rajah and carries Aouda away.'],
  ['In Which Phileas Fogg Descends the Whole Length of the Beautiful Valley of the Ganges Without Ever Thinking of Seeing It', 'Aouda recovers as the party regains the railway and reaches Calcutta.'],
  ['In Which the Bag of Banknotes Disgorges Some Thousands of Pounds More', 'The Bombay temple charge produces a conviction, bail, and another urgent departure.'],
  ['In Which Fix Does Not Seem to Understand in the Least What Is Said to Him', 'Fix joins the Rangoon and misreads Passepartout’s suspicion as willingness to betray Fogg.'],
  ['Showing What Happened on the Voyage from Singapore to Hong Kong', 'A storm delays the Rangoon while Aouda learns that her Hong Kong relative has left.'],
  ['In Which Phileas Fogg, Passepartout, and Fix Go Each About His Business', 'The delayed steamer reaches Hong Kong just before the Carnatic postpones its departure.'],
  ['In Which Passepartout Takes a Too Great Interest in His Master, and What Comes of It', 'Fix reveals his mission to Passepartout and drugs him before he can warn Fogg.'],
  ['In Which Fix Comes Face to Face with Phileas Fogg', 'Fogg misses the Carnatic, hires the Tankadere, and permits Fix to share the risky passage.'],
  ['In Which the Master of the Tankadere Runs Great Risk of Losing a Reward of Two Hundred Pounds', 'Bunsby drives the pilot boat through a typhoon and intercepts the Yokohama steamer at Shanghai.'],
  ['In Which Passepartout Finds Out That, Even at the Antipodes, It Is Convenient to Have Some Money in One’s Pocket', 'Passepartout reaches Yokohama alone, hungry, and penniless.'],
  ['In Which Passepartout’s Nose Becomes Outrageously Long', 'Passepartout joins a circus and collapses its human pyramid when he sees Fogg in the audience.'],
  ['During Which Mr. Fogg and Party Cross the Pacific Ocean', 'The reunited party sails for San Francisco while Fix adopts a new strategy.'],
  ['In Which a Slight Glimpse Is Had of San Francisco', 'A political rally becomes a brawl and Fogg exchanges blows with Colonel Proctor.'],
  ['In Which Phileas Fogg and Party Travel by the Pacific Railroad', 'The transcontinental train leaves Oakland and carries the party into the American interior.'],
  ['In Which Passepartout Undergoes, at a Speed of Twenty Miles an Hour, a Course of Mormon History', 'A missionary lectures aboard the train while the journey crosses Utah.'],
  ['In Which Passepartout Does Not Succeed in Making Anybody Listen to Reason', 'The train crosses a failing bridge at speed and Fogg’s duel with Proctor is interrupted.'],
  ['In Which Certain Incidents Are Narrated Which Are Only to Be Met with on American Railroads', 'Sioux warriors attack the train and Passepartout stops it after the crew is disabled.'],
  ['In Which Phileas Fogg Simply Does His Duty', 'Fogg leads a rescue from Fort Kearny and returns with Passepartout after the train has gone.'],
  ['In Which Fix, the Detective, Considerably Furthers the Interests of Phileas Fogg', 'Fix obtains Mudge’s wind sledge and helps the party regain the railway at Omaha.'],
  ['In Which Phileas Fogg Engages in a Direct Struggle with Bad Fortune', 'The party reaches New York too late for the China, and Fogg searches the harbour for an alternative.'],
  ['In Which Phileas Fogg Shows Himself Equal to the Occasion', 'Fogg takes control of the Henrietta and burns its wooden fittings to reach Ireland.'],
  ['In Which Phileas Fogg at Last Reaches London', 'Fix arrests Fogg at Liverpool, releases him when the error is discovered, and Fogg reaches London apparently late.'],
  ['In Which Phileas Fogg Does Not Have to Repeat His Orders to Passepartout Twice', 'Believing himself ruined, Fogg remains at home until Aouda proposes marriage.'],
  ['In Which Phileas Fogg’s Name Is Once More at a Premium on ’Change', 'London believes Fogg lost until the real date sends Passepartout racing back to Savile Row.'],
  ['In Which It Is Shown That Phileas Fogg Gained Nothing by His Tour Around the World, Unless It Were Happiness', 'Fogg reaches the Reform Club on time, wins the wager, and marries Aouda.'],
]
const chapters = chapterDefs.map(([title, synopsis], index) => ({ ...base, id: chId(index + 1), timelineId, number: index + 1, title, synopsis, notes: '', wordGoal: null }))

const plotThreads = [
  ['wager', 'The Eighty-Day Wager', '#b17c3d', 'The journey is governed by a public deadline, fixed route, and twenty-thousand-pound stake.'],
  ['pursuit', 'Fix’s Pursuit', '#76524b', 'Fix follows Fogg through British territory while trying to obtain and execute an arrest warrant.'],
  ['aouda', 'Aouda’s New Life', '#9a6372', 'A rescue in India develops into companionship, agency, love, and a chosen home.'],
  ['passepartout', 'Passepartout’s Loyalty', '#b4653c', 'The valet’s mistakes, courage, separations, and recoveries repeatedly alter the timetable.'],
  ['time', 'Gaining and Losing Time', '#4d7382', 'Early gains are spent against missed steamers, storms, legal delays, and attacks.'],
  ['bank', 'The Bank Robbery Suspicion', '#6e6258', 'A superficial resemblance turns an innocent traveller into the target of a global police pursuit.'],
  ['transport', 'Improvised Transport', '#527468', 'When timetables fail, money and resolve procure an elephant, pilot boat, wind sledge, and steamer.'],
  ['proctor', 'Fogg and Colonel Proctor', '#85483d', 'A chance quarrel in San Francisco becomes an unfinished duel on the railway.'],
].map(([slug, name, color, description]) => ({ ...base, id: threadId(slug), name, color, description }))

const motifs = [
  ['clocks', 'Clocks and Calendars', '#52758a', 'Mechanical time appears exact until geography changes the meaning of a day.'],
  ['money', 'Money as Momentum', '#a07a3e', 'Fogg converts wealth into speed, rescue, access, and responsibility.'],
  ['routine', 'Routine and Disruption', '#6a6658', 'Fogg’s ordered life is tested by an itinerary made of constant uncertainty.'],
  ['mistaken-identity', 'Mistaken Identity', '#76565b', 'Fix’s error and Passepartout’s disguises show how appearances redirect action.'],
  ['loyalty', 'Service and Loyalty', '#4e7165', 'Employment becomes attachment as Passepartout and Fogg repeatedly risk themselves for others.'],
  ['modernity', 'Modern Networks', '#4c6778', 'Railways, steamships, telegraphs, newspapers, and finance compress the globe while creating new dependencies.'],
  ['spectacle', 'Crowds and Spectacle', '#956142', 'Processions, rallies, circuses, and clubs turn private choices into public events.'],
  ['eastward', 'Travelling East', '#817344', 'Every eastward mile invisibly accumulates the day that resolves the wager.'],
].map(([slug, name, color, description]) => ({ ...base, id: motifId(slug), name, color, description }))

const eventDefs = []
function event(chapter, title, description, loc, states, options = {}) {
  eventDefs.push({ chapter, title, description, loc, states, items: options.items ?? [], mentioned: options.mentioned ?? [], threads: options.threads ?? [], motifs: options.motifs ?? [], tension: options.tension ?? 2, at: options.at, elapsed: options.elapsed ?? 0, pov: options.pov ?? 'passepartout', dead: options.dead ?? [], beat: options.beat ?? null })
}

const day = (month, date, hour = 12, minute = 0) => {
  const monthStarts = { Oct: 274, Nov: 305, Dec: 335 }
  return monthStarts[month] + date - 1 + (hour * 60 + minute) / 1440
}

event(1, 'Passepartout Is Interviewed', 'Passepartout presents his varied employment history and asks for the stable post recently vacated in Fogg’s household.', 'savile-row', {
  fogg: 'Measures the applicant against the household clock and accepts his answers without unnecessary conversation.',
  passepartout: 'Offers his service in hopes that a mathematically regular master will end years of restless employment.',
}, { at: day('Oct', 2, 11, 25), threads: ['passepartout'], motifs: ['routine', 'clocks'], items: ['watch'], tension: 1, elapsed: 0, beat: 'opening-image' })
event(1, 'Master and Servant Agree', 'At half past eleven, Fogg appoints Passepartout and leaves for his daily routine at the Reform Club.', 'savile-row', {
  fogg: 'Names the exact hour from which Passepartout’s service begins and departs on schedule.',
  passepartout: 'Takes possession of the quiet house, confident that he has finally found the ideal master.',
}, { at: day('Oct', 2, 11, 30), threads: ['passepartout'], motifs: ['routine', 'clocks'], tension: 1 })

event(2, 'The Household Timetable Is Studied', 'Alone at Savile Row, Passepartout examines the labelled wardrobe and the schedule governing every detail of Fogg’s day.', 'savile-row', {
  passepartout: 'Reads the domestic programme with delight and sees his own appetite for order reflected in the house.',
}, { at: day('Oct', 2, 12, 0), motifs: ['routine', 'clocks'], items: ['watch'], tension: 1 })
event(2, 'Passepartout Settles In', 'The new valet compares his watch with the house clock and imagines an uneventful future in London.', 'savile-row', {
  passepartout: 'Refuses to reset a watch that runs four minutes slow and relaxes into what he expects will be permanent calm.',
}, { at: day('Oct', 2, 12, 30), threads: ['passepartout'], motifs: ['routine', 'clocks'], items: ['watch'], tension: 1 })

event(3, 'The Bank Robbery Is Debated', 'During whist, the Reform Club members discuss the fifty-five-thousand-pound theft and the difficulty of escaping modern police networks.', 'reform-club', {
  fogg: 'Treats the newspaper account as a problem of distance and connections rather than criminal mystery.',
  stuart: 'Rejects the claim that the world has become small enough to circle in eighty days.',
  sullivan: 'Produces the Morning Chronicle calculation supporting the new itinerary.',
  fallentin: 'Tests the proposed schedule against inevitable accidents and delays.',
  flanagan: 'Joins the challenge once Fogg insists that the published total is sufficient.',
  ralph: 'Connects the travel argument to the bank’s search for its missing cashier’s money.',
}, { at: day('Oct', 2, 19, 30), threads: ['wager', 'bank'], motifs: ['modernity', 'spectacle'], items: ['bradshaw'], tension: 2, pov: 'fogg', beat: 'theme-stated' })
event(3, 'Fogg Makes the Wager', 'Fogg stakes twenty thousand pounds that he will return to the club by 8:45 p.m. on Saturday, 21 December.', 'reform-club', {
  fogg: 'Commits half his fortune and his next eighty days to the timetable without displaying excitement.',
  stuart: 'Accepts Fogg’s challenge and binds the argument to a precise deadline.',
  sullivan: 'Signs the written memorandum for the wager with the other club members.',
  fallentin: 'Becomes one of the five financial opponents waiting for Fogg’s failure.',
  flanagan: 'Adds his share to the collective twenty-thousand-pound stake.',
  ralph: 'Witnesses the agreement and the exact return time entered in writing.',
}, { at: day('Oct', 2, 20, 45), threads: ['wager'], motifs: ['clocks', 'money', 'spectacle'], items: ['bradshaw', 'banknotes'], tension: 3, pov: 'fogg', beat: 'catalyst' })

event(4, 'Pack for a Journey Around the World', 'Fogg returns to Savile Row and gives his astonished valet minutes to pack for immediate departure.', 'savile-row', {
  fogg: 'Selects only the necessities, takes a large roll of banknotes, and keeps his attention on the train.',
  passepartout: 'Abandons his dream of domestic stillness and packs in a daze for a journey he did not know existed.',
}, { at: day('Oct', 2, 20, 52), threads: ['wager', 'passepartout'], motifs: ['routine', 'money'], items: ['carpet-bag', 'banknotes', 'passport', 'railway-tickets'], tension: 3 })
event(4, 'London Is Left Behind', 'At Charing Cross, the club members see Fogg and Passepartout onto the Dover train as the wager begins.', 'charing-cross', {
  fogg: 'Checks the departure against his timetable and starts the circuit with no visible farewell emotion.',
  passepartout: 'Realizes only after the train moves that he left the gas burning in his room at Savile Row.',
  stuart: 'Watches the train depart while expecting geography or chance to defeat the calculation.',
  sullivan: 'Sees the wager pass from an argument into a public journey.',
  fallentin: 'Confirms that Fogg has left at the promised hour.',
  flanagan: 'Begins the eighty-day wait with the other bettors.',
  ralph: 'Observes the suspected coincidence between Fogg’s sudden travel and the bank theft.',
}, { at: day('Oct', 2, 21, 0), threads: ['wager', 'bank', 'passepartout'], motifs: ['clocks', 'eastward', 'modernity'], items: ['carpet-bag', 'banknotes', 'watch'], tension: 3, beat: 'break-into-two' })

event(5, 'Fogg Becomes a Public Speculation', 'Newspapers publish the wager, and London begins to argue over whether the traveller can survive the connections.', 'reform-club', {
  stuart: 'Defends the wager against club members who think Fogg’s attempt has made him a favourite.',
  sullivan: 'Follows the changing odds as public confidence briefly rises.',
  fallentin: 'Finds that every reported obstacle moves the market around Fogg’s name.',
  flanagan: 'Waits for a missed connection to settle the speculation.',
  ralph: 'Keeps the bank robbery in view while the city treats Fogg as a sporting proposition.',
}, { at: day('Oct', 3, 12, 0), threads: ['wager', 'bank'], motifs: ['money', 'spectacle', 'modernity'], tension: 2, pov: 'ralph' })
event(5, 'The Arrest Theory Spreads', 'A police dispatch identifying Fogg as resembling the bank robber turns most betting sharply against him.', 'reform-club', {
  stuart: 'Regards the robbery accusation as another reason the traveller will never return to claim the wager.',
  sullivan: 'Sees Fogg’s market value collapse under a suspicion unsupported by proof.',
  fallentin: 'Reads the detective report as the first concrete threat to the timetable.',
  flanagan: 'Expects arrest to end the journey before natural delays can do so.',
  ralph: 'Treats the resemblance report seriously because the stolen money belongs to his bank.',
}, { at: day('Oct', 6, 16, 0), threads: ['wager', 'bank', 'pursuit'], motifs: ['mistaken-identity', 'spectacle'], tension: 3, pov: 'ralph' })

event(6, 'Fix Watches the Mongolia Arrive', 'At Suez, Fix studies the steamer’s passengers and recognizes Fogg from the circulated description.', 'suez', {
  fix: 'Selects the composed English passenger as his suspect and searches for a way to keep him in British jurisdiction.',
  consul: 'Listens sceptically as Fix claims that the bank robber is about to present himself for a visa.',
  fogg: 'Waits aboard while Passepartout carries the passport ashore.',
  passepartout: 'Looks for the consular office without realizing that a detective is examining his master.',
}, { at: day('Oct', 9, 10, 0), threads: ['pursuit', 'bank', 'time'], motifs: ['mistaken-identity', 'modernity'], items: ['passport', 'warrant'], tension: 3, pov: 'fix' })
event(6, 'The Suspect Comes Ashore', 'Fix persuades Passepartout that the passport must be presented in person, bringing Fogg within sight of the consul.', 'suez', {
  fix: 'Engineers a face-to-face inspection and becomes more certain that his resemblance evidence is correct.',
  passepartout: 'Returns for his master after accepting Fix’s confident but unnecessary advice.',
  fogg: 'Walks to the consulate because the stamp is useful as a record of progress.',
  consul: 'Prepares to apply ordinary passport rules rather than act on Fix’s suspicion.',
}, { at: day('Oct', 9, 10, 30), threads: ['pursuit'], motifs: ['mistaken-identity'], items: ['passport'], tension: 3, pov: 'fix' })

event(7, 'The Consul Stamps the Passport', 'Fogg answers the consul’s questions, receives the visa, and returns immediately to the Mongolia.', 'suez', {
  fogg: 'Uses the stamp to document his route and refuses to waste time sightseeing.',
  consul: 'Finds the passport valid and declines to obstruct a traveller who has committed no visible offence.',
  fix: 'Sees the chance for a Suez arrest disappear while the warrant remains far away.',
}, { at: day('Oct', 9, 11, 0), threads: ['pursuit', 'time'], motifs: ['clocks', 'modernity'], items: ['passport', 'warrant'], tension: 3, pov: 'fix' })
event(7, 'Fix Chooses to Follow', 'Unable to detain Fogg, Fix obtains passage onward and sends urgent instructions for the warrant to reach Bombay.', 'suez', {
  fix: 'Commits himself to the same eastward route so the suspect cannot leave British territory unobserved.',
  consul: 'Lets the traveller proceed and leaves the detective responsible for proving his case.',
}, { at: day('Oct', 9, 11, 30), threads: ['pursuit', 'bank'], motifs: ['eastward', 'modernity'], items: ['warrant'], tension: 3, pov: 'fix' })

event(8, 'Passepartout Explains the Wager', 'During the Suez stop, Passepartout freely tells Fix about the sudden departure, the deadline, and Fogg’s large supply of cash.', 'suez', {
  passepartout: 'Talks with relief to a familiar European and unknowingly supplies every fact that strengthens the detective’s theory.',
  fix: 'Interprets the haste, wealth, and unusual route as the escape plan of a meticulous criminal.',
}, { at: day('Oct', 9, 12, 0), threads: ['pursuit', 'bank', 'passepartout'], motifs: ['mistaken-identity', 'money'], items: ['banknotes', 'watch'], tension: 3, pov: 'fix' })
event(8, 'The Watch Stays on London Time', 'Fix points out the local time, but Passepartout refuses to adjust the watch inherited from his orderly London life.', 'suez', {
  passepartout: 'Defends his watch against geography and carries London time eastward as a point of pride.',
  fix: 'Lets the harmless error stand while concentrating on the information he can use against Fogg.',
}, { at: day('Oct', 9, 12, 20), threads: ['time'], motifs: ['clocks', 'eastward'], items: ['watch'], tension: 1, pov: 'passepartout' })

event(9, 'The Mongolia Crosses the Red Sea', 'Fine weather and disciplined engines carry the steamer toward Aden while Fogg keeps his usual habits aboard.', 'aden', {
  fogg: 'Plays whist and records the ship’s progress without treating the surrounding sea as a spectacle.',
  passepartout: 'Makes himself useful aboard and begins to enjoy motion despite his abandoned hope of rest.',
  fix: 'Cultivates the valet’s company while calculating where the warrant might overtake them.',
}, { at: day('Oct', 13, 12, 0), threads: ['pursuit', 'time'], motifs: ['modernity', 'routine', 'eastward'], items: ['passport', 'watch'], tension: 2 })
event(9, 'Bombay Is Reached Ahead of Schedule', 'The Mongolia completes the Indian Ocean passage two days early, adding time to Fogg’s account.', 'bombay', {
  fogg: 'Credits the gain against the fixed itinerary and prepares for the evening train to Calcutta.',
  passepartout: 'Steps into Bombay eager to explore before departure.',
  fix: 'Finds that the arrest warrant has not arrived and must continue following the suspect.',
}, { at: day('Oct', 20, 16, 30), threads: ['time', 'pursuit'], motifs: ['clocks', 'modernity'], items: ['passport', 'warrant'], tension: 2 })

event(10, 'Passepartout Enters the Temple', 'While Fogg waits at the station, Passepartout wanders into the sacred precinct on Malabar Hill without removing his shoes.', 'malabar-hill', {
  passepartout: 'Admires the unfamiliar building until angry priests confront him over a rule he did not understand.',
  priest: 'Treats the visitor’s footwear and presence as a profanation requiring immediate punishment.',
}, { at: day('Oct', 20, 18, 0), threads: ['passepartout'], motifs: ['mistaken-identity', 'spectacle'], items: ['shoes'], tension: 3 })
event(10, 'The Shoes Are Lost but the Train Is Caught', 'Passepartout fights free, leaves his shoes behind, and reaches the Calcutta train moments before departure.', 'bombay', {
  passepartout: 'Boards barefoot and breathless, concealing how narrowly his excursion endangered the schedule.',
  fogg: 'Receives his disordered valet without delaying the train and begins the trans-Indian leg.',
  fix: 'Learns of the temple offence and sees a legal means to hold Fogg’s party in Calcutta.',
}, { at: day('Oct', 20, 20, 0), threads: ['pursuit', 'time', 'passepartout'], motifs: ['clocks', 'modernity'], items: ['shoes', 'railway-tickets'], tension: 3 })

event(11, 'The Railway Ends at Kholby', 'The passengers are ordered off where the advertised line stops, revealing an unfinished gap before Allahabad.', 'kholby', {
  fogg: 'Accepts the contradiction between newspaper and track as a problem to solve within his two-day gain.',
  passepartout: 'Feels personally betrayed by the missing railway and searches for transport with growing urgency.',
  cromarty: 'Explains the overland distance and joins Fogg in seeking a practical alternative.',
}, { at: day('Oct', 22, 8, 0), threads: ['time', 'transport'], motifs: ['modernity', 'clocks'], items: ['bradshaw', 'railway-tickets'], tension: 3 })
event(11, 'Fogg Buys Kiouni', 'After carts and horses prove unavailable, Fogg offers an escalating price for a trained elephant and hires a Parsee guide.', 'kholby', {
  fogg: 'Pays two thousand pounds for speed without bargaining over the cost to his fortune.',
  passepartout: 'Watches his master convert money into an improbable continuation of the route.',
  cromarty: 'Accepts a place with the party and reassesses Fogg’s supposed indifference.',
  guide: 'Takes responsibility for the forest route and the powerful elephant.',
  kiouni: 'Leaves its former owner equipped to carry the travellers and their bags.',
}, { at: day('Oct', 22, 10, 0), threads: ['time', 'transport'], motifs: ['money', 'loyalty'], items: ['banknotes', 'elephant', 'carpet-bag'], tension: 3 })

event(12, 'The Elephant Crosses the Forest', 'Kiouni carries the party through difficult forest paths while the guide avoids settlements and dangerous ground.', 'jungle-camp', {
  fogg: 'Endures the rough journey with the same composure he shows in a railway carriage.',
  passepartout: 'Struggles with the elephant’s motion while growing fond of the animal’s steadiness.',
  cromarty: 'Shares military knowledge of the region and watches for threats along the route.',
  guide: 'Chooses hidden tracks and controls Kiouni through dense woodland.',
  kiouni: 'Maintains the pace that keeps the party’s railway connection possible.',
}, { at: day('Oct', 22, 17, 0), threads: ['transport', 'time'], motifs: ['eastward', 'loyalty'], items: ['elephant'], tension: 2 })
event(12, 'The Procession Is Observed', 'From concealment, the travellers see a religious procession carrying the drugged Aouda toward the Pillaji temple.', 'pillaji-temple', {
  fogg: 'Learns that the young widow is to die and decides that available time can be spent saving her.',
  passepartout: 'Moves from horror to eager support for intervention.',
  cromarty: 'Confirms the danger and joins the rescue despite the armed procession.',
  guide: 'Identifies Aouda, explains the intended rite, and leads the party toward the temple.',
  aouda: 'Is carried unconscious under guard, unable to resist the ceremony arranged around her.',
  priest: 'Directs the procession and secures the widow inside the temple for the night.',
  kiouni: 'Waits concealed with the party’s baggage beyond the procession route.',
}, { at: day('Oct', 22, 20, 0), threads: ['aouda', 'time', 'passepartout'], motifs: ['spectacle', 'loyalty', 'money'], items: ['palanquin', 'revolver'], tension: 4, beat: 'debate' })

event(13, 'The Temple Guard Blocks the Rescue', 'The rescuers circle the temple at night but find every entrance guarded and wait for a final opportunity at dawn.', 'pillaji-temple', {
  fogg: 'Refuses to abandon Aouda and prepares to use force if stealth remains impossible.',
  passepartout: 'Disappears from the group after conceiving a dangerous plan of his own.',
  cromarty: 'Covers the approach with a revolver while expecting the attempt to fail.',
  guide: 'Keeps the escape route open and Kiouni ready beyond the sacred enclosure.',
  aouda: 'Remains unconscious beside the rajah’s body as the ceremony approaches.',
  priest: 'Maintains guards around the shrine until the funeral procession forms.',
}, { at: day('Oct', 23, 4, 30), threads: ['aouda', 'passepartout'], motifs: ['loyalty', 'mistaken-identity'], items: ['palanquin', 'revolver'], tension: 4 })
event(13, 'Passepartout Rises from the Pyre', 'Disguised as the dead rajah, Passepartout stands amid the flames, lifts Aouda, and reaches the waiting elephant.', 'suttee-clearing', {
  passepartout: 'Turns disguise into a moment of terror, carries Aouda through the stunned crowd, and runs for Kiouni.',
  aouda: 'Is removed unconscious from the pyre and carried beyond the priests’ control.',
  fogg: 'Covers Passepartout’s escape and receives Aouda before ordering immediate flight.',
  cromarty: 'Protects the retreat and recognizes the valet’s extraordinary courage.',
  guide: 'Gets the rescued party onto Kiouni and drives the elephant away from pursuit.',
  priest: 'Mistakes the rising figure for a miracle until the captives are already escaping.',
  kiouni: 'Carries rescuers and rescued woman rapidly away from the funeral ground.',
}, { at: day('Oct', 23, 5, 15), threads: ['aouda', 'passepartout', 'transport'], motifs: ['mistaken-identity', 'loyalty', 'spectacle'], items: ['palanquin', 'revolver', 'elephant'], tension: 5, beat: 'midpoint' })

event(14, 'Aouda Awakens at Allahabad', 'The party reaches Allahabad, rewards the guide with Kiouni, and explains the rescue when Aouda regains consciousness.', 'allahabad', {
  aouda: 'Learns that strangers risked their lives for her and accepts Fogg’s protection toward Hong Kong.',
  fogg: 'Provides clothing and onward passage while treating the rescue as an obligation fully assumed.',
  passepartout: 'Rejoices in Aouda’s recovery and parts emotionally from the elephant.',
  cromarty: 'Prepares to leave the party after seeing Aouda safely aboard the railway.',
  guide: 'Receives Kiouni as Fogg’s reward and ends his service with unexpected wealth.',
  kiouni: 'Passes into the guide’s ownership after completing the overland crossing.',
}, { at: day('Oct', 24, 10, 0), threads: ['aouda', 'transport', 'time'], motifs: ['money', 'loyalty'], items: ['banknotes', 'elephant', 'railway-tickets'], tension: 2 })
event(14, 'The Ganges Valley Passes Unseen', 'The train carries Fogg, Passepartout, and Aouda through Benares toward Calcutta as trust develops among them.', 'benares', {
  fogg: 'Keeps the connection in view while quietly ensuring that Aouda has everything required for the voyage.',
  passepartout: 'Studies his master’s care for Aouda and becomes protective of their new companion.',
  aouda: 'Recovers strength, hears the full history of the wager, and chooses to continue with Fogg.',
}, { at: day('Oct', 24, 20, 0), threads: ['aouda', 'time', 'passepartout'], motifs: ['loyalty', 'eastward', 'modernity'], tension: 2 })

event(15, 'The Temple Case Comes to Court', 'On arrival in Calcutta, officers divert Fogg and Passepartout to court, where the abandoned shoes prove the Bombay charge.', 'calcutta', {
  fogg: 'Refuses to let surprise or accusation alter his calculation and prepares to pay whatever preserves the departure.',
  passepartout: 'Recognizes his shoes and understands that his private mistake has followed the entire party across India.',
  aouda: 'Waits anxiously while the men who rescued her face imprisonment.',
  fix: 'Uses the temple prosecution to hold his suspect while the arrest warrant is redirected eastward.',
  obadiah: 'Hears the evidence and imposes imprisonment and fines under the colonial court.',
  oysterpuff: 'Produces the shoes and identifies them as the physical proof of the offence.',
}, { at: day('Oct', 25, 8, 30), threads: ['pursuit', 'time', 'passepartout'], motifs: ['money', 'modernity'], items: ['shoes', 'warrant'], tension: 4 })
event(15, 'Fogg Pays Bail and Boards the Rangoon', 'Fogg deposits two thousand pounds for bail and reaches the Hong Kong steamer before it sails.', 'calcutta', {
  fogg: 'Sacrifices more money without appeal because minutes matter more than recovering the deposit.',
  passepartout: 'Leaves court free but ashamed that his curiosity cost his master time and cash.',
  aouda: 'Boards the Rangoon beside the men whose journey she now shares.',
  fix: 'Follows aboard after the legal delay fails to secure the bank-robbery arrest he wants.',
  obadiah: 'Releases the defendants when Fogg immediately satisfies the bail requirement.',
}, { at: day('Oct', 25, 12, 0), threads: ['pursuit', 'time', 'aouda'], motifs: ['money', 'clocks', 'eastward'], items: ['banknotes', 'railway-tickets'], tension: 3 })

event(16, 'Fix Tests Passepartout’s Suspicion', 'Aboard the Rangoon, Passepartout hints that he knows Fix has followed them, but mistakes him for an agent of the wager’s backers.', 'calcutta-world', {
  passepartout: 'Teases the detective with partial recognition while remaining unaware of the bank-robbery accusation.',
  fix: 'Mistakes the valet’s jokes for proof that his police identity has been discovered.',
  fogg: 'Resumes whist and timetable calculations without noticing the private contest nearby.',
  aouda: 'Grows more comfortable within the travelling household during the sea passage.',
}, { at: day('Oct', 26, 12, 0), threads: ['pursuit', 'passepartout'], motifs: ['mistaken-identity', 'loyalty'], tension: 2 })
event(16, 'The Detective Decides to Use the Valet', 'Fix considers recruiting Passepartout to delay Fogg before Hong Kong, the final British territory on their eastward route.', 'singapore', {
  fix: 'Plans to turn the valet’s loyalty or confusion into the delay his missing warrant has not provided.',
  passepartout: 'Believes he is watching a harmless spy sent to protect the wager rather than an enemy of his master.',
}, { at: day('Oct', 30, 18, 0), threads: ['pursuit', 'time'], motifs: ['mistaken-identity'], items: ['warrant'], tension: 3, pov: 'fix' })

event(17, 'Singapore Offers a Brief Respite', 'The Rangoon coals at Singapore, where Fogg and Aouda take a carriage through the island before returning aboard.', 'singapore', {
  fogg: 'Uses the scheduled stop without anxiety and remains attentive to Aouda’s comfort.',
  aouda: 'Sees more of the port than Fogg and begins to read tenderness beneath his formal care.',
  passepartout: 'Helps aboard the steamer and watches the deadline survive another connection.',
  fix: 'Keeps close enough to prevent the suspect disappearing while still lacking authority to arrest him.',
}, { at: day('Oct', 31, 14, 0), threads: ['aouda', 'pursuit', 'time'], motifs: ['routine', 'eastward'], tension: 1 })
event(17, 'The Rangoon Loses Time in the Storm', 'A northwesterly gale slows the steamer, threatening the Hong Kong connection to Yokohama.', 'hong-kong', {
  fogg: 'Observes the delay without complaint and asks only for the captain’s revised arrival estimate.',
  passepartout: 'Rages at the engines and weather because every lost hour endangers his master’s fortune.',
  aouda: 'Endures the rough sea while recognizing how completely the wager governs their immediate future.',
  fix: 'Privately welcomes a natural delay that may keep Fogg inside British territory long enough for the warrant.',
}, { at: day('Nov', 3, 18, 0), threads: ['time', 'pursuit'], motifs: ['clocks', 'loyalty', 'modernity'], tension: 3 })

event(18, 'Aouda’s Relative Has Left Hong Kong', 'The party learns that Jejeeh has moved to Europe, leaving Aouda without the expected household in Hong Kong.', 'hong-kong', {
  aouda: 'Faces the loss of her planned refuge and waits to learn whether she must continue alone.',
  fogg: 'Invites Aouda to travel onward to Europe as a matter requiring no hesitation.',
  passepartout: 'Welcomes the decision because he now regards Aouda as part of their company.',
  fix: 'Sees another passenger join the route but remains focused on holding Fogg for arrest.',
}, { at: day('Nov', 6, 15, 0), threads: ['aouda', 'pursuit'], motifs: ['loyalty'], tension: 2 })
event(18, 'The Carnatic’s Departure Is Postponed', 'Engine repairs delay the Yokohama steamer until the next morning, temporarily restoring the lost connection.', 'hong-kong', {
  fogg: 'Accepts the revised sailing as a favourable correction to the storm delay.',
  passepartout: 'Receives instructions to book cabins and later learns that the ship may sail earlier than announced.',
  aouda: 'Prepares to continue east with Fogg rather than separate in Hong Kong.',
  fix: 'Recognizes that the new sailing may be his last chance to prevent Fogg leaving British jurisdiction.',
}, { at: day('Nov', 6, 18, 0), threads: ['time', 'pursuit'], motifs: ['clocks', 'modernity'], items: ['railway-tickets'], tension: 3 })

event(19, 'Fix Reveals His Mission', 'Fix takes Passepartout into a tavern, identifies himself as a detective, and asks for help delaying the supposed robber.', 'hong-kong', {
  fix: 'Abandons indirect questioning and offers money for a delay before the Carnatic sails.',
  passepartout: 'Rejects the accusation against Fogg and finally understands that Fix has been pursuing rather than protecting them.',
}, { at: day('Nov', 6, 21, 0), threads: ['pursuit', 'bank', 'passepartout'], motifs: ['mistaken-identity', 'loyalty', 'money'], items: ['warrant'], tension: 4 })
event(19, 'Passepartout Is Drugged', 'When bribery fails, Fix encourages the already dizzy valet to smoke until opium leaves him unable to warn Fogg.', 'hong-kong', {
  fix: 'Uses the drugged collapse to remove the one person who knows the Carnatic’s new departure time.',
  passepartout: 'Fights through intoxication toward the harbour but loses the ability to return to his master.',
}, { at: day('Nov', 6, 22, 0), threads: ['pursuit', 'time', 'passepartout'], motifs: ['loyalty', 'clocks'], items: ['opium-pipe'], tension: 4 })

event(20, 'Fogg Finds the Carnatic Gone', 'Fogg and Aouda reach the harbour unaware that Passepartout boarded the steamer alone before its early sailing.', 'hong-kong', {
  fogg: 'Receives the missed connection as a fact and immediately begins searching for another vessel.',
  aouda: 'Fears for the missing Passepartout while trusting Fogg’s refusal to surrender the journey.',
  fix: 'Approaches as a fellow stranded passenger and conceals his responsibility for the separation.',
}, { at: day('Nov', 7, 8, 0), threads: ['time', 'pursuit', 'passepartout'], motifs: ['clocks', 'mistaken-identity'], tension: 4 })
event(20, 'The Tankadere Is Hired', 'Fogg hires Bunsby’s pilot boat to reach Shanghai in time for the steamer to Yokohama and allows Fix aboard.', 'hong-kong', {
  fogg: 'Offers a large reward for the difficult passage and treats Fix as another traveller in need of transport.',
  aouda: 'Boards the small vessel despite rough weather and continued uncertainty about Passepartout.',
  fix: 'Accepts Fogg’s generosity while realizing the suspect’s conduct contradicts his criminal theory.',
  bunsby: 'Calculates the weather and agrees to attempt Shanghai for a substantial reward.',
}, { at: day('Nov', 7, 15, 0), threads: ['transport', 'time', 'pursuit'], motifs: ['money', 'loyalty'], items: ['banknotes'], tension: 3 })

event(21, 'The Tankadere Enters the Typhoon', 'Bunsby keeps the pilot boat under sail as violent weather drives it through the Taiwan Strait.', 'tankadere-sea', {
  bunsby: 'Uses every scrap of local seamanship to keep the small craft running before the storm.',
  fogg: 'Remains steady on deck and promises the full reward if the connection can still be made.',
  aouda: 'Endures the exposed crossing with courage while the vessel rolls under breaking seas.',
  fix: 'Shares the physical danger with the man he intends to arrest and grows less certain of his moral judgment.',
}, { at: day('Nov', 8, 20, 0), threads: ['transport', 'time', 'pursuit'], motifs: ['loyalty', 'modernity'], tension: 4 })
event(21, 'The Yokohama Steamer Is Signalled', 'Short of Shanghai but within sight of the departing steamer, Fogg orders the Tankadere’s signal gun fired and secures rescue.', 'tankadere-sea', {
  fogg: 'Turns a near failure into a connection by recognizing the steamer and ordering a distress signal.',
  aouda: 'Sees the distant vessel answer and understands that the Pacific route remains open.',
  fix: 'Boards the Yokohama steamer with the pursuit intact but no longer able to arrest Fogg until America or England.',
  bunsby: 'Brings the Tankadere close enough for the signal to be seen and earns the promised reward.',
}, { at: day('Nov', 11, 7, 0), threads: ['transport', 'time', 'pursuit'], motifs: ['clocks', 'money', 'modernity'], items: ['banknotes'], tension: 4 })

event(22, 'Passepartout Wakes in Yokohama', 'After travelling aboard the Carnatic in a stupor, Passepartout wakes alone in Yokohama without money or knowledge of Fogg’s fate.', 'yokohama-harbor', {
  passepartout: 'Realizes that he reached Japan while his master may still be stranded, and blames himself for the separation.',
}, { at: day('Nov', 13, 8, 0), threads: ['passepartout', 'time'], motifs: ['loyalty', 'money'], tension: 3 })
event(22, 'Hunger Drives Passepartout to Seek Work', 'Unable to sell his European clothes for enough food, Passepartout wanders the native quarter looking for paid employment.', 'yokohama-streets', {
  passepartout: 'Trades dignity for survival, advertises his acrobatic skills, and refuses to stop searching for a route home.',
}, { at: day('Nov', 13, 13, 0), threads: ['passepartout'], motifs: ['money', 'spectacle'], tension: 2 })

event(23, 'Passepartout Joins the Long Noses', 'Batulcar hires the former acrobat to support the final human pyramid in a grotesque ceremonial costume.', 'long-noses', {
  passepartout: 'Accepts a place at the base of the troupe’s pyramid because the wage can carry him toward America.',
  batulcar: 'Uses the strong newcomer to complete his farewell performance before the circus leaves Japan.',
}, { at: day('Nov', 13, 18, 30), threads: ['passepartout'], motifs: ['spectacle', 'mistaken-identity', 'money'], items: ['circus-costume'], tension: 2 })
event(23, 'The Human Pyramid Collapses into Reunion', 'Passepartout spots Fogg and Aouda in the audience, breaks formation, and reaches them amid the fallen performers.', 'long-noses', {
  passepartout: 'Forgets costume, employment, and audience the instant he recognizes his master.',
  fogg: 'Finds the missing valet alive and immediately leads the reunited party toward the Pacific steamer.',
  aouda: 'Welcomes Passepartout with relief after days of uncertainty about his fate.',
  batulcar: 'Sees his finale destroyed and accepts Fogg’s compensation for the ruined performance.',
}, { at: day('Nov', 13, 19, 0), threads: ['passepartout', 'aouda', 'time'], motifs: ['spectacle', 'loyalty', 'money'], items: ['circus-costume', 'banknotes'], tension: 4 })

event(24, 'The General Grant Leaves Yokohama', 'Fogg, Aouda, Passepartout, and Fix board the Pacific Mail steamer for San Francisco.', 'general-grant-berth', {
  fogg: 'Secures the next major connection with the party restored and the timetable still viable.',
  passepartout: 'Returns to his duties but keeps Fix’s identity secret to avoid distracting his master.',
  aouda: 'Continues toward Europe with affection for Fogg deepening during the long crossing.',
  fix: 'Changes tactics because arrest is impossible outside British territory and Fogg must now reach England before he can be detained.',
  mandiboy: 'Takes the reunited passengers aboard and begins the scheduled Pacific crossing.',
}, { at: day('Nov', 14, 10, 0), threads: ['time', 'pursuit', 'aouda', 'passepartout'], motifs: ['eastward', 'modernity', 'loyalty'], items: ['railway-tickets'], tension: 2 })
event(24, 'Fix Promises to Help Reach England', 'On the Pacific, Fix tells Passepartout that their interests now align until Fogg returns to British soil.', 'general-grant', {
  fix: 'Commits to removing obstacles so the suspect reaches the jurisdiction where the warrant can be served.',
  passepartout: 'Accepts the temporary alliance while threatening Fix with personal consequences after the wager is safe.',
  fogg: 'Maintains his daily routine during the twenty-one-day crossing.',
  aouda: 'Recognizes the emotional reserve that still separates Fogg’s actions from any declaration of feeling.',
}, { at: day('Nov', 22, 12, 0), threads: ['pursuit', 'time', 'aouda'], motifs: ['loyalty', 'routine'], items: ['warrant', 'watch'], tension: 2 })

event(25, 'San Francisco’s Election Meeting Erupts', 'A political rally fills the streets, and the travelling party is caught between rival clubs.', 'san-francisco', {
  fogg: 'Protects Aouda as banners, fists, and sticks turn civic spectacle into a melee.',
  aouda: 'Stays close to Fogg while the crowd closes around their carriage route.',
  passepartout: 'Uses his strength to clear space and defend his companions.',
  fix: 'Fights beside the man he still intends to arrest because their route now depends on mutual survival.',
  proctor: 'Forces a confrontation with Fogg in the middle of the riot.',
}, { at: day('Dec', 3, 12, 0), threads: ['proctor', 'pursuit'], motifs: ['spectacle', 'loyalty'], tension: 4 })
event(25, 'Fogg Vows to Meet Proctor Again', 'After Proctor insults and strikes him, Fogg records the colonel’s name before leaving for the train.', 'san-francisco', {
  fogg: 'Suppresses immediate retaliation so the timetable survives but promises himself a future reckoning.',
  proctor: 'Leaves the encounter having created a personal enemy who refuses to forget the insult.',
  passepartout: 'Burns with anger that the deadline prevents him and Fogg from answering the attack.',
  aouda: 'Sees Fogg place duty to the journey ahead of wounded pride.',
  fix: 'Keeps the party moving toward Oakland and away from further delay.',
}, { at: day('Dec', 3, 13, 0), threads: ['proctor', 'time'], motifs: ['clocks', 'loyalty'], tension: 3 })

event(26, 'The Pacific Railroad Journey Begins', 'The party boards the eastbound train at Oakland for the long scheduled crossing to New York.', 'oakland', {
  fogg: 'Calculates the seven-day railway leg and settles into the carriage with no remaining reserve for major delay.',
  passepartout: 'Inspects the American train and watches for any repeat of the San Francisco quarrel.',
  aouda: 'Takes her place beside Fogg for a crossing through unfamiliar winter country.',
  fix: 'Treats every eastbound mile as progress toward the jurisdiction of his warrant.',
  conductor: 'Starts the train onto the continuous route joining the Pacific coast to the Missouri network.',
}, { at: day('Dec', 3, 18, 0), threads: ['time', 'pursuit'], motifs: ['modernity', 'eastward'], items: ['railway-tickets', 'watch'], tension: 2 })
event(26, 'The Train Crosses the Sierra Nevada', 'Snowy grades, tunnels, and mountain curves carry the train toward the interior without losing the schedule.', 'oakland', {
  fogg: 'Reads and plays whist while the railway climbs, trusting the network on which his wager depends.',
  passepartout: 'Studies the landscape and the machinery with more curiosity than his master permits himself.',
  aouda: 'Watches the mountain crossing and shares the quiet routine of the compartment.',
  fix: 'Remains useful and unobtrusive while guarding against delays that would keep Fogg from England.',
  conductor: 'Manages the winter ascent and keeps the train moving through the high passes.',
}, { at: day('Dec', 4, 10, 0), threads: ['time'], motifs: ['modernity', 'routine'], tension: 2 })

event(27, 'Elder Hitch Lectures on Mormon History', 'A travelling missionary gathers passengers in a railway car and gives a rapid history of Mormon settlement.', 'medicine-bow', {
  passepartout: 'Listens politely as the audience dwindles until practical curiosity outlasts almost everyone else.',
  fogg: 'Continues his own routine elsewhere on the train, untouched by the lecture.',
  aouda: 'Travels steadily east while Passepartout explores another passing culture.',
  fix: 'Keeps watch over the journey rather than attend the lecture.',
}, { at: day('Dec', 5, 10, 0), threads: ['time'], motifs: ['spectacle', 'modernity'], tension: 1 })
event(27, 'A Mormon Husband Flees the Train', 'A man pursued by an additional wife jumps off at speed, giving Passepartout an abrupt comic end to the lesson.', 'medicine-bow', {
  passepartout: 'Sees private desperation replace the missionary’s grand history and returns to his companions amused.',
  conductor: 'Keeps the train moving while the fleeing passenger chooses the trackside over domestic pursuit.',
}, { at: day('Dec', 5, 11, 0), motifs: ['spectacle', 'modernity'], tension: 1 })

event(28, 'The Train Charges across the Failing Bridge', 'At Medicine Bow, the engineer drives the train over a weakened suspension bridge before it collapses behind them.', 'medicine-bow', {
  fogg: 'Accepts the conductor’s dangerous calculation because stopping would destroy the connection.',
  passepartout: 'Proposes crossing on foot but is ignored as speed becomes the chosen solution.',
  aouda: 'Endures the violent passage and sees the bridge fall once every carriage is clear.',
  fix: 'Supports the attempt because reaching England now serves his own purpose.',
  conductor: 'Orders full speed so momentum carries the train across the unsupported span.',
}, { at: day('Dec', 6, 9, 0), threads: ['time'], motifs: ['modernity', 'clocks'], tension: 4 })
event(28, 'The Duel Is Interrupted', 'Fogg and Proctor prepare to duel in the baggage car, but an attack on the train forces them to take up a common defence.', 'medicine-bow', {
  fogg: 'Keeps his promise to face Proctor until the greater danger demands immediate action.',
  proctor: 'Accepts the duel and then turns his weapon toward the attackers outside the train.',
  passepartout: 'Tries unsuccessfully to postpone the honour dispute until the timetable is safe.',
  aouda: 'Fears that a voluntary duel will waste the life Fogg has risked for others.',
  fix: 'Offers to substitute for Fogg so the wager need not be endangered.',
}, { at: day('Dec', 6, 14, 0), threads: ['proctor', 'time', 'pursuit'], motifs: ['loyalty', 'clocks'], items: ['revolver'], tension: 4 })

event(29, 'Sioux Warriors Board the Train', 'Attackers leap onto the moving cars, and a running battle spreads from the platforms to the engine.', 'fort-kearny', {
  fogg: 'Defends the passengers with controlled fire while tracking the train’s loss of command.',
  passepartout: 'Climbs beneath the moving carriages to reach the linkage between engine and train.',
  aouda: 'Uses a revolver from the carriage and refuses to remain a passive object of rescue.',
  fix: 'Fights beside Aouda and the passengers against the boarders.',
  proctor: 'Is wounded while defending the train during the interrupted duel.',
  conductor: 'Falls injured after the crew loses control of the locomotive.',
}, { at: day('Dec', 7, 11, 0), threads: ['time', 'passepartout', 'proctor'], motifs: ['loyalty', 'modernity'], items: ['revolver'], tension: 5 })
event(29, 'Passepartout Stops the Train', 'Passepartout separates the engine from the carriages, allowing the brakes to halt the survivors near Fort Kearny before he is captured.', 'fort-kearny', {
  passepartout: 'Crawls beneath the axle line, releases the coupling, and sacrifices his own safety to save the passengers.',
  fogg: 'Finds the train secured but discovers that his valet has been carried away.',
  aouda: 'Survives the attack and immediately shares Fogg’s fear for Passepartout.',
  fix: 'Sees the deadline endangered by the loss of the man he drugged in Hong Kong.',
  conductor: 'Brings the detached carriages to rest within reach of the military post.',
}, { at: day('Dec', 7, 11, 30), threads: ['passepartout', 'time'], motifs: ['loyalty', 'clocks'], tension: 5 })

event(30, 'Fogg Leads the Rescue', 'Fogg refuses to abandon Passepartout, recruits soldiers at Fort Kearny, and follows the attackers despite the departing train.', 'fort-kearny', {
  fogg: 'Chooses his servant’s life over the wager and personally joins the armed pursuit.',
  aouda: 'Waits at the fort with fear and admiration for the duty Fogg accepts.',
  fix: 'Stays with Aouda and the baggage while recognizing that the supposed robber has sacrificed his best chance of escape.',
  passepartout: 'Remains a captive beyond the fort after saving the train.',
}, { at: day('Dec', 7, 13, 0), threads: ['passepartout', 'time', 'pursuit'], motifs: ['loyalty', 'money'], items: ['revolver'], tension: 4 })
event(30, 'The Rescue Party Returns', 'Fogg brings Passepartout and the other captives back alive, only to find the eastbound train long gone.', 'fort-kearny', {
  fogg: 'Returns successful in the rescue and immediately asks what transport can recover the lost hours.',
  passepartout: 'Reaches safety exhausted and tormented that his rescue may have cost Fogg the wager.',
  aouda: 'Receives both men with relief that outweighs the vanished connection.',
  fix: 'Moves from witness to active helper because he needs Fogg to reach England.',
}, { at: day('Dec', 7, 20, 0), threads: ['passepartout', 'time', 'pursuit'], motifs: ['loyalty', 'clocks'], tension: 3 })

event(31, 'Fix Finds the Wind Sledge', 'Fix locates Mudge and persuades Fogg to cross the frozen plains under sail toward Omaha.', 'fort-kearny', {
  fix: 'Uses money and urgency to secure the only transport capable of recovering the railway connection.',
  fogg: 'Accepts the exposed ride after confirming that the wind can deliver them to Omaha in time.',
  passepartout: 'Boards the sledge grateful for Fix’s help but still distrustful of his ultimate purpose.',
  aouda: 'Wraps against the winter crossing and continues without complaint.',
  mudge: 'Sets the sail and judges a fast line over the frozen ground.',
}, { at: day('Dec', 8, 7, 0), threads: ['transport', 'time', 'pursuit'], motifs: ['money', 'loyalty'], items: ['sledge-sail', 'banknotes'], tension: 3 })
event(31, 'Omaha Restores the Railway Route', 'The wind sledge reaches Omaha, and rapid connections carry the party through Chicago toward New York.', 'omaha', {
  fogg: 'Transfers directly to the railway with the Atlantic steamer still barely within reach.',
  passepartout: 'Feels the lost train’s hours shrink as Mudge’s improvised vehicle earns its reward.',
  aouda: 'Returns to enclosed railway travel after the punishing cold of the plains.',
  fix: 'Keeps every transfer moving because an English arrest now depends on Fogg winning the race to the coast.',
  mudge: 'Delivers the passengers to the junction and receives payment for the successful crossing.',
}, { at: day('Dec', 8, 16, 0), threads: ['transport', 'time', 'pursuit'], motifs: ['modernity', 'money', 'clocks'], items: ['sledge-sail', 'railway-tickets', 'banknotes'], tension: 3 })

event(32, 'The China Sails without Fogg', 'The train reaches New York at 11:15 p.m., forty-five minutes after the Liverpool steamer’s departure.', 'new-york', {
  fogg: 'Confirms the missed sailing without reproach and turns immediately from scheduled travel to private negotiation.',
  passepartout: 'Sees the consequence of every accumulated delay concentrated in an empty berth.',
  aouda: 'Remains beside Fogg as the published itinerary finally fails outright.',
  fix: 'Loses the simplest path to British territory and helps search for another ship.',
}, { at: day('Dec', 11, 23, 15), threads: ['time', 'transport', 'pursuit'], motifs: ['clocks', 'modernity'], tension: 4 })
event(32, 'Fogg Searches New York Harbour', 'At dawn Fogg canvasses the waterfront and finds Captain Speedy willing to sail only as far as Bordeaux.', 'new-york', {
  fogg: 'Conceals the intended change of destination and charters the Henrietta at a lavish per-passenger price.',
  passepartout: 'Follows his master back to sea with renewed hope and no certainty about the plan.',
  aouda: 'Boards another improvised connection after Fogg assures her that England remains possible.',
  fix: 'Accepts passage because any European landfall can return the suspect to British jurisdiction.',
  speedy: 'Refuses to surrender command or sail to Liverpool but accepts an exceptionally profitable charter to Bordeaux.',
}, { at: day('Dec', 12, 7, 0), threads: ['transport', 'time', 'pursuit'], motifs: ['money', 'mistaken-identity'], items: ['banknotes', 'henrietta'], tension: 3 })

event(33, 'Fogg Takes Command of the Henrietta', 'Once at sea, the crew confines Speedy and turns the steamer northeast under Fogg’s purchased authority.', 'henrietta', {
  fogg: 'Uses money and calm leadership to redirect the willing crew toward Liverpool.',
  passepartout: 'Helps the crew work the ship and delights in his master’s unexpectedly piratical solution.',
  aouda: 'Trusts Fogg’s command even as the charter becomes something more radical.',
  fix: 'Travels toward his legal objective while watching Fogg acquire a ship rather than surrender.',
  speedy: 'Rages in confinement after discovering that his vessel no longer follows the agreed destination.',
}, { at: day('Dec', 13, 12, 0), threads: ['transport', 'time', 'pursuit'], motifs: ['money', 'modernity'], items: ['henrietta', 'banknotes'], tension: 3 })
event(33, 'The Henrietta Burns Herself for Speed', 'When coal runs short, Fogg buys the ship and feeds its wooden fittings to the boilers until Queenstown comes within reach.', 'henrietta', {
  fogg: 'Pays Speedy sixty thousand dollars for the vessel and sacrifices it piece by piece to preserve the deadline.',
  passepartout: 'Carries doors, rails, and fittings toward the furnaces as the ship is stripped around him.',
  aouda: 'Watches Fogg spend nearly everything rather than accept defeat.',
  fix: 'Sees the suspect’s fortune consumed in the effort to return voluntarily to arrest.',
  speedy: 'Accepts an extraordinary sale price and protects the engine and iron hull while the superstructure burns.',
}, { at: day('Dec', 19, 12, 0), threads: ['transport', 'time', 'pursuit'], motifs: ['money', 'clocks', 'loyalty'], items: ['henrietta', 'banknotes'], tension: 4 })

event(34, 'Fix Arrests Fogg at Liverpool', 'After landing through Queenstown, Fogg reaches Liverpool and is taken into custody under the long-awaited warrant.', 'liverpool', {
  fogg: 'Submits to arrest while calculating that detention has destroyed the last possible train to London.',
  passepartout: 'Turns on Fix in fury now that the detective has used their arrival to end the wager.',
  aouda: 'Waits outside the cell unable to overcome the authority Fogg’s generosity brought him home to face.',
  fix: 'Executes the warrant in British territory and believes the months-long pursuit complete.',
}, { at: day('Dec', 20, 11, 40), threads: ['pursuit', 'bank', 'time'], motifs: ['mistaken-identity', 'clocks'], items: ['warrant'], tension: 5 })
event(34, 'The Error Is Corrected Too Late', 'Fix releases Fogg after learning the real robber was arrested; a special train reaches London at 8:50 p.m., apparently five minutes late.', 'london-terminus', {
  fogg: 'Strikes Fix once, hires the fastest possible special train, and reaches London believing the wager lost.',
  passepartout: 'Shares responsibility for the desperate final rail journey and the crushing five-minute delay.',
  aouda: 'Returns to London beside a man who has spent his fortune and appears to have lost his remaining stake.',
  fix: 'Admits the mistaken identity and absorbs Fogg’s single blow before the travellers leave him behind.',
}, { at: day('Dec', 20, 20, 50), threads: ['pursuit', 'bank', 'time'], motifs: ['mistaken-identity', 'clocks', 'modernity'], items: ['warrant', 'banknotes'], tension: 5 })

event(35, 'Fogg Faces Apparent Ruin', 'At Savile Row, Fogg withdraws to calculate his remaining money and prepares to live in reduced circumstances.', 'savile-row', {
  fogg: 'Believes honour satisfied but fortune lost, and isolates himself rather than expose Aouda to his despair.',
  passepartout: 'Blames his own mistakes for the ruin and waits helplessly outside his master’s room.',
  aouda: 'Understands that Fogg’s reserve now hides grief rather than indifference.',
}, { at: day('Dec', 21, 12, 0), threads: ['wager', 'aouda', 'passepartout'], motifs: ['money', 'routine'], tension: 3 })
event(35, 'Aouda Proposes Marriage', 'Aouda offers to become Fogg’s wife, and his acceptance sends Passepartout to arrange the ceremony with Reverend Wilson.', 'savile-row', {
  aouda: 'Refuses gratitude without companionship and openly offers the future Fogg cannot ask for.',
  fogg: 'Recognizes that he loves Aouda and accepts happiness even while believing himself financially ruined.',
  passepartout: 'Explodes into action at the order to find a clergyman for the next day.',
}, { at: day('Dec', 21, 19, 0), threads: ['aouda', 'wager'], motifs: ['loyalty', 'clocks'], tension: 2, beat: 'all-is-lost' })

event(36, 'London Waits for a Man It Thinks Defeated', 'At the Reform Club, the five bettors watch the clock as no reliable report explains Fogg’s disappearance after New York.', 'reform-club', {
  stuart: 'Insists that the final seconds must pass before the wager is declared won.',
  sullivan: 'Tracks the club clock while the possibility of an unreported arrival narrows.',
  fallentin: 'Reviews the known timetable and sees no route by which Fogg can appear.',
  flanagan: 'Waits beside the whist table for the contractual deadline.',
  ralph: 'Separates the wager from the solved bank robbery and watches for Fogg himself.',
}, { at: day('Dec', 21, 19, 30), threads: ['wager'], motifs: ['clocks', 'spectacle', 'modernity'], tension: 4, pov: 'stuart' })
event(36, 'Passepartout Discovers the True Date', 'Reverend Wilson explains that it is Saturday, not Sunday, and Passepartout races back with the day gained by travelling east.', 'wilson-house', {
  passepartout: 'Understands the watch, sunrise, and date at once, then runs for Savile Row with the wager suddenly alive.',
  wilson: 'Corrects the requested wedding date and unknowingly reveals the decisive calendar fact.',
}, { at: day('Dec', 21, 20, 0), threads: ['wager', 'time', 'passepartout'], motifs: ['clocks', 'eastward', 'modernity'], items: ['watch'], tension: 5, beat: 'break-into-three' })

event(37, 'Fogg Reaches the Reform Club', 'Passepartout brings Fogg to a cab, and after a final collision and sprint the traveller enters the club at 8:45 p.m.', 'reform-club', {
  fogg: 'Crosses the threshold at the exact contractual second and announces his return with composure restored.',
  passepartout: 'Delivers his master to Pall Mall after turning the invisible gained day into five decisive minutes.',
  stuart: 'Sees the apparently impossible traveller enter before the deadline expires.',
  sullivan: 'Confirms the club clock and the completion of the published circuit.',
  fallentin: 'Accepts that every interruption still left Fogg inside the eighty days.',
  flanagan: 'Loses his share of the wager at the instant Fogg appears.',
  ralph: 'Witnesses the innocent traveller’s return after the bank case has already collapsed.',
}, { at: day('Dec', 21, 20, 45), threads: ['wager', 'time', 'passepartout'], motifs: ['clocks', 'eastward', 'spectacle'], items: ['watch', 'bradshaw'], tension: 5, beat: 'climax' })
event(37, 'The Journey Ends in Marriage', 'Fogg’s winnings barely cover the immense cost of travel, but Aouda and the life found together make the circuit worthwhile.', 'savile-row', {
  fogg: 'Returns home with little financial profit and a future transformed by affection rather than routine.',
  aouda: 'Marries Fogg and makes the journey’s human consequence more important than the wager.',
  passepartout: 'Calculates that leaving the gas burning cost nineteen hundred and twenty hours of fuel, then accepts the happy ending.',
  wilson: 'Conducts the marriage that Passepartout’s calendar discovery made possible on the intended day.',
}, { at: day('Dec', 22, 11, 30), threads: ['wager', 'aouda', 'passepartout'], motifs: ['money', 'routine', 'loyalty'], tension: 1, beat: 'final-image' })

const events = eventDefs.map((entry, index) => ({
  ...base,
  id: id('event', String(index + 1).padStart(3, '0')),
  chapterId: chId(entry.chapter), timelineId, title: entry.title, description: entry.description,
  locationMarkerId: locId(entry.loc), involvedCharacterIds: Object.keys(entry.states).map(charId), mentionedCharacterIds: entry.mentioned.map(charId), involvedItemIds: entry.items.map(itemId),
  tags: [`chapter-${entry.chapter}`], threadIds: entry.threads.map(threadId), motifIds: entry.motifs.map(motifId), sortOrder: index,
  travelDays: index === 0 ? 0 : Math.max(0, entry.at - eventDefs[index - 1].at), inWorldTime: Math.floor(entry.at), tension: entry.tension, structureBeat: entry.beat, status: 'final', povCharacterId: entry.pov ? charId(entry.pov) : null, isFlashback: false,
}))
const eventByTitle = new Map(events.map(row => [row.title, row]))
const findEvent = title => {
  const found = eventByTitle.get(title)
  if (!found) throw new Error(`Unknown event: ${title}`)
  return found.id
}

const characterSnapshots = []
for (const [index, entry] of eventDefs.entries()) {
  const eventRow = events[index]
  const locationRow = locationMarkers.find(row => row.id === eventRow.locationMarkerId)
  const sortKey = entry.chapter + eventRow.sortOrder / 1_000_000
  for (const [slug, statusNotes] of Object.entries(entry.states)) {
    characterSnapshots.push({ ...base, id: id('snapshot', `${index + 1}-${slug}`), characterId: charId(slug), eventId: eventRow.id, isAlive: !entry.dead.includes(slug), currentLocationMarkerId: eventRow.locationMarkerId, currentMapLayerId: locationRow.mapLayerId, inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey, statusNotes })
  }
}

const relationshipDefs = [
  ['fogg', 'passepartout', 'master and devoted servant', 5, 'positive', 'A contractual household role becomes mutual loyalty as each repeatedly places the other above the wager.', false, 'Passepartout Is Interviewed'],
  ['fogg', 'aouda', 'rescuer, companion, and husband', 5, 'positive', 'Fogg’s formal protection grows into a love neither recognizes until apparent defeat removes the timetable between them.', true, 'The Procession Is Observed'],
  ['passepartout', 'aouda', 'rescuer and protective friend', 5, 'positive', 'Passepartout physically frees Aouda and thereafter treats her safety and happiness as part of his service.', true, 'Passepartout Rises from the Pyre'],
  ['fogg', 'fix', 'suspect and pursuing detective', 5, 'negative', 'Fix’s mistaken certainty turns Fogg’s route into a pursuit, even as shared dangers force cooperation.', false, 'Fix Watches the Mongolia Arrive'],
  ['passepartout', 'fix', 'confidant turned adversary', 5, 'negative', 'Casual shipboard friendship becomes hostility when Passepartout learns that Fix means to arrest Fogg.', true, 'Passepartout Explains the Wager'],
  ['fogg', 'cromarty', 'travelling companions', 3, 'positive', 'Cromarty shares the unfinished railway crossing and the decision to rescue Aouda.', true, 'The Railway Ends at Kholby'],
  ['fogg', 'guide', 'employer and guide', 4, 'positive', 'Fogg trusts the guide’s knowledge and rewards his courageous assistance with Kiouni.', false, 'Fogg Buys Kiouni'],
  ['passepartout', 'kiouni', 'passenger and fond caretaker', 3, 'positive', 'Passepartout begins uncomfortable on the elephant and parts from it with genuine affection.', false, 'Fogg Buys Kiouni'],
  ['fogg', 'bunsby', 'charterer and pilot', 4, 'positive', 'Bunsby’s judgement and Fogg’s reward turn a small pilot boat into the route’s crucial link.', false, 'The Tankadere Is Hired'],
  ['passepartout', 'batulcar', 'acrobat and employer', 2, 'mixed', 'Batulcar gives the stranded valet work, then sees the performance destroyed by an emotional reunion.', false, 'Passepartout Joins the Long Noses'],
  ['fogg', 'proctor', 'honour-bound adversaries', 4, 'negative', 'A street insult produces a duel repeatedly postponed by the demands of the journey.', true, 'San Francisco’s Election Meeting Erupts'],
  ['fogg', 'mudge', 'passenger and driver', 4, 'positive', 'Mudge’s practical command of the wind sledge restores the lost rail connection.', false, 'Fix Finds the Wind Sledge'],
  ['fogg', 'speedy', 'charterer, captor, and buyer', 4, 'mixed', 'Fogg violates the agreed destination but ultimately pays Speedy an extraordinary price for the Henrietta.', false, 'Fogg Searches New York Harbour'],
  ['fogg', 'stuart', 'opposing bettors', 4, 'neutral', 'Their disagreement over the new timetable becomes the binding eighty-day wager.', true, 'The Bank Robbery Is Debated'],
  ['fogg', 'ralph', 'club members and opposing bettors', 3, 'neutral', 'Ralph’s bank has been robbed, giving the wager an accidental connection to the suspicion that follows Fogg.', true, 'The Bank Robbery Is Debated'],
  ['aouda', 'fix', 'uneasy travelling companions', 2, 'mixed', 'Fix helps protect Aouda in America while concealing that he intends to arrest the man she loves.', true, 'The Tankadere Is Hired'],
]
const relationships = relationshipDefs.map(([a, b, label, strength, sentiment, description, isBidirectional, start]) => ({ ...base, id: id('relationship', `${a}-${b}`), characterAId: charId(a), characterBId: charId(b), label, strength, sentiment, description, isBidirectional, startEventId: findEvent(start) }))

const placementDefs = [
  ['watch', 'Passepartout Is Interviewed', 'savile-row', 'Passepartout compares his own watch with the exact clocks of the new household.'],
  ['bradshaw', 'The Bank Robbery Is Debated', 'reform-club', 'The published timetable supports the proposed eighty-day total.'],
  ['banknotes', 'Pack for a Journey Around the World', 'savile-row', 'Fogg places a large reserve of notes in the carpet-bag.'],
  ['carpet-bag', 'London Is Left Behind', 'charing-cross', 'Passepartout carries the lightly packed bag onto the Dover train.'],
  ['passport', 'The Consul Stamps the Passport', 'suez', 'The Suez visa records the party’s arrival on the planned route.'],
  ['shoes', 'The Shoes Are Lost but the Train Is Caught', 'malabar-hill', 'The priests retain the footwear Passepartout abandons during his escape.'],
  ['elephant', 'Fogg Buys Kiouni', 'kholby', 'Kiouni is equipped for the unfinished section of the journey.'],
  ['palanquin', 'The Procession Is Observed', 'pillaji-temple', 'Aouda is carried under guard toward the funeral ground.'],
  ['shoes', 'The Temple Case Comes to Court', 'calcutta', 'Oysterpuff produces the shoes as evidence of the Bombay offence.'],
  ['opium-pipe', 'Passepartout Is Drugged', 'hong-kong', 'Fix uses the tavern’s opium to prevent a warning from reaching Fogg.'],
  ['circus-costume', 'Passepartout Joins the Long Noses', 'long-noses', 'Batulcar outfits Passepartout for the human pyramid.'],
  ['revolver', 'Sioux Warriors Board the Train', 'fort-kearny', 'The travellers use their weapons to defend the moving railway cars.'],
  ['sledge-sail', 'Fix Finds the Wind Sledge', 'fort-kearny', 'Mudge raises the sail for the winter crossing to Omaha.'],
  ['henrietta', 'Fogg Searches New York Harbour', 'new-york', 'Speedy accepts the party aboard under a charter nominally bound for Bordeaux.'],
  ['henrietta', 'The Henrietta Burns Herself for Speed', 'henrietta', 'Fogg buys the ship before feeding its wooden fittings to the furnaces.'],
  ['watch', 'Passepartout Discovers the True Date', 'wilson-house', 'The unchanged London time helps explain the day accumulated by travelling east.'],
]
const itemPlacements = placementDefs.map(([item, title, loc, notes], index) => {
  const eventRow = eventByTitle.get(title)
  const chapterNumber = Number(eventRow.chapterId.slice(-2))
  return { ...base, id: id('placement', String(index + 1)), itemId: itemId(item), eventId: eventRow.id, locationMarkerId: locId(loc), sortKey: chapterNumber + eventRow.sortOrder / 1_000_000, notes }
})

const factionDefs = [
  ['travellers', 'Fogg’s Travelling Party', 'The changing company bound together by the wager, rescue, loyalty, and the shared eastward route.', '#4e7280', 'plate-35'],
  ['reform-club', 'Reform Club Bettors', 'The six whist players whose written agreement turns a newspaper itinerary into a public financial test.', '#74634f', 'plate-3'],
  ['detective-office', 'British Detective Police', 'The investigative authority directing Fix to identify the bank robber and secure an arrest within British jurisdiction.', '#685b58', 'plate-7'],
  ['transport-crews', 'Railway and Steamship Crews', 'The captains, pilots, conductors, engineers, and sailors whose skill makes the modern route possible.', '#4d6c70', 'plate-50'],
]
const factions = factionDefs.map(([slug, name, description, color, artwork]) => ({ ...base, id: id('faction', slug), name, description, color, coverImageId: imageId(artwork), tags: [] }))
const membershipDefs = [
  ['travellers', 'fogg', 'leader and wager holder', 'London Is Left Behind', null],
  ['travellers', 'passepartout', 'valet and rescuer', 'London Is Left Behind', null],
  ['travellers', 'aouda', 'companion', 'Aouda Awakens at Allahabad', null],
  ['travellers', 'cromarty', 'India travelling companion', 'The Railway Ends at Kholby', 'Aouda Awakens at Allahabad'],
  ['travellers', 'fix', 'temporary companion with concealed purpose', 'The Tankadere Is Hired', 'Fix Arrests Fogg at Liverpool'],
  ['reform-club', 'fogg', 'bettor', 'The Bank Robbery Is Debated', 'Fogg Reaches the Reform Club'],
  ['reform-club', 'stuart', 'bettor', 'Fogg Makes the Wager', 'Fogg Reaches the Reform Club'],
  ['reform-club', 'sullivan', 'bettor', 'Fogg Makes the Wager', 'Fogg Reaches the Reform Club'],
  ['reform-club', 'fallentin', 'bettor', 'Fogg Makes the Wager', 'Fogg Reaches the Reform Club'],
  ['reform-club', 'flanagan', 'bettor', 'Fogg Makes the Wager', 'Fogg Reaches the Reform Club'],
  ['reform-club', 'ralph', 'bettor and bank governor', 'Fogg Makes the Wager', 'Fogg Reaches the Reform Club'],
  ['detective-office', 'fix', 'detective', 'Fix Watches the Mongolia Arrive', 'The Error Is Corrected Too Late'],
  ['transport-crews', 'bunsby', 'pilot-boat master', 'The Tankadere Is Hired', 'The Yokohama Steamer Is Signalled'],
  ['transport-crews', 'mandiboy', 'Pacific steamer captain', 'The General Grant Leaves Yokohama', 'San Francisco’s Election Meeting Erupts'],
  ['transport-crews', 'conductor', 'railroad conductor', 'The Pacific Railroad Journey Begins', 'Passepartout Stops the Train'],
  ['transport-crews', 'mudge', 'wind-sledge driver', 'Fix Finds the Wind Sledge', 'Omaha Restores the Railway Route'],
  ['transport-crews', 'speedy', 'Atlantic steamer captain', 'Fogg Searches New York Harbour', 'The Henrietta Burns Herself for Speed'],
]
const factionMemberships = membershipDefs.map(([faction, character, role, start, end], index) => ({ ...base, id: id('membership', String(index + 1)), factionId: id('faction', faction), characterId: charId(character), role, startEventId: findEvent(start), endEventId: end ? findEvent(end) : null, notes: '' }))
const factionRelationships = [
  { ...base, id: id('faction-relationship', 'club-travellers'), factionAId: id('faction', 'reform-club'), factionBId: id('faction', 'travellers'), stance: 'competitive', notes: 'The club’s wager supplies the deadline and financial stakes governing the route.' },
  { ...base, id: id('faction-relationship', 'police-travellers'), factionAId: id('faction', 'detective-office'), factionBId: id('faction', 'travellers'), stance: 'pursuit', notes: 'Fix follows the party because he wrongly identifies Fogg as the bank robber.' },
  { ...base, id: id('faction-relationship', 'crews-travellers'), factionAId: id('faction', 'transport-crews'), factionBId: id('faction', 'travellers'), stance: 'transactional', notes: 'Scheduled and improvised crews carry the party in exchange for fares, charters, rewards, or purchase.' },
]

const loreCategories = [
  ['sources', 'Sources and Artwork', '#766455', 0],
  ['time', 'Time and Geography', '#4d7080', 1],
  ['transport', 'Transport Networks', '#526b65', 2],
  ['society', 'Institutions and Society', '#76604e', 3],
  ['context', 'Historical Context', '#655b63', 4],
].map(([slug, name, color, sortOrder]) => ({ id: id('lore-category', slug), worldId, name, color, sortOrder }))
const loreDefs = [
  ['sources', 'Text, Maps, and Illustrations', 'The chronology and chapter structure follow the public-domain George Makepeace Towle translation available through Project Gutenberg. Character and place artwork comes from the 1873 illustrated edition associated with Alphonse de Neuville and Léon Benett. The linked maps include a dedicated route map, a Victorian London map, an 1870 Indian railway map, an 1870 Yokohama map, and an 1871 American railway map.', 'cover', ['world'], 'Passepartout Is Interviewed'],
  ['time', 'Why the Travellers Gain a Day', 'By travelling continually east, the party meets sunrise earlier at each longitude. Their accumulated local adjustments amount to twenty-four hours by the time they circle the globe, although Passepartout’s watch remains on London time.', 'plate-54', ['item:watch'], 'Passepartout Discovers the True Date'],
  ['time', 'The Published Eighty-Day Itinerary', 'The calculation divides the circuit among rail and steamship legs: London to Suez, Suez to Bombay, Bombay to Calcutta, Calcutta to Hong Kong, Hong Kong to Yokohama, Yokohama to San Francisco, San Francisco to New York, and New York to London.', 'map-world', ['map:world', 'item:bradshaw'], 'The Bank Robbery Is Debated'],
  ['transport', 'Steam, Rail, and Telegraph', 'The wager depends on nineteenth-century networks that synchronize distant schedules and carry news ahead of travellers. The same system that enables Fogg also lets Fix send warrants and lets London turn the route into a market.', 'plate-37', ['faction:transport-crews'], 'Fogg Becomes a Public Speculation'],
  ['transport', 'Improvisation beyond the Timetable', 'The elephant, Tankadere, wind sledge, and Henrietta are not picturesque diversions but responses to gaps in the published network. Fogg repeatedly replaces lost scheduled time with private transport and extraordinary expenditure.', 'plate-47', ['item:henrietta'], 'Fogg Buys Kiouni'],
  ['society', 'The Reform Club Wager', 'Fogg’s club combines private sociability, newspapers, card play, and financial confidence. Its clock and written memorandum make Pall Mall the journey’s legal and dramatic finish line.', 'plate-3', ['faction:reform-club'], 'Fogg Makes the Wager'],
  ['society', 'Passports and British Jurisdiction', 'Fogg seeks stamps as evidence of his route, while Fix cares less about travel permission than about the changing limits of police authority. Hong Kong is the final British territory before the Pacific; Liverpool is where the warrant can finally be used.', 'plate-7', ['item:passport', 'item:warrant'], 'The Consul Stamps the Passport'],
  ['context', 'India in the Novel', 'The Indian chapters are shaped by the assumptions and exoticism of a nineteenth-century European adventure novel set under British colonial rule. Its railway, court, religious, and rescue episodes should be read as literary constructions rather than neutral description of Indian life.', 'plate-18', ['map:india'], 'The Railway Ends at Kholby'],
  ['context', 'America in the Novel', 'The American crossing compresses elections, Mormon history, railroad engineering, frontier violence, and winter transport into an accelerated sequence. These episodes reflect Verne’s imagined geography and period conventions as much as documentary travel.', 'plate-44', ['map:america'], 'San Francisco’s Election Meeting Erupts'],
  ['context', 'Aouda’s Agency', 'Although introduced through a rescue plot shaped by period conventions, Aouda observes, decides, travels voluntarily, uses a weapon in defence, and ultimately proposes marriage herself.', 'plate-21', ['character:aouda'], 'Aouda Awakens at Allahabad'],
]
const resolveEntity = token => {
  const [kind, slug] = token.split(':')
  if (!slug) return worldId
  if (kind === 'item') return itemId(slug)
  if (kind === 'character') return charId(slug)
  if (kind === 'map') return mapId(slug)
  if (kind === 'faction') return id('faction', slug)
  return worldId
}
const lorePages = loreDefs.map(([category, title, body, artwork, links, visible], index) => ({ ...base, id: id('lore-page', String(index + 1)), categoryId: id('lore-category', category), title, body, tags: [], coverImageId: imageId(artwork), linkedEntityIds: links.map(resolveEntity), visibleFromEventId: findEvent(visible) }))

const knowledgeDefs = [
  ['wager-deadline', 'The wager expires at 8:45 p.m. on 21 December', 'Fogg must appear at the Reform Club no later than the exact agreed second.', 'Fogg Makes the Wager'],
  ['fix-suspicion', 'Fix identifies Fogg as the suspected bank robber', 'The detective relies on resemblance, sudden travel, and possession of a large sum.', 'Fix Watches the Mongolia Arrive'],
  ['rail-gap', 'The Bombay–Calcutta railway is incomplete', 'The advertised line stops before Allahabad and requires an overland crossing.', 'The Railway Ends at Kholby'],
  ['aouda-danger', 'Aouda is being taken to her death', 'The forest procession is carrying a drugged widow to the Pillaji ceremony.', 'The Procession Is Observed'],
  ['shoes-evidence', 'The Bombay priests retained Passepartout’s shoes', 'The abandoned footwear lets the temple complaint reach the Calcutta court.', 'The Temple Case Comes to Court'],
  ['fix-detective', 'Fix is a detective pursuing Fogg', 'Passepartout learns that the supposed wager agent intends to arrest his master.', 'Fix Reveals His Mission'],
  ['carnatic-early', 'The Carnatic will sail early', 'Repairs finish sooner than expected, moving departure to the night Fix drugs Passepartout.', 'Passepartout Is Drugged'],
  ['passepartout-japan', 'Passepartout reached Yokohama alone', 'The valet boarded the Carnatic despite the opium and crossed without Fogg or Aouda.', 'Passepartout Wakes in Yokohama'],
  ['fix-alliance', 'Fix now needs Fogg to reach England quickly', 'Outside British territory, the detective’s arrest depends on helping rather than delaying the route.', 'Fix Promises to Help Reach England'],
  ['robber-caught', 'The real Bank of England robber has been arrested', 'Fix’s warrant targets an innocent man and is withdrawn after the Liverpool detention.', 'The Error Is Corrected Too Late'],
  ['gained-day', 'The eastward journey gained a calendar day', 'The party reached London on Friday while believing it was Saturday, leaving the true deadline still open.', 'Passepartout Discovers the True Date'],
]
const knowledgeFacts = knowledgeDefs.map(([slug, title, description, learned]) => ({ ...base, id: id('fact', slug), title, description, tags: [], readerLearnsAtEventId: findEvent(learned), originEventId: findEvent(learned) }))
const revealDefs = [
  ['wager-deadline', 'fogg', 'Fogg Makes the Wager', 'Fogg fixes the written deadline before leaving the club.'],
  ['wager-deadline', 'passepartout', 'Pack for a Journey Around the World', 'Passepartout learns why they must depart immediately.'],
  ['fix-suspicion', 'fix', 'Fix Watches the Mongolia Arrive', 'The detective matches Fogg to the circulated description.'],
  ['rail-gap', 'fogg', 'The Railway Ends at Kholby', 'The visible end of track disproves the published claim.'],
  ['rail-gap', 'passepartout', 'The Railway Ends at Kholby', 'The conductor orders everyone off at the unfinished section.'],
  ['aouda-danger', 'fogg', 'The Procession Is Observed', 'The guide explains the purpose of the procession.'],
  ['aouda-danger', 'passepartout', 'The Procession Is Observed', 'Passepartout sees Aouda carried under guard.'],
  ['shoes-evidence', 'passepartout', 'The Temple Case Comes to Court', 'Oysterpuff produces the familiar footwear.'],
  ['fix-detective', 'passepartout', 'Fix Reveals His Mission', 'Fix states his office and asks the valet to cooperate.'],
  ['carnatic-early', 'passepartout', 'Passepartout Is Drugged', 'Passepartout knows the revised sailing but cannot carry the warning home.'],
  ['passepartout-japan', 'passepartout', 'Passepartout Wakes in Yokohama', 'He wakes after the Carnatic completes the crossing.'],
  ['passepartout-japan', 'fogg', 'The Human Pyramid Collapses into Reunion', 'The circus reunion reveals how the valet reached Japan.'],
  ['fix-alliance', 'passepartout', 'Fix Promises to Help Reach England', 'Fix explains why the warrant now makes speed useful.'],
  ['robber-caught', 'fix', 'The Error Is Corrected Too Late', 'Liverpool police deliver the correction after the wrongful arrest.'],
  ['robber-caught', 'fogg', 'The Error Is Corrected Too Late', 'Fix releases Fogg and admits that another man committed the robbery.'],
  ['gained-day', 'passepartout', 'Passepartout Discovers the True Date', 'Wilson’s correction makes the longitude effect suddenly clear.'],
  ['gained-day', 'fogg', 'Fogg Reaches the Reform Club', 'Passepartout’s warning sends Fogg to claim the still-open wager.'],
]
const knowledgeReveals = revealDefs.map(([fact, character, title, note], index) => ({ ...base, id: id('reveal', String(index + 1)), factId: id('fact', fact), characterId: charId(character), eventId: findEvent(title), note }))

const goalDefs = [
  ['fogg', 'Fogg Makes the Wager', 'Fogg Reaches the Reform Club', 'want', 'Complete the published circuit and appear at the Reform Club within eighty days.'],
  ['fogg', 'The Procession Is Observed', 'Aouda Awakens at Allahabad', 'want', 'Use the available time to save Aouda and place her beyond immediate danger.'],
  ['passepartout', 'Passepartout Is Interviewed', 'The Journey Ends in Marriage', 'want', 'Serve Fogg faithfully and restore the stable household he expected to find.'],
  ['passepartout', 'Fix Reveals His Mission', 'The Error Is Corrected Too Late', 'fear', 'Prevent Fix’s mistaken pursuit from destroying Fogg’s freedom and wager.'],
  ['aouda', 'Aouda Awakens at Allahabad', 'Aouda Proposes Marriage', 'want', 'Reach safety while choosing a future based on trust rather than dependence.'],
  ['fix', 'Fix Watches the Mongolia Arrive', 'The Error Is Corrected Too Late', 'want', 'Keep the suspected robber in sight until a warrant can be executed in British territory.'],
  ['cromarty', 'The Procession Is Observed', 'Aouda Awakens at Allahabad', 'want', 'Help remove Aouda from the procession and reach Allahabad alive.'],
  ['bunsby', 'The Tankadere Is Hired', 'The Yokohama Steamer Is Signalled', 'want', 'Navigate the Tankadere through dangerous weather and earn Fogg’s promised reward.'],
  ['proctor', 'San Francisco’s Election Meeting Erupts', 'The Duel Is Interrupted', 'want', 'Force Fogg to answer the San Francisco quarrel with a duel.'],
  ['speedy', 'Fogg Searches New York Harbour', 'The Henrietta Burns Herself for Speed', 'want', 'Keep command of the Henrietta while profiting from Fogg’s urgent charter.'],
]
const characterGoals = goalDefs.map(([character, start, end, type, text], index) => ({ ...base, id: id('goal', String(index + 1)), characterId: charId(character), startEventId: findEvent(start), endEventId: findEvent(end), type, text }))

const mapRoutes = [
  { ...base, id: id('route', 'world-circuit'), mapLayerId: mapId('world'), name: 'The Eighty-Day Circuit', routeType: 'mixed', waypoints: ['london-entrance', 'paris', 'turin', 'brindisi', 'suez', 'aden', 'bombay-entrance', 'calcutta-world', 'singapore', 'hong-kong', 'tankadere-sea', 'yokohama-entrance', 'general-grant', 'san-francisco-entrance', 'new-york-world', 'henrietta', 'queenstown', 'liverpool', 'london-entrance'].map(locId), color: '#b16d36', notes: 'The complete eastward route, including missed connections and improvised sea passages.' },
  { ...base, id: id('route', 'london'), mapLayerId: mapId('london'), name: 'Departure and Return in London', routeType: 'road-and-rail', waypoints: ['savile-row', 'reform-club', 'charing-cross', 'london-terminus', 'savile-row', 'wilson-house', 'savile-row', 'reform-club'].map(locId), color: '#517487', notes: 'The household, wager, departure station, calendar discovery, and final run to Pall Mall.' },
  { ...base, id: id('route', 'india'), mapLayerId: mapId('india'), name: 'Across India', routeType: 'rail-and-elephant', waypoints: ['bombay', 'malabar-hill', 'bombay', 'kholby', 'jungle-camp', 'pillaji-temple', 'suttee-clearing', 'allahabad', 'benares', 'calcutta'].map(locId), color: '#9a7040', notes: 'The railway journey interrupted by the overland elephant crossing and rescue.' },
  { ...base, id: id('route', 'yokohama'), mapLayerId: mapId('yokohama'), name: 'Passepartout Alone in Yokohama', routeType: 'foot', waypoints: ['yokohama-harbor', 'yokohama-streets', 'long-noses', 'general-grant-berth'].map(locId), color: '#a45d3e', notes: 'Passepartout’s route from the Carnatic to hunger, circus employment, reunion, and departure.' },
  { ...base, id: id('route', 'america'), mapLayerId: mapId('america'), name: 'The American Crossing', routeType: 'rail-and-sledge', waypoints: ['san-francisco', 'oakland', 'medicine-bow', 'fort-kearny', 'omaha', 'chicago', 'new-york'].map(locId), color: '#55715d', notes: 'The transcontinental railway route and wind-sledge recovery after the attack.' },
]

const months = [
  ['January', 31], ['February', 29], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
  ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31],
].map(([name, days]) => ({ name, days }))

const data = {
  version: 16, type: 'worldbreaker-export', exportedAt: now,
  world: { id: worldId, name: 'Around the World in Eighty Days', description: 'Phileas Fogg wagers that the new railways and steamship lines can carry him around the globe in eighty days. Travelling east with Passepartout, pursued by a mistaken detective, and joined by Aouda, he discovers that precision can master a timetable but not the loyalty, danger, and affection encountered along the route.', coverImageId: imageId('cover'), theme: 'theme-action', readingMode: true, createdAt: now, updatedAt: now, continuityStaleThreshold: 5, calendar: { startYear: 1872, yearSuffix: '', months }, wordTarget: null },
  mapLayers, locationMarkers, characters, items, characterSnapshots, characterMovements: [], itemPlacements, locationSnapshots: [], itemSnapshots: [], relationships, relationshipSnapshots: [],
  timelines: [{ id: timelineId, worldId, name: 'The Eighty-Day Journey', description: 'A single chronological timeline from the Reform Club wager to Fogg’s return, using the actual local calendar dates resolved by the gained day.', color: '#b06d38', dayOffset: 0, createdAt: now }],
  chapters, events, blobs, travelModes: [], timelineRelationships: [], crossTimelineArtifacts: [], mapRoutes, mapRegions: [], mapRegionSnapshots: [], mapAnnotations: [],
  loreCategories, lorePages, factions, factionMemberships, factionRelationships, knowledgeFacts, knowledgeReveals, characterGoals, sceneTexts: [], plotThreads, motifs, continuitySuppressions: [], writingLogs: [], sceneRevisions: [],
}

const collectionIds = new Map()
for (const [key, value] of Object.entries(data)) {
  if (!Array.isArray(value)) continue
  for (const row of value) {
    if (!row.id) continue
    if (collectionIds.has(row.id)) throw new Error(`Duplicate id ${row.id} in ${key} and ${collectionIds.get(row.id)}`)
    collectionIds.set(row.id, key)
  }
}
const assertRef = (value, collection, label) => {
  if (value != null && !new Set(collection.map(row => row.id)).has(value)) throw new Error(`${label}: missing ${value}`)
}
events.forEach(row => {
  assertRef(row.chapterId, chapters, `${row.id}.chapterId`)
  assertRef(row.timelineId, data.timelines, `${row.id}.timelineId`)
  assertRef(row.locationMarkerId, locationMarkers, `${row.id}.location`)
  row.involvedCharacterIds.forEach(value => assertRef(value, characters, `${row.id}.character`))
  row.involvedItemIds.forEach(value => assertRef(value, items, `${row.id}.item`))
  row.threadIds.forEach(value => assertRef(value, plotThreads, `${row.id}.thread`))
  row.motifIds.forEach(value => assertRef(value, motifs, `${row.id}.motif`))
  if (!Number.isInteger(row.tension) || row.tension < 1 || row.tension > 5) throw new Error(`${row.id}: invalid tension`)
  if (!Number.isFinite(row.travelDays) || row.travelDays < 0) throw new Error(`${row.id}: invalid elapsed time`)
  if (!Number.isFinite(row.inWorldTime)) throw new Error(`${row.id}: invalid calendar time`)
})
characterSnapshots.forEach(row => {
  assertRef(row.characterId, characters, `${row.id}.character`)
  assertRef(row.eventId, events, `${row.id}.event`)
  assertRef(row.currentLocationMarkerId, locationMarkers, `${row.id}.location`)
  const eventRow = events.find(entry => entry.id === row.eventId)
  if (!eventRow.involvedCharacterIds.includes(row.characterId)) throw new Error(`${row.id}: absent character snapshot`)
})
if (chapters.length !== 37 || new Set(events.map(row => row.chapterId)).size !== 37) throw new Error('Every chapter must contain events')
for (const eventRow of events) {
  const snapshots = characterSnapshots.filter(row => row.eventId === eventRow.id)
  if (snapshots.length !== eventRow.involvedCharacterIds.length) throw new Error(`${eventRow.id}: snapshot count`)
  if (new Set(snapshots.map(row => row.statusNotes.toLowerCase())).size !== snapshots.length) throw new Error(`${eventRow.id}: repeated status`)
}
mapLayers.forEach(row => assertRef(row.imageId, blobs, `${row.id}.image`))
locationMarkers.forEach(row => {
  assertRef(row.mapLayerId, mapLayers, `${row.id}.map`)
  assertRef(row.linkedMapLayerId, mapLayers, `${row.id}.linkedMap`)
  assertRef(row.imageId, blobs, `${row.id}.image`)
})
characters.forEach(row => assertRef(row.portraitImageId, blobs, `${row.id}.portrait`))
items.forEach(row => assertRef(row.imageId, blobs, `${row.id}.image`))

const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync('example/Around the World in Eighty Days.pwk', text)
fs.writeFileSync('public/library/around-the-world-in-eighty-days.pwk', text)
console.log(JSON.stringify({ chapters: chapters.length, events: events.length, characters: characters.length, snapshots: characterSnapshots.length, locations: locationMarkers.length, maps: mapLayers.length, items: items.length, relationships: relationships.length, lore: lorePages.length, factions: factions.length, facts: knowledgeFacts.length, bytes: Buffer.byteLength(text) }, null, 2))
