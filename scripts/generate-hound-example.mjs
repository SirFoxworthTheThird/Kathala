import fs from 'node:fs'

const P = 'hound'
const worldId = `${P}-world`
const timelineId = `${P}-timeline-main`
const now = 1785585600000
const base = { worldId, createdAt: now, updatedAt: now }
const id = (kind, slug) => `${P}-${kind}-${slug}`
const chId = n => id('chapter', String(n).padStart(2, '0'))
const charId = slug => id('char', slug)
const itemId = slug => id('item', slug)
const locId = slug => id('loc', slug)
const mapId = slug => id('map', slug)
const threadId = slug => id('thread', slug)
const motifId = slug => id('motif', slug)

const months = [
  ['January',31],['February',28],['March',31],['April',30],['May',31],['June',30],
  ['July',31],['August',31],['September',30],['October',31],['November',30],['December',31],
].map(([name,days]) => ({ name, days }))

const blob = (slug, url, mimeType='image/jpeg') => ({ id:id('image',slug), worldId, mimeType, url, createdAt:now })
const commons = (name, width=960) => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(name)}?width=${width}`

const blobs = [
  blob('cover', commons('Houn-42 - Frontispiece (Hound of Baskervilles).jpg', 960)),
  blob('map-britain', commons('British Isles location map.svg', 960), 'image/png'),
  blob('map-london', commons("1890 Bacon Traveler's Pocket Map of London, England - Geographicus - London-bacon-1890.jpg", 1280)),
  blob('map-dartmoor', commons('Ordnance Survey Drawings - Dartmoor (OSD 23).jpg', 1280)),
  blob('map-hall', commons('Floor plan of Wanstead House.png', 1280), 'image/png'),
]

const illustrationNumbers = [1,5,6,8,9,10,11,12,14,15,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,53,54,55,56,57,58,59,60]
for (const n of illustrationNumbers) {
  const special = n === 5 ? 'Houn-05 - Hound of Baskervilles, page 24.jpg'
    : n === 11 ? 'Houn-11 - Sir Henry Baskerville (Hound of Baskervilles, page 58).jpg'
    : n === 14 ? 'Houn-14 - Hound of Baskervilles, page 76.jpg'
    : n === 21 ? 'Houn-21 - Hound of Baskervilles, page 118.jpg'
    : n === 27 ? 'Houn-27 - Legend of the wicked Hugo (Hound of Baskervilles, page 160).jpg'
    : n === 28 ? 'Houn-28 - Hound of Baskervilles, page 163.jpg'
    : n === 34 ? 'Houn-34 - Hound of Baskervilles, page 204.jpg'
    : n === 53 ? 'Houn-53 - The coal-black Hound (Hound of Baskervilles).jpg'
    : n === 54 ? 'Houn-54 - The Hound killed by Holmes.jpg'
    : `Houn-${String(n).padStart(2,'0')}.jpg`
  blobs.push(blob(`paget-${n}`, commons(special, 720)))
}
blobs.push(blob('paget-selden', commons('The Hound of the Baskervilles, pg.260.png', 720), 'image/png'))

const mapLayers = [
  { ...base, id:mapId('britain'), parentMapId:null, name:'Britain, 1889', description:'The investigation moves between London and the Devonshire moor country.', imageId:id('image','map-britain'), imageWidth:960, imageHeight:1483, scalePixelsPerUnit:null, scaleUnit:null, levelGroupId:null, levelIndex:0, levelLabel:'' },
  { ...base, id:mapId('london'), parentMapId:mapId('britain'), name:'Victorian London', description:'Baker Street, Northumberland Hotel, stations, and the streets where Sir Henry is watched.', imageId:id('image','map-london'), imageWidth:1280, imageHeight:981, scalePixelsPerUnit:null, scaleUnit:null, levelGroupId:null, levelIndex:0, levelLabel:'' },
  { ...base, id:mapId('dartmoor'), parentMapId:mapId('britain'), name:'Dartmoor and the Baskerville Country', description:'An editorial story map for the fictional Baskerville district, laid over a historical Ordnance Survey drawing of Dartmoor.', imageId:id('image','map-dartmoor'), imageWidth:1280, imageHeight:620, scalePixelsPerUnit:null, scaleUnit:null, levelGroupId:null, levelIndex:0, levelLabel:'' },
  { ...base, id:mapId('hall'), parentMapId:mapId('dartmoor'), name:'Baskerville Hall and Grounds', description:'A navigable editorial plan of the ancestral house, its rooms, yew alley, gate, and neighbouring grounds.', imageId:id('image','map-hall'), imageWidth:1280, imageHeight:848, scalePixelsPerUnit:null, scaleUnit:null, levelGroupId:null, levelIndex:0, levelLabel:'' },
]

const locationMarkers = []
function location(slug, map, name, description, x, y, iconType='landmark', linked=null) {
  locationMarkers.push({ ...base, id:locId(slug), mapLayerId:mapId(map), linkedMapLayerId:linked?mapId(linked):null, name, description, x, y, iconType, tags:[], factionId:null })
}
location('london-portal','britain','London','Portal to the metropolitan investigation.',725,370,'city','london')
location('dartmoor-portal','britain','Dartmoor, Devon','Portal to the Baskerville country on the Devonshire moors.',390,215,'region','dartmoor')
location('baker-street','london','221B Baker Street','Holmes and Watson examine Mortimer’s stick, the family legend, and the modern case.',590,585,'building')
location('northumberland','london','Northumberland Hotel','Sir Henry stays here; boots vanish and the cut-paper warning arrives.',650,480,'building')
location('charing-cross','london','Charing Cross and Regent Street','The investigators pursue the bearded cab passenger through central London.',620,430,'landmark')
location('waterloo','london','Waterloo Station','Departure point for the journey to Devon.',710,295,'landmark')
location('cartwright-route','london','Hotel Wastepaper Route','Cartwright searches hotel wastepaper for the cut Times page.',675,510,'custom')
location('moor-gate','dartmoor','Moor Gate and Road','The road from the railway enters the guarded Baskerville district.',165,180,'landmark')
location('hall-portal','dartmoor','Baskerville Hall','The ancient Baskerville seat and the investigation’s domestic centre.',380,330,'castle','hall')
location('merripit','dartmoor','Merripit House','Stapleton’s isolated home beside the mire.',850,345,'building')
location('grimpen','dartmoor','Great Grimpen Mire','A treacherous bog crossed only by a hidden path marked with sticks.',950,265,'region')
location('tor','dartmoor','The Tor','High ground from which the concealed watcher surveys the moor.',665,475,'landmark')
location('stone-hut','dartmoor','Neolithic Stone Hut','Holmes’s concealed base, supplied by Cartwright.',620,430,'building')
location('coombe-tracey','dartmoor','Coombe Tracey','The town where Laura Lyons lives and works.',1060,150,'town')
location('frankland','dartmoor','Lafter Hall','Frankland’s home and telescope station.',610,250,'building')
location('princetown','dartmoor','Princetown Prison','Selden escapes from the prison onto the moor.',230,475,'building')
location('selden-refuge','dartmoor','Selden’s Moor Refuge','The escaped convict hides among rocks beyond the Hall.',505,510,'custom')
location('hound-kennel','dartmoor','Island Kennel in the Mire','Stapleton keeps the hound on firm ground deep within the mire.',1080,315,'custom')
location('yew-alley-entry','hall','Yew Alley','The long dark avenue where Sir Charles waited and died.',1030,190,'landmark')
location('summer-house','hall','Summer-house Gate','The gate opening from the yew alley toward the moor.',1140,150,'landmark')
location('great-hall','hall','Great Hall','The sombre central room where Sir Henry takes possession of the estate.',620,390,'building')
location('dining-room','hall','Dining Room','Meals, plans, and the ancestral portrait bring the mystery into focus.',800,410,'building')
location('sir-henry-room','hall','Sir Henry’s Room','Sir Henry sleeps here and lends Barrymore a suit later worn by Selden.',930,620,'building')
location('watson-room','hall','Watson’s Room','Watson hears a woman sobbing and writes reports to Holmes.',630,650,'building')
location('barrymore-room','hall','Barrymores’ Quarters','The servants conceal their aid to Selden.',310,610,'building')
location('portrait-gallery','hall','Portrait Gallery','Holmes recognises Stapleton in the face of Hugo Baskerville.',445,430,'building')

const charSpecs = [
 ['holmes','Sherlock Holmes','The consulting detective who directs the investigation while concealing his own movements on Dartmoor.',1,'#66798c',true],
 ['watson','Dr. John Watson','Holmes’s friend, narrator, and field investigator at Baskerville Hall.',5,'#8b7355',true],
 ['sir-henry','Sir Henry Baskerville','The Canadian-raised heir who returns to claim Baskerville Hall despite threats.',11,'#9b694e',true],
 ['mortimer','Dr. James Mortimer','A country physician and friend of Sir Charles who brings the case to Holmes.',6,'#7c8068',true],
 ['sir-charles','Sir Charles Baskerville','The late baronet whose terror and death initiate the investigation.',8,'#6d625f',false],
 ['stapleton','Jack Stapleton','A naturalist of the moor, secretly Roger Baskerville and architect of the murders.',9,'#6f8155',false],
 ['beryl','Beryl Stapleton','Stapleton’s wife, forced to pose as his sister and struggling to warn Sir Henry.',10,'#8f6b76',true],
 ['barrymore','John Barrymore','The Hall’s bearded butler, initially suspected because he secretly aids Selden.',12,'#5d6670',true],
 ['mrs-barrymore','Eliza Barrymore','The housekeeper and Selden’s sister, torn between duty and family loyalty.',14,'#7f625f',true],
 ['laura','Laura Lyons','Frankland’s estranged daughter, manipulated by Stapleton into writing to Sir Charles.',15,'#9a7180',true],
 ['selden','Selden','Mrs Barrymore’s brother, an escaped convict hiding on the moor.','selden','#594f4b',false],
 ['frankland','Mr. Frankland','An elderly litigious neighbour whose telescope inadvertently helps Watson.',17,'#8b6f4e',true],
 ['cartwright','Cartwright','The Baker Street page who searches hotel wastepaper and supplies Holmes’s hut.',18,'#667f74',true],
 ['lestrade','Inspector Lestrade','The Scotland Yard inspector who joins Holmes for the final trap.',19,'#4f6474',true],
 ['perkins','Perkins','The Baskerville coachman who carries guests between station and Hall.',20,'#75624d',true],
 ['clayton','John Clayton','The cabman unknowingly hired by Stapleton under Holmes’s name.',21,'#686868',true],
 ['postmaster','Postmaster','The Grimpen postmaster who reveals that Barrymore did not personally receive Holmes’s telegram.',22,'#7d725d',true],
 ['hugo','Hugo Baskerville','The violent ancestor at the centre of the Baskerville legend.',27,'#6f4841',false],
 ['yeoman-daughter','The Yeoman’s Daughter','The unnamed woman abducted by Hugo who escapes across the moor.',28,'#887373',false],
]
const characters = charSpecs.map(([slug,name,description,img,color,isAlive]) => ({ ...base, id:charId(slug), name, aliases:[], description, portraitImageId:id('image',`paget-${img}`), color, tags:[], isAlive, birthDate:null }))

const itemSpecs = [
 ['walking-stick','Mortimer’s Walking Stick','The forgotten stick from which Holmes and Watson infer Mortimer’s profession and habits.','walking-stick',24],
 ['manuscript','Baskerville Manuscript','The dated family account of Hugo Baskerville and the legendary hound.','scroll',27],
 ['newspaper','Newspaper Account','The report of Sir Charles’s death and the official inquest.','newspaper',25],
 ['warning','Anonymous Warning Note','Words cut from the Times warn Sir Henry to keep away from the moor.','mail-warning',26],
 ['brown-boot','New Brown Boot','A new boot stolen from Sir Henry’s hotel room and later returned.','footprints',29],
 ['old-boot','Old Black Boot','A worn boot stolen to give the hound Sir Henry’s scent.','footprints',30],
 ['telegram','Barrymore Telegram','Holmes’s test of whether Barrymore is truly at Baskerville Hall.','send',31],
 ['sir-charles-letter','Burned Letter Fragment','A fragment signed L.L. asks Sir Charles to wait at the yew-alley gate.','mail',32],
 ['candle','Barrymore’s Candle','The light in the window signals food and clothing to Selden.','flame',33],
 ['telescope','Frankland’s Telescope','The instrument that reveals Cartwright crossing the moor to Holmes.','telescope',34],
 ['reports','Watson’s Reports','Watson’s letters and diary preserve his investigation for Holmes and the reader.','notebook',35],
 ['portrait','Portrait of Hugo Baskerville','The family portrait exposes Stapleton’s Baskerville resemblance.','image-frame',56],
 ['sir-henry-suit','Sir Henry’s Old Suit','Clothes given to Selden cause the hound to pursue the wrong man.','shirt',57],
 ['phosphorus','Phosphorus Preparation','Stapleton paints the hound’s muzzle to create a supernatural glow.','flask-conical',58],
 ['revolver','Holmes’s Revolver','Holmes uses it to kill the attacking hound.','target',54],
 ['mire-marks','Mire Path Markers','Hidden rods indicate the only safe path across the Great Grimpen Mire.','signpost',59],
 ['hound','The Hound','A huge trained dog used by Stapleton as a weapon disguised by phosphorus.','dog',53],
 ['net','Butterfly Net','Stapleton’s naturalist’s net, part vocation and part camouflage.','bug',60],
]
const items = itemSpecs.map(([slug,name,description,iconType,img]) => ({ ...base, id:itemId(slug), name, description, iconType, imageId:id('image',`paget-${img}`), tags:[] }))

const chapterSpecs = [
 ['Mr. Sherlock Holmes','Mortimer’s forgotten stick lets Holmes and Watson compare methods before their visitor returns.'],
 ['The Curse of the Baskervilles','Mortimer reads the legend of Hugo and the report of Sir Charles’s unexplained death.'],
 ['The Problem','Holmes tests the evidence and accepts the task of protecting the new heir.'],
 ['Sir Henry Baskerville','Sir Henry arrives in London, receives a warning, loses boots, and is followed.'],
 ['Three Broken Threads','The London leads fail, but Holmes quietly prepares a wider investigation.'],
 ['Baskerville Hall','Watson accompanies Sir Henry to Devon and enters the troubled ancestral house.'],
 ['The Stapletons of Merripit House','Watson meets Stapleton and Beryl beside the dangerous Grimpen Mire.'],
 ['First Report of Dr. Watson','Watson reports the moor’s suspects, tensions, and concealed movements.'],
 ['The Light upon the Moor','Sir Henry courts Beryl while Watson uncovers the Barrymores’ signal to Selden.'],
 ['Extract from the Diary of Dr. Watson','Barrymore explains the signal and reveals Sir Charles’s link to the initials L.L.'],
 ['The Man on the Tor','Laura Lyons’s account and Frankland’s telescope lead Watson to Holmes’s hidden hut.'],
 ['Death on the Moor','Holmes and Watson find Selden dead in Sir Henry’s clothes and confront Stapleton’s composure.'],
 ['Fixing the Nets','Holmes identifies the Baskerville resemblance and arranges the final trap.'],
 ['The Hound of the Baskervilles','The investigators confront the hound, rescue Beryl, and search the mire.'],
 ['A Retrospection','Holmes reconstructs Stapleton’s identity, conspiracy, methods, and probable fate.'],
]
const chapters = chapterSpecs.map(([title,synopsis],i) => ({ ...base, id:chId(i+1), timelineId, number:i+1, title, synopsis, notes:'', wordGoal:null }))

const plotThreads = [
 ['curse','The Baskerville Curse','#79534f','A family legend is weaponised as the explanation for two attempted murders.'],
 ['investigation','Holmes and Watson’s Investigation','#536d7a','Observation, correspondence, disguise, and deduction turn Gothic terror into a solvable crime.'],
 ['inheritance','The Baskerville Inheritance','#9a744f','Sir Henry’s succession makes him both the estate’s hope and Stapleton’s target.'],
 ['stapleton','Stapleton’s Conspiracy','#5c6f4e','Stapleton hides his identity, marriage, hound, and manipulation behind naturalist respectability.'],
 ['beryl','Beryl’s Resistance','#8b6674','Beryl tries to protect Sir Henry while living under coercion.'],
 ['selden','Selden on the Moor','#665b54','The escaped convict creates a plausible danger and becomes an unintended victim.'],
 ['barrymores','The Barrymores’ Secret','#6e6870','The servants’ aid to Selden makes innocent conduct look criminal.'],
 ['laura','Laura Lyons and the Letter','#8c6c78','A vulnerable woman’s letter becomes the concealed appointment behind Sir Charles’s death.'],
 ['hidden-holmes','The Man on the Tor','#4f6573','Holmes conducts a parallel inquiry while Watson believes him to be in London.'],
 ['hound','The Real Hound','#694d48','Footprints, cries, scent, and phosphorus gradually replace superstition with material evidence.'],
].map(([slug,name,color,description]) => ({ ...base, id:threadId(slug), name, color, description }))

const motifs = [
 ['reason-superstition','Reason and Superstition','#6c7182','Every supernatural sign has a material cause, yet fear remains physically dangerous.'],
 ['moor','The Moor','#6d765c','Fog, tors, mire, and open distance conceal watchers and erase certainty.'],
 ['footprints','Footprints and Tracks','#7d6855','Human and animal traces connect the hotel thefts, Sir Charles’s death, and the hound.'],
 ['light','Lights in Darkness','#9d7a48','Candles, windows, lanterns, and the hound’s glow communicate or deceive.'],
 ['documents','Documents and Reports','#617688','Manuscript, newspaper, letters, telegrams, reports, and diaries ration knowledge.'],
 ['disguise','Names and Disguises','#765f72','False kinship, false names, a beard, and hidden observation destabilise identity.'],
 ['inheritance','Blood and Inheritance','#8b534f','Family resemblance and succession bind Hugo, Sir Henry, and Stapleton.'],
 ['captivity','Captivity and Escape','#675f58','Beryl, Selden, the hound, and the mire’s victims occupy different forms of confinement.'],
].map(([slug,name,color,description]) => ({ ...base, id:motifId(slug), name, color, description }))

const events = []
function event(ch,title,description,loc,chars=[],itemSlugs=[],tension=2,day=270,opts={}) {
  const n=events.length+1
  events.push({ ...base, id:id('event',String(n)), chapterId:chId(ch), timelineId, title, description,
    locationMarkerId:loc?locId(loc):null, involvedCharacterIds:chars.map(charId), mentionedCharacterIds:(opts.mentioned||[]).map(charId),
    involvedItemIds:itemSlugs.map(itemId), tags:[`chapter-${ch}`], threadIds:(opts.threads||['investigation']).map(threadId), motifIds:(opts.motifs||['documents']).map(motifId),
    sortOrder:(events.filter(e=>e.chapterId===chId(ch)).length)*10, travelDays:opts.travelDays??0, inWorldTime:day, tension,
    structureBeat:opts.beat??null, status:'final', povCharacterId:charId(opts.pov||'watson'), isFlashback:opts.flashback??false })
  return n
}
event(1,'The Forgotten Stick','Watson examines Mortimer’s walking stick and offers an enthusiastic but flawed portrait of its owner.','baker-street',['holmes','watson'],['walking-stick'],1,270,{beat:'opening_image',motifs:['documents']})
event(1,'Holmes Reads the Stick','Holmes corrects Watson’s deductions, inferring a young country doctor, a friendly presentation, and a dog.','baker-street',['holmes','watson'],['walking-stick'],2,270,{motifs:['footprints']})
event(1,'Mortimer Returns','Mortimer retrieves the stick and asks Holmes to consider a matter of grave importance.','baker-street',['holmes','watson','mortimer'],['walking-stick'],2,270)
event(2,'The Legend of Hugo Baskerville','Mortimer reads the manuscript: Hugo abducts a woman, pursues her, and is found dead beside a monstrous hound.','yew-alley-entry',['mortimer','hugo','yeoman-daughter'],['manuscript','hound'],4,-53655,{flashback:true,pov:'mortimer',threads:['curse','hound'],motifs:['reason-superstition','inheritance','captivity']})
event(2,'Sir Charles Waits at the Gate','On 4 June, the terrified Sir Charles pauses at the yew-alley gate as if expecting someone.','summer-house',['sir-charles'],['sir-charles-letter'],3,154,{flashback:true,pov:'mortimer',threads:['curse','laura','stapleton'],motifs:['documents','moor']})
event(2,'Sir Charles Dies','Sir Charles runs from the gate and dies; Mortimer privately sees a gigantic hound’s footprints nearby.','yew-alley-entry',['sir-charles','mortimer'],['hound'],5,154,{flashback:true,pov:'mortimer',threads:['curse','hound','inheritance'],motifs:['footprints','reason-superstition']})
event(2,'The Official Account','Mortimer reads the newspaper account, which reports death from natural causes and omits the animal tracks.','baker-street',['holmes','watson','mortimer'],['newspaper'],2,270,{threads:['investigation','curse'],motifs:['documents']})
event(3,'Holmes Tests the Evidence','Holmes questions the alley, gate, footprints, cigars, and Sir Charles’s movements.','baker-street',['holmes','watson','mortimer'],['newspaper'],3,270,{threads:['investigation','hound'],motifs:['footprints']})
event(3,'The Missing Interval','Mortimer admits that Sir Charles stood at the gate for several minutes and that his footprints changed when he ran.','baker-street',['holmes','watson','mortimer'],['newspaper'],3,270,{threads:['investigation','laura'],motifs:['footprints','documents']})
event(3,'The New Heir','Mortimer identifies Sir Henry as the last practical heir and explains that he is arriving from Canada.','baker-street',['holmes','watson','mortimer'],[],2,270,{mentioned:['sir-henry'],threads:['inheritance']})
event(3,'Holmes Accepts the Case','Holmes asks Mortimer to bring Sir Henry and studies the problem through the day.','baker-street',['holmes','watson','mortimer'],[],2,270,{beat:'inciting_incident',threads:['investigation','inheritance']})
event(4,'Sir Henry Arrives','Mortimer introduces the vigorous new baronet at Baker Street.','baker-street',['holmes','watson','mortimer','sir-henry'],[],2,271,{threads:['inheritance','investigation']})
event(4,'The Cut-Paper Warning','Sir Henry shows an anonymous note assembled from the Times, with “moor” written by hand.','baker-street',['holmes','watson','mortimer','sir-henry'],['warning'],3,271,{threads:['beryl','investigation'],motifs:['documents','disguise']})
event(4,'The Missing Brown Boot','Sir Henry reports that one of his new brown boots disappeared from the hotel.','northumberland',['sir-henry','mortimer','holmes','watson'],['brown-boot'],2,271,{threads:['hound','investigation'],motifs:['footprints']})
event(4,'The Bearded Watcher','Holmes and Watson spot a black-bearded man watching Sir Henry from a cab, but the cab escapes.','charing-cross',['holmes','watson','sir-henry','mortimer','stapleton','clayton'],[],4,271,{threads:['stapleton','investigation'],motifs:['disguise']})
event(4,'The Boots Are Exchanged','The brown boot returns, but an old black boot has vanished—evidence that confounds the hotel.','northumberland',['sir-henry','mortimer','holmes','watson'],['brown-boot','old-boot'],3,271,{threads:['hound','investigation'],motifs:['footprints']})
event(5,'The Hotel Register','Holmes checks other guests and finds no plausible suspect hiding behind the register.','northumberland',['holmes','watson','sir-henry','mortimer'],[],2,271,{threads:['investigation']})
event(5,'The Barrymore Test','A telegram is sent to Baskerville Hall with instructions that it be delivered into Barrymore’s own hands.','baker-street',['holmes','watson'],['telegram'],2,271,{mentioned:['barrymore'],threads:['barrymores','investigation'],motifs:['documents']})
event(5,'John Clayton’s Fare','The cabman reports that his passenger gave the name Sherlock Holmes, turning pursuit into mockery.','baker-street',['holmes','watson','clayton'],[],3,272,{threads:['stapleton','investigation'],motifs:['disguise']})
event(5,'Cartwright Searches the Hotels','Holmes sends Cartwright through hotel wastepaper to identify the source of the warning’s cut type.','cartwright-route',['holmes','watson','cartwright'],['warning'],2,272,{threads:['investigation','beryl'],motifs:['documents']})
event(5,'Watson Receives His Charge','Holmes claims London business prevents him from travelling and assigns Watson to protect Sir Henry.','baker-street',['holmes','watson','sir-henry','mortimer'],[],3,272,{beat:'break_into_two',threads:['investigation','hidden-holmes']})
event(6,'Departure for Devon','Watson, Sir Henry, and Mortimer leave Waterloo; Holmes warns Watson never to leave Sir Henry alone.','waterloo',['holmes','watson','sir-henry','mortimer'],[],2,273,{travelDays:1,threads:['investigation','inheritance']})
event(6,'The Escaped Convict','Perkins explains the soldiers on the road are searching for Selden, the Notting Hill murderer.','moor-gate',['watson','sir-henry','mortimer','perkins'],[],3,273,{mentioned:['selden'],threads:['selden'],motifs:['captivity','moor']})
event(6,'Arrival at Baskerville Hall','Sir Henry enters his ancestral home; Barrymore and Mrs Barrymore receive the party sombrely.','great-hall',['watson','sir-henry','mortimer','barrymore','mrs-barrymore'],[],3,273,{threads:['inheritance','barrymores'],motifs:['inheritance']})
event(6,'A Woman Sobs at Night','Watson hears a woman crying, though Barrymore later denies that it was his wife.','watson-room',['watson','mrs-barrymore'],[],3,273,{threads:['barrymores','selden'],motifs:['captivity']})
event(7,'The Postmaster Contradicts the Telegram','Watson learns that the telegram was handed to Mrs Barrymore rather than to the butler himself.','moor-gate',['watson','postmaster'],['telegram'],3,274,{mentioned:['barrymore','mrs-barrymore'],threads:['barrymores','investigation'],motifs:['documents']})
event(7,'Stapleton on the Moor','Stapleton introduces himself as a naturalist and guides Watson toward Merripit House.','tor',['watson','stapleton'],['net'],2,274,{threads:['stapleton'],motifs:['moor','disguise']})
event(7,'The Mire Takes a Pony','A pony disappears into Grimpen Mire while an eerie cry travels over the moor.','grimpen',['watson','stapleton'],[],4,274,{threads:['hound','stapleton'],motifs:['moor','captivity','reason-superstition']})
event(7,'Beryl’s Mistaken Warning','Believing Watson to be Sir Henry, Beryl urgently tells him to return to London.','merripit',['watson','beryl'],[],4,274,{threads:['beryl','stapleton'],motifs:['disguise','captivity']})
event(7,'The Warning Retracted','Once Stapleton approaches, Beryl pretends her warning concerned only the family legend.','merripit',['watson','beryl','stapleton'],[],3,274,{threads:['beryl','stapleton'],motifs:['disguise','captivity']})
event(8,'Watson’s First Report','Watson writes Holmes about Barrymore, the sobbing woman, the Stapletons, Frankland, and Selden.','watson-room',['watson'],['reports'],2,275,{mentioned:['holmes','barrymore','mrs-barrymore','stapleton','beryl','frankland','selden'],threads:['investigation'],motifs:['documents']})
event(8,'Sir Henry Pursues Beryl','Sir Henry’s attraction to Beryl grows despite Watson’s warning that she appears to be Stapleton’s sister.','great-hall',['watson','sir-henry'],[],2,275,{mentioned:['beryl','stapleton'],threads:['beryl','inheritance']})
event(8,'Frankland’s Legal Wars','Frankland boasts of lawsuits and uses his telescope to watch the roads and moor.','frankland',['watson','frankland'],['telescope'],2,275,{threads:['investigation'],motifs:['documents']})
event(8,'A Dangerous Landscape','Watson records the intersecting dangers of the convict, the servants’ secret, the Stapletons, and the unknown watcher.','tor',['watson'],['reports'],3,275,{mentioned:['selden','barrymore','mrs-barrymore','stapleton','beryl'],threads:['investigation','selden','barrymores','hidden-holmes'],motifs:['moor','documents']})
event(9,'The Moorland Rendezvous','Sir Henry meets Beryl despite Watson’s distant supervision and offers his devotion.','merripit',['sir-henry','beryl','watson'],[],2,276,{threads:['beryl','inheritance']})
event(9,'Stapleton’s Jealous Fury','Stapleton interrupts, abuses Sir Henry, and later apologises while postponing the courtship.','merripit',['sir-henry','beryl','watson','stapleton'],[],4,276,{threads:['stapleton','beryl'],motifs:['captivity','disguise']})
event(9,'The Candle in the Window','Watson and Sir Henry catch Barrymore signalling across the moor with a candle.','barrymore-room',['watson','sir-henry','barrymore'],['candle'],4,276,{threads:['barrymores','selden'],motifs:['light']})
event(9,'The Signal Answered','A distant light reveals the position of Selden’s refuge.','selden-refuge',['watson','sir-henry','barrymore','mrs-barrymore','selden'],['candle'],4,276,{threads:['barrymores','selden'],motifs:['light','captivity']})
event(9,'The Convict Escapes','Watson and Sir Henry pursue Selden but lose him among the rocks as a terrifying cry crosses the moor.','selden-refuge',['watson','sir-henry','selden'],[],5,276,{threads:['selden','hound'],motifs:['moor','reason-superstition']})
event(9,'The Figure on the Tor','Watson sees the silhouette of a tall unknown man watching from high ground.','tor',['watson','holmes'],[],4,276,{threads:['hidden-holmes','investigation'],motifs:['moor','disguise']})
event(10,'Mrs Barrymore Pleads for Selden','The Barrymores explain that Selden is Mrs Barrymore’s younger brother and will soon flee overseas.','great-hall',['watson','sir-henry','barrymore','mrs-barrymore'],[],3,277,{mentioned:['selden'],threads:['barrymores','selden'],motifs:['captivity']})
event(10,'The Burned Letter Fragment','In gratitude for Sir Henry’s mercy, Barrymore reveals that Sir Charles burned a letter signed L.L.','great-hall',['watson','sir-henry','barrymore'],['sir-charles-letter'],4,277,{mentioned:['sir-charles','laura'],threads:['laura','investigation'],motifs:['documents']})
event(10,'L.L. Is Identified','Mortimer identifies Laura Lyons as Frankland’s estranged daughter living in Coombe Tracey.','great-hall',['watson','sir-henry','mortimer'],['sir-charles-letter'],3,277,{mentioned:['laura','frankland'],threads:['laura','investigation']})
event(10,'Food for the Unknown Man','Barrymore reports that a boy carries supplies to another man hiding in the stone huts.','great-hall',['watson','barrymore'],[],4,277,{mentioned:['cartwright','holmes'],threads:['hidden-holmes','investigation'],motifs:['moor']})
event(11,'Laura Lyons Explains the Appointment','Laura admits asking Sir Charles for help but says another person persuaded her not to keep the appointment.','coombe-tracey',['watson','laura'],['sir-charles-letter'],4,278,{mentioned:['sir-charles','stapleton'],threads:['laura','stapleton','investigation'],motifs:['documents','disguise']})
event(11,'Frankland Spots the Messenger','Through his telescope Frankland shows Watson a boy carrying food onto the moor.','frankland',['watson','frankland','cartwright'],['telescope'],3,278,{threads:['hidden-holmes','investigation'],motifs:['light']})
event(11,'Watson Tracks the Boy','Watson crosses the moor toward the stone huts and finds signs of a cultivated hidden occupant.','stone-hut',['watson','cartwright'],['reports'],4,278,{threads:['hidden-holmes','investigation'],motifs:['moor','footprints']})
event(11,'Holmes Steps from the Shadows','Holmes reveals that he has been living on the moor and praises Watson’s reports.','stone-hut',['holmes','watson','cartwright'],['reports'],4,278,{beat:'midpoint',threads:['hidden-holmes','investigation'],motifs:['documents','disguise']})
event(12,'Holmes Names the Enemy','Holmes explains that Stapleton is the adversary and that Beryl is his wife, not his sister.','stone-hut',['holmes','watson'],['reports'],4,278,{mentioned:['stapleton','beryl'],threads:['stapleton','beryl','investigation'],motifs:['disguise']})
event(12,'A Cry on the Moor','A scream sends Holmes and Watson racing through the darkness.','tor',['holmes','watson'],[],5,278,{threads:['hound','selden'],motifs:['moor','reason-superstition']})
event(12,'Selden’s Body','They find Selden dead below a cliff, dressed in Sir Henry’s old suit and apparently pursued by the hound.','selden-refuge',['holmes','watson','selden'],['sir-henry-suit','hound'],5,278,{threads:['selden','hound','stapleton'],motifs:['footprints','inheritance']})
event(12,'Stapleton Arrives','Stapleton comes expecting Sir Henry, masks his disappointment, and claims the cries may be made by a bittern.','selden-refuge',['holmes','watson','selden','stapleton'],[],4,278,{mentioned:['sir-henry'],threads:['stapleton','hound'],motifs:['disguise','reason-superstition']})
event(13,'Holmes Studies Hugo’s Portrait','In the portrait gallery Holmes covers the hat and hair, revealing Stapleton’s face in Hugo Baskerville.','portrait-gallery',['holmes','watson','sir-henry'],['portrait'],4,279,{mentioned:['hugo','stapleton'],threads:['inheritance','stapleton'],motifs:['inheritance','disguise']})
event(13,'The Net Is Set','Holmes instructs Sir Henry to dine alone at Merripit House and walk home across the moor.','dining-room',['holmes','watson','sir-henry'],[],4,279,{threads:['investigation','stapleton','hound'],motifs:['captivity']})
event(13,'Lestrade Arrives','Lestrade joins Holmes and Watson from London, bringing official force to the final operation.','moor-gate',['holmes','watson','lestrade'],[],3,279,{threads:['investigation']})
event(13,'Sir Henry Goes to Merripit','Sir Henry keeps the dinner invitation, unaware of the full danger prepared around him.','merripit',['sir-henry','stapleton'],[],4,279,{mentioned:['beryl'],threads:['inheritance','stapleton','hound']})
event(14,'Watching Merripit House','Holmes, Watson, and Lestrade stake out the house; Watson sees Sir Henry dining with Stapleton.','merripit',['holmes','watson','lestrade','sir-henry','stapleton'],[],4,279,{threads:['investigation','stapleton']})
event(14,'Fog Covers the Path','Fog rolls over the mire and threatens to make the trap impossible.','grimpen',['holmes','watson','lestrade'],[],4,279,{threads:['hound','investigation'],motifs:['moor','captivity']})
event(14,'The Hound Attacks','The glowing hound charges Sir Henry; Holmes fires and kills it before it can finish the attack.','merripit',['holmes','watson','lestrade','sir-henry'],['hound','phosphorus','revolver','old-boot'],5,279,{beat:'climax',threads:['hound','stapleton','inheritance'],motifs:['reason-superstition','footprints','light']})
event(14,'Beryl Is Rescued','The investigators find Beryl bound and beaten; she directs them to Stapleton’s island in the mire.','merripit',['holmes','watson','lestrade','beryl','sir-henry'],[],4,279,{threads:['beryl','stapleton'],motifs:['captivity']})
event(14,'The Mire Is Searched','The next day Beryl guides the men along the marked path; they find the old boot but no recoverable body.','grimpen',['holmes','watson','lestrade','beryl'],['old-boot','mire-marks'],4,280,{mentioned:['stapleton'],threads:['stapleton','hound'],motifs:['moor','footprints','captivity']})
event(15,'Roger Baskerville’s Identity','Back in Baker Street, Holmes explains that Stapleton was the son of Roger Baskerville and next in line after Sir Henry.','baker-street',['holmes','watson'],['portrait'],3,310,{mentioned:['stapleton','sir-henry','sir-charles','hugo'],threads:['inheritance','stapleton'],motifs:['inheritance','disguise']})
event(15,'The Women Were Manipulated','Holmes reconstructs how Stapleton coerced Beryl and deceived Laura into arranging Sir Charles’s appointment.','baker-street',['holmes','watson'],['sir-charles-letter','warning'],3,310,{mentioned:['stapleton','beryl','laura','sir-charles'],threads:['beryl','laura','stapleton'],motifs:['documents','captivity']})
event(15,'The Hound Was Made Supernatural','Stapleton bought and hid a large dog, trained it on scent, and used phosphorus to exploit the family legend.','hound-kennel',['stapleton'],['hound','phosphorus','old-boot'],4,154,{flashback:true,pov:'holmes',threads:['hound','stapleton','curse'],motifs:['reason-superstition','light','footprints']})
event(15,'The Complete Design','Holmes connects the warning, boot thefts, London disguise, Sir Charles’s death, Selden’s mistake, and the final attack.','baker-street',['holmes','watson'],['warning','brown-boot','old-boot','sir-henry-suit','portrait'],3,310,{mentioned:['stapleton','beryl','sir-charles','selden','sir-henry'],threads:['investigation','stapleton','hound'],motifs:['documents','disguise','footprints']})
event(15,'The Case Closes','Stapleton is presumed swallowed by the mire; Sir Henry leaves to recover while Holmes and Watson turn back toward London life.','baker-street',['holmes','watson'],[],2,310,{mentioned:['stapleton','sir-henry'],beat:'resolution',threads:['investigation','inheritance'],motifs:['moor']})

const locById = new Map(locationMarkers.map(l=>[l.id,l]))
const eventStateRows = [
 ['The Forgotten Stick',{holmes:'Watching Watson test his deductive method before offering any correction.',watson:'Handling the forgotten stick and confidently constructing a mistaken portrait of its owner.'}],
 ['Holmes Reads the Stick',{holmes:'Reading wear, engraving, and tooth marks as evidence of Mortimer’s age, work, and dog.',watson:'Listening as Holmes separates supported observations from Watson’s imaginative assumptions.'}],
 ['Mortimer Returns',{holmes:'Receiving the visitor with curiosity after identifying him from the stick.',watson:'Meeting the man whose character he and Holmes have just debated.',mortimer:'Returning for his stick and preparing to disclose the Baskerville problem.'}],
 ['The Legend of Hugo Baskerville',{mortimer:'Reading the family manuscript aloud as essential context for Sir Charles’s terror.',hugo:'Dead beside the escaped woman after his violent pursuit ends at the hound.', 'yeoman-daughter':'Reaching the moor after escaping Hugo’s captivity and flight from Baskerville Hall.'}],
 ['Sir Charles Waits at the Gate',{'sir-charles':'Waiting nervously at the moor gate for Laura Lyons while already vulnerable to the legend.'}],
 ['Sir Charles Dies',{'sir-charles':'Dead from terror and heart failure after fleeing the released hound.',mortimer:'Examining the scene privately and noticing the enormous animal footprints omitted from the inquest.'}],
 ['The Official Account',{holmes:'Comparing the public inquest with Mortimer’s suppressed observations.',watson:'Following the difference between the official narrative and the private evidence.',mortimer:'Presenting the newspaper report while insisting it does not explain everything he saw.'}],
 ['Holmes Tests the Evidence',{holmes:'Interrogating each spatial and physical detail of the yew alley rather than accepting the curse.',watson:'Tracking Holmes’s reconstruction of the gate, cigar ash, footprints, and running stride.',mortimer:'Answering from memory while distinguishing what he observed from what the inquest recorded.'}],
 ['The Missing Interval',{holmes:'Focusing on the unexplained minutes Sir Charles spent waiting at the gate.',watson:'Recognising that the pause implies an appointment rather than a solitary walk.',mortimer:'Admitting that Sir Charles waited and then ran, two facts absent from the public account.'}],
 ['The New Heir',{holmes:'Testing the succession for motive and identifying who now stands in danger.',watson:'Learning why the case continues beyond Sir Charles’s death.',mortimer:'Explaining Sir Henry’s Canadian upbringing and place in the Baskerville line.'}],
 ['Holmes Accepts the Case',{holmes:'Taking responsibility for the case and beginning a private day of research.',watson:'Leaving Mortimer with the expectation that Holmes will produce a practical plan.',mortimer:'Departing under instructions to return with Sir Henry.'}],
 ['Sir Henry Arrives',{holmes:'Assessing the new client’s courage, temper, and exposure to danger.',watson:'Meeting the heir whose safety will soon become his responsibility.',mortimer:'Introducing Sir Henry and transferring the problem into Holmes’s hands.','sir-henry':'Demanding a plain explanation of the danger surrounding his inheritance.'}],
 ['The Cut-Paper Warning',{holmes:'Examining typeface, scent, penmanship, and delivery for traces of the sender.',watson:'Helping compare the clipped words with the Times while observing Holmes’s method.',mortimer:'Realising the threat has followed the heir into London.','sir-henry':'Angry but intrigued by an anonymous demand that he abandon the moor.'}],
 ['The Missing Brown Boot',{'sir-henry':'Reporting the hotel theft with irritation, treating it as insolence rather than evidence.',mortimer:'Confirming the boot vanished inside the hotel.',holmes:'Adding the apparently trivial theft to the warning and surveillance pattern.',watson:'Noting that the thief has gained access to Sir Henry’s private belongings.'}],
 ['The Bearded Watcher',{holmes:'Leading the pursuit while memorising the watcher’s appearance and cab number.',watson:'Running with Holmes after spotting the cab surveillance.', 'sir-henry':'Walking through London unaware that the suspect is watching him at close range.',mortimer:'Accompanying Sir Henry while failing to notice the watcher.',stapleton:'Escaping in a cab behind a false beard after confirming Sir Henry’s movements.',clayton:'Driving a disguised passenger without knowing his identity or purpose.'}],
 ['The Boots Are Exchanged',{'sir-henry':'Finding the new boot returned and an old, scent-bearing boot stolen instead.',mortimer:'Witnessing the substitution and recognising that ordinary hotel theft no longer explains it.',holmes:'Inferring that the thief specifically requires Sir Henry’s scent.',watson:'Revising his understanding of the first theft in light of the exchanged boot.'}],
 ['The Hotel Register',{holmes:'Eliminating registered hotel guests as plausible authors of the warning and thefts.',watson:'Assisting with interviews that close several obvious London leads.','sir-henry':'Cooperating impatiently while the hotel produces no culprit.',mortimer:'Remaining with Sir Henry as Holmes tests the guest list.'}],
 ['The Barrymore Test',{holmes:'Sending a delivery test designed to place the bearded butler at the Hall.',watson:'Understanding that the telegram may eliminate or strengthen suspicion of Barrymore.'}],
 ['John Clayton’s Fare',{holmes:'Concealing his annoyance after learning the adversary borrowed his name.',watson:'Recognising that the cab passenger anticipated their attempt to trace him.',clayton:'Giving an honest account of the bearded fare who called himself Sherlock Holmes.'}],
 ['Cartwright Searches the Hotels',{holmes:'Assigning a practical paper search that may identify where the warning was assembled.',watson:'Watching Holmes turn discarded hotel newspapers into a testable lead.',cartwright:'Beginning a methodical search of wastepaper baskets for the mutilated Times page.'}],
 ['Watson Receives His Charge',{holmes:'Keeping his own intended movements secret while sending Watson as visible protection.',watson:'Accepting responsibility to guard Sir Henry and report every suspicious detail.','sir-henry':'Agreeing to Watson’s company but refusing to surrender his plan to claim the Hall.',mortimer:'Supporting the arrangement that returns the heir to Devon under protection.'}],
 ['Departure for Devon',{holmes:'Giving final instructions at the station while remaining outwardly committed to London.',watson:'Beginning the journey as Sir Henry’s companion, observer, and correspondent.','sir-henry':'Leaving for his inheritance despite the warning and unresolved surveillance.',mortimer:'Returning to Devon with the heir and Watson after bringing them together.'}],
 ['The Escaped Convict',{watson:'Learning that a violent fugitive adds a second, human danger to the moor.','sir-henry':'Approaching his estate with armed patrols already shaping the landscape.',mortimer:'Explaining Selden’s escape and the continuing search.',perkins:'Driving cautiously through the guarded district while relaying local news.'}],
 ['Arrival at Baskerville Hall',{watson:'Entering the sombre Hall and immediately studying its servants and atmosphere.','sir-henry':'Taking possession of his ancestral home with determination despite its gloom.',mortimer:'Delivering the heir safely before returning to his own household.',barrymore:'Receiving the new master formally while concealing the family crisis involving Selden.','mrs-barrymore':'Welcoming Sir Henry while grief and fear for her fugitive brother remain visible.'}],
 ['A Woman Sobs at Night',{watson:'Awake and alert, identifying a woman’s suppressed grief somewhere in the Hall.','mrs-barrymore':'Crying privately over Selden’s danger while trying not to expose the secret.'}],
 ['The Postmaster Contradicts the Telegram',{watson:'Discovering that Holmes’s telegram never proved Barrymore was personally at home.',postmaster:'Clarifying that the message was handed to Mrs Barrymore and only reported as delivered.'}],
 ['Stapleton on the Moor',{watson:'Meeting the naturalist while assessing his local knowledge and unusual eagerness.',stapleton:'Cultivating Watson’s trust through natural history and apparent openness.'}],
 ['The Mire Takes a Pony',{watson:'Watching the bog swallow a pony and hearing a cry he cannot explain.',stapleton:'Demonstrating expert knowledge of the mire while dismissing its cry as natural.'}],
 ['Beryl’s Mistaken Warning',{watson:'Startled by an urgent warning intended for Sir Henry and searching for its cause.',beryl:'Risking discovery to urge the man she mistakes for Sir Henry to leave the moor.'}],
 ['The Warning Retracted',{watson:'Recognising that Beryl’s public explanation does not match her earlier fear.',beryl:'Masking her attempted warning once Stapleton’s approach makes honesty dangerous.',stapleton:'Rejoining them while monitoring Beryl and maintaining the fiction that she is his sister.'}],
 ['Watson’s First Report',{watson:'Organising uncertain observations into a candid written report for Holmes.'}],
 ['Sir Henry Pursues Beryl',{watson:'Warning Sir Henry that the supposed sibling relationship makes the courtship dangerous.','sir-henry':'Increasingly resolved to court Beryl despite Stapleton’s ambiguous authority over her.'}],
 ['Frankland’s Legal Wars',{watson:'Listening politely while evaluating whether Frankland’s surveillance may become useful.',frankland:'Boasting about lawsuits and using his telescope to monitor roads beyond his estate.'}],
 ['A Dangerous Landscape',{watson:'Recognising that several plausible threats overlap while the unknown tor watcher remains unexplained.'}],
 ['The Moorland Rendezvous',{'sir-henry':'Declaring his feelings to Beryl during a private meeting on the moor.',beryl:'Responding under the pressure of affection, deception, and fear of her husband.',watson:'Keeping distant watch as promised while allowing Sir Henry some privacy.'}],
 ['Stapleton’s Jealous Fury',{'sir-henry':'Angry and confused when Stapleton violently interrupts his proposal.',beryl:'Caught between Sir Henry’s courtship and her husband’s possessive rage.',watson:'Intervening as witness and protector when the meeting turns hostile.',stapleton:'Losing control at the apparent courtship, then recovering enough to offer a strategic apology.'}],
 ['The Candle in the Window',{watson:'Catching Barrymore at the forbidden window and demanding the truth.','sir-henry':'Confronting his butler over the secret midnight signal.',barrymore:'Cornered while signalling food and safety to Selden across the moor.'}],
 ['The Signal Answered',{watson:'Locating the answering light and finally understanding the Barrymores’ secret.','sir-henry':'Choosing to hear the servants’ explanation before deciding their fate.',barrymore:'Admitting that the candle guides Selden to supplies.','mrs-barrymore':'Pleading for compassion toward her brother while the concealment collapses.',selden:'Answering the Hall’s candle from his refuge and waiting for aid.'}],
 ['The Convict Escapes',{watson:'Pursuing Selden over broken ground while hearing the hound-like cry nearby.','sir-henry':'Joining the dangerous chase despite Watson’s duty to keep him safe.',selden:'Outrunning his pursuers among familiar rocks and disappearing into the darkness.'}],
 ['The Figure on the Tor',{watson:'Seeing a poised human silhouette and realising another concealed actor is watching the moor.',holmes:'Observing Watson and the district from concealment without revealing his presence.'}],
 ['Mrs Barrymore Pleads for Selden',{watson:'Accepting the human explanation for the servants’ deception while weighing Selden’s danger.','sir-henry':'Showing mercy by allowing the planned escape rather than dismissing the Barrymores.',barrymore:'Explaining the limits of his assistance and promising that Selden will soon leave.','mrs-barrymore':'Appealing directly to Sir Henry to spare the brother she remembers from before his crimes.'}],
 ['The Burned Letter Fragment',{watson:'Receiving the first concrete evidence that Sir Charles had arranged a midnight meeting.','sir-henry':'Rewarding Barrymore’s honesty while learning the death involved an unknown correspondent.',barrymore:'Repaying Sir Henry’s mercy by disclosing the surviving fragment signed L.L.'}],
 ['L.L. Is Identified',{watson:'Redirecting the investigation toward Laura Lyons in Coombe Tracey.','sir-henry':'Learning that a local woman may explain why Sir Charles waited at the gate.',mortimer:'Identifying L.L. from local knowledge and describing Laura’s estrangement from Frankland.'}],
 ['Food for the Unknown Man',{watson:'Preparing to hunt the separate moorland stranger described by Barrymore.',barrymore:'Reporting the boy and food deliveries he has observed beyond Selden’s refuge.'}],
 ['Laura Lyons Explains the Appointment',{watson:'Pressing Laura past denial until she admits the letter and unexplained cancellation.',laura:'Defending her reputation while revealing that she wrote to Sir Charles but never met him.'}],
 ['Frankland Spots the Messenger',{watson:'Using Frankland’s discovery without revealing the true purpose of the messenger.',frankland:'Delighted that his telescope has found the boy the authorities failed to notice.',cartwright:'Crossing the moor with Holmes’s supplies, unaware that Watson and Frankland are watching.'}],
 ['Watson Tracks the Boy',{watson:'Following Cartwright to the stone hut and entering with his revolver ready.',cartwright:'Completing a supply run to Holmes’s concealed base before leaving the hut.'}],
 ['Holmes Steps from the Shadows',{holmes:'Revealing his hidden operation and evaluating the evidence Watson has gathered.',watson:'Relieved, offended, and proud as the mysterious watcher proves to be Holmes.',cartwright:'Maintaining Holmes’s field base and supply line while the partners reunite.'}],
 ['Holmes Names the Enemy',{holmes:'Sharing his conclusion that Stapleton is the adversary and Beryl his coerced wife.',watson:'Reframing the warnings, courtship, and jealousy around the concealed marriage.'}],
 ['A Cry on the Moor',{holmes:'Running toward the scream with the fear that the planned victim has already been attacked.',watson:'Racing beside Holmes through darkness toward a falling man’s final cry.'}],
 ['Selden’s Body',{holmes:'Identifying the dead man and immediately connecting the mistaken scent to Sir Henry’s clothes.',watson:'Confirming Selden’s identity and understanding how the borrowed suit redirected the hound.',selden:'Dead below the rocks after fleeing the hound in Sir Henry’s scent-bearing clothes.'}],
 ['Stapleton Arrives',{holmes:'Testing Stapleton’s reaction while hiding how much the investigation now knows.',watson:'Watching for disappointment when Stapleton discovers the victim is Selden.',selden:'Lying dead as the investigators temporarily conceal the body’s meaning.',stapleton:'Masking shock that the hound killed the wrong man and inventing a natural explanation for the cry.'}],
 ['Holmes Studies Hugo’s Portrait',{holmes:'Isolating the facial features that expose Stapleton as a Baskerville descendant.',watson:'Seeing the resemblance emerge and grasping the inheritance motive.','sir-henry':'Providing access to the family gallery without yet knowing the full conclusion.'}],
 ['The Net Is Set',{holmes:'Designing a controlled risk that will force Stapleton to deploy the hound before witnesses.',watson:'Accepting the dangerous plan while preparing to support Sir Henry from concealment.','sir-henry':'Agreeing to dine at Merripit and walk home alone despite incomplete knowledge of the trap.'}],
 ['Lestrade Arrives',{holmes:'Adding an armed official witness to the final operation.',watson:'Receiving Lestrade as the practical reinforcement Holmes requested.',lestrade:'Arriving from London ready to follow Holmes into an unusual rural arrest.'}],
 ['Sir Henry Goes to Merripit',{'sir-henry':'Entering Stapleton’s house alone and maintaining the dinner engagement as instructed.',stapleton:'Hosting his intended victim while preparing the hound for the walk home.'}],
 ['Watching Merripit House',{holmes:'Directing the stakeout and waiting for Stapleton to expose the method.',watson:'Crawling close enough to observe the dinner and report when Sir Henry departs.',lestrade:'Holding position with Holmes as an armed witness.','sir-henry':'Finishing dinner without seeing the investigators outside.',stapleton:'Maintaining cordial conversation while anticipating the attack he has arranged.'}],
 ['Fog Covers the Path',{holmes:'Moving the party back from the advancing fog so the hound can still be intercepted.',watson:'Watching visibility collapse and fearing the trap will isolate Sir Henry.',lestrade:'Following Holmes to clearer ground while keeping his weapon ready.'}],
 ['The Hound Attacks',{holmes:'Firing repeatedly until the charging hound falls before it can kill Sir Henry.',watson:'Running to Sir Henry and confronting the animal behind the legend.',lestrade:'Witnessing the luminous hound and supporting the armed response.','sir-henry':'Collapsed and shaken after facing the apparent family demon at close range.'}],
 ['Beryl Is Rescued',{holmes:'Freeing Beryl and asking for the route Stapleton would use through the mire.',watson:'Helping stabilise Sir Henry while confronting the violence inside Merripit House.',lestrade:'Securing the house and receiving evidence of Stapleton’s coercion.',beryl:'Bound, injured, and finally able to direct the investigators toward her husband.','sir-henry':'Alive but physically and psychologically exhausted by the attack.'}],
 ['The Mire Is Searched',{holmes:'Following Beryl’s directions and inferring Stapleton’s death from the broken trail and recovered boot.',watson:'Crossing the marked path and documenting the remnants of the conspiracy.',lestrade:'Participating in the official search despite the mire’s continuing danger.',beryl:'Guiding the party along the only safe route toward the island kennel.'}],
 ['Roger Baskerville’s Identity',{holmes:'Explaining how genealogy, resemblance, and aliases establish Stapleton’s place in the succession.',watson:'Listening as the hidden inheritance motive is reconstructed from the beginning.'}],
 ['The Women Were Manipulated',{holmes:'Distinguishing Beryl’s coerced warning from Laura’s deceived participation.',watson:'Understanding how Stapleton exploited both women while revealing different fragments of his plan.'}],
 ['The Hound Was Made Supernatural',{stapleton:'Keeping, training, and painting the hound so inherited terror can conceal a physical murder weapon.'}],
 ['The Complete Design',{holmes:'Connecting every apparently stray clue into one continuous conspiracy.',watson:'Reviewing the solution as warning, disguise, scent, hound, and mistaken victim finally align.'}],
 ['The Case Closes',{holmes:'Closing the file with Stapleton presumed dead and turning toward ordinary London life.',watson:'Ending the record with Sir Henry recovering and the case’s uncertainties reduced to Stapleton’s unrecovered body.'}],
]
const eventStates = new Map(eventStateRows.map(([title,states])=>[title,states]))
const characterSnapshots=[]
for(const ev of events){
  ev.involvedCharacterIds.forEach((cid,i)=>{
    const slug=cid.replace(`${P}-char-`,'')
    const statusNotes=eventStates.get(ev.title)?.[slug]
    if(!statusNotes) throw new Error(`Missing event-specific status for ${slug} in “${ev.title}”`)
    let isAlive=true
    if(cid===charId('sir-charles') && ev.title==='Sir Charles Dies') isAlive=false
    if(cid===charId('selden') && ev.title==='Selden’s Body') isAlive=false
    if(cid===charId('hugo') && ev.title==='The Legend of Hugo Baskerville') isAlive=false
    characterSnapshots.push({ ...base, id:id('snapshot',`${ev.id.split('-').at(-1)}-${slug}`), characterId:cid, eventId:ev.id, isAlive,
      currentLocationMarkerId:ev.locationMarkerId, currentMapLayerId:ev.locationMarkerId?locById.get(ev.locationMarkerId).mapLayerId:null,
      inventoryItemIds:[], inventoryNotes:'', travelModeId:null, sortKey:events.indexOf(ev)*10+i,
      statusNotes })
  })
}

const itemPlacements=[]
for(const ev of events){
  ev.involvedItemIds.forEach((iid,i)=>itemPlacements.push({ ...base,id:id('placement',`${ev.id.split('-').at(-1)}-${i+1}`),itemId:iid,eventId:ev.id,locationMarkerId:ev.locationMarkerId,sortKey:events.indexOf(ev)*10+i,notes:`Present during “${ev.title}”.` }))
}

const relationshipSpecs = [
 ['holmes','watson','Detective partners','strong','positive','Watson’s loyalty and fieldwork complement Holmes’s deduction and secrecy.'],
 ['holmes','sir-henry','Investigator and client','strong','positive','Holmes protects Sir Henry while using him as the necessary centre of the trap.'],
 ['watson','sir-henry','Protector and friend','strong','positive','Watson accompanies Sir Henry and repeatedly shares his danger.'],
 ['sir-henry','beryl','Courtship under threat','strong','positive','Their attraction becomes dangerous because Stapleton presents Beryl as his sister.'],
 ['stapleton','beryl','Coercive marriage','strong','negative','Stapleton controls, threatens, and binds his wife when she resists the murders.'],
 ['stapleton','sir-henry','Hidden rival heirs','strong','negative','Stapleton must kill Sir Henry to clear his path to the Baskerville estate.'],
 ['stapleton','sir-charles','Murderer and victim','strong','negative','Stapleton uses the legend and hound to frighten Sir Charles to death.'],
 ['stapleton','laura','Deceptive courtship','strong','negative','Stapleton promises marriage and manipulates Laura into writing the fatal letter.'],
 ['barrymore','mrs-barrymore','Married allies','strong','positive','They jointly protect Selden and endure suspicion together.'],
 ['mrs-barrymore','selden','Siblings','strong','positive','Mrs Barrymore risks her home to feed and equip her fugitive brother.'],
 ['mortimer','sir-charles','Physician and friend','strong','positive','Mortimer knows Sir Charles’s fears and guards the evidence others dismiss.'],
 ['mortimer','sir-henry','Adviser and heir','medium','positive','Mortimer brings Sir Henry into the case and hopes he will restore the estate.'],
 ['frankland','laura','Estranged father and daughter','weak','negative','Frankland’s refusal to support Laura leaves her financially vulnerable.'],
 ['holmes','stapleton','Detective and adversary','strong','negative','Each hides his movements while testing the other’s knowledge.'],
 ['hugo','yeoman-daughter','Captor and captive','strong','negative','Hugo’s violence begins the legend later exploited by Stapleton.'],
]
const relationships=relationshipSpecs.map(([a,b,label,strength,sentiment,description],i)=>({ ...base,id:id('relationship',String(i+1)),characterAId:charId(a),characterBId:charId(b),label,strength,sentiment,description,isBidirectional:true,startEventId:null }))

const loreCategories = [
 ['case','The Baskerville Case','#5c7080'],['family','Baskerville History','#8b5b4d'],['moor','Dartmoor','#697358'],['method','Detection and Evidence','#6f6b80'],['sources','Sources and Editorial Notes','#8b7355'],
].map(([slug,name,color],i)=>({id:id('lore-category',slug),worldId,name,color,sortOrder:i+1}))
const lorePageSpecs = [
 ['family','The Baskerville Legend','A manuscript dated 1742 recounts Hugo Baskerville’s death beside a spectral hound. Whether or not the legend began in fact, Stapleton turns inherited fear into a murder weapon.'],
 ['family','The Line of Succession','Sir Charles’s death brings Sir Henry from Canada. Stapleton is secretly the son of Roger Baskerville, a younger brother of Sir Charles, and therefore has a financial motive to remove the remaining heir.'],
 ['moor','The Great Grimpen Mire','The mire appears open but contains lethal bogs and only narrow islands of firm ground. Stapleton’s marked path gives him a private refuge, kennel, and escape route.'],
 ['moor','The Fictional Baskerville Country','Baskerville Hall, Merripit House, Lafter Hall, and Grimpen are fictional. Their positions on the Dartmoor map are an editorial reconstruction of the novel’s relative directions, not claims about real sites.'],
 ['case','Sir Charles’s Death','Stapleton arranges Laura’s letter, releases the hound when Sir Charles waits at the gate, and relies on terror and heart disease to leave no conventional wound.'],
 ['case','The Attempt on Sir Henry','Stapleton first steals a worn boot for scent, later releases the hound as Sir Henry walks from Merripit House, and loses control of the plan when Holmes shoots the animal.'],
 ['method','Holmes’s Hidden Investigation','Holmes remains on Dartmoor in a stone hut, using Cartwright for supplies. The concealment lets him study Stapleton without alerting the suspect, though it also keeps Watson and the reader partially uninformed.'],
 ['method','The Material Hound','The “demon” is a large dog trained as a weapon. Phosphorus creates the fiery appearance; stolen clothing provides scent; the moor and family story amplify fear.'],
 ['method','Documents as Evidence','The case is carried through a manuscript, newspaper account, warning note, telegram, Watson’s reports, diary extracts, and the burned L.L. letter. Each document has a different author and degree of reliability.'],
 ['sources','Text Source','Chapter order and factual checking follow the public-domain Project Gutenberg edition of The Hound of the Baskervilles (ebook 2852). Summaries here are newly written and do not reproduce the novel’s prose.'],
 ['sources','Sidney Paget Illustrations','Character and item images link to Sidney Paget’s original Strand and early book illustrations held on Wikimedia Commons. Individual files retain the licensing information on their Commons pages.'],
 ['sources','Map Sources','The Britain locator, 1890 London map, historical Ordnance Survey Dartmoor drawing, and period house plan are linked from Wikimedia Commons. The house plan provides navigable editorial space rather than a canonical Baskerville Hall blueprint.'],
]
const lorePages=lorePageSpecs.map(([cat,title,body],i)=>({ ...base,id:id('lore',String(i+1)),categoryId:id('lore-category',cat),title,body,tags:[],coverImageId:null,linkedEntityIds:[],visibleFromEventId:null }))

const factions = [
 ['investigators','The Investigators','#526f80','Holmes, Watson, Lestrade, Mortimer, and their practical assistants.'],
 ['baskervilles','The Baskerville Family','#8a5e4d','The old landed family whose inheritance and legend motivate the case.'],
 ['merripit','The Merripit Household','#68764f','Stapleton’s false domestic arrangement with Beryl and the hidden hound.'],
 ['hall','Baskerville Hall Household','#706670','Sir Henry and the Barrymores within the ancestral estate.'],
 ['law','Law and Custody','#596b75','Police, prison guards, and the legal structures surrounding Selden and Frankland.'],
].map(([slug,name,color,description])=>({ ...base,id:id('faction',slug),name,description,color,coverImageId:null,tags:[] }))
const membershipSpecs=[
 ['investigators','holmes','Lead detective'],['investigators','watson','Field investigator'],['investigators','mortimer','Client and medical witness'],['investigators','lestrade','Police support'],['investigators','cartwright','Courier and scout'],
 ['baskervilles','sir-charles','Late baronet'],['baskervilles','sir-henry','Heir and baronet'],['baskervilles','hugo','Ancestor'],['baskervilles','stapleton','Concealed heir'],
 ['merripit','stapleton','Master of the conspiracy'],['merripit','beryl','Coerced wife'],['hall','sir-henry','Master'],['hall','barrymore','Butler'],['hall','mrs-barrymore','Housekeeper'],
 ['law','lestrade','Inspector'],['law','selden','Fugitive'],['law','frankland','Litigant'],
]
const factionMemberships=membershipSpecs.map(([f,c,role],i)=>({ ...base,id:id('membership',String(i+1)),factionId:id('faction',f),characterId:charId(c),role,startEventId:null,endEventId:null,notes:'' }))
const factionRelationships=[
 ['investigators','merripit','hostile','The investigators work to expose and stop Stapleton’s conspiracy.'],
 ['hall','merripit','hostile','Merripit’s hospitality conceals a plan against the Hall’s master.'],
 ['investigators','hall','allied','The investigation exists to protect Sir Henry and clarify Sir Charles’s death.'],
 ['law','hall','neutral','The prison search and Frankland’s lawsuits complicate, but do not define, the household mystery.'],
].map(([a,b,stance,notes],i)=>({ ...base,id:id('faction-rel',String(i+1)),factionAId:id('faction',a),factionBId:id('faction',b),stance,notes }))

const findEvent = title => events.find(e=>e.title===title).id
const facts = [
 ['tracks','A gigantic hound left tracks near Sir Charles','Mortimer privately observed animal footprints omitted from the inquest.','Sir Charles Dies'],
 ['warning','The warning was assembled from the Times','The anonymous London warning used printed words and a handwritten “moor.”','The Cut-Paper Warning'],
 ['scent','The thief wanted a worn boot','The exchange of a new boot for an old one shows that scent, not footwear, is the object.','The Boots Are Exchanged'],
 ['barrymore-innocent','Barrymore’s secret concerns Selden','The candle and deception protect Mrs Barrymore’s fugitive brother rather than a murderer of Baskervilles.','The Signal Answered'],
 ['ll','Laura Lyons wrote the appointment letter','The initials L.L. belong to Laura, who asked Sir Charles to meet her at the gate.','Laura Lyons Explains the Appointment'],
 ['hidden-holmes','Holmes is the man on the tor','Holmes has secretly conducted a parallel investigation from a stone hut.','Holmes Steps from the Shadows'],
 ['wife','Beryl is Stapleton’s wife','The supposed siblings are married; the deception makes Sir Henry’s courtship useful to Stapleton.','Holmes Names the Enemy'],
 ['selden-scent','Selden died because he wore Sir Henry’s clothes','The hound follows Sir Henry’s scent on the suit and drives Selden over the cliff.','Selden’s Body'],
 ['heir','Stapleton is a Baskerville heir','The Hugo portrait reveals a family resemblance later confirmed by records.','Holmes Studies Hugo’s Portrait'],
 ['hound-material','The hound is a trained dog painted with phosphorus','The supernatural appearance is manufactured from an animal, scent training, and a luminous chemical.','The Hound Attacks'],
 ['stapleton-fate','Stapleton likely died in the mire','His old boot is recovered beyond the marked path, but his body is not found.','The Mire Is Searched'],
]
const knowledgeFacts=facts.map(([slug,title,description,eventTitle])=>({ ...base,id:id('fact',slug),title,description,tags:[],readerLearnsAtEventId:findEvent(eventTitle),originEventId:findEvent(eventTitle) }))
const reveals=[]
function reveal(fact,character,eventTitle,note){reveals.push({ ...base,id:id('reveal',String(reveals.length+1)),factId:id('fact',fact),characterId:charId(character),eventId:findEvent(eventTitle),note })}
reveal('tracks','holmes','Sir Charles Dies','Mortimer’s account gives Holmes the suppressed physical clue.')
reveal('tracks','watson','Sir Charles Dies','Watson hears Mortimer’s suppressed physical clue.')
reveal('warning','holmes','The Cut-Paper Warning','Holmes identifies the newspaper type and disguised handwriting.')
reveal('scent','holmes','The Boots Are Exchanged','Holmes recognises that a worn object has greater evidentiary value to the thief.')
reveal('barrymore-innocent','watson','The Signal Answered','The Barrymores disclose the meaning of their light.')
reveal('barrymore-innocent','sir-henry','The Signal Answered','Sir Henry learns why his servants deceived him.')
reveal('ll','watson','Laura Lyons Explains the Appointment','Laura confirms the appointment and that she was induced not to attend.')
reveal('hidden-holmes','watson','Holmes Steps from the Shadows','Watson discovers the watcher’s identity.')
reveal('wife','watson','Holmes Names the Enemy','Holmes supplies the decisive correction to the Stapletons’ public identity.')
reveal('selden-scent','holmes','Selden’s Body','The exchanged clothing explains the hound’s mistaken pursuit.')
reveal('selden-scent','watson','Selden’s Body','Watson connects Selden’s borrowed clothes to Sir Henry’s scent.')
reveal('heir','holmes','Holmes Studies Hugo’s Portrait','The family face supplies Holmes with Stapleton’s motive and ancestry.')
reveal('heir','watson','Holmes Studies Hugo’s Portrait','Watson sees the resemblance when Holmes masks the portrait’s hair and hat.')
reveal('hound-material','holmes','The Hound Attacks','The dead animal and chemical residue confirm the material mechanism.')
reveal('hound-material','watson','The Hound Attacks','Watson witnesses and examines the real hound.')
reveal('hound-material','lestrade','The Hound Attacks','Lestrade witnesses the attack and its physical explanation.')
reveal('hound-material','sir-henry','The Hound Attacks','Sir Henry directly confronts the weapon behind the curse.')
reveal('stapleton-fate','holmes','The Mire Is Searched','The recovered boot and broken trail support the inference that Stapleton sank.')
reveal('stapleton-fate','watson','The Mire Is Searched','Watson shares the final search and inference.')
reveal('stapleton-fate','beryl','The Mire Is Searched','Beryl guides the search along the only safe route.')

const characterGoals=[
 ['holmes','The New Heir','The Case Closes','want','Expose the mechanism and protect Sir Henry without alerting the adversary.'],
 ['watson','Watson Receives His Charge','The Hound Attacks','want','Protect Sir Henry and supply Holmes with accurate observations.'],
 ['sir-henry','Sir Henry Arrives','The Case Closes','want','Claim his inheritance and build a future at Baskerville Hall.'],
 ['sir-henry','The Cut-Paper Warning','The Hound Attacks','fear','Refuse to be ruled by the family curse while surviving its apparent return.'],
 ['stapleton','Sir Charles Waits at the Gate','The Hound Attacks','want','Remove Sir Charles and Sir Henry so he can claim the Baskerville fortune.'],
 ['stapleton','The Bearded Watcher','The Mire Is Searched','fear','Keep his identity, marriage, hound, and island refuge undiscovered.'],
 ['beryl','The Cut-Paper Warning','Beryl Is Rescued','want','Prevent Sir Henry’s murder without provoking Stapleton’s violence.'],
 ['barrymore','A Woman Sobs at Night','Mrs Barrymore Pleads for Selden','want','Help Selden escape without destroying the Barrymores’ position.'],
 ['laura','Laura Lyons Explains the Appointment','The Women Were Manipulated','want','Secure independence from her father and understand Stapleton’s deception.'],
 ['selden','The Escaped Convict','Selden’s Body','want','Reach safety and flee the country.'],
].map(([c,start,end,type,text],i)=>({ ...base,id:id('goal',String(i+1)),characterId:charId(c),startEventId:findEvent(start),endEventId:findEvent(end),type,text }))

const mapRoutes=[
 { ...base,id:id('route','london-pursuit'),mapLayerId:mapId('london'),name:'The London Pursuit',routeType:'carriage',waypoints:[locId('northumberland'),locId('charing-cross'),locId('baker-street')],color:'#66798c',notes:'The failed pursuit of Stapleton’s cab and the return to Baker Street.' },
 { ...base,id:id('route','watson-moor'),mapLayerId:mapId('dartmoor'),name:'Watson’s Moor Investigation',routeType:'foot',waypoints:[locId('hall-portal'),locId('merripit'),locId('grimpen'),locId('frankland'),locId('stone-hut'),locId('tor')],color:'#8b7355',notes:'Watson’s expanding investigation across the fictional Baskerville district.' },
 { ...base,id:id('route','hound'),mapLayerId:mapId('dartmoor'),name:'The Hound’s Scent Trails',routeType:'foot',waypoints:[locId('hound-kennel'),locId('merripit'),locId('selden-refuge'),locId('merripit')],color:'#7b443e',notes:'Editorially combines the pursuit of Selden and the final attack on Sir Henry.' },
]

const data={
 version:16,type:'worldbreaker-export',exportedAt:now,
 world:{id:worldId,name:'The Hound of the Baskervilles',description:'Sherlock Holmes and Dr Watson investigate the death of Sir Charles Baskerville and the threat against his heir, moving from London evidence to a Dartmoor landscape shaped by inheritance, coercion, concealed identities, and a legendary hound.',coverImageId:id('image','cover'),theme:'theme-noir',readingMode:true,createdAt:now,updatedAt:now,continuityStaleThreshold:5,calendar:{startYear:1889,yearSuffix:' (editorial reconstruction)',months},wordTarget:null},
 mapLayers,locationMarkers,characters,items,characterSnapshots,characterMovements:[],itemPlacements,locationSnapshots:[],itemSnapshots:[],relationships,relationshipSnapshots:[],
 timelines:[{id:timelineId,worldId,name:'The Hound of the Baskervilles — Master Chronology',description:'A single reading-order timeline. Retrospective testimony is flagged as flashback material and pinned to its reconstructed date.',color:'#5c7080',dayOffset:0,createdAt:now}],chapters,events,blobs,travelModes:[],timelineRelationships:[],crossTimelineArtifacts:[],mapRoutes,mapRegions:[],mapRegionSnapshots:[],mapAnnotations:[],
 loreCategories,lorePages,factions,factionMemberships,factionRelationships,knowledgeFacts,knowledgeReveals:reveals,characterGoals,sceneTexts:[],plotThreads,motifs,continuitySuppressions:[],writingLogs:[],sceneRevisions:[]
}

// Structural validation before writing either copy.
const ids = new Map()
for(const [key,value] of Object.entries(data)) if(Array.isArray(value)) for(const row of value) if(row.id){ if(ids.has(row.id)) throw new Error(`Duplicate id ${row.id}`); ids.set(row.id,key) }
const assertRef=(value,collection,label)=>{ if(value!=null && !new Set(collection.map(x=>x.id)).has(value)) throw new Error(`${label}: missing ${value}`) }
events.forEach(e=>{assertRef(e.chapterId,chapters,`${e.id}.chapterId`);assertRef(e.locationMarkerId,locationMarkers,`${e.id}.location`);e.involvedCharacterIds.forEach(v=>assertRef(v,characters,`${e.id}.character`));e.involvedItemIds.forEach(v=>assertRef(v,items,`${e.id}.item`));e.threadIds.forEach(v=>assertRef(v,plotThreads,`${e.id}.thread`));e.motifIds.forEach(v=>assertRef(v,motifs,`${e.id}.motif`));if(e.tension<1||e.tension>5)throw new Error(`${e.id}: tension`)})
characterSnapshots.forEach(s=>{assertRef(s.characterId,characters,`${s.id}.character`);assertRef(s.eventId,events,`${s.id}.event`);assertRef(s.currentLocationMarkerId,locationMarkers,`${s.id}.location`)})
if(chapters.length!==15 || new Set(events.map(e=>e.chapterId)).size!==15) throw new Error('Every chapter must contain events')
if(characterSnapshots.some(s=>!events.find(e=>e.id===s.eventId).involvedCharacterIds.includes(s.characterId))) throw new Error('Snapshot for absent character')
if(new Set(characterSnapshots.map(s=>s.statusNotes)).size!==characterSnapshots.length) throw new Error('Character statuses must be event-specific, not reused')

const text=JSON.stringify(data,null,2)+'\n'
fs.writeFileSync('example/The Hound of the Baskervilles.pwk',text)
fs.writeFileSync('public/library/the-hound-of-the-baskervilles.pwk',text)
console.log(JSON.stringify({chapters:chapters.length,events:events.length,characters:characters.length,locations:locationMarkers.length,maps:mapLayers.length,snapshots:characterSnapshots.length,items:items.length},null,2))
